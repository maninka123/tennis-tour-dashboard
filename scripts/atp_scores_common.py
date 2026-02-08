#!/usr/bin/env python3
"""Shared helpers for ATP live/recent/upcoming score scripts."""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin

import cloudscraper
from bs4 import BeautifulSoup

BASE_URL = "https://www.atptour.com"
SCORES_CURRENT_URL = f"{BASE_URL}/en/scores/current"
ATP_GATEWAY_LIVE_URL = "https://app.atptour.com/api/v2/gateway/livematches/website"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": SCORES_CURRENT_URL,
    "Accept": "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

NON_TOUR_EVENT_TYPES = {
    "CH",
    "CHALLENGER",
    "DCR",
    "LVR",
    "UTS",
    "ITF",
}


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        text = str(value).strip()
        if text == "":
            return None
        return int(text)
    except Exception:
        return None


def _clean_text(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _slugify(text: str) -> str:
    base = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    base = base.lower()
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = re.sub(r"-+", "-", base)
    return base.strip("-") or "tournament"


def _format_duration(value: Any) -> Optional[str]:
    text = _clean_text(value)
    if not text:
        return None
    parts = text.split(":")
    if len(parts) != 3:
        return text
    h = _to_int(parts[0])
    m = _to_int(parts[1])
    if h is None or m is None:
        return text
    if h > 0:
        return f"{h}:{m:02d}"
    return f"0:{m:02d}"


def _absolute_url(path_or_url: Any) -> str:
    text = _clean_text(path_or_url)
    if not text:
        return ""
    return urljoin(BASE_URL, text)


def _flag_code_from_node(node: Optional[BeautifulSoup]) -> Optional[str]:
    if not node:
        return None
    use = node.select_one("use")
    href = ""
    if use:
        href = use.get("href") or use.get("xlink:href") or ""
    if not href:
        return None
    m = re.search(r"flag-([a-z]{2,3})", href, flags=re.IGNORECASE)
    if not m:
        return None
    return m.group(1).upper()


def _player_id_from_profile_link(link: str) -> Optional[str]:
    text = _clean_text(link)
    if not text:
        return None
    m = re.search(r"/players/[^/]+/([a-z0-9]+)/", text, flags=re.IGNORECASE)
    if not m:
        return None
    return m.group(1).upper()


def _event_category(event_type: Any) -> str:
    code = _clean_text(event_type).upper()
    if code in ("GS", "GRANDSLAM", "GRAND_SLAM"):
        return "grand_slam"
    if "1000" in code:
        return "masters_1000"
    if "500" in code:
        return "atp_500"
    if "250" in code:
        return "atp_250"
    if "125" in code:
        return "atp_125"
    if "FINAL" in code:
        return "finals"
    return "other"


def _is_tour_tournament(tournament: Dict[str, Any]) -> bool:
    if not isinstance(tournament, dict):
        return False
    if bool(tournament.get("HasTeamTieStats")):
        return False
    event_type = _clean_text(tournament.get("EventType")).upper()
    if event_type in NON_TOUR_EVENT_TYPES:
        return False
    return True


def _build_location(tournament: Dict[str, Any]) -> str:
    city = _clean_text(tournament.get("EventCity"))
    country = _clean_text(tournament.get("EventCountry"))
    if city and country:
        return f"{city}, {country}"
    if city:
        return city
    return country


def make_scraper() -> Any:
    scraper = cloudscraper.create_scraper(browser={"browser": "chrome", "platform": "windows", "mobile": False})
    scraper.headers.update(HEADERS)
    return scraper


def fetch_tour_tournaments(scraper: Any, timeout: int = 30) -> List[Dict[str, Any]]:
    payload = None
    attempts = 3

    for _ in range(attempts):
        try:
            scraper.get(SCORES_CURRENT_URL, timeout=timeout)
            response = scraper.get(
                ATP_GATEWAY_LIVE_URL,
                params={"scoringTournamentLevel": "tour"},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            break
        except Exception:
            payload = None
            continue

    if payload is None:
        return []

    data = payload.get("Data") if isinstance(payload, dict) else {}
    tournaments = data.get("LiveMatchesTournamentsOrdered") if isinstance(data, dict) else []
    if not isinstance(tournaments, list):
        return []
    return [t for t in tournaments if _is_tour_tournament(t)]


def _build_player_from_team(team: Dict[str, Any]) -> Dict[str, Any]:
    player = (team or {}).get("Player") or {}
    first = _clean_text(player.get("PlayerFirstName"))
    last = _clean_text(player.get("PlayerLastName"))
    name = _clean_text(f"{first} {last}")
    player_id = _clean_text(player.get("PlayerId")).upper()
    image_url = (
        f"{BASE_URL}/-/media/alias/player-headshot/{player_id.lower()}"
        if player_id
        else None
    )
    return {
        "id": player_id or None,
        "name": name or "TBD",
        "country": _clean_text(player.get("PlayerCountry")).upper() or None,
        "rank": None,
        "image_url": image_url,
    }


def _infer_tiebreak_values(
    p1: Optional[int],
    p2: Optional[int],
    tb1: Optional[int],
    tb2: Optional[int],
) -> Optional[Dict[str, int]]:
    if tb1 is None and tb2 is None:
        return None
    if tb1 is None and tb2 is not None and p1 is not None and p2 is not None:
        if p1 > p2:
            tb1 = max(tb2 + 2, 7)
        elif p2 > p1:
            tb1 = tb2
    if tb2 is None and tb1 is not None and p1 is not None and p2 is not None:
        if p2 > p1:
            tb2 = max(tb1 + 2, 7)
        elif p1 > p2:
            tb2 = tb1
    if tb1 is None or tb2 is None:
        return None
    return {"p1": int(tb1), "p2": int(tb2)}


def _parse_gateway_sets(match: Dict[str, Any]) -> List[Dict[str, Any]]:
    player_a = (match.get("PlayerTeam") or {}).get("SetScores") or []
    player_b = (match.get("OpponentTeam") or {}).get("SetScores") or []

    def _ordered(rows: Any) -> List[Dict[str, Any]]:
        if not isinstance(rows, list):
            return []
        valid = [row for row in rows if isinstance(row, dict)]
        return sorted(valid, key=lambda row: _to_int(row.get("SetNumber")) or 0)

    sets_a = _ordered(player_a)
    sets_b = _ordered(player_b)
    size = max(len(sets_a), len(sets_b))
    parsed: List[Dict[str, Any]] = []

    for idx in range(size):
        row_a = sets_a[idx] if idx < len(sets_a) else {}
        row_b = sets_b[idx] if idx < len(sets_b) else {}
        p1 = _to_int(row_a.get("SetScore"))
        p2 = _to_int(row_b.get("SetScore"))
        if p1 is None and p2 is None:
            continue
        entry: Dict[str, Any] = {
            "p1": int(p1 if p1 is not None else 0),
            "p2": int(p2 if p2 is not None else 0),
        }
        tb = _infer_tiebreak_values(
            p1=p1,
            p2=p2,
            tb1=_to_int(row_a.get("TieBreakScore")),
            tb2=_to_int(row_b.get("TieBreakScore")),
        )
        if tb:
            entry["tiebreak"] = tb
        parsed.append(entry)

    return parsed


def _winner_from_sets(sets: List[Dict[str, Any]]) -> Optional[int]:
    p1_sets = sum(1 for s in sets if _to_int(s.get("p1")) is not None and _to_int(s.get("p2")) is not None and int(s["p1"]) > int(s["p2"]))
    p2_sets = sum(1 for s in sets if _to_int(s.get("p1")) is not None and _to_int(s.get("p2")) is not None and int(s["p2"]) > int(s["p1"]))
    if p1_sets > p2_sets:
        return 1
    if p2_sets > p1_sets:
        return 2
    return None


def _serving_from_gateway(match: Dict[str, Any]) -> Optional[int]:
    raw = match.get("ServerTeam")
    text = _clean_text(raw).upper()
    if text in ("A", "1"):
        return 1
    if text in ("B", "2"):
        return 2
    num = _to_int(raw)
    if num in (1, 2):
        return int(num)
    return None


def _compose_match_id(event_year: Any, event_id: Any, match_id: Any) -> str:
    return f"atp_{_clean_text(event_year)}_{_clean_text(event_id)}_{_clean_text(match_id)}"


def parse_live_matches_from_gateway(tournaments: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    live_matches: List[Dict[str, Any]] = []

    for tournament in tournaments:
        event_id = _clean_text(tournament.get("EventId"))
        event_year = _clean_text(tournament.get("EventYear"))
        event_title = _clean_text(tournament.get("EventTitle")) or "Tournament"
        category = _event_category(tournament.get("EventType"))

        for match in (tournament.get("LiveMatches") or []):
            if not isinstance(match, dict):
                continue
            if _clean_text(match.get("Type")).lower() != "singles":
                continue
            status_code = _clean_text(match.get("MatchStatus")).upper()
            if status_code != "P":
                continue

            p1 = _build_player_from_team(match.get("PlayerTeam") or {})
            p2 = _build_player_from_team(match.get("OpponentTeam") or {})
            sets = _parse_gateway_sets(match)
            score_payload: Dict[str, Any] = {"sets": sets}
            game_p1 = _clean_text((match.get("PlayerTeam") or {}).get("GameScore"))
            game_p2 = _clean_text((match.get("OpponentTeam") or {}).get("GameScore"))
            if game_p1 or game_p2:
                score_payload["current_game"] = {"p1": game_p1, "p2": game_p2}

            match_id = _clean_text(match.get("MatchId"))
            live_matches.append(
                {
                    "id": _compose_match_id(event_year, event_id, match_id),
                    "tour": "ATP",
                    "tournament": event_title,
                    "tournament_category": category,
                    "atp_event_id": event_id or None,
                    "atp_event_year": event_year or None,
                    "atp_match_id": match_id or None,
                    "location": _build_location(tournament),
                    "surface": "",
                    "round": _clean_text(match.get("RoundName")) or "",
                    "court": _clean_text(match.get("CourtName")) if _clean_text(match.get("CourtName")) != "0" else "",
                    "player1": p1,
                    "player2": p2,
                    "status": "live",
                    "serving": _serving_from_gateway(match),
                    "match_time": _format_duration(match.get("MatchTimeTotal")),
                    "scheduled_time": _clean_text(match.get("LastUpdated")) or None,
                    "score": score_payload,
                }
            )

    return live_matches


def _extract_results_player(stats_item: BeautifulSoup) -> Tuple[Dict[str, Any], List[Tuple[int, Optional[int]]], bool]:
    profile_img = stats_item.select_one(".profile img")
    profile_src = profile_img.get("src") if profile_img else ""

    name_link = stats_item.select_one(".name a")
    profile_href = name_link.get("href") if name_link else ""
    player_name = _clean_text(name_link.get_text(" ", strip=True) if name_link else "")
    player_id = _player_id_from_profile_link(profile_href)

    country = _flag_code_from_node(stats_item.select_one(".country"))
    winner = bool(stats_item.select_one(".player-info .winner"))

    score_cells: List[Tuple[int, Optional[int]]] = []
    for cell in stats_item.select(".scores .score-item"):
        spans = [_clean_text(s.get_text(" ", strip=True)) for s in cell.select("span")]
        spans = [s for s in spans if s]
        if not spans:
            continue
        main = _to_int(spans[0])
        if main is None:
            continue
        tb = _to_int(spans[1]) if len(spans) > 1 else None
        score_cells.append((int(main), tb if tb is not None else None))

    player = {
        "id": player_id,
        "name": player_name or "TBD",
        "country": country,
        "rank": None,
        "image_url": _absolute_url(profile_src) if profile_src else None,
    }
    return player, score_cells, winner


def _scores_to_sets(
    scores_p1: List[Tuple[int, Optional[int]]],
    scores_p2: List[Tuple[int, Optional[int]]],
) -> List[Dict[str, Any]]:
    sets: List[Dict[str, Any]] = []
    size = min(len(scores_p1), len(scores_p2))
    for idx in range(size):
        p1, tb1 = scores_p1[idx]
        p2, tb2 = scores_p2[idx]
        entry: Dict[str, Any] = {"p1": p1, "p2": p2}
        tb = _infer_tiebreak_values(p1=p1, p2=p2, tb1=tb1, tb2=tb2)
        if tb:
            entry["tiebreak"] = tb
        sets.append(entry)
    return sets


def _parse_results_page_date(header_text: str) -> Optional[datetime]:
    text = _clean_text(header_text)
    # Example: "Fri, 06 February, 2026 Day (6)"
    m = re.search(r"(\d{1,2}\s+[A-Za-z]+,\s*\d{4})", text)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%d %B, %Y")
    except Exception:
        return None


def parse_recent_matches_from_results_page(
    html_text: str,
    tournament: Dict[str, Any],
) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html_text or "", "html.parser")
    parsed: List[Dict[str, Any]] = []

    event_id = _clean_text(tournament.get("EventId"))
    event_year = _clean_text(tournament.get("EventYear"))
    event_title = _clean_text(tournament.get("EventTitle")) or "Tournament"
    category = _event_category(tournament.get("EventType"))
    location = _build_location(tournament)

    for day_block in soup.select(".atp_accordion-item"):
        day_header = day_block.select_one(".tournament-day h4")
        day_dt = _parse_results_page_date(day_header.get_text(" ", strip=True) if day_header else "")
        day_iso = day_dt.strftime("%Y-%m-%dT00:00:00") if day_dt else None

        for match_node in day_block.select(".match-group-content > .match"):
            stats_items = match_node.select(".match-content .match-stats > .stats-item")
            if len(stats_items) < 2:
                continue

            p1, p1_scores, p1_winner = _extract_results_player(stats_items[0])
            p2, p2_scores, p2_winner = _extract_results_player(stats_items[1])
            if not p1.get("name") or not p2.get("name"):
                continue

            sets = _scores_to_sets(p1_scores, p2_scores)
            winner = 1 if p1_winner else 2 if p2_winner else _winner_from_sets(sets)

            header_strong = match_node.select_one(".match-header strong")
            header_text = _clean_text(header_strong.get_text(" ", strip=True) if header_strong else "")
            round_text = header_text
            court_text = ""
            if " - " in header_text:
                round_text, court_text = [part.strip() for part in header_text.split(" - ", 1)]

            duration_text = ""
            header_spans = match_node.select(".match-header > span")
            if len(header_spans) > 1:
                duration_text = _clean_text(header_spans[1].get_text(" ", strip=True))

            stats_link = ""
            for link in match_node.select(".match-footer .match-cta a[href]"):
                href = _clean_text(link.get("href"))
                if "/scores/" in href and "/archive/" in href:
                    stats_link = href
                    break

            match_code = ""
            if stats_link:
                m = re.search(r"/archive/(\d{4})/(\d+)/(\w+)", stats_link, flags=re.IGNORECASE)
                if m:
                    event_year = event_year or m.group(1)
                    event_id = event_id or m.group(2)
                    match_code = m.group(3).upper()

            if not match_code:
                match_code = f"RS{len(parsed) + 1:03d}"

            parsed.append(
                {
                    "id": _compose_match_id(event_year, event_id, match_code),
                    "tour": "ATP",
                    "tournament": event_title,
                    "tournament_category": category,
                    "atp_event_id": event_id or None,
                    "atp_event_year": event_year or None,
                    "atp_match_id": match_code,
                    "location": location,
                    "surface": "",
                    "round": round_text or "",
                    "court": court_text,
                    "player1": p1,
                    "player2": p2,
                    "status": "finished",
                    "winner": winner,
                    "final_score": {"sets": sets},
                    "match_duration": _format_duration(duration_text),
                    "scheduled_time": day_iso,
                    "atp_stats_url": _absolute_url(stats_link) if stats_link else None,
                }
            )

    return parsed


def _extract_schedule_player(side_node: BeautifulSoup) -> Dict[str, Any]:
    profile_img = side_node.select_one(".profile img")
    profile_src = profile_img.get("src") if profile_img else ""

    name_link = side_node.select_one(".name a")
    profile_href = name_link.get("href") if name_link else ""
    player_name = _clean_text(name_link.get_text(" ", strip=True) if name_link else "")
    player_id = _player_id_from_profile_link(profile_href)
    country = _flag_code_from_node(side_node.select_one(".country"))

    return {
        "id": player_id,
        "name": player_name or "TBD",
        "country": country,
        "rank": None,
        "image_url": _absolute_url(profile_src) if profile_src else None,
    }


def parse_upcoming_matches_from_schedule_page(
    html_text: str,
    tournament: Dict[str, Any],
    days: int,
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html_text or "", "html.parser")
    parsed: List[Dict[str, Any]] = []

    now_dt = now or datetime.now()
    cutoff = now_dt + timedelta(days=max(0, int(days)))

    event_id = _clean_text(tournament.get("EventId"))
    event_year = _clean_text(tournament.get("EventYear"))
    event_title = _clean_text(tournament.get("EventTitle")) or "Tournament"
    category = _event_category(tournament.get("EventType"))
    location = _build_location(tournament)

    for idx, schedule_node in enumerate(soup.select(".schedule"), start=1):
        dt_text = _clean_text(schedule_node.get("data-datetime"))
        if not dt_text:
            continue
        try:
            match_dt = datetime.strptime(dt_text, "%Y-%m-%d %H:%M:%S")
        except Exception:
            continue

        if match_dt < now_dt:
            continue
        if match_dt > cutoff:
            continue

        player_side = schedule_node.select_one(".schedule-players > .player")
        opponent_side = schedule_node.select_one(".schedule-players > .opponent")
        if not player_side or not opponent_side:
            continue

        player1 = _extract_schedule_player(player_side)
        player2 = _extract_schedule_player(opponent_side)
        if not player1.get("name") or not player2.get("name"):
            continue

        round_text = _clean_text(
            (schedule_node.select_one(".schedule-header .schedule-type") or schedule_node.select_one(".schedule-content .schedule-type") or {}).get_text(" ", strip=True)
            if (schedule_node.select_one(".schedule-header .schedule-type") or schedule_node.select_one(".schedule-content .schedule-type"))
            else ""
        )

        h2h_link = schedule_node.select_one(".schedule-cta a[href*='/players/atp-head-2-head/']")
        match_code = ""
        if h2h_link:
            href = _clean_text(h2h_link.get("href"))
            ids = re.findall(r"/([a-z0-9]{3,6})(?:/|$)", href, flags=re.IGNORECASE)
            if len(ids) >= 2:
                match_code = f"UP_{ids[-2].upper()}_{ids[-1].upper()}_{match_dt.strftime('%Y%m%d%H%M')}"

        if not match_code:
            match_code = f"UP_{match_dt.strftime('%Y%m%d%H%M')}_{idx:03d}"

        parsed.append(
            {
                "id": _compose_match_id(event_year, event_id, match_code),
                "tour": "ATP",
                "tournament": event_title,
                "tournament_category": category,
                "atp_event_id": event_id or None,
                "atp_event_year": event_year or None,
                "atp_match_id": match_code,
                "location": location,
                "surface": "",
                "round": round_text,
                "court": "",
                "player1": player1,
                "player2": player2,
                "status": "upcoming",
                "scheduled_time": match_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            }
        )

    return parsed


def build_results_url(tournament: Dict[str, Any]) -> str:
    slug = _slugify(_clean_text(tournament.get("EventTitle")))
    event_id = _clean_text(tournament.get("EventId"))
    return f"{BASE_URL}/en/scores/current/{slug}/{event_id}/results"


def build_schedule_url(tournament: Dict[str, Any]) -> str:
    slug = _slugify(_clean_text(tournament.get("EventTitle")))
    event_id = _clean_text(tournament.get("EventId"))
    schedule_link = _clean_text(tournament.get("ScheduleLink")) or "daily-schedule"
    return f"{BASE_URL}/en/scores/current/{slug}/{event_id}/{schedule_link}"
