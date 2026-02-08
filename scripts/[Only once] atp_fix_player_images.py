#!/usr/bin/env python3
"""
Audit and repair ATP player images in local data/atp folders.

- Detects missing/broken local image files
- Uses ATP ranking pages to map player -> official image URL
- Replaces local image and updates profile.json image_url
"""

from __future__ import annotations

import argparse
import io
import importlib.util
import json
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

try:
    from PIL import Image
except Exception:
    Image = None

DEFAULT_DATA_DIR = "data/atp"
DEFAULT_MAX_PLAYERS = 200
DEFAULT_TIMEOUT = 45
DEFAULT_LIMIT_FOLDERS = 0
DEFAULT_REFRESH_EXISTING = False
DEFAULT_DRY_RUN = False
DEFAULT_WIKI_DELAY = 0.6
SCRAPER_FILE = "[Only once] atp_scrape_atptour.py"
IMAGE_NAME_PREFIX = "image"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_UA = "TennisDashboardBot/1.0 (contact: local-tennis-dashboard)"


@dataclass
class LocalPlayerFolder:
    folder: Path
    profile_path: Path
    profile: Dict[str, Any]
    player_id: str
    name: str


def _load_scraper_module(script_dir: Path):
    scraper_path = script_dir / SCRAPER_FILE
    if not scraper_path.exists():
        raise FileNotFoundError(f"Missing required scraper file: {scraper_path}")

    spec = importlib.util.spec_from_file_location("atp_scrape_once", scraper_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Could not load module from: {scraper_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, "fetch_ranked_players"):
        raise RuntimeError("Scraper module missing function: fetch_ranked_players")

    return module


def _get_session(user_agent: str) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": user_agent,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        }
    )
    return session


def _read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _extract_player_id(profile: Dict[str, Any]) -> str:
    # Prefer explicit id if present.
    pid = str(profile.get("player_id") or "").strip().upper()
    if pid:
        return pid

    url = str(profile.get("url") or "").strip()
    match = re.search(r"/players/[^/]+/([A-Za-z0-9]+)/", url, flags=re.IGNORECASE)
    if not match:
        return ""
    return match.group(1).upper()


def _scan_local_player_folders(data_dir: Path) -> List[LocalPlayerFolder]:
    folders: List[LocalPlayerFolder] = []
    for profile_path in sorted(data_dir.glob("*/profile.json")):
        try:
            profile = _read_json(profile_path)
        except Exception as exc:
            print(f"[WARN] Could not read JSON: {profile_path} ({exc})")
            continue

        player_id = _extract_player_id(profile)
        if not player_id:
            print(f"[WARN] Missing player id in: {profile_path}")
            continue

        folders.append(
            LocalPlayerFolder(
                folder=profile_path.parent,
                profile_path=profile_path,
                profile=profile,
                player_id=player_id,
                name=(profile.get("name") or profile_path.parent.name).strip(),
            )
        )
    return folders


def _get_local_image_files(folder: Path) -> List[Path]:
    files: List[Path] = []
    for file in folder.iterdir():
        if not file.is_file():
            continue
        if file.stem != IMAGE_NAME_PREFIX:
            continue
        if file.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        files.append(file)
    return sorted(files)


def _validate_local_image(path: Path) -> bool:
    if not path.exists() or path.stat().st_size == 0:
        return False
    if Image is None:
        return True
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            img.load()
        return True
    except Exception:
        return False


def _validate_image_url(session: requests.Session, url: str, timeout: int) -> bool:
    if not url:
        return False
    try:
        with session.get(url, timeout=timeout, stream=True, allow_redirects=True) as resp:
            if resp.status_code != 200:
                return False
            content_type = (resp.headers.get("Content-Type") or "").lower()
            if "image" not in content_type:
                return False
            first_chunk = next(resp.iter_content(1024), b"")
            return bool(first_chunk)
    except Exception:
        return False


def _remove_other_image_files(folder: Path, keep: Path) -> None:
    for file in _get_local_image_files(folder):
        if file.resolve() == keep.resolve():
            continue
        file.unlink(missing_ok=True)


def _save_image_bytes(folder: Path, raw: bytes, content_type: str) -> Optional[Path]:
    if not raw:
        return None

    if Image is not None:
        try:
            with Image.open(io.BytesIO(raw)) as img:
                img.load()
                if (img.format or "").upper() == "WEBP":
                    out_path = folder / "image.jpg"
                    img.convert("RGB").save(out_path, format="JPEG", quality=92)
                    _remove_other_image_files(folder, out_path)
                    return out_path

                ext_map = {"JPEG": ".jpg", "JPG": ".jpg", "PNG": ".png"}
                ext = ext_map.get((img.format or "").upper(), ".jpg")
                out_path = folder / f"image{ext}"
                out_path.write_bytes(raw)
                _remove_other_image_files(folder, out_path)
                return out_path
        except Exception:
            pass

    ct = (content_type or "").lower()
    ext = ".jpg"
    if "png" in ct:
        ext = ".png"
    elif "webp" in ct:
        ext = ".webp"
    out_path = folder / f"image{ext}"
    out_path.write_bytes(raw)
    _remove_other_image_files(folder, out_path)
    return out_path


def _download_and_store_image(
    session: requests.Session, url: str, folder: Path, timeout: int
) -> Optional[Path]:
    max_attempts = 6
    for attempt in range(1, max_attempts + 1):
        try:
            resp = session.get(url, timeout=timeout, allow_redirects=True)
            if resp.status_code in {429, 500, 502, 503, 504}:
                retry_after_raw = (resp.headers.get("Retry-After") or "").strip()
                retry_after = 0.0
                try:
                    retry_after = float(retry_after_raw)
                except Exception:
                    retry_after = 0.0
                wait_seconds = retry_after if retry_after > 0 else min(30.0, 1.5 * (2 ** (attempt - 1)))
                time.sleep(wait_seconds)
                raise requests.HTTPError(f"temporary image download error {resp.status_code}")
            if resp.status_code != 200:
                return None
            content_type = resp.headers.get("Content-Type", "")
            if "image" not in content_type.lower():
                return None
            saved = _save_image_bytes(folder, resp.content, content_type)
            if saved is not None:
                return saved
        except requests.RequestException:
            if attempt >= max_attempts:
                return None
            continue
    return None


def _format_name(name: str, fallback: str) -> str:
    return name.strip() if name and name.strip() else fallback


def _fetch_wikipedia_image_url(name: str, timeout: int, cache: Dict[str, str]) -> str:
    key = (name or "").strip().lower()
    if not key:
        return ""
    if key in cache:
        return cache[key]

    headers = {"User-Agent": WIKIPEDIA_UA, "Accept": "application/json,text/plain,*/*"}
    search_variants = [f"{name} tennis player", f"{name} tennis"]
    name_tokens = [token for token in key.split() if token]
    best_url = ""
    best_score = -999

    for search_query in search_variants:
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": search_query,
            "gsrlimit": "8",
            "prop": "pageimages|info",
            "inprop": "url",
            "piprop": "thumbnail",
            "pithumbsize": "720",
        }
        try:
            url = f"{WIKIPEDIA_API}?{urllib.parse.urlencode(params)}"
            resp = requests.get(url, timeout=timeout, headers=headers)
            if resp.status_code != 200:
                continue
            payload = resp.json()
        except Exception:
            continue

        pages = payload.get("query", {}).get("pages", {})
        if not isinstance(pages, dict) or not pages:
            continue
        for page in pages.values():
            if not isinstance(page, dict):
                continue
            thumb = str((page.get("thumbnail") or {}).get("source") or "").strip()
            if not thumb:
                continue
            title = str(page.get("title") or "").lower()
            score = 0
            for token in name_tokens:
                if token in title:
                    score += 1
            if re.search(r"\b\d{4}\b", title):
                score -= 2
            if "season" in title:
                score -= 2
            if score > best_score:
                best_score = score
                best_url = thumb

    cache[key] = best_url
    return best_url


def _to_wikimedia_file_path_url(url: str) -> str:
    text = str(url or "").strip()
    if not text:
        return ""
    match = re.search(r"/wikipedia/commons/thumb/.+?/([^/]+)/\d+px-", text, flags=re.IGNORECASE)
    if not match:
        return text
    original_file = match.group(1)
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{original_file}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Audit ATP player folder images, detect missing/broken files/URLs, "
            "and backfill from ATP ranking pages."
        )
    )
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Local ATP data folder")
    parser.add_argument("--max-players", type=int, default=DEFAULT_MAX_PLAYERS, help="Max ranked players to fetch")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout in seconds")
    parser.add_argument(
        "--wiki-delay",
        type=float,
        default=DEFAULT_WIKI_DELAY,
        help="Delay between Wikipedia image requests in seconds",
    )
    parser.add_argument(
        "--limit-folders",
        type=int,
        default=DEFAULT_LIMIT_FOLDERS,
        help="Process only first N local folders (0 means all)",
    )
    parser.set_defaults(
        refresh_existing=DEFAULT_REFRESH_EXISTING,
        dry_run=DEFAULT_DRY_RUN,
    )
    parser.add_argument(
        "--refresh-existing",
        dest="refresh_existing",
        action="store_true",
        help="Redownload image file even if local file already looks valid",
    )
    parser.add_argument(
        "--no-refresh-existing",
        dest="refresh_existing",
        action="store_false",
        help="Keep existing valid local images and only fill missing/broken ones",
    )
    parser.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        help="Print actions without writing files",
    )
    parser.add_argument(
        "--no-dry-run",
        dest="dry_run",
        action="store_false",
        help="Apply changes (write files)",
    )
    args, unknown_args = parser.parse_known_args()
    if unknown_args:
        print(f"[WARN] Ignoring unknown args: {' '.join(unknown_args)}")

    if len(sys.argv) == 1:
        print(
            "[INFO] Running with defaults: "
            f"data_dir={args.data_dir}, max_players={args.max_players}, "
            f"timeout={args.timeout}, limit_folders={args.limit_folders}, "
            f"dry_run={args.dry_run}, refresh_existing={args.refresh_existing}"
        )

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"[ERROR] data directory not found: {data_dir}")
        return 1

    script_dir = Path(__file__).resolve().parent
    try:
        scraper = _load_scraper_module(script_dir)
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return 1

    user_agent = getattr(scraper, "USER_AGENT", "Mozilla/5.0")
    session = _get_session(user_agent)

    local_folders = _scan_local_player_folders(data_dir)
    if not local_folders:
        print("[ERROR] No local player folders with profile.json found.")
        return 1
    if args.limit_folders > 0:
        local_folders = local_folders[: args.limit_folders]

    ranked_rows: List[Dict[str, Any]] = []
    try:
        ranked_rows = scraper.fetch_ranked_players(
            limit=args.max_players,
            session=session,
            timeout=args.timeout,
        )
    except Exception as exc:
        print(f"[WARN] Rankings fetch failed: {exc}")
        print("[WARN] Continuing with player-id fallback image URLs.")

    ranked_map = {str(row.get("player_id") or "").upper(): row for row in ranked_rows}
    if not ranked_map:
        print("[WARN] No ranked rows available; using local folders + player-id fallback only.")

    stats = {
        "processed": 0,
        "skipped": 0,
        "updated_profile_only": 0,
        "downloaded_or_replaced": 0,
        "downloaded_from_wikipedia": 0,
        "missing_rankings_match": 0,
        "unresolved_missing": 0,
    }
    wiki_cache: Dict[str, str] = {}

    total = len(local_folders)
    print(f"[INFO] Processing local folders: {total}\n")

    for idx, local in enumerate(local_folders, 1):
        stats["processed"] += 1
        ranked = ranked_map.get(local.player_id)
        ranked_name = ranked.get("name") if ranked else ""
        display_name = _format_name(local.name, local.folder.name)
        official_name = _format_name(ranked_name, display_name)

        image_files = _get_local_image_files(local.folder)
        local_valid_path = None
        for image_file in image_files:
            if _validate_local_image(image_file):
                local_valid_path = image_file
                break

        existing_url = str(local.profile.get("image_url") or "").strip()
        existing_url_valid = _validate_image_url(session, existing_url, args.timeout) if existing_url else False

        replacement_url = ""
        replacement_source = ""
        if ranked:
            replacement_url = str(ranked.get("image_url") or "").strip()
            if not replacement_url:
                pid = str(ranked.get("player_id") or "").lower()
                replacement_url = f"https://www.atptour.com/-/media/alias/player-gladiator-headshot/{pid}"
            replacement_source = "rankings"
        if not replacement_url:
            replacement_url = f"https://www.atptour.com/-/media/alias/player-gladiator-headshot/{local.player_id.lower()}"
            replacement_source = "player-id"
        replacement_url_valid = _validate_image_url(session, replacement_url, args.timeout) if replacement_url else False
        if not replacement_url_valid:
            name_candidates = []
            for candidate in [official_name, display_name, str(local.profile.get("name") or "").strip()]:
                if candidate and candidate not in name_candidates:
                    name_candidates.append(candidate)
            for candidate_name in name_candidates:
                wiki_url = _fetch_wikipedia_image_url(candidate_name, args.timeout, wiki_cache)
                if not wiki_url:
                    continue
                replacement_url = _to_wikimedia_file_path_url(wiki_url)
                replacement_url_valid = True
                replacement_source = "wikipedia"
                break

        print(f"[{idx:03d}/{total:03d}] {local.folder.name} | {official_name} (id={local.player_id})")
        print(
            f"  local_image: "
            f"{local_valid_path.name if local_valid_path else 'MISSING_OR_BROKEN'} | "
            f"profile_url: {'VALID' if existing_url_valid else ('MISSING' if not existing_url else 'BROKEN')} | "
            f"replacement_url({replacement_source or 'none'}): {'VALID' if replacement_url_valid else 'NOT_VALID'}"
        )

        if ranked is None:
            stats["missing_rankings_match"] += 1
            print("  note: no ranking match, using player-id fallback URL")

        target_url = replacement_url if replacement_url_valid else (existing_url if existing_url_valid else "")
        needs_profile_update = bool(target_url) and (existing_url != target_url)
        needs_local_file = local_valid_path is None or args.refresh_existing

        if not target_url:
            print("  action: SKIP (no usable image URL found)\n")
            if local_valid_path is None:
                stats["unresolved_missing"] += 1
            else:
                stats["skipped"] += 1
            continue

        if args.dry_run:
            if needs_local_file:
                print("  action: DRY-RUN replace/download image file")
            elif needs_profile_update:
                print("  action: DRY-RUN update profile image_url only")
            else:
                print("  action: DRY-RUN skip (already valid)")
            print("")
            continue

        wrote_local = False
        if needs_local_file:
            if replacement_source == "wikipedia" and args.wiki_delay > 0:
                time.sleep(args.wiki_delay)
            saved = _download_and_store_image(session, target_url, local.folder, args.timeout)
            if saved is not None and _validate_local_image(saved):
                wrote_local = True
                local_valid_path = saved
            else:
                print("  action: FAILED download (kept existing state)\n")
                stats["unresolved_missing"] += 1
                continue

        if needs_profile_update or (local.profile.get("image_url") or "") != target_url:
            local.profile["image_url"] = target_url
            _write_json(local.profile_path, local.profile)
            if wrote_local:
                print(f"  action: REPLACED image -> {local_valid_path.name}, updated profile image_url\n")
                stats["downloaded_or_replaced"] += 1
                if replacement_source == "wikipedia":
                    stats["downloaded_from_wikipedia"] += 1
            else:
                print("  action: UPDATED profile image_url (local image kept)\n")
                stats["updated_profile_only"] += 1
        else:
            if wrote_local:
                print(f"  action: REPLACED image -> {local_valid_path.name}\n")
                stats["downloaded_or_replaced"] += 1
                if replacement_source == "wikipedia":
                    stats["downloaded_from_wikipedia"] += 1
            else:
                print("  action: SKIP (already valid)\n")
                stats["skipped"] += 1

    print("========== SUMMARY ==========")
    print(f"processed:              {stats['processed']}")
    print(f"downloaded/replaced:    {stats['downloaded_or_replaced']}")
    print(f"from wikipedia:         {stats['downloaded_from_wikipedia']}")
    print(f"updated profile only:   {stats['updated_profile_only']}")
    print(f"skipped:                {stats['skipped']}")
    print(f"no rankings match:      {stats['missing_rankings_match']}")
    print(f"unresolved missing:     {stats['unresolved_missing']}")
    print("=============================")

    return 0


if __name__ == "__main__":
    sys.exit(main())
