#!/usr/bin/env python3
"""
Update ATP player stats in existing player folders only.

This script:
- Scans existing folders in data/atp
- Requires existing profile.json + stats_2026.json
- Refreshes player profile, stats and recent matches
- Rewrites profile.json + stats_2026.json in each folder

It does NOT create new player folders.
"""

import argparse
import importlib.util
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import requests

DEFAULT_ROOT = "data/atp"
DEFAULT_YEAR = 2026
DEFAULT_DELAY = 0.25
DEFAULT_LIMIT = 0
DEFAULT_START = 0
DEFAULT_TIMEOUT = 45
SCRAPER_FILE = "[Only once] atp_scrape_atptour.py"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def green(text: str) -> str:
    return f"\033[92m{text}\033[0m"


def yellow(text: str) -> str:
    return f"\033[93m{text}\033[0m"


def red(text: str) -> str:
    return f"\033[91m{text}\033[0m"


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_scraper_module(script_dir: Path):
    scraper_path = script_dir / SCRAPER_FILE
    if not scraper_path.exists():
        raise FileNotFoundError(f"Missing required scraper file: {scraper_path}")

    spec = importlib.util.spec_from_file_location("atp_scrape_once", scraper_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Could not load module from: {scraper_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    required = [
        "scrape_player_profile",
        "scrape_player_stats",
        "scrape_player_recent_matches",
    ]
    missing = [name for name in required if not hasattr(module, name)]
    if missing:
        raise RuntimeError(f"Scraper module missing functions: {', '.join(missing)}")

    return module


def iter_player_folders(root: Path) -> Iterable[Path]:
    if not root.exists():
        return []
    folders = [p for p in root.iterdir() if p.is_dir()]
    folders.sort(key=lambda p: p.name.lower())
    return folders


def update_player_folder(
    folder: Path,
    scraper: Any,
    session: requests.Session,
    year: int,
    timeout: int,
    refresh_recent: bool,
    dry_run: bool,
) -> str:
    profile_path = folder / "profile.json"
    stats_path = folder / "stats_2026.json"

    if not profile_path.exists():
        return "skip:no-profile"
    if not stats_path.exists():
        return "skip:no-stats-file"

    profile = load_json(profile_path)
    existing_stats = load_json(stats_path)
    if not isinstance(profile, dict):
        return "skip:bad-profile"
    if not isinstance(existing_stats, dict):
        return "skip:bad-stats"

    player_url = str(profile.get("url") or "").strip()
    if not player_url:
        return "skip:no-player-url"

    ranking_row = {
        "name": profile.get("name") or "",
        "profile_url": player_url,
        "rank": profile.get("rank") or "",
        "points": profile.get("points") or "",
        "player_id": profile.get("player_id") or "",
        "image_url": profile.get("image_url") or "",
    }
    new_profile = scraper.scrape_player_profile(ranking_row, session=session, timeout=timeout)
    new_stats = scraper.scrape_player_stats(player_url, session=session, timeout=timeout)
    if not isinstance(new_stats, dict):
        return "error:stats-fetch-failed"
    if not isinstance(new_profile, dict):
        return "error:profile-fetch-failed"

    profile_merged = dict(profile)
    profile_merged.update(new_profile)
    profile_merged["updated_at"] = now_iso()
    merged = dict(existing_stats)
    merged.update(new_stats)

    if refresh_recent:
        try:
            recent = scraper.scrape_player_recent_matches(
                player_url,
                year=year,
                session=session,
                timeout=timeout,
            )
            if isinstance(recent, dict):
                merged["recent_matches_tab"] = recent
        except Exception:
            # Keep previous recent_matches_tab if refresh fails.
            pass

    merged["updated_at"] = now_iso()

    if dry_run:
        return "dry-run"

    write_json(profile_path, profile_merged)
    write_json(stats_path, merged)
    return "updated"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Update ATP stats/recent matches in existing player folders only."
    )
    parser.add_argument("--root", default=DEFAULT_ROOT, help="Base folder (default: data/atp)")
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR, help="Recent matches year")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Delay between players")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Max folders to process (0 = all)")
    parser.add_argument("--start", type=int, default=DEFAULT_START, help="Start index offset")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout in seconds")
    parser.add_argument("--filter", default="", help="Process folders matching substring")
    parser.add_argument("--dry-run", action="store_true", help="Show actions only, do not write files")
    parser.add_argument("--skip-recent", action="store_true", help="Skip recent_matches_tab refresh")
    args = parser.parse_args()

    root = Path(args.root)
    script_dir = Path(__file__).resolve().parent

    try:
        scraper = load_scraper_module(script_dir)
    except Exception as exc:
        print(red(f"[ERROR] {exc}"))
        return 1

    folders = list(iter_player_folders(root))
    if args.filter:
        needle = args.filter.strip().lower()
        folders = [p for p in folders if needle in p.name.lower()]
    if args.start > 0:
        folders = folders[args.start :]
    if args.limit and args.limit > 0:
        folders = folders[: args.limit]

    if not folders:
        print(yellow("No matching player folders found."))
        return 1

    print(green(f"Found {len(folders)} player folders to process"))
    print(
        f"root={root} | year={args.year} | delay={args.delay}s | "
        f"recent={'off' if args.skip_recent else 'on'} | "
        f"timeout={args.timeout}s | "
        f"mode={'dry-run' if args.dry_run else 'write'}"
    )

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": getattr(scraper, "USER_AGENT", "Mozilla/5.0"),
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        }
    )

    stats = {
        "processed": 0,
        "updated": 0,
        "dry-run": 0,
        "skipped": 0,
        "errors": 0,
    }

    total = len(folders)
    for idx, folder in enumerate(folders, start=1):
        stats["processed"] += 1
        label = f"[{idx:03d}/{total:03d}] {folder.name}"
        try:
            result = update_player_folder(
                folder=folder,
                scraper=scraper,
                session=session,
                year=args.year,
                timeout=args.timeout,
                refresh_recent=not args.skip_recent,
                dry_run=args.dry_run,
            )

            if result == "updated":
                stats["updated"] += 1
                print(green(f"{label} -> updated"))
            elif result == "dry-run":
                stats["dry-run"] += 1
                print(yellow(f"{label} -> dry-run (no write)"))
            elif result.startswith("skip:"):
                stats["skipped"] += 1
                print(yellow(f"{label} -> {result}"))
            else:
                stats["errors"] += 1
                print(red(f"{label} -> {result}"))
        except Exception as exc:
            stats["errors"] += 1
            print(red(f"{label} -> error: {exc}"))

        if args.delay > 0:
            time.sleep(args.delay)

    print("\n========== SUMMARY ==========")
    print(f"processed: {stats['processed']}")
    print(f"updated:   {stats['updated']}")
    print(f"dry-run:   {stats['dry-run']}")
    print(f"skipped:   {stats['skipped']}")
    print(f"errors:    {stats['errors']}")
    return 0 if stats["errors"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
