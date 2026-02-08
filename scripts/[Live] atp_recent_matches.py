#!/usr/bin/env python3
"""Fetch recently completed ATP singles matches from ATP results pages and print JSON."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from typing import Any, Dict, List

from atp_scores_common import (
    build_results_url,
    fetch_tour_tournaments,
    make_scraper,
    parse_recent_matches_from_results_page,
)


def _sort_key(match: Dict[str, Any]) -> str:
    ts = str(match.get("scheduled_time") or "")
    return ts


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch recent ATP singles matches.")
    parser.add_argument("--limit", type=int, default=20, help="Maximum number of matches")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    parser.add_argument("--out", type=str, default="", help="Optional file path to write JSON")
    args = parser.parse_args()

    try:
        scraper = make_scraper()
        tournaments = fetch_tour_tournaments(scraper=scraper, timeout=args.timeout)

        recent: List[Dict[str, Any]] = []
        for tournament in tournaments:
            try:
                url = build_results_url(tournament)
                response = scraper.get(url, timeout=args.timeout)
                if response.status_code != 200:
                    continue
                parsed = parse_recent_matches_from_results_page(response.text, tournament)
                recent.extend(parsed)
            except Exception:
                continue

        deduped: Dict[str, Dict[str, Any]] = {}
        for match in recent:
            key = str(match.get("id") or "")
            if not key:
                continue
            if key not in deduped:
                deduped[key] = match

        payload = sorted(deduped.values(), key=_sort_key, reverse=True)[: max(1, args.limit)]
    except Exception as exc:
        print(f"[atp_recent_matches] {exc}", file=sys.stderr)
        return 1

    text = json.dumps(payload, ensure_ascii=False)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as out_file:
            out_file.write(text)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
