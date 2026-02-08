#!/usr/bin/env python3
"""Fetch live ATP singles matches and print JSON."""

from __future__ import annotations

import argparse
import json
import sys

from atp_scores_common import fetch_tour_tournaments, make_scraper, parse_live_matches_from_gateway


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch live ATP singles matches.")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    parser.add_argument("--out", type=str, default="", help="Optional file path to write JSON")
    args = parser.parse_args()

    try:
        scraper = make_scraper()
        tournaments = fetch_tour_tournaments(scraper=scraper, timeout=args.timeout)
        payload = parse_live_matches_from_gateway(tournaments)
    except Exception as exc:
        print(f"[atp_live_matches] {exc}", file=sys.stderr)
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
