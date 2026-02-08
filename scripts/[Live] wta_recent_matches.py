#!/usr/bin/env python3
"""Fetch recent (finished) WTA singles matches and print JSON."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

WTA_GLOBAL_MATCHES_URL = "https://api.wtatennis.com/tennis/matches/global"
WTA_MATCH_STATS_URL_TEMPLATE = (
    "https://api.wtatennis.com/tennis/tournaments/{event_id}/{event_year}/matches/{match_id}/stats"
)
DEFAULT_CACHE_FILE = (
    Path(__file__).resolve().parent.parent / "data" / "wta_recent_match_stats_cache.json"
)
MAX_CACHE_ENTRIES = 1200
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.wtatennis.com/scores?type=S",
}


def fetch_global_matches(timeout: int) -> List[Dict[str, Any]]:
    response = requests.get(WTA_GLOBAL_MATCHES_URL, headers=HEADERS, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        for key in ("Matches", "matches", "data"):
            value = data.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
    return []


def filter_recent_singles(matches: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    finished = [
        match
        for match in matches
        if match.get("DrawMatchType") == "S" and match.get("MatchState") == "F"
    ]
    finished.sort(key=lambda row: row.get("MatchTimeStamp") or "", reverse=True)
    return finished[: max(1, limit)]


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 1)


def _match_cache_key(match: Dict[str, Any]) -> str:
    event_id = str(match.get("EventID") or "").strip()
    event_year = str(match.get("EventYear") or "").strip()
    match_id = str(match.get("MatchID") or "").strip()
    return f"{event_id}|{event_year}|{match_id}"


def _load_cache(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"version": 1, "updated_at": None, "matches": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"version": 1, "updated_at": None, "matches": {}}
    if not isinstance(payload, dict):
        return {"version": 1, "updated_at": None, "matches": {}}
    matches = payload.get("matches")
    if not isinstance(matches, dict):
        matches = {}
    return {
        "version": 1,
        "updated_at": payload.get("updated_at"),
        "matches": matches,
    }


def _save_cache(path: Path, cache: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cache["updated_at"] = _iso_now()
    matches = cache.get("matches")
    if isinstance(matches, dict) and len(matches) > MAX_CACHE_ENTRIES:
        items = sorted(
            matches.items(),
            key=lambda kv: (
                str((kv[1] or {}).get("fetched_at") or ""),
                str(kv[0]),
            ),
            reverse=True,
        )[:MAX_CACHE_ENTRIES]
        cache["matches"] = {k: v for k, v in items}
    path.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _pick_overall_stats_row(rows: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(rows, list):
        return None
    dict_rows = [row for row in rows if isinstance(row, dict)]
    if not dict_rows:
        return None
    for row in dict_rows:
        if _to_int(row.get("setnum"), default=-1) == 0:
            return row
    return dict_rows[0]


def _fetch_match_stats_snapshot(
    session: requests.Session,
    event_id: Any,
    event_year: Any,
    match_id: Any,
    timeout: int,
) -> Optional[Dict[str, Any]]:
    event_id_str = str(event_id or "").strip()
    event_year_str = str(event_year or "").strip()
    match_id_str = str(match_id or "").strip()
    if not event_id_str or not event_year_str or not match_id_str:
        return None

    url = WTA_MATCH_STATS_URL_TEMPLATE.format(
        event_id=event_id_str,
        event_year=event_year_str,
        match_id=match_id_str,
    )
    response = session.get(url, headers=HEADERS, timeout=timeout)
    if response.status_code != 200:
        return None
    row = _pick_overall_stats_row(response.json())
    if not row:
        return None

    aces_a = _to_int(row.get("acesa"))
    aces_b = _to_int(row.get("acesb"))
    dblflt_a = _to_int(row.get("dblflta"))
    dblflt_b = _to_int(row.get("dblfltb"))

    first_in_a = _to_int(row.get("ptsplayed1stserva"))
    first_in_b = _to_int(row.get("ptsplayed1stservb"))
    first_won_a = _to_int(row.get("ptswon1stserva"))
    first_won_b = _to_int(row.get("ptswon1stservb"))
    serve_pts_a = _to_int(row.get("totservplayeda"))
    serve_pts_b = _to_int(row.get("totservplayedb"))
    serve_pts_won_a = _to_int(row.get("ptstotwonserva"))
    serve_pts_won_b = _to_int(row.get("ptstotwonservb"))
    total_pts_won_a = _to_int(row.get("totptswona"))
    total_pts_won_b = _to_int(row.get("totptswonb"))

    second_played_a = max(0, serve_pts_a - first_in_a)
    second_played_b = max(0, serve_pts_b - first_in_b)
    second_won_a = max(0, serve_pts_won_a - first_won_a)
    second_won_b = max(0, serve_pts_won_b - first_won_b)

    break_conv_a = _to_int(row.get("breakptsconva"))
    break_conv_b = _to_int(row.get("breakptsconvb"))
    break_total_a = _to_int(row.get("breakptsplayeda"))
    break_total_b = _to_int(row.get("breakptsplayedb"))

    break_faced_a = break_total_b
    break_faced_b = break_total_a
    break_saved_a = max(0, break_faced_a - break_conv_b)
    break_saved_b = max(0, break_faced_b - break_conv_a)

    serv_games_a = _to_int(row.get("servgamesplayeda"))
    serv_games_b = _to_int(row.get("servgamesplayedb"))

    return {
        "event_id": event_id_str,
        "event_year": event_year_str,
        "match_id": match_id_str,
        "aces_a": aces_a,
        "aces_b": aces_b,
        "double_faults_a": dblflt_a,
        "double_faults_b": dblflt_b,
        "first_serve_in_a": first_in_a,
        "first_serve_in_b": first_in_b,
        "first_serve_points_won_a": first_won_a,
        "first_serve_points_won_b": first_won_b,
        "service_points_played_a": serve_pts_a,
        "service_points_played_b": serve_pts_b,
        "service_points_won_a": serve_pts_won_a,
        "service_points_won_b": serve_pts_won_b,
        "second_serve_points_played_a": second_played_a,
        "second_serve_points_played_b": second_played_b,
        "second_serve_points_won_a": second_won_a,
        "second_serve_points_won_b": second_won_b,
        "break_points_converted_a": break_conv_a,
        "break_points_converted_b": break_conv_b,
        "break_points_total_a": break_total_a,
        "break_points_total_b": break_total_b,
        "break_points_faced_a": break_faced_a,
        "break_points_faced_b": break_faced_b,
        "break_points_saved_a": break_saved_a,
        "break_points_saved_b": break_saved_b,
        "service_games_played_a": serv_games_a,
        "service_games_played_b": serv_games_b,
        "total_points_won_a": total_pts_won_a,
        "total_points_won_b": total_pts_won_b,
        "first_serve_percent_a": _pct(first_in_a, serve_pts_a),
        "first_serve_percent_b": _pct(first_in_b, serve_pts_b),
        "first_serve_points_won_percent_a": _pct(first_won_a, first_in_a),
        "first_serve_points_won_percent_b": _pct(first_won_b, first_in_b),
        "second_serve_points_won_percent_a": _pct(second_won_a, second_played_a),
        "second_serve_points_won_percent_b": _pct(second_won_b, second_played_b),
        "break_points_converted_percent_a": _pct(break_conv_a, break_total_a),
        "break_points_converted_percent_b": _pct(break_conv_b, break_total_b),
        "break_points_saved_percent_a": _pct(break_saved_a, break_faced_a),
        "break_points_saved_percent_b": _pct(break_saved_b, break_faced_b),
    }


def enrich_recent_matches_with_stats(
    matches: List[Dict[str, Any]],
    timeout: int,
    cache_path: Path,
) -> List[Dict[str, Any]]:
    if not matches:
        return matches

    cache = _load_cache(cache_path)
    by_match = cache.get("matches", {})
    if not isinstance(by_match, dict):
        by_match = {}
        cache["matches"] = by_match

    session = requests.Session()
    for match in matches:
        key = _match_cache_key(match)
        if not key.strip("|"):
            continue
        cached = by_match.get(key) or {}
        snapshot = cached.get("stats_snapshot") if isinstance(cached, dict) else None
        if not isinstance(snapshot, dict):
            snapshot = _fetch_match_stats_snapshot(
                session=session,
                event_id=match.get("EventID"),
                event_year=match.get("EventYear"),
                match_id=match.get("MatchID"),
                timeout=timeout,
            )
            if snapshot:
                by_match[key] = {
                    "fetched_at": _iso_now(),
                    "stats_snapshot": snapshot,
                }
        if snapshot:
            match["DetailedStats"] = snapshot

    _save_cache(cache_path, cache)
    return matches


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch recent WTA singles matches.")
    parser.add_argument("--limit", type=int, default=20, help="Maximum number of matches")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds")
    parser.add_argument("--out", type=str, default="", help="Optional file path to write JSON")
    parser.add_argument(
        "--cache-file",
        type=str,
        default=str(DEFAULT_CACHE_FILE),
        help="Cache file for match stats snapshots",
    )
    args = parser.parse_args()

    try:
        payload = filter_recent_singles(fetch_global_matches(args.timeout), args.limit)
        payload = enrich_recent_matches_with_stats(
            matches=payload,
            timeout=args.timeout,
            cache_path=Path(args.cache_file),
        )
    except Exception as exc:
        print(f"[wta_recent_matches] {exc}", file=sys.stderr)
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
