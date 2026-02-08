#!/usr/bin/env python3
"""Build ATP tournament JSON files from ATP Tour calendar + draws.

Incremental mode (default):
- If no local JSON exists, do a full build.
- If local JSON exists, only refresh tournaments that are in progress or finished
  and not yet complete. Skip upcoming and already-complete tournaments.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import time
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import cloudscraper
from bs4 import BeautifulSoup

BASE_URL = "https://www.atptour.com"
CALENDAR_ENDPOINT = f"{BASE_URL}/en/-/tournaments/calendar/tour"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

CATEGORY_POINTS = {
    "grand_slam": {"R128": 10, "R64": 45, "R32": 90, "R16": 180, "QF": 360, "SF": 720, "F": 1200, "W": 2000},
    "masters_1000": {"R64": 25, "R32": 45, "R16": 90, "QF": 180, "SF": 360, "F": 600, "W": 1000},
    "atp_500": {"R32": 20, "R16": 45, "QF": 90, "SF": 180, "F": 300, "W": 500},
    "atp_250": {"R32": 10, "R16": 20, "QF": 45, "SF": 90, "F": 150, "W": 250},
    "atp_125": {"R32": 7, "R16": 13, "QF": 25, "SF": 45, "F": 75, "W": 125},
    "finals": {"RR": 200, "SF": 400, "F": 500, "W": 1500},
}


def _iso_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "tournament"


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        text = _clean(value).replace(",", "")
        if not text:
            return None
        return int(text)
    except Exception:
        return None


def _to_iso_date(dt: Optional[date]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%Y-%m-%d")


def _month_num(name: str) -> Optional[int]:
    try:
        return datetime.strptime(name[:3], "%b").month
    except Exception:
        return None


def _parse_formatted_date(text: str) -> Tuple[Optional[date], Optional[date], Optional[int]]:
    value = _clean(text)
    if not value:
        return None, None, None
    clean = value.replace(",", "")

    # 2 - 11 January 2026
    m = re.match(r"^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", clean)
    if m:
        d1 = int(m.group(1))
        d2 = int(m.group(2))
        month = _month_num(m.group(3))
        year = int(m.group(4))
        if month:
            return date(year, month, d1), date(year, month, d2), year

    # 23 February - 1 March 2026
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", clean)
    if m:
        d1 = int(m.group(1))
        m1 = _month_num(m.group(2))
        d2 = int(m.group(3))
        m2 = _month_num(m.group(4))
        year = int(m.group(5))
        if m1 and m2:
            y2 = year + 1 if m2 < m1 else year
            return date(year, m1, d1), date(y2, m2, d2), year

    # 18 January - 1 February, 2026 (comma variant already removed)
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", clean)
    if m:
        d1 = int(m.group(1))
        m1 = _month_num(m.group(2))
        d2 = int(m.group(3))
        m2 = _month_num(m.group(4))
        year = int(m.group(5))
        if m1 and m2:
            y2 = year + 1 if m2 < m1 else year
            return date(year, m1, d1), date(y2, m2, d2), year

    return None, None, None


def _category_from_badge(url: str) -> str:
    text = _clean(url).lower()
    if "grandslam" in text:
        return "grand_slam"
    if "1000" in text:
        return "masters_1000"
    if "500" in text:
        return "atp_500"
    if "250" in text:
        return "atp_250"
    if "125" in text:
        return "atp_125"
    if "finals" in text:
        return "finals"
    if "unitedcup" in text:
        return "atp_500"
    return "other"


def _level_label(category: str) -> str:
    labels = {
        "grand_slam": "Grand Slam",
        "masters_1000": "ATP 1000",
        "atp_500": "ATP 500",
        "atp_250": "ATP 250",
        "atp_125": "ATP 125",
        "finals": "ATP Finals",
        "other": "Tour",
    }
    return labels.get(category, "Tour")


def _is_supported_tour_event(row: Dict[str, Any]) -> bool:
    badge = _clean(row.get("BadgeUrl")).lower()
    if any(token in badge for token in ("itf", "lvr", "dcr", "challenger")):
        return False
    event_type = _clean(row.get("Type")).upper()
    if event_type in {"CH", "ITF", "LVR", "DCR"}:
        return False
    return True


def _status_from_row(row: Dict[str, Any], start_dt: Optional[date], end_dt: Optional[date], today: date) -> str:
    if bool(row.get("IsLive")):
        return "in_progress"
    if bool(row.get("IsPastEvent")):
        return "finished"
    if start_dt and end_dt:
        if end_dt < today:
            return "finished"
        if start_dt <= today <= end_dt:
            return "in_progress"
        return "upcoming"
    return "upcoming"


def _extract_city_country(location: str) -> Tuple[str, str]:
    loc = _clean(location)
    if not loc:
        return "", ""
    parts = [p.strip() for p in loc.split(",") if p.strip()]
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def _absolute_url(path_or_url: str) -> str:
    return urljoin(BASE_URL, _clean(path_or_url))


def _extract_player_id(href: str) -> Optional[str]:
    m = re.search(r"/players/[^/]+/([a-z0-9]+)/", _clean(href), flags=re.IGNORECASE)
    if not m:
        return None
    return m.group(1).upper()


def _round_code(raw: str) -> str:
    text = _clean(raw).lower()
    if not text:
        return ""
    m = re.search(r"round\s+of\s+(\d+)", text)
    if m:
        return f"R{m.group(1)}"
    if "quarter" in text:
        return "QF"
    if "semi" in text:
        return "SF"
    if text in {"final", "the final"} or " final" in text:
        return "F"
    if "round robin" in text:
        return "RR"
    q = re.search(r"qual(?:ifying)?\s*(?:round)?\s*(\d+)", text)
    if q:
        return f"Q{q.group(1)}"
    return _clean(raw)


def _winner_tb_from_loser(loser: Optional[int]) -> Optional[int]:
    if loser is None:
        return None
    return max(7, int(loser) + 2)


def _parse_player_stats_item(node: BeautifulSoup) -> Dict[str, Any]:
    name_link = node.select_one(".name a")
    name_text = _clean(name_link.get_text(" ", strip=True) if name_link else node.select_one(".name").get_text(" ", strip=True) if node.select_one(".name") else "")
    seed_or_entry = ""
    seed_span = node.select_one(".name span")
    if seed_span:
        seed_or_entry = _clean(seed_span.get_text(" ", strip=True)).strip("()")

    profile_href = _clean(name_link.get("href") if name_link else "")
    player_id = _extract_player_id(profile_href)

    country = None
    use_node = node.select_one(".country use")
    if use_node:
        href = _clean(use_node.get("href") or use_node.get("xlink:href"))
        m = re.search(r"flag-([a-z]{2,3})", href, flags=re.IGNORECASE)
        if m:
            country = m.group(1).upper()

    img = node.select_one(".profile img")
    image_url = _absolute_url(_clean(img.get("src") if img else "")) if img else ""

    score_cells: List[Tuple[Optional[int], Optional[int]]] = []
    for cell in node.select(".scores .score-item"):
        spans = [
            _clean(span.get_text(" ", strip=True))
            for span in cell.select("span")
        ]
        p = _to_int(spans[0]) if len(spans) > 0 else None
        tb = _to_int(spans[1]) if len(spans) > 1 else None
        score_cells.append((p, tb))

    winner = bool(node.select_one(".winner"))

    player = {
        "id": player_id,
        "name": name_text or "TBD",
        "country": country,
        "seed": _to_int(seed_or_entry) if seed_or_entry.isdigit() else None,
        "entry": seed_or_entry if seed_or_entry and not seed_or_entry.isdigit() else None,
        "image_url": image_url or None,
        "profile_url": _absolute_url(profile_href) if profile_href else None,
    }
    return {
        "player": player,
        "scores": score_cells,
        "winner": winner,
    }


def _scores_to_sets(
    p1_scores: List[Tuple[Optional[int], Optional[int]]],
    p2_scores: List[Tuple[Optional[int], Optional[int]]],
) -> List[Dict[str, Any]]:
    sets: List[Dict[str, Any]] = []
    for idx in range(min(len(p1_scores), len(p2_scores))):
        p1, tb1 = p1_scores[idx]
        p2, tb2 = p2_scores[idx]
        if p1 is None and p2 is None:
            continue
        entry = {"p1": int(p1 or 0), "p2": int(p2 or 0)}
        if tb1 is None and tb2 is not None:
            if (p1 or 0) > (p2 or 0):
                tb1 = _winner_tb_from_loser(tb2)
            else:
                tb1 = tb2
        if tb2 is None and tb1 is not None:
            if (p2 or 0) > (p1 or 0):
                tb2 = _winner_tb_from_loser(tb1)
            else:
                tb2 = tb1
        if tb1 is not None and tb2 is not None:
            entry["tiebreak"] = {"p1": int(tb1), "p2": int(tb2)}
        sets.append(entry)
    return sets


def _winner_from_sets(sets: List[Dict[str, Any]]) -> Optional[int]:
    p1_wins = sum(1 for s in sets if int(s.get("p1", 0)) > int(s.get("p2", 0)))
    p2_wins = sum(1 for s in sets if int(s.get("p2", 0)) > int(s.get("p1", 0)))
    if p1_wins > p2_wins:
        return 1
    if p2_wins > p1_wins:
        return 2
    return None


def parse_draw_html(html: str, category: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html or "", "html.parser")
    rounds_out: List[Dict[str, Any]] = []

    draw_nodes = soup.select(".atp-draw-container .atp-draw-scroller .draw")
    for draw_node in draw_nodes:
        round_header = _clean(draw_node.select_one(".draw-header").get_text(" ", strip=True) if draw_node.select_one(".draw-header") else "")
        if not round_header:
            continue
        round_label = _round_code(round_header)

        match_nodes = draw_node.select(".draw-content > .draw-item")
        matches: List[Dict[str, Any]] = []
        for match_idx, match_node in enumerate(match_nodes, start=1):
            stats_items = match_node.select(".draw-stats .stats-item")
            if len(stats_items) < 2:
                continue

            p1_data = _parse_player_stats_item(stats_items[0])
            p2_data = _parse_player_stats_item(stats_items[1])
            sets = _scores_to_sets(p1_data["scores"], p2_data["scores"])

            winner_side = 1 if p1_data["winner"] else 2 if p2_data["winner"] else _winner_from_sets(sets)
            winner = p1_data["player"] if winner_side == 1 else p2_data["player"] if winner_side == 2 else None

            status = "scheduled"
            if sets or winner_side is not None:
                status = "finished"

            stats_link = ""
            link = match_node.select_one(".stats-cta a[href*='/scores/stats-centre/archive/']")
            if link:
                stats_link = _absolute_url(_clean(link.get("href")))
            match_code = ""
            if stats_link:
                m = re.search(r"/archive/(\d{4})/(\d+)/(\w+)$", stats_link, flags=re.IGNORECASE)
                if m:
                    match_code = m.group(3)

            points_map = CATEGORY_POINTS.get(category, {})

            matches.append(
                {
                    "id": match_code or f"{round_label}_{match_idx}",
                    "round": round_label,
                    "match_number": match_idx,
                    "player1": p1_data["player"],
                    "player2": p2_data["player"],
                    "score": {"sets": sets} if sets else None,
                    "status": status,
                    "winner": winner,
                    "points": points_map.get(round_label),
                    "prize_money": None,
                    "stats_url": stats_link or None,
                }
            )

        if matches:
            rounds_out.append({"round": round_label, "matches": matches})

    # Deduplicate by round order if page includes repeated structures.
    seen = set()
    unique_rounds: List[Dict[str, Any]] = []
    for row in rounds_out:
        key = row.get("round")
        if key in seen:
            continue
        seen.add(key)
        unique_rounds.append(row)

    return {
        "rounds": [r.get("round") for r in unique_rounds],
        "matches": unique_rounds,
    }


def _status_score(value: str) -> int:
    val = _clean(value).lower()
    if val == "in_progress":
        return 3
    if val == "finished":
        return 2
    return 1


def _is_complete_tournament_tree(record: Dict[str, Any], today: date) -> bool:
    if not isinstance(record, dict):
        return False
    end_text = _clean(record.get("end_date"))
    end_dt = None
    if end_text:
        try:
            end_dt = datetime.strptime(end_text, "%Y-%m-%d").date()
        except Exception:
            end_dt = None

    status = _clean(record.get("status")).lower()
    is_finished = status == "finished" or bool(end_dt and end_dt < today)
    if not is_finished:
        return False

    champion = record.get("champion") or {}
    champion_name = _clean(champion.get("name") if isinstance(champion, dict) else "")
    if not champion_name:
        return False

    bracket = record.get("bracket") or {}
    rounds = bracket.get("matches") if isinstance(bracket, dict) else []
    if not isinstance(rounds, list) or not rounds:
        return False

    final_round = next((r for r in rounds if _clean(r.get("round")) in {"F", "Final", "FINAL"}), None)
    if not final_round:
        return False
    final_matches = final_round.get("matches") or []
    if not final_matches:
        return False
    final_winner = (final_matches[0].get("winner") or {}).get("name") if isinstance(final_matches[0], dict) else ""
    return bool(_clean(final_winner))


def _load_existing_records(output_dir: Path, year: int) -> Dict[str, Dict[str, Any]]:
    existing: Dict[str, Dict[str, Any]] = {}
    for file_path in sorted(output_dir.glob("*.json")):
        try:
            payload = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if _to_int(payload.get("year")) not in {None, year}:
            continue
        group_id = _clean(payload.get("tournament_group_id") or payload.get("id"))
        if not group_id:
            continue
        existing[group_id] = {"path": file_path, "data": payload}
    return existing


def _archive_file_if_needed(path: Path, outdated_dir: Path, stamp: str) -> None:
    if not path.exists():
        return
    target_dir = outdated_dir / stamp
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / path.name
    suffix = 1
    while target.exists():
        target = target_dir / f"{path.stem}_{suffix}{path.suffix}"
        suffix += 1
    shutil.copy2(path, target)


def _build_scraper() -> Any:
    scraper = cloudscraper.create_scraper(browser={"browser": "chrome", "platform": "windows", "mobile": False})
    scraper.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            "Referer": f"{BASE_URL}/en/tournaments",
        }
    )
    return scraper


def _fetch_calendar(scraper: Any, timeout: int) -> List[Dict[str, Any]]:
    resp = scraper.get(CALENDAR_ENDPOINT, timeout=timeout)
    resp.raise_for_status()
    payload = resp.json() if resp.text else {}
    out: List[Dict[str, Any]] = []
    for block in payload.get("TournamentDates", []) or []:
        for row in block.get("Tournaments", []) or []:
            if isinstance(row, dict):
                out.append(row)
    return out


def _build_tournament_record(row: Dict[str, Any], year: int, today: date) -> Dict[str, Any]:
    tournament_id = _clean(row.get("Id"))
    name = _clean(row.get("Name")) or "Tournament"
    location = _clean(row.get("Location"))
    city, country = _extract_city_country(location)

    start_dt, end_dt, parsed_year = _parse_formatted_date(_clean(row.get("FormattedDate")))
    record_year = parsed_year or year

    surface = _clean(row.get("Surface")) or "Hard"
    indoor_outdoor = _clean(row.get("IndoorOutdoor"))
    if indoor_outdoor and "indoor" in indoor_outdoor.lower() and "Indoor" not in surface:
        surface = f"{surface} (Indoor)"

    category = _category_from_badge(_clean(row.get("BadgeUrl")))
    status = _status_from_row(row, start_dt, end_dt, today)

    draws_url = _clean(row.get("DrawsUrl"))
    scores_url = _clean(row.get("ScoresUrl"))
    if not draws_url and scores_url:
        draws_url = re.sub(r"/results$", "/draws", scores_url)
        draws_url = re.sub(r"/country-results$", "/country-draws", draws_url)

    return {
        "order": 0,
        "tournament_group_id": int(tournament_id) if tournament_id.isdigit() else tournament_id,
        "id": int(tournament_id) if tournament_id.isdigit() else tournament_id,
        "name": name,
        "title": f"{name} - {location}" if location else name,
        "level": _level_label(category),
        "level_number": _level_label(category),
        "category": category,
        "year": int(record_year),
        "start_date": _to_iso_date(start_dt),
        "end_date": _to_iso_date(end_dt),
        "surface": surface,
        "indoor_outdoor": "I" if "indoor" in indoor_outdoor.lower() else "O" if indoor_outdoor else "",
        "city": city,
        "country": country,
        "location": location,
        "status": status,
        "draw_size_singles": _to_int(row.get("SglDrawSize")),
        "draw_size_doubles": _to_int(row.get("DblDrawSize")),
        "prize_money": _clean(row.get("TotalFinancialCommitment")) or _clean(row.get("PrizeMoneyDetails")),
        "prize_money_currency": "USD",
        "draw_url": _absolute_url(draws_url) if draws_url else "",
        "scores_url": _absolute_url(scores_url) if scores_url else "",
        "champion": None,
        "runner_up": None,
        "draw": None,
        "matches": [],
        "bracket": {
            "tournament_id": int(tournament_id) if tournament_id.isdigit() else tournament_id,
            "tournament_name": name,
            "tournament_category": category,
            "tournament_surface": surface,
            "tournament_year": int(record_year),
            "tournament_status": status,
            "tournament_tour": "atp",
            "draw_size": _to_int(row.get("SglDrawSize")) or 32,
            "rounds": [],
            "matches": [],
            "round_points": CATEGORY_POINTS.get(category, {}),
            "round_prize": {},
            "champion": None,
            "source": "atp",
        },
    }


def _enrich_with_draw(scraper: Any, record: Dict[str, Any], timeout: int) -> Tuple[bool, Optional[str]]:
    draw_url = _clean(record.get("draw_url"))
    if not draw_url:
        return False, "draw url missing"

    resp = scraper.get(draw_url, timeout=timeout)
    if resp.status_code == 404:
        return False, "draw page not found"
    resp.raise_for_status()

    parsed = parse_draw_html(resp.text or "", record.get("category") or "other")
    rounds = parsed.get("rounds") or []
    round_rows = parsed.get("matches") or []

    record["draw"] = {
        "draw_size": record.get("draw_size_singles") or 0,
        "surface": record.get("surface") or "",
        "draw_type": "Singles",
        "draw_lines": [],
        "breakdown": [],
        "results": [],
    }

    # Flatten bracket matches into `matches` for compatibility fallback paths.
    flat_matches: List[Dict[str, Any]] = []
    for round_block in round_rows:
        round_label = _clean(round_block.get("round"))
        for match in round_block.get("matches") or []:
            item = {
                "match_id": match.get("id"),
                "round_id": round_label,
                "draw_level_type": "M",
                "draw_match_type": "S",
                "match_state": "F" if match.get("status") == "finished" else "P",
                "player_a": match.get("player1") or {},
                "player_b": match.get("player2") or {},
                "score_string": " ".join(
                    f"{s.get('p1', 0)}-{s.get('p2', 0)}"
                    + (
                        f"({s.get('tiebreak', {}).get('p2')})"
                        if isinstance(s.get("tiebreak"), dict)
                        and s.get("p1", 0) != s.get("p2", 0)
                        and ((s.get("p1", 0) > s.get("p2", 0) and s.get("tiebreak", {}).get("p2") is not None) or (s.get("p2", 0) > s.get("p1", 0) and s.get("tiebreak", {}).get("p1") is not None))
                        else ""
                    )
                    for s in (match.get("score") or {}).get("sets", [])
                ).strip(),
                "winner_side": "A" if (match.get("winner") or {}).get("id") == (match.get("player1") or {}).get("id") else "B" if (match.get("winner") or {}).get("id") == (match.get("player2") or {}).get("id") else None,
            }
            flat_matches.append(item)

    record["matches"] = flat_matches

    bracket = record.get("bracket") or {}
    bracket["rounds"] = rounds
    bracket["matches"] = round_rows

    final_round = next((r for r in round_rows if _clean(r.get("round")) == "F"), None)
    champion = None
    runner_up = None
    if final_round and (final_round.get("matches") or []):
        final_match = final_round.get("matches")[0]
        winner = final_match.get("winner") or {}
        p1 = final_match.get("player1") or {}
        p2 = final_match.get("player2") or {}
        if winner:
            champion = {"name": winner.get("name"), "country": winner.get("country"), "image_url": winner.get("image_url")}
            if winner.get("id") and winner.get("id") == p1.get("id"):
                runner_up = {"name": p2.get("name"), "country": p2.get("country"), "image_url": p2.get("image_url")}
            elif winner.get("id") and winner.get("id") == p2.get("id"):
                runner_up = {"name": p1.get("name"), "country": p1.get("country"), "image_url": p1.get("image_url")}

    bracket["champion"] = champion
    record["bracket"] = bracket
    record["champion"] = champion
    record["runner_up"] = runner_up

    return bool(round_rows), None


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape ATP tournaments calendar + draw data into JSON files.")
    parser.add_argument("--year", type=int, default=2026, help="Season year")
    parser.add_argument("--output-dir", type=str, default="data/atp/tournaments", help="Output folder")
    parser.add_argument("--outdated-dir", type=str, default="data/atp_tournaments_outdated", help="Archive folder for replaced JSON")
    parser.add_argument("--limit", type=int, default=0, help="Optional cap on number of tournaments")
    parser.add_argument("--full-refresh", action="store_true", help="Refresh all tournaments, ignoring incremental skip rules")
    parser.add_argument("--timeout", type=int, default=45, help="HTTP timeout seconds")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between draw requests")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    outdated_dir = Path(args.outdated_dir)
    outdated_dir.mkdir(parents=True, exist_ok=True)

    today = datetime.utcnow().date()
    existing = _load_existing_records(output_dir, args.year)
    archive_stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    scraper = _build_scraper()

    try:
        rows = _fetch_calendar(scraper, timeout=args.timeout)
    except Exception as exc:
        print(f"[ERROR] Failed to fetch ATP tournament calendar: {exc}")
        return 1

    filtered_rows = []
    for row in rows:
        if not _is_supported_tour_event(row):
            continue
        # keep only requested year where parse is available
        start_dt, end_dt, parsed_year = _parse_formatted_date(_clean(row.get("FormattedDate")))
        if parsed_year and parsed_year != int(args.year):
            continue
        if not parsed_year and _to_int(row.get("Year")) not in {None, args.year}:
            continue
        filtered_rows.append(row)

    if args.limit and args.limit > 0:
        filtered_rows = filtered_rows[: args.limit]

    if not filtered_rows and not existing:
        print("[WARN] No ATP tournaments parsed and no existing JSON files found.")
        return 0

    output_records: List[Dict[str, Any]] = []
    seen_ids = set()
    stats = {
        "total_source": len(filtered_rows),
        "refreshed": 0,
        "skipped": 0,
        "draw_success": 0,
        "draw_failed": 0,
        "new_files": 0,
        "updated_files": 0,
        "unchanged_files": 0,
    }

    for idx, row in enumerate(filtered_rows, start=1):
        record = _build_tournament_record(row, year=args.year, today=today)
        gid = _clean(record.get("tournament_group_id"))
        if not gid:
            continue
        seen_ids.add(gid)

        existing_entry = existing.get(gid)
        existing_data = existing_entry.get("data") if existing_entry else None

        skip_refresh = False
        if existing_data and not args.full_refresh:
            source_status = _clean(record.get("status")).lower()
            if source_status == "upcoming":
                skip_refresh = True
            elif source_status == "finished" and _is_complete_tournament_tree(existing_data, today):
                skip_refresh = True

        if skip_refresh:
            merged = dict(existing_data)
            merged.update(
                {
                    "name": record.get("name"),
                    "title": record.get("title"),
                    "location": record.get("location"),
                    "start_date": record.get("start_date"),
                    "end_date": record.get("end_date"),
                    "status": record.get("status"),
                    "surface": record.get("surface"),
                    "category": record.get("category") or merged.get("category"),
                }
            )
            output_records.append(merged)
            stats["skipped"] += 1
            print(f"[{idx}/{len(filtered_rows)}] {record.get('name')} -> skip (incremental)")
            continue

        draw_ok = False
        draw_msg = None
        try:
            draw_ok, draw_msg = _enrich_with_draw(scraper, record, timeout=args.timeout)
        except Exception as exc:
            draw_ok = False
            draw_msg = str(exc)

        if draw_ok:
            stats["draw_success"] += 1
        else:
            stats["draw_failed"] += 1

        output_records.append(record)
        stats["refreshed"] += 1
        suffix = "" if draw_ok else f" (draw missing: {draw_msg})"
        print(f"[{idx}/{len(filtered_rows)}] {record.get('name')} -> refreshed{suffix}")

        if args.delay > 0:
            time.sleep(args.delay)

    # Keep existing records that are not present in current source payload.
    for gid, entry in existing.items():
        if gid in seen_ids:
            continue
        output_records.append(entry["data"])

    output_records.sort(key=lambda x: ((x.get("start_date") or "9999-12-31"), _clean(x.get("name"))))
    for order, record in enumerate(output_records, start=1):
        record["order"] = order

    # Write files with archive-on-change.
    for record in output_records:
        gid = _clean(record.get("tournament_group_id"))
        name = _clean(record.get("name") or record.get("title") or f"tournament-{record.get('order')}")
        filename = f"{int(record.get('order') or 0):03d}_{_slugify(name)}.json"
        out_path = output_dir / filename

        new_text = json.dumps(record, ensure_ascii=False, indent=2)

        existing_entry = existing.get(gid)
        previous_path = existing_entry.get("path") if existing_entry else None
        previous_text = ""
        if previous_path and previous_path.exists():
            try:
                previous_text = previous_path.read_text(encoding="utf-8")
            except Exception:
                previous_text = ""

        if previous_path and previous_text == new_text and previous_path.resolve() == out_path.resolve():
            stats["unchanged_files"] += 1
            continue

        if previous_path and previous_path.exists() and previous_text != new_text:
            _archive_file_if_needed(previous_path, outdated_dir, archive_stamp)

        if out_path.exists() and (not previous_path or out_path.resolve() != previous_path.resolve()):
            old_text = ""
            try:
                old_text = out_path.read_text(encoding="utf-8")
            except Exception:
                old_text = ""
            if old_text != new_text:
                _archive_file_if_needed(out_path, outdated_dir, archive_stamp)

        out_path.write_text(new_text, encoding="utf-8")

        if previous_path and previous_path.exists() and previous_path.resolve() != out_path.resolve():
            previous_path.unlink(missing_ok=True)

        if previous_path:
            stats["updated_files"] += 1
        else:
            stats["new_files"] += 1

    # Remove duplicate old names for this year when they are not in the current output set.
    keep_names = {f"{int(r.get('order') or 0):03d}_{_slugify(_clean(r.get('name') or r.get('title') or 'tournament'))}.json" for r in output_records}
    for extra in output_dir.glob("*.json"):
        if extra.name not in keep_names:
            # Keep unknown files if they are not this season.
            try:
                payload = json.loads(extra.read_text(encoding="utf-8"))
                if _to_int(payload.get("year")) == args.year:
                    _archive_file_if_needed(extra, outdated_dir, archive_stamp)
                    extra.unlink(missing_ok=True)
            except Exception:
                continue

    print("========== ATP TOURNAMENT SUMMARY ==========")
    print(f"source rows:      {stats['total_source']}")
    print(f"refreshed rows:   {stats['refreshed']}")
    print(f"skipped rows:     {stats['skipped']}")
    print(f"draw success:     {stats['draw_success']}")
    print(f"draw failed:      {stats['draw_failed']}")
    print(f"new files:        {stats['new_files']}")
    print(f"updated files:    {stats['updated_files']}")
    print(f"unchanged files:  {stats['unchanged_files']}")
    print(f"output dir:       {output_dir}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
