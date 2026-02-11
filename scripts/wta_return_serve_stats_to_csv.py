#!/usr/bin/env python3
"""
Fetch WTA player stat tables and build normalized Stat Zone leaderboards.

Output schema is compatible with the frontend stat-zone table parser used by ATP,
with categories:
- serve
- return

Data source:
- https://api.wtatennis.com/tennis/stats/{year}/{metric}
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests


API_BASE = "https://api.wtatennis.com/tennis/stats/{year}/{metric}"

# Pull two tabs (serving + returning) to mirror website sections.
SOURCE_METRICS = [
    "Aces",
    "return_points_won_percent",
]

SERVE_METRICS = [
    ("Aces", "Aces", False, 0.16, False),
    ("Double_Faults", "Double Faults", False, 0.12, True),
    ("first_serve_percent", "1st Serve %", True, 0.14, False),
    ("first_serve_won_percent", "1st Serve Points Won %", True, 0.20, False),
    ("second_serve_won_percent", "2nd Serve Points Won %", True, 0.20, False),
    ("breakpoint_saved_percent", "Break Points Saved %", True, 0.18, False),
]

RETURN_METRICS = [
    ("first_return_percent", "1st Return Points Won %", True, 0.22, False),
    ("second_return_percent", "2nd Return Points Won %", True, 0.22, False),
    ("breakpoint_converted_percent", "Break Points Converted %", True, 0.20, False),
    ("return_games_won_percent", "Return Games Won %", True, 0.16, False),
    ("return_points_won_percent", "Return Points Won %", True, 0.20, False),
]


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


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Export WTA stat-zone leaderboard to CSV")
    parser.add_argument("--year", type=int, default=datetime.now(timezone.utc).year)
    parser.add_argument("--max-players", type=int, default=250, help="players per source metric")
    parser.add_argument("--max-pages", type=int, default=80)
    parser.add_argument("--min-matches", type=int, default=5, help="Minimum match count required")
    parser.add_argument("--timeout", type=int, default=25)
    parser.add_argument(
        "--out",
        type=Path,
        default=repo_root / "data" / "wta_stats" / "wta_stats_leaderboard.csv",
    )
    parser.add_argument(
        "--archive-old",
        action="store_true",
        help="archive existing CSV before writing a new one",
    )
    return parser.parse_args()


def _norm_name(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


def _title_word(word: str) -> str:
    if not word:
        return word
    chunks = word.split("-")
    chunks = [c[:1].upper() + c[1:].lower() if c else c for c in chunks]
    return "-".join(chunks)


def _format_name(first: str, last: str) -> str:
    parts = []
    for token in (first or "").strip().split():
        parts.append(_title_word(token))
    for token in (last or "").strip().split():
        parts.append(_title_word(token))
    return " ".join(p for p in parts if p).strip()


def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _to_int(value) -> Optional[int]:
    num = _to_float(value)
    if num is None:
        return None
    try:
        return int(round(num))
    except Exception:
        return None


def _fmt_value(value: Optional[float], is_percent: bool) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "-"
    if is_percent:
        return f"{value:.1f}%"
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.1f}"


def _normalize(value: Optional[float], low: Optional[float], high: Optional[float], lower_better: bool) -> float:
    if value is None or low is None or high is None:
        return 50.0
    if high <= low:
        return 50.0
    scaled = (value - low) / (high - low)
    if lower_better:
        scaled = 1.0 - scaled
    return max(0.0, min(100.0, scaled * 100.0))


def _load_rankings_assets(repo_root: Path) -> Tuple[Dict[int, Dict], Dict[str, Dict]]:
    by_id: Dict[int, Dict] = {}
    by_name: Dict[str, Dict] = {}

    ranking_csv = repo_root / "data" / "wta_live_ranking.csv"
    if ranking_csv.exists():
        with ranking_csv.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = _to_int(row.get("player_id"))
                name = (row.get("player") or "").strip()
                item = {
                    "image_url": (row.get("image_url") or "").strip(),
                    "profile_url": (row.get("profile_url") or "").strip(),
                    "country": (row.get("country") or "").strip(),
                    "name": name,
                }
                if pid:
                    by_id[pid] = {**by_id.get(pid, {}), **item}
                if name:
                    by_name[_norm_name(name)] = {**by_name.get(_norm_name(name), {}), **item}

    connections = repo_root / "data" / "wta_player_connections.json"
    if connections.exists():
        try:
            payload = json.loads(connections.read_text(encoding="utf-8"))
        except Exception:
            payload = {}
        for row in payload.get("players", []):
            pid = _to_int(row.get("player_id"))
            name = (row.get("name") or "").strip()
            item = {
                "image_url": (row.get("image_url") or "").strip(),
                "profile_url": (row.get("profile_url") or "").strip(),
                "country": (row.get("country") or "").strip(),
                "name": name,
            }
            if pid:
                by_id[pid] = {**by_id.get(pid, {}), **item}
            if name:
                by_name[_norm_name(name)] = {**by_name.get(_norm_name(name), {}), **item}

    return by_id, by_name


def _fetch_metric_page(session: requests.Session, year: int, metric: str, page: int, timeout: int) -> List[Dict]:
    url = API_BASE.format(year=year, metric=metric)
    response = session.get(url, params={"page": page, "sort": "desc"}, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else []


def fetch_players(year: int, max_players: int, max_pages: int, timeout: int) -> List[Dict]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.wtatennis.com/stats",
            "account": "wta",
        }
    )

    players: Dict[int, Dict] = {}
    for metric in SOURCE_METRICS:
        print(f"[WTA STATS] Fetching metric source: {metric}")
        pages_without_new = 0
        for page in range(max_pages):
            rows = _fetch_metric_page(session, year, metric, page, timeout)
            if not rows:
                break

            new_count = 0
            for row in rows:
                pid = _to_int(row.get("PlayerNbr"))
                if not pid:
                    continue
                existing = players.get(pid, {})
                merged = {**existing, **row}
                players[pid] = merged
                if not existing:
                    new_count += 1

            if new_count == 0:
                pages_without_new += 1
            else:
                pages_without_new = 0

            # Stop when this metric already supplied enough unique players.
            metric_unique = sum(1 for v in players.values() if _to_int(v.get("PlayerNbr")))
            if metric_unique >= max_players and page >= (max_players // 10):
                break
            if pages_without_new >= 3:
                break

        print(f"[WTA STATS] Collected unique players so far: {len(players)}")

    ordered = sorted(
        players.values(),
        key=lambda r: (
            _to_int(r.get("Current_Rank")) if _to_int(r.get("Current_Rank")) is not None else 10**9,
            _norm_name(_format_name(r.get("First_Name"), r.get("Last_Name"))),
        ),
    )
    return ordered


def _build_category_rows(
    source_rows: List[Dict],
    category_key: str,
    category_label: str,
    metric_specs: List[Tuple[str, str, bool, float, bool]],
    fetched_at_utc: str,
    max_leaders: int,
    min_matches: int,
    assets_by_id: Dict[int, Dict],
    assets_by_name: Dict[str, Dict],
) -> List[LeaderRow]:
    eligible_rows = []
    for r in source_rows:
        match_count = _to_int(r.get("MatchCount"))
        if match_count is None or match_count < max(0, min_matches):
            continue
        eligible_rows.append(r)

    if not eligible_rows:
        return []

    # Compute min/max per metric for normalization.
    minmax: Dict[str, Tuple[Optional[float], Optional[float]]] = {}
    for field, _, _, _, _ in metric_specs:
        vals = [_to_float(r.get(field)) for r in eligible_rows]
        vals = [v for v in vals if v is not None]
        minmax[field] = (min(vals), max(vals)) if vals else (None, None)

    built = []
    for row in eligible_rows:
        pid = _to_int(row.get("PlayerNbr"))
        if not pid:
            continue

        first = row.get("First_Name")
        last = row.get("Last_Name")
        name = _format_name(first, last)
        if not name:
            continue

        norm_name = _norm_name(name)
        rank = _to_int(row.get("Current_Rank"))
        country = (row.get("Nationality") or "").strip().upper()

        asset = assets_by_id.get(pid) or assets_by_name.get(norm_name) or {}
        image_url = (asset.get("image_url") or "").strip()
        profile_url = (asset.get("profile_url") or "").strip()
        if not profile_url:
            profile_url = f"https://www.wtatennis.com/players/{pid}"

        weighted_sum = 0.0
        weight_total = 0.0
        metrics_details = []

        for field, label, is_percent, weight, lower_better in metric_specs:
            raw = _to_float(row.get(field))
            low, high = minmax[field]
            norm = _normalize(raw, low, high, lower_better)
            weighted_sum += norm * weight
            weight_total += weight
            metrics_details.append(
                {
                    "key": field,
                    "name": label,
                    "raw": raw,
                    "raw_display": _fmt_value(raw, is_percent),
                    "normalized": round(norm, 2),
                    "weight": weight,
                    "weight_pct": round(weight * 100, 1),
                    "min": low,
                    "max": high,
                    "lower_is_better": lower_better,
                    "is_percent": is_percent,
                }
            )

        if weight_total <= 0:
            continue
        rating = round(weighted_sum / weight_total, 1)

        built.append(
            {
                "player_id": str(pid),
                "player_name": name,
                "country": country,
                "rank": rank,
                "match_count": _to_int(row.get("MatchCount")),
                "profile_url": profile_url,
                "image_url": image_url,
                "rating": rating,
                "metrics": metrics_details,
            }
        )

    built.sort(
        key=lambda item: (
            -item["rating"],
            item["rank"] if item["rank"] is not None else 10**9,
            item["player_name"],
        )
    )

    leaders = built[:max_leaders]

    out_rows: List[LeaderRow] = []
    for idx, item in enumerate(leaders, start=1):
        metrics = item["metrics"]
        row = LeaderRow(
            fetched_at_utc=fetched_at_utc,
            category_key=category_key,
            category_label=category_label,
            rank=idx,
            player_name=item["player_name"],
            player_id=item["player_id"],
            profile_url=item["profile_url"],
            image_url=item["image_url"],
            rating=item["rating"],
            metrics_json=json.dumps(
                {
                    "category": category_key,
                    "player_rank": item["rank"],
                    "match_count": item.get("match_count"),
                    "formula": "normalized_score = Σ(metric_norm × weight)",
                    "metrics": metrics,
                },
                ensure_ascii=False,
            ),
        )

        for i in range(6):
            m = metrics[i] if i < len(metrics) else None
            setattr(row, f"metric_{i + 1}_name", m["name"] if m else "")
            setattr(row, f"metric_{i + 1}_value", m["raw_display"] if m else "")

        out_rows.append(row)

    return out_rows


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


def maybe_archive_existing(out_path: Path) -> Optional[Path]:
    if not out_path.exists():
        return None

    outdated_dir = out_path.parent.parent / "wta_stats_outdated"
    outdated_dir.mkdir(parents=True, exist_ok=True)

    stat = out_path.stat()
    ts = datetime.fromtimestamp(getattr(stat, "st_birthtime", stat.st_ctime)).strftime("%Y%m%d_%H%M%S")
    archive = outdated_dir / f"wta_stats_leaderboard_{ts}.csv"
    suffix = 1
    while archive.exists():
        archive = outdated_dir / f"wta_stats_leaderboard_{ts}_{suffix}.csv"
        suffix += 1

    shutil.copy2(out_path, archive)
    return archive


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent

    try:
        if args.archive_old:
            archived = maybe_archive_existing(args.out)
            if archived:
                print(f"[WTA STATS] Archived previous CSV -> {archived}")

        rows = fetch_players(
            year=args.year,
            max_players=max(10, args.max_players),
            max_pages=max(1, args.max_pages),
            timeout=max(5, args.timeout),
        )
        if not rows:
            raise RuntimeError("No WTA stat rows fetched")

        fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        assets_by_id, assets_by_name = _load_rankings_assets(repo_root)

        serve_rows = _build_category_rows(
            source_rows=rows,
            category_key="serve",
            category_label="Serve",
            metric_specs=SERVE_METRICS,
            fetched_at_utc=fetched_at,
            max_leaders=max(20, args.max_players),
            min_matches=max(0, args.min_matches),
            assets_by_id=assets_by_id,
            assets_by_name=assets_by_name,
        )
        return_rows = _build_category_rows(
            source_rows=rows,
            category_key="return",
            category_label="Return",
            metric_specs=RETURN_METRICS,
            fetched_at_utc=fetched_at,
            max_leaders=max(20, args.max_players),
            min_matches=max(0, args.min_matches),
            assets_by_id=assets_by_id,
            assets_by_name=assets_by_name,
        )

        all_rows = serve_rows + return_rows
        if not all_rows:
            raise RuntimeError("No leaderboard rows generated")

        write_csv(all_rows, args.out)

        print("\n[WTA STATS] Export complete")
        print(f"[WTA STATS] Output: {args.out}")
        print(f"[WTA STATS] Serve leaders: {len(serve_rows)}")
        print(f"[WTA STATS] Return leaders: {len(return_rows)}")
        return 0
    except Exception as exc:
        print(f"[WTA STATS] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
