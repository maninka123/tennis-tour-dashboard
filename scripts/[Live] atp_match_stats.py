#!/usr/bin/env python3
"""
Fetch ATP match statistics from an ATP stats-centre URL and print normalized JSON.

Usage:
  python scripts/[Live] atp_match_stats.py --stats-url "https://www.atptour.com/..."
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from typing import Any, Dict, Optional, Tuple

import requests


RJINA_PREFIX = "https://r.jina.ai/http://"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


def _clean_text(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _to_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return fallback


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return fallback


def _rjina_url(url: str) -> str:
    plain = re.sub(r"^https?://", "", str(url or "").strip(), flags=re.IGNORECASE)
    return f"{RJINA_PREFIX}{plain}"


def _fetch_markdown(url: str, timeout: int) -> str:
    headers = {"User-Agent": USER_AGENT}
    request_url = _rjina_url(url)
    max_attempts = 4

    for attempt in range(1, max_attempts + 1):
        try:
            resp = requests.get(request_url, headers=headers, timeout=timeout)
            if resp.status_code in {429, 500, 502, 503, 504}:
                raise requests.HTTPError(f"Temporary upstream {resp.status_code}", response=resp)
            resp.raise_for_status()
            text = resp.text or ""
            if text.strip():
                return text
            raise requests.HTTPError("Empty markdown response", response=resp)
        except requests.RequestException:
            if attempt >= max_attempts:
                raise
            time.sleep(min(8.0, 0.75 * (2 ** (attempt - 1))))
    return ""


def _normalize_markdown(text: str) -> str:
    out = text or ""
    out = re.sub(r"!\[[^\]]*\]\(([^)]+)\)", r"\1", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", out)
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    out = re.sub(r"^\s*[-*]\s*$", "", out, flags=re.MULTILINE)
    return out


def _section_slice(text: str, title: str, next_titles: list[str]) -> str:
    start = text.find(title)
    if start < 0:
        return ""
    end = len(text)
    for marker in next_titles:
        pos = text.find(marker, start + len(title))
        if pos >= 0:
            end = min(end, pos)
    return text[start:end]


def _extract_stat_pair(section_text: str, label: str) -> Optional[Tuple[str, str]]:
    pattern = re.compile(
        rf"\n\s*(?P<left>[^\n]+?)\s*\n\s*{re.escape(label)}\s*\n\s*(?P<right>[^\n]+)",
        flags=re.IGNORECASE,
    )
    match = pattern.search(section_text or "")
    if not match:
        return None
    left = _clean_text(match.group("left"))
    right = _clean_text(match.group("right"))
    if not left or not right:
        return None
    return left, right


def _parse_fraction_percent(value: str) -> Dict[str, Any]:
    text = _clean_text(value)
    frac_match = re.search(r"(\d+)\s*/\s*(\d+)", text)
    pct_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    number_match = re.search(r"\d+(?:\.\d+)?", text)

    made = _to_int(frac_match.group(1), 0) if frac_match else None
    total = _to_int(frac_match.group(2), 0) if frac_match else None

    if pct_match:
        percent = _to_float(pct_match.group(1), 0.0)
    elif made is not None and total is not None and total > 0:
        percent = round((made / total) * 100.0, 1)
    elif number_match:
        percent = _to_float(number_match.group(0), 0.0)
    else:
        percent = 0.0

    return {
        "text": text,
        "made": made,
        "total": total,
        "percent": percent,
    }


def _parse_int(value: str) -> int:
    m = re.search(r"-?\d+", _clean_text(value))
    return _to_int(m.group(0), 0) if m else 0


def parse_match_stats(markdown: str) -> Dict[str, Any]:
    text = _normalize_markdown(markdown)
    service = _section_slice(text, "SERVICE STATS", ["RETURN STATS", "POINT STATS", "SERVICE SPEED"])
    ret = _section_slice(text, "RETURN STATS", ["POINT STATS", "SERVICE SPEED"])
    points = _section_slice(text, "POINT STATS", ["SERVICE SPEED", "DOWNLOAD OFFICIAL ATP WTA LIVE APP"])

    payload: Dict[str, Any] = {
        "source": "atp_stats_centre",
        "aces": {"p1": 0, "p2": 0},
        "doubleFaults": {"p1": 0, "p2": 0},
        "firstServe": {"p1": 0.0, "p2": 0.0, "made": {"p1": 0, "p2": 0}, "total": {"p1": 0, "p2": 0}},
        "firstServeWon": {"p1": 0.0, "p2": 0.0, "won": {"p1": 0, "p2": 0}, "total": {"p1": 0, "p2": 0}},
        "secondServeWon": {"p1": 0.0, "p2": 0.0, "won": {"p1": 0, "p2": 0}, "total": {"p1": 0, "p2": 0}},
        "breakPointsWon": {"p1": 0, "p2": 0},
        "breakPointsTotal": {"p1": 0, "p2": 0},
        "breakPointsRate": {"p1": 0.0, "p2": 0.0},
        "breakPointsFaced": {"p1": 0, "p2": 0},
        "breakPointsSaved": {"p1": 0, "p2": 0},
        "breakPointsSavedRate": {"p1": 0.0, "p2": 0.0},
        "serviceGamesPlayed": {"p1": 0, "p2": 0},
        "returnGamesPlayed": {"p1": 0, "p2": 0},
        "servicePointsPlayed": {"p1": 0, "p2": 0},
        "servicePointsWon": {"p1": 0, "p2": 0},
        "totalPoints": {"p1": 0, "p2": 0},
        "winners": {"p1": 0, "p2": 0},
        "unforcedErrors": {"p1": 0, "p2": 0},
    }

    pair = _extract_stat_pair(service, "Aces")
    if pair:
        payload["aces"] = {"p1": _parse_int(pair[0]), "p2": _parse_int(pair[1])}

    pair = _extract_stat_pair(service, "Double Faults")
    if pair:
        payload["doubleFaults"] = {"p1": _parse_int(pair[0]), "p2": _parse_int(pair[1])}

    pair = _extract_stat_pair(service, "First serve")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["firstServe"] = {
            "p1": left["percent"],
            "p2": right["percent"],
            "made": {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)},
            "total": {"p1": _to_int(left["total"], 0), "p2": _to_int(right["total"], 0)},
        }

    pair = _extract_stat_pair(service, "1st serve points won")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["firstServeWon"] = {
            "p1": left["percent"],
            "p2": right["percent"],
            "won": {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)},
            "total": {"p1": _to_int(left["total"], 0), "p2": _to_int(right["total"], 0)},
        }

    pair = _extract_stat_pair(service, "2nd serve points won")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["secondServeWon"] = {
            "p1": left["percent"],
            "p2": right["percent"],
            "won": {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)},
            "total": {"p1": _to_int(left["total"], 0), "p2": _to_int(right["total"], 0)},
        }

    pair = _extract_stat_pair(service, "Break Points Saved")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["breakPointsSaved"] = {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)}
        payload["breakPointsFaced"] = {"p1": _to_int(left["total"], 0), "p2": _to_int(right["total"], 0)}
        payload["breakPointsSavedRate"] = {"p1": left["percent"], "p2": right["percent"]}

    pair = _extract_stat_pair(service, "Service Games Played")
    if pair:
        payload["serviceGamesPlayed"] = {"p1": _parse_int(pair[0]), "p2": _parse_int(pair[1])}

    pair = _extract_stat_pair(ret, "Break Points Converted")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["breakPointsWon"] = {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)}
        payload["breakPointsTotal"] = {"p1": _to_int(left["total"], 0), "p2": _to_int(right["total"], 0)}
        payload["breakPointsRate"] = {"p1": left["percent"], "p2": right["percent"]}

    pair = _extract_stat_pair(ret, "Return Games Played")
    if pair:
        payload["returnGamesPlayed"] = {"p1": _parse_int(pair[0]), "p2": _parse_int(pair[1])}

    pair = _extract_stat_pair(points, "Service Points Won")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["servicePointsWon"] = {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)}
        payload["servicePointsPlayed"] = {"p1": _to_int(left["total"], 0), "p2": _to_int(right["total"], 0)}

    pair = _extract_stat_pair(points, "Total Points Won")
    if pair:
        left = _parse_fraction_percent(pair[0])
        right = _parse_fraction_percent(pair[1])
        payload["totalPoints"] = {"p1": _to_int(left["made"], 0), "p2": _to_int(right["made"], 0)}

    pair = _extract_stat_pair(points, "Winners")
    if pair:
        payload["winners"] = {"p1": _parse_int(pair[0]), "p2": _parse_int(pair[1])}

    pair = _extract_stat_pair(points, "Unforced Errors")
    if pair:
        payload["unforcedErrors"] = {"p1": _parse_int(pair[0]), "p2": _parse_int(pair[1])}

    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch ATP match stats from ATP stats-centre URL.")
    parser.add_argument("--stats-url", type=str, required=True, help="ATP stats-centre/archive URL")
    parser.add_argument("--timeout", type=int, default=50, help="HTTP timeout in seconds")
    args = parser.parse_args()

    stats_url = _clean_text(args.stats_url)
    if not stats_url:
        print("Missing --stats-url", file=sys.stderr)
        return 2

    try:
        markdown = _fetch_markdown(url=stats_url, timeout=max(5, int(args.timeout)))
        payload = parse_match_stats(markdown)
        sys.stdout.write(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f"[atp_match_stats] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
