#!/usr/bin/env python3
"""
Fetch ATP leaderboard stats (Serve / Return / Under Pressure) and export to CSV.

Notes:
- ATP pages are protected by Cloudflare for direct scripted access.
- This script uses r.jina.ai as a read-only fetch proxy to retrieve the ATP
  leaderboard markdown pages, then parses the table rows.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests


CATEGORY_MAP = {
    "serve": "Serve",
    "return": "Return",
    "pressure": "Under Pressure",
}

BASE_URL = "https://www.atptour.com/en/stats/leaderboard?boardType={board_type}"
R_JINA_PREFIX = "https://r.jina.ai/http://"

PLAYER_CELL_RE = re.compile(
    r"!\[[^\]]*\]\((?P<image>[^)]+)\)\s*\[(?P<name>[^\]]+)\]\((?P<profile>[^)]+)\)",
    re.IGNORECASE,
)
PLAYER_LINK_RE = re.compile(r"\[(?P<name>[^\]]+)\]\((?P<profile>[^)]+)\)", re.IGNORECASE)
PLAYER_ID_RE = re.compile(r"/players/[^/]+/(?P<player_id>[A-Za-z0-9]+)/overview", re.IGNORECASE)


@dataclass
class LeaderRow:
    fetched_at_utc: str
    category_key: str
    category_label: str
    rank: int
    player_name: str
    player_id: str
    profile_url: str
    image_url: str
    rating: float
    metric_1_name: str = ""
    metric_1_value: str = ""
    metric_2_name: str = ""
    metric_2_value: str = ""
    metric_3_name: str = ""
    metric_3_value: str = ""
    metric_4_name: str = ""
    metric_4_value: str = ""
    metric_5_name: str = ""
    metric_5_value: str = ""
    metric_6_name: str = ""
    metric_6_value: str = ""
    metrics_json: str = "{}"


def _absolute_url(url: str) -> str:
    text = (url or "").strip()
    if not text:
        return ""
    if text.startswith("http://") or text.startswith("https://"):
        return text
    if text.startswith("//"):
        return f"https:{text}"
    if text.startswith("/"):
        return f"https://www.atptour.com{text}"
    return text


def _parse_rating(value: str) -> Optional[float]:
    text = (value or "").strip()
    if not text:
        return None
    text = text.replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def _parse_player_cell(cell: str) -> Dict[str, str]:
    image_url = ""
    name = ""
    profile_url = ""

    m = PLAYER_CELL_RE.search(cell)
    if m:
        image_url = _absolute_url(m.group("image") or "")
        name = (m.group("name") or "").strip()
        profile_url = _absolute_url(m.group("profile") or "")
    else:
        link = PLAYER_LINK_RE.search(cell)
        if link:
            name = (link.group("name") or "").strip()
            profile_url = _absolute_url(link.group("profile") or "")
        else:
            name = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", cell).strip()

    player_id = ""
    id_match = PLAYER_ID_RE.search(profile_url)
    if id_match:
        player_id = (id_match.group("player_id") or "").upper()

    return {
        "name": name,
        "profile_url": profile_url,
        "image_url": image_url,
        "player_id": player_id,
    }


def _split_markdown_row(line: str) -> List[str]:
    if not line.strip().startswith("|"):
        return []
    body = line.strip().strip("|")
    return [col.strip() for col in body.split("|")]


def _fetch_markdown(board_type: str, timeout: int) -> str:
    source_url = BASE_URL.format(board_type=board_type)
    proxy_url = f"{R_JINA_PREFIX}{source_url.replace('https://', '')}"
    response = requests.get(proxy_url, timeout=timeout)
    response.raise_for_status()
    text = response.text or ""
    if "| Rank | Player |" not in text:
        raise RuntimeError(f"Leaderboard table not found for boardType={board_type}")
    return text


def _parse_leaderboard(markdown: str, category_key: str, fetched_at_utc: str, min_matches: int) -> List[LeaderRow]:
    lines = markdown.splitlines()

    header_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith("| Rank | Player |"):
            header_idx = i
            break

    if header_idx < 0 or header_idx + 1 >= len(lines):
        return []

    headers = _split_markdown_row(lines[header_idx])
    metric_headers = headers[3:9]

    match_idx = -1
    for i, header in enumerate(metric_headers):
        normalized = re.sub(r"[^a-z]", "", header.lower())
        if normalized in {"matches", "matchesplayed", "matchplayed"}:
            match_idx = i
            break

    rows: List[LeaderRow] = []
    for line in lines[header_idx + 2 :]:
        if not line.strip().startswith("|"):
            continue
        cols = _split_markdown_row(line)
        if len(cols) < 3:
            continue

        rank_text = cols[0].strip()
        if not rank_text.isdigit():
            continue

        rank = int(rank_text)
        player_meta = _parse_player_cell(cols[1])
        rating_value = _parse_rating(cols[2])
        if rating_value is None:
            continue

        metric_values = cols[3:9]
        match_count = None
        if 0 <= match_idx < len(metric_values):
            count_raw = re.sub(r"[^\d]", "", metric_values[match_idx])
            if count_raw:
                try:
                    match_count = int(count_raw)
                except ValueError:
                    match_count = None
        if match_count is not None and match_count < max(0, min_matches):
            continue

        metrics_map = {
            metric_headers[i] if i < len(metric_headers) else f"Metric {i+1}": metric_values[i]
            for i in range(min(len(metric_values), 6))
        }
        if match_count is not None:
            metrics_map["Match Count"] = match_count

        row = LeaderRow(
            fetched_at_utc=fetched_at_utc,
            category_key=category_key,
            category_label=CATEGORY_MAP[category_key],
            rank=rank,
            player_name=player_meta["name"],
            player_id=player_meta["player_id"],
            profile_url=player_meta["profile_url"],
            image_url=player_meta["image_url"],
            rating=rating_value,
            metrics_json=json.dumps(metrics_map, ensure_ascii=True),
        )

        for i in range(6):
            name = metric_headers[i] if i < len(metric_headers) else ""
            value = metric_values[i] if i < len(metric_values) else ""
            setattr(row, f"metric_{i+1}_name", name)
            setattr(row, f"metric_{i+1}_value", value)

        rows.append(row)

    return rows


def fetch_all_categories(timeout: int, min_matches: int) -> List[LeaderRow]:
    fetched_at_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    all_rows: List[LeaderRow] = []

    for category_key in CATEGORY_MAP:
        print(f"[ATP STATS] Fetching category: {category_key}")
        markdown = _fetch_markdown(category_key, timeout)
        rows = _parse_leaderboard(markdown, category_key, fetched_at_utc, min_matches)
        if not rows:
            raise RuntimeError(f"No rows parsed for category: {category_key}")
        all_rows.extend(rows)
        print(f"[ATP STATS] Parsed {len(rows)} rows for {category_key}")

    return all_rows


def write_csv(rows: List[LeaderRow], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "fetched_at_utc",
        "category_key",
        "category_label",
        "rank",
        "player_name",
        "player_id",
        "profile_url",
        "image_url",
        "rating",
        "metric_1_name",
        "metric_1_value",
        "metric_2_name",
        "metric_2_value",
        "metric_3_name",
        "metric_3_value",
        "metric_4_name",
        "metric_4_value",
        "metric_5_name",
        "metric_5_value",
        "metric_6_name",
        "metric_6_value",
        "metrics_json",
    ]

    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in sorted(rows, key=lambda r: (r.category_key, r.rank)):
            writer.writerow({k: getattr(row, k) for k in fieldnames})


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parent.parent
    default_out = repo_root / "data" / "atp_stats" / "atp_stats_leaderboard.csv"

    parser = argparse.ArgumentParser(description="Export ATP leaderboard stats to CSV")
    parser.add_argument("--out", type=Path, default=default_out, help="Output CSV path")
    parser.add_argument("--timeout", type=int, default=35, help="HTTP timeout in seconds")
    parser.add_argument("--min-matches", type=int, default=5, help="Minimum matches required when available in source table")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        rows = fetch_all_categories(timeout=args.timeout, min_matches=max(0, args.min_matches))
        write_csv(rows, args.out)
        counts = {key: 0 for key in CATEGORY_MAP}
        for row in rows:
            counts[row.category_key] += 1

        print("\n[ATP STATS] Export complete")
        print(f"[ATP STATS] Output: {args.out}")
        for key, count in counts.items():
            print(f"[ATP STATS] {key}: {count} rows")
        return 0
    except Exception as exc:
        print(f"[ATP STATS] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
