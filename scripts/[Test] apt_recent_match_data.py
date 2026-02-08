#!/usr/bin/env python3
"""
Standalone test scraper for ATP recent match stats.

What this script does:
- Fetches recent ATP singles matches (same source flow as live/recent scripts)
- Uses the "Stats" link for each match (stats-centre archive URL)
- Scrapes and prints:
  - SERVICE STATS
  - RETURN STATS
  - POINT STATS
  - SERVICE SPEED (if present)

This script is intentionally separate and does not modify app data.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests

from atp_scores_common import (
    build_results_url,
    fetch_tour_tournaments,
    make_scraper,
    parse_recent_matches_from_results_page,
)


# ============================================================
# Defaults (edit and run directly)
# ============================================================
DEFAULT_RECENT_LIMIT = 20
DEFAULT_PRINT_MATCHES = 3
DEFAULT_TIMEOUT = 50

RJINA_PREFIX = "https://r.jina.ai/http://"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

SERVICE_LABELS = [
    "Serve Rating",
    "Aces",
    "Double Faults",
    "First serve",
    "1st serve points won",
    "2nd serve points won",
    "Break Points Saved",
    "Service Games Played",
]

RETURN_LABELS = [
    "Return Rating",
    "1st Serve Return Points Won",
    "2nd Serve Return Points Won",
    "Break Points Converted",
    "Return Games Played",
]

POINT_LABELS = [
    "Net points won",
    "Winners",
    "Unforced Errors",
    "Service Points Won",
    "Return Points Won",
    "Total Points Won",
]

SPEED_LABELS = [
    "Max Speed",
    "1st Serve Average Speed",
    "2nd Serve Average Speed",
]


def _clean_text(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _rjina_url(url: str) -> str:
    plain = re.sub(r"^https?://", "", str(url or "").strip())
    return f"{RJINA_PREFIX}{plain}"


def _sort_key(match: Dict[str, Any]) -> str:
    return str(match.get("scheduled_time") or "")


def fetch_recent_matches(limit: int, timeout: int) -> List[Dict[str, Any]]:
    scraper = make_scraper()
    tournaments = fetch_tour_tournaments(scraper=scraper, timeout=timeout)

    recent: List[Dict[str, Any]] = []
    for tournament in tournaments:
        try:
            url = build_results_url(tournament)
            response = scraper.get(url, timeout=timeout)
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

    ordered = sorted(deduped.values(), key=_sort_key, reverse=True)
    return ordered[: max(1, limit)]


def fetch_markdown(url: str, timeout: int) -> str:
    headers = {"User-Agent": USER_AGENT}
    request_url = _rjina_url(url)
    max_attempts = 4
    for attempt in range(1, max_attempts + 1):
        try:
            resp = requests.get(request_url, headers=headers, timeout=timeout)
            if resp.status_code in {429, 500, 502, 503, 504}:
                raise requests.HTTPError(f"temporary upstream {resp.status_code}", response=resp)
            resp.raise_for_status()
            text = resp.text or ""
            if text.strip():
                return text
            raise requests.HTTPError("empty markdown response", response=resp)
        except requests.RequestException:
            if attempt >= max_attempts:
                raise
            time.sleep(min(8.0, 0.75 * (2 ** (attempt - 1))))
    return ""


def normalize_markdown(text: str) -> str:
    # Keep human text and strip markdown links/images wrappers.
    out = text
    out = re.sub(r"!\[[^\]]*\]\(([^)]+)\)", r"\1", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", out)
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    # Remove obvious empty bullets and decoration lines.
    out = re.sub(r"^\s*[-*]\s*$", "", out, flags=re.MULTILINE)
    return out


def section_slice(text: str, title: str, next_titles: List[str]) -> str:
    start = text.find(title)
    if start < 0:
        return ""
    end = len(text)
    for marker in next_titles:
        pos = text.find(marker, start + len(title))
        if pos >= 0:
            end = min(end, pos)
    return text[start:end]


def extract_stat_pair(section_text: str, label: str) -> Optional[Tuple[str, str]]:
    # First robust pattern: value, label, value
    pattern = re.compile(
        rf"\n\s*(?P<left>[^\n]+?)\s*\n\s*{re.escape(label)}\s*\n\s*(?P<right>[^\n]+)",
        flags=re.IGNORECASE,
    )
    match = pattern.search(section_text)
    if not match:
        return None
    left = _clean_text(match.group("left"))
    right = _clean_text(match.group("right"))
    if not left or not right:
        return None
    return left, right


def extract_speed_pair(section_text: str, label: str) -> Optional[Tuple[str, str]]:
    # Pattern example:
    # 195 km/h
    # 121 mph
    # Max Speed
    # 209 km/h
    # 129 mph
    pattern = re.compile(
        rf"(?P<l1>\d+\s*km/h)\s*\n\s*(?P<l2>\d+\s*mph)\s*\n\s*{re.escape(label)}\s*\n\s*(?P<r1>\d+\s*km/h)\s*\n\s*(?P<r2>\d+\s*mph)",
        flags=re.IGNORECASE,
    )
    match = pattern.search(section_text)
    if not match:
        return None
    left = f"{_clean_text(match.group('l1'))} ({_clean_text(match.group('l2'))})"
    right = f"{_clean_text(match.group('r1'))} ({_clean_text(match.group('r2'))})"
    return left, right


def parse_match_stats(markdown: str) -> Dict[str, List[Tuple[str, str, str]]]:
    text = normalize_markdown(markdown)

    service_block = section_slice(text, "SERVICE STATS", ["RETURN STATS", "POINT STATS", "SERVICE SPEED"])
    return_block = section_slice(text, "RETURN STATS", ["POINT STATS", "SERVICE SPEED"])
    point_block = section_slice(text, "POINT STATS", ["SERVICE SPEED", "DOWNLOAD OFFICIAL ATP WTA LIVE APP"])
    speed_block = section_slice(text, "SERVICE SPEED", ["DOWNLOAD OFFICIAL ATP WTA LIVE APP"])

    parsed: Dict[str, List[Tuple[str, str, str]]] = {
        "SERVICE STATS": [],
        "RETURN STATS": [],
        "POINT STATS": [],
        "SERVICE SPEED": [],
    }

    for label in SERVICE_LABELS:
        pair = extract_stat_pair(service_block, label) if service_block else None
        if pair:
            parsed["SERVICE STATS"].append((label, pair[0], pair[1]))

    for label in RETURN_LABELS:
        pair = extract_stat_pair(return_block, label) if return_block else None
        if pair:
            parsed["RETURN STATS"].append((label, pair[0], pair[1]))

    for label in POINT_LABELS:
        pair = extract_stat_pair(point_block, label) if point_block else None
        if pair:
            parsed["POINT STATS"].append((label, pair[0], pair[1]))

    for label in SPEED_LABELS:
        pair = extract_speed_pair(speed_block, label) if speed_block else None
        if pair:
            parsed["SERVICE SPEED"].append((label, pair[0], pair[1]))

    return parsed


def print_match_stats(match: Dict[str, Any], stats: Dict[str, List[Tuple[str, str, str]]], index: int) -> None:
    p1 = (match.get("player1") or {}).get("name") or "Player 1"
    p2 = (match.get("player2") or {}).get("name") or "Player 2"
    tournament = match.get("tournament") or "-"
    round_name = match.get("round") or "-"
    stats_url = match.get("atp_stats_url") or "-"

    print("=" * 88)
    print(f"[MATCH {index}] {p1} vs {p2}")
    print(f"Tournament: {tournament}")
    print(f"Round: {round_name}")
    print(f"Stats URL: {stats_url}")
    print("-" * 88)

    for section_name in ("SERVICE STATS", "RETURN STATS", "POINT STATS", "SERVICE SPEED"):
        rows = stats.get(section_name) or []
        if not rows:
            continue
        print(section_name)
        for label, left, right in rows:
            print(f"- {label}: {left} | {right}")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Test scraper for ATP recent match stats-centre data.")
    parser.add_argument("--limit", type=int, default=DEFAULT_RECENT_LIMIT, help="Recent matches to scan")
    parser.add_argument("--print-matches", type=int, default=DEFAULT_PRINT_MATCHES, help="Matches to print")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Timeout for HTTP calls")
    parser.add_argument("--match-id", type=str, default="", help="Only print a specific recent match id")
    parser.add_argument("--stats-url", type=str, default="", help="Direct stats-centre URL (skip recent list)")
    args = parser.parse_args()

    print(
        "[INFO] Running with defaults: "
        f"limit={args.limit}, print_matches={args.print_matches}, timeout={args.timeout}"
    )

    matches: List[Dict[str, Any]] = []
    if args.stats_url:
        matches = [{
            "id": "manual",
            "tournament": "Manual Stats URL",
            "round": "-",
            "player1": {"name": "Player 1"},
            "player2": {"name": "Player 2"},
            "atp_stats_url": args.stats_url.strip(),
        }]
    else:
        matches = fetch_recent_matches(limit=max(1, args.limit), timeout=max(5, args.timeout))
        if args.match_id:
            target = args.match_id.strip()
            matches = [m for m in matches if str(m.get("id")) == target]
        matches = [m for m in matches if m.get("atp_stats_url")]
        matches = matches[: max(1, args.print_matches)]

    if not matches:
        print("[WARN] No recent ATP matches with stats URLs found.")
        return 0

    failures = 0
    for i, match in enumerate(matches, start=1):
        url = match.get("atp_stats_url") or ""
        if not url:
            failures += 1
            print(f"[WARN] Skipping match without stats URL: {match.get('id')}")
            continue
        try:
            md = fetch_markdown(url=url, timeout=max(5, args.timeout))
            parsed = parse_match_stats(md)
            print_match_stats(match, parsed, i)
        except Exception as exc:
            failures += 1
            print(f"[ERROR] Failed match {match.get('id')}: {exc}")

    print("=" * 88)
    print(f"[SUMMARY] processed={len(matches)} failed={failures} succeeded={len(matches) - failures}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

