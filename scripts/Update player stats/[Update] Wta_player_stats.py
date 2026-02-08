#!/usr/bin/env python3
"""
Update WTA player stats in existing player folders only.

This script:
- Scans existing folders in data/wta
- Requires existing profile.json + stats_2026.json
- Refreshes player stats and recent matches
- Rewrites only stats_2026.json in each folder

It does NOT create new player folders or new standalone files.
"""

import argparse
import importlib.util
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional


DEFAULT_ROOT = "../../data/wta"
DEFAULT_YEAR = 2026
DEFAULT_DELAY = 0.35
DEFAULT_LIMIT = 0
DEFAULT_START = 0
SCRAPER_FILE = "[Only once] wta_scrape_wtatennis.py"
CONFIG_FILE = "update_config.json"


def load_config(script_dir: Path) -> Dict[str, Any]:
    config_path = script_dir / CONFIG_FILE
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Warning: Failed to load config file: {e}")
        return {}


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


def extract_player_id(player_url: str) -> str:
    text = str(player_url or "").strip()
    match = re.search(r"/players/(\d+)(?:/|$)", text)
    return match.group(1) if match else ""


def load_scraper_module(script_dir: Path):
    scraper_path = script_dir / SCRAPER_FILE
    if not scraper_path.exists():
        # Try parent directory
        scraper_path = script_dir.parent / SCRAPER_FILE

    if not scraper_path.exists():
        raise FileNotFoundError(
            f"Missing required scraper file: {scraper_path}"
        )

    spec = importlib.util.spec_from_file_location("wta_scrape_once", scraper_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Could not load module from: {scraper_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    required = [
        "scrape_player_stats",
        "scrape_player_records",
        "scrape_player_recent_matches",
        "_dismiss_cookie_banner",
    ]
    missing = [name for name in required if not hasattr(module, name)]
    if missing:
        raise RuntimeError(
            f"Scraper module missing functions: {', '.join(missing)}"
        )
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
    page: Any,
    api_session: Any,
    year: int,
    refresh_records: bool,
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
    player_id = extract_player_id(player_url)
    if not player_url or not player_id:
        return "skip:no-player-url"

    new_stats = scraper.scrape_player_stats(page, player_url)
    if not isinstance(new_stats, dict):
        return "error:stats-fetch-failed"

    merged = dict(existing_stats)
    merged.update(new_stats)

    if refresh_records:
        try:
            records_tab = scraper.scrape_player_records(page, player_url)
            if isinstance(records_tab, dict) and (
                records_tab.get("summary") or records_tab.get("yearly")
            ):
                merged["records_tab"] = records_tab
        except Exception:
            # Keep previous records_tab if refresh fails.
            pass

    if refresh_recent:
        try:
            recent = scraper.scrape_player_recent_matches(player_id, year, api_session)
            if isinstance(recent, dict):
                if hasattr(scraper, "_normalize_recent_rounds_payload"):
                    recent = scraper._normalize_recent_rounds_payload(recent)
                merged["recent_matches_tab"] = recent
        except Exception:
            # Keep previous recent_matches_tab if refresh fails.
            pass

    # Always run round-label normalization over stored payload as a safety net.
    if isinstance(merged.get("recent_matches_tab"), dict) and hasattr(scraper, "_normalize_recent_rounds_payload"):
        merged["recent_matches_tab"] = scraper._normalize_recent_rounds_payload(merged["recent_matches_tab"])

    merged["updated_at"] = now_iso()

    if dry_run:
        return "dry-run"

    write_json(stats_path, merged)
    return "updated"


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    config = load_config(script_dir)
    cfg_common = config.get("common", {})
    cfg_wta = config.get("wta_stats", {})

    # Resolve config defaults
    conf_root = cfg_wta.get("root", DEFAULT_ROOT)
    if conf_root.startswith(".."):
        conf_root = str((script_dir / conf_root).resolve())

    conf_year = cfg_common.get("year", DEFAULT_YEAR)
    conf_delay = cfg_wta.get("delay", DEFAULT_DELAY)
    conf_limit = cfg_wta.get("limit", DEFAULT_LIMIT)
    conf_dry_run = cfg_common.get("dry_run", False)
    conf_skip_records = cfg_wta.get("skip_records", False)
    conf_skip_recent = cfg_wta.get("skip_recent", False)
    conf_headful = cfg_wta.get("headful", False)

    parser = argparse.ArgumentParser(
        description="Update WTA stats/recent matches in existing player folders only."
    )
    parser.add_argument("--root", default=conf_root, help=f"Base folder (default: {conf_root})")
    parser.add_argument("--year", type=int, default=conf_year, help=f"Recent matches year (default: {conf_year})")
    parser.add_argument("--delay", type=float, default=conf_delay, help=f"Delay between players (default: {conf_delay})")
    parser.add_argument("--limit", type=int, default=conf_limit, help=f"Max folders to process (0 = all, default: {conf_limit})")
    parser.add_argument("--start", type=int, default=DEFAULT_START, help="Start index offset")
    parser.add_argument("--filter", default="", help="Process folders matching substring")
    parser.add_argument("--headful", action="store_true", default=conf_headful, help="Run browser in visible mode")
    parser.add_argument("--dry-run", action="store_true", default=conf_dry_run, help="Show actions only, do not write files")
    parser.add_argument("--skip-records", action="store_true", default=conf_skip_records, help="Skip records_tab refresh")
    parser.add_argument("--skip-recent", action="store_true", default=conf_skip_recent, help="Skip recent_matches_tab refresh")
    args = parser.parse_args()

    root = Path(args.root)
    # script_dir is already defined above

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
        f"records={'off' if args.skip_records else 'on'} | "
        f"recent={'off' if args.skip_recent else 'on'} | "
        f"mode={'dry-run' if args.dry_run else 'write'}"
    )

    try:
        from playwright.sync_api import sync_playwright
        import requests
    except Exception as exc:
        print(red("Playwright + requests are required."))
        print("Install with:")
        print("  pip install playwright requests")
        print("  playwright install chromium")
        return 1

    stats = {
        "processed": 0,
        "updated": 0,
        "dry-run": 0,
        "skipped": 0,
        "errors": 0,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful)
        page = browser.new_page()
        api_session = requests.Session()

        try:
            page.goto("https://www.wtatennis.com/players", wait_until="domcontentloaded")
            page.wait_for_timeout(1000)
            scraper._dismiss_cookie_banner(page)
        except Exception:
            pass

        total = len(folders)
        for idx, folder in enumerate(folders, start=1):
            stats["processed"] += 1
            label = f"[{idx:03d}/{total:03d}] {folder.name}"
            try:
                result = update_player_folder(
                    folder=folder,
                    scraper=scraper,
                    page=page,
                    api_session=api_session,
                    year=args.year,
                    refresh_records=not args.skip_records,
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

        browser.close()

    print("\n========== SUMMARY ==========")
    print(f"processed: {stats['processed']}")
    print(f"updated:   {stats['updated']}")
    print(f"dry-run:   {stats['dry-run']}")
    print(f"skipped:   {stats['skipped']}")
    print(f"errors:    {stats['errors']}")
    return 0 if stats["errors"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
