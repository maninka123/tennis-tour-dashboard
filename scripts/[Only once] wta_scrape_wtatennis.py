#!/usr/bin/env python3
import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

BASE_URL = "https://www.wtatennis.com"
PLAYERS_URL = f"{BASE_URL}/players"
TENNIS_API_BASE = "https://api.wtatennis.com/tennis"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# ============================================================
# Configurable Defaults (edit here)
# ============================================================
DEFAULT_LIMIT = 200
DEFAULT_OUT_DIR = "data/wta"
DEFAULT_DELAY_SECONDS = 1.0
DEFAULT_YEAR = 2026

# Browser/requests behavior
DEFAULT_HEADLESS = True
DEFAULT_LOAD_MORE_CLICKS = 6
DEFAULT_REQUEST_TIMEOUT_SECONDS = 30

# Playwright waits (milliseconds)
DEFAULT_WAIT_INITIAL_LIST_MS = 1200
DEFAULT_WAIT_AFTER_LOAD_MORE_SCROLL_MS = 800
DEFAULT_WAIT_AFTER_LOAD_MORE_CLICK_MS = 1500
DEFAULT_WAIT_AFTER_FALLBACK_SCROLL_MS = 500
DEFAULT_WAIT_STATS_OPEN_MS = 1500
DEFAULT_WAIT_STATS_FILTER_MS = 1200
DEFAULT_WAIT_RECORD_OPEN_MS = 1200

# Runtime tunables (can be overridden by CLI in main)
PLAYWRIGHT_HEADLESS = DEFAULT_HEADLESS
PLAYWRIGHT_LOAD_MORE_CLICKS = DEFAULT_LOAD_MORE_CLICKS
REQUEST_TIMEOUT_SECONDS = DEFAULT_REQUEST_TIMEOUT_SECONDS


def green(text: str) -> str:
    return f"\033[92m{text}\033[0m"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def fetch_html(url: str, session: requests.Session) -> str:
    resp = session.get(
        url, timeout=REQUEST_TIMEOUT_SECONDS, headers={"User-Agent": USER_AGENT}
    )
    resp.raise_for_status()
    return resp.text


def fetch_json(
    url: str, session: requests.Session, headers: Optional[Dict[str, str]] = None
) -> Dict:
    req_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)
    resp = session.get(url, timeout=REQUEST_TIMEOUT_SECONDS, headers=req_headers)
    resp.raise_for_status()
    return resp.json()


def extract_player_links_from_html(html: str) -> List[Tuple[str, str]]:
    links = []
    for m in re.finditer(r'href="(/players/\d+/[^"]+)"', html):
        path = m.group(1)
        parts = path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "players":
            player_id = parts[1]
            links.append((player_id, path))
    # preserve order and uniqueness
    seen = set()
    uniq = []
    for pid, path in links:
        key = (pid, path)
        if key in seen:
            continue
        seen.add(key)
        uniq.append((pid, path))
    return uniq


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_players_with_playwright(limit: int) -> List[Tuple[str, str]]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        raise RuntimeError("playwright not available") from exc

    players = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=PLAYWRIGHT_HEADLESS)
        page = browser.new_page()
        page.goto(PLAYERS_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(DEFAULT_WAIT_INITIAL_LIST_MS)
        _dismiss_cookie_banner(page)

        # Hard-click Load More several times to ensure full list
        for _ in range(max(0, PLAYWRIGHT_LOAD_MORE_CLICKS)):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(DEFAULT_WAIT_AFTER_LOAD_MORE_SCROLL_MS)
            # Try normal click
            load_more = page.query_selector(
                "button:has-text('Load More'), a:has-text('Load More')"
            )
            if load_more:
                try:
                    load_more.click(force=True)
                except Exception:
                    pass
                # Force click via JS in case of overlay
                page.evaluate("""
                    (() => {
                        const btn = Array.from(document.querySelectorAll('button, a'))
                          .find(el => (el.textContent || '').trim().toLowerCase() === 'load more');
                        if (btn) btn.click();
                    })();
                """)
                page.wait_for_timeout(DEFAULT_WAIT_AFTER_LOAD_MORE_CLICK_MS)
                continue
            # Try scrolling a bit more to trigger lazy load
            page.evaluate("window.scrollTo(0, document.body.scrollHeight - 200)")
            page.wait_for_timeout(DEFAULT_WAIT_AFTER_FALLBACK_SCROLL_MS)

        # After loading, collect all players
        anchors = page.query_selector_all('a[href^="/players/"]')
        for a in anchors:
            href = a.get_attribute("href")
            if not href:
                continue
            if re.match(r"/players/\d+/", href):
                parts = href.strip("/").split("/")
                pid = parts[1]
                if (pid, href) not in players:
                    players.append((pid, href))

        browser.close()
    return players[:limit]


def get_players(limit: int) -> List[Tuple[str, str]]:
    # Try playwright for full list (Load More is client-side)
    try:
        players = get_players_with_playwright(limit)
        if players:
            return players
    except Exception:
        # Fallback to static HTML list (may be limited)
        session = requests.Session()
        html = fetch_html(PLAYERS_URL, session)
        links = extract_player_links_from_html(html)
        return links[:limit]
    # Fallback if playwright returned empty
    session = requests.Session()
    html = fetch_html(PLAYERS_URL, session)
    links = extract_player_links_from_html(html)
    return links[:limit]


def _slice_section(text: str, start_label: str, next_labels: List[str]) -> str:
    lower = text.lower()
    start = lower.find(start_label.lower())
    if start == -1:
        return ""
    end = len(text)
    for label in next_labels:
        idx = lower.find(label.lower(), start + len(start_label))
        if idx != -1:
            end = min(end, idx)
    return text[start:end]


def _pick_line_value(text: str, label: str) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for idx, line in enumerate(lines):
        if line.lower() == label.lower() and idx + 1 < len(lines):
            return lines[idx + 1]
    return None


def parse_records_from_text(text: str) -> List[Dict[str, str]]:
    records = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    header_idx = None
    for i, line in enumerate(lines):
        if line.lower() == "record":
            header_idx = i
            break
    if header_idx is None:
        return records
    for line in lines[header_idx + 1 :]:
        if not re.match(r"^\d{4}\b", line):
            continue
        parts = re.split(r"\s{2,}|\t", line)
        if len(parts) < 5:
            continue
        year = parts[0]
        ao, rg, wb, us = parts[1:5]
        records.append(
            {
                "year": year,
                "australian_open": ao,
                "french_open": rg,
                "wimbledon": wb,
                "us_open": us,
            }
        )
    return records


def _extract_text_lines(raw: str) -> List[str]:
    if "<" in raw and ">" in raw:
        cleaned = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"<style[^>]*>.*?</style>", " ", cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"<[^>]+>", "\n", cleaned)
        raw = cleaned
    return [line.strip() for line in raw.splitlines() if line.strip()]


def _normalize_result_token(token: str) -> str:
    if not token:
        return ""
    upper = token.upper().strip()
    if upper.startswith("ROUND OF"):
        digits = re.sub(r"[^\d]", "", upper)
        return f"R{digits}" if digits else ""
    if re.match(r"^R\\d+$", upper):
        return upper
    if upper in {"QF", "QUARTERFINAL", "QUARTERFINALS", "QUARTER-FINALS"}:
        return "QF"
    if upper in {"SF", "SEMIFINALS", "SEMI-FINALS", "SEMI FINAL", "SEMI-FINALIST"}:
        return "SF"
    if upper in {"F", "FINAL", "FINALIST"}:
        return "F"
    if upper in {"W", "WINNER"}:
        return "W"
    if upper in {"RR", "DNQ", "-"}:
        return upper
    return ""


def parse_records_tab(text: str) -> Dict[str, List[Dict[str, str]]]:
    # Try HTML table parsing first
    yearly_from_html = parse_records_table_from_html(text)
    if yearly_from_html:
        return {
            "summary": parse_records_summary_from_text(text),
            "yearly": yearly_from_html
        }

    lines = _extract_text_lines(text)
    events = ["Australian Open", "Roland Garros", "Wimbledon", "US Open"]

    summary = parse_records_summary_from_text(text)

    # Extract yearly results table (year + 4 results)
    yearly = []
    i = 0
    while i < len(lines):
        if re.match(r"^\d{4}$", lines[i]):
            year = lines[i]
            results = []
            j = i + 1
            while j < len(lines) and not re.match(r"^\d{4}$", lines[j]):
                token = lines[j]
                if "total w/l" in token.lower() or "tournament" in token.lower():
                    j += 1
                    continue
                normalized = _normalize_result_token(token)
                if normalized:
                    if not results or normalized != results[-1]:
                        results.append(normalized)
                    if len(results) == 4:
                        break
                j += 1
            if len(results) == 4:
                yearly.append({
                    "year": year,
                    "australian_open": results[0],
                    "roland_garros": results[1],
                    "french_open": results[1],
                    "wimbledon": results[2],
                    "us_open": results[3],
                })
            i = j
            continue
        i += 1

    return {
        "summary": summary,
        "yearly": yearly
    }


def parse_records_summary_from_text(text: str) -> List[Dict[str, str]]:
    lines = _extract_text_lines(text)
    events = ["Australian Open", "Roland Garros", "Wimbledon", "US Open"]
    summary = []
    lower_lines = [line.lower() for line in lines]
    for event in events:
        try:
            idx = lower_lines.index(event.lower())
        except ValueError:
            continue
        block = []
        for j in range(idx + 1, min(idx + 20, len(lines))):
            if lines[j] in events:
                break
            block.append(lines[j])
        best_result = ""
        best_years = ""
        total_wl = ""
        for entry in block:
            if re.search(r"Total W/L", entry):
                m = re.search(r"Total W/L\\s*-\\s*([\\d/]+)", entry)
                total_wl = m.group(1) if m else total_wl
                continue
            if re.search(r"\\b\\d{4}\\b", entry) and ("," in entry or "20" in entry):
                best_years = entry
                continue
            if any(word in entry.lower() for word in ["winner", "final", "semi", "quarter", "r32", "r64", "r128"]):
                if not best_result:
                    best_result = entry
        summary.append({
            "event": event,
            "best_result": best_result,
            "best_years": best_years,
            "total_wl": total_wl
        })
    return summary


def parse_records_table_from_html(html: str) -> List[Dict[str, str]]:
    yearly = []
    if "gs-history-table__row" not in html:
        return yearly
    rows = re.findall(r'<tr class=\"gs-history-table__row[^>]*\">(.*?)</tr>', html, re.DOTALL)
    for row in rows:
        year_match = re.search(r'>\s*(20\d{2})\s*<', row)
        if not year_match:
            continue
        year = year_match.group(1)
        mods = re.findall(r'gs-history-table__cell--([a-z0-9-]+)', row)
        if len(mods) < 4:
            continue
        def map_mod(mod):
            m = mod.lower()
            if m in {"w", "winner"}:
                return "W"
            if m in {"f", "final"}:
                return "F"
            if m in {"sf", "semi", "semifinal"}:
                return "SF"
            if m in {"qf", "quarterfinal"}:
                return "QF"
            if m.startswith("r") and m[1:].isdigit():
                return f"R{m[1:]}"
            if m == "blank":
                return "-"
            if m in {"rr", "dnq"}:
                return m.upper()
            return "-"
        results = [map_mod(mods[0]), map_mod(mods[1]), map_mod(mods[2]), map_mod(mods[3])]
        yearly.append({
            "year": year,
            "australian_open": results[0],
            "roland_garros": results[1],
            "french_open": results[1],
            "wimbledon": results[2],
            "us_open": results[3],
        })
    return yearly


def parse_stats_from_text(text: str) -> Dict[str, str]:
    def pick_from(source: str, label: str) -> Optional[str]:
        pattern = re.compile(
            rf"{re.escape(label)}\s+([\d\.\,%/$\-]+)", re.IGNORECASE
        )
        m = pattern.search(source)
        return m.group(1).strip() if m else None

    serving_text = _slice_section(
        text, "Singles Serving Stats", ["Singles Return Stats", "Return Stats"]
    ) or text
    return_text = _slice_section(text, "Singles Return Stats", ["Doubles", "Career"]) or text

    singles_titles = _pick_line_value(text, "Singles Titles")
    won_lost = _pick_line_value(text, "Won / Lost")
    prize_money = _pick_line_value(text, "Prize Money")

    return {
        "singles_ranking": pick_from(text, "Singles Ranking"),
        "matches_played": pick_from(text, "Matches Played"),
        "aces": pick_from(text, "Aces"),
        "service_games_won": pick_from(text, "Service Games Won"),
        "return_games_won": pick_from(text, "Return Games Won"),
        "first_serve_won": pick_from(text, "1st Serve Won"),
        "singles_titles": singles_titles,
        "won_lost": won_lost,
        "prize_money": prize_money,
        "singles_serving_stats": {
            "aces": pick_from(serving_text, "Aces"),
            "double_faults": pick_from(serving_text, "Double Faults"),
            "first_serve_pct": pick_from(serving_text, "1st Serve %"),
            "first_serve_won": pick_from(serving_text, "1st Serve Won"),
            "second_serve_won": pick_from(serving_text, "2nd Serve Won"),
            "break_points_saved": pick_from(serving_text, "Break Points Saved"),
            "service_points_won_pct": pick_from(serving_text, "Service Points Won %"),
            "service_games_won": pick_from(serving_text, "Service Games Won"),
            "service_games_played": pick_from(serving_text, "Service Games Played"),
        },
        "singles_return_stats": {
            "return_points_won": pick_from(return_text, "Return Points Won"),
            "first_return_points_won_pct": pick_from(return_text, "1st Return Points Won %"),
            "second_return_points_won_pct": pick_from(return_text, "2nd Return Points Won %"),
            "break_points_converted": pick_from(return_text, "Break Points Converted"),
            "return_games_won": pick_from(return_text, "Return Games Won"),
            "return_games_played": pick_from(return_text, "Return Games Played"),
        },
        "raw": {
            "serving_section": serving_text.strip(),
            "return_section": return_text.strip(),
        },
        "records": parse_records_from_text(text),
        "updated_at": _iso_now(),
    }


def _click_if_exists(page, selector: str) -> None:
    try:
        element = page.query_selector(selector)
        if element:
            element.click(force=True)
            page.wait_for_timeout(500)
    except Exception:
        return


def _dismiss_cookie_banner(page) -> None:
    try:
        # Common OneTrust selectors
        for selector in [
            "#onetrust-accept-btn-handler",
            "button#onetrust-accept-btn-handler",
            "button:has-text('Accept All')",
            "button:has-text('Accept')",
        ]:
            el = page.query_selector(selector)
            if el:
                try:
                    el.click(force=True)
                    page.wait_for_timeout(500)
                except Exception:
                    pass
        # Hide overlay if still present
        page.evaluate(
            """
            (() => {
              const ids = ['onetrust-consent-sdk','onetrust-banner-sdk'];
              ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
              });
              document.querySelectorAll('.onetrust-pc-dark-filter').forEach(el => {
                el.style.display = 'none';
              });
            })();
            """
        )
    except Exception:
        return


def _select_year_2026(page) -> None:
    try:
        selects = page.query_selector_all("select")
    except Exception:
        return
    for select in selects:
        try:
            options = select.query_selector_all("option")
        except Exception:
            continue
        for option in options:
            try:
                val = option.get_attribute("value") or ""
                text = option.inner_text() or ""
            except Exception:
                continue
            if "2026" in val or "2026" in text:
                try:
                    select.select_option(value=val if val else text)
                    page.wait_for_timeout(700)
                    return
                except Exception:
                    continue


def _to_int(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except Exception:
        return None


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _category_from_level(level: str) -> str:
    upper = str(level or "").upper()
    if "GS" in upper or "GRAND" in upper:
        return "grand_slam"
    if "1000" in upper or upper in {"PM", "P1"}:
        return "masters_1000"
    if "500" in upper or upper in {"P5"}:
        return "atp_500"
    if "250" in upper or upper in {"P2"}:
        return "atp_250"
    if "125" in upper or upper in {"P3"}:
        return "atp_125"
    if "FINALS" in upper or "FINAL" in upper:
        return "finals"
    if upper == "P":
        return "masters_1000"
    return "other"


def _category_label(category: str) -> str:
    labels = {
        "grand_slam": "Grand Slam",
        "masters_1000": "WTA 1000",
        "atp_500": "WTA 500",
        "atp_250": "WTA 250",
        "atp_125": "WTA 125",
        "finals": "WTA Finals",
        "other": "Tour",
    }
    return labels.get(category, "Tour")


def _surface_key(surface: str) -> str:
    text = str(surface or "").lower()
    if "grass" in text:
        return "grass"
    if "clay" in text:
        return "clay"
    if "indoor" in text:
        return "indoor"
    return "hard"


def _format_money(value: Any) -> str:
    numeric = _to_float(value)
    if numeric is None:
        return ""
    sign = "+" if numeric >= 0 else "-"
    return f"{sign}${abs(numeric):,.0f}"


def _format_points(value: Any) -> str:
    numeric = _to_float(value)
    if numeric is None:
        return ""
    sign = "+" if numeric >= 0 else ""
    if abs(numeric - round(numeric)) < 1e-9:
        return f"{sign}{int(round(numeric))}"
    return f"{sign}{numeric:.1f}"


def _format_date_range(start_date: str, end_date: str) -> str:
    def parse_date(value: str):
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
        except Exception:
            try:
                return datetime.fromisoformat(str(value)[:10]).date()
            except Exception:
                return None

    start = parse_date(start_date)
    end = parse_date(end_date)
    if not start and not end:
        return ""
    if start and end:
        if start.year == end.year:
            return f"{start.strftime('%d %b').lstrip('0')} - {end.strftime('%d %b %Y').lstrip('0')}"
        return f"{start.strftime('%d %b %Y').lstrip('0')} - {end.strftime('%d %b %Y').lstrip('0')}"
    single = start or end
    return single.strftime("%d %b %Y").lstrip("0")


def _qualifying_round_number(round_name: str, tourn_round: Any) -> Optional[int]:
    round_num = _to_int(tourn_round)
    if round_num is not None and round_num > 0:
        return round_num

    upper = str(round_name or "").strip().upper()
    if upper in {"Q", "Q1"}:
        return 1
    if upper == "Q2":
        return 2
    if upper == "Q3":
        return 3

    m_qual = re.search(r"(?:QUALIFYING\s*)?R\s*(\d+)$", upper)
    if m_qual:
        parsed = _to_int(m_qual.group(1))
        if parsed is not None and 0 < parsed <= 9:
            return parsed
    return None


def _round_label(round_name: str, tourn_round: Any, draw_level_type: Any = None) -> str:
    raw = str(round_name or "").strip()
    upper = raw.upper()
    draw_level = str(draw_level_type or "").strip().upper()

    # Keep qualifying rounds explicit even when DrawLevelType is missing.
    if upper in {"Q1", "Q2", "Q3"} or upper.startswith("QUALIFY"):
        q_round = _qualifying_round_number(raw, tourn_round)
        if q_round:
            return f"Qualifying R{q_round}"
        return raw or "Qualifying"

    # "Q" can be qualifying (Q1 shorthand) or quarterfinals.
    if upper == "Q" and draw_level != "M":
        q_round = _qualifying_round_number(raw, tourn_round)
        if q_round and q_round <= 3:
            return f"Qualifying R{q_round}"

    if draw_level == "Q":
        if upper in {"Q", "Q1", "Q2", "Q3"}:
            q_round = _qualifying_round_number(raw, tourn_round)
            if q_round:
                return f"Qualifying R{q_round}"
        if upper.startswith("QUALIFY"):
            q_round = _qualifying_round_number(raw, tourn_round)
            if q_round:
                return f"Qualifying R{q_round}"
            return raw
        q_round = _qualifying_round_number(raw, tourn_round)
        if q_round:
            return f"Qualifying R{q_round}"
        if re.match(r"^R\d+$", upper) or re.match(r"^ROUND OF \d+$", upper):
            return "Qualifying"
        return raw or "Qualifying"

    if raw:
        if upper in {"F", "FINAL"}:
            return "Final"
        if upper in {"SF", "S", "SEMIFINAL", "SEMIFINALS"}:
            return "Semifinals"
        if upper in {"QF", "Q", "QUARTERFINAL", "QUARTERFINALS"}:
            return "Quarterfinals"
        m_round_of = re.match(r"^ROUND OF (\d+)$", upper)
        if m_round_of:
            return f"Round of {m_round_of.group(1)}"
        m_r_code = re.match(r"^R(\d+)$", upper)
        if m_r_code:
            return f"Round of {m_r_code.group(1)}"
        return raw

    round_num = _to_int(tourn_round)
    if round_num is not None:
        return f"Round {round_num}"
    return "-"


def _round_sort_value(round_name: str, tourn_round: Any, draw_level_type: Any = None) -> int:
    raw = str(round_name or "").strip()
    upper = raw.upper()
    draw_level = str(draw_level_type or "").strip().upper()

    # Keep qualifying rows grouped after main draw rows.
    is_qualifying = (
        draw_level == "Q"
        or upper.startswith("QUALIFY")
        or upper in {"Q1", "Q2", "Q3"}
    )

    if not is_qualifying:
        if upper in {"F", "FINAL"}:
            return 1000
        if upper in {"SF", "S", "SEMIFINAL", "SEMIFINALS"}:
            return 900
        if upper in {"QF", "Q", "QUARTERFINAL", "QUARTERFINALS"}:
            return 800
        m_round_of = re.match(r"^ROUND OF (\d+)$", upper)
        if m_round_of:
            return 700 - (_to_int(m_round_of.group(1)) or 0)
        m_r_code = re.match(r"^R(\d+)$", upper)
        if m_r_code:
            return 700 - (_to_int(m_r_code.group(1)) or 0)

    if is_qualifying:
        q_round = _qualifying_round_number(raw, tourn_round)
        if q_round is not None:
            return 200 + q_round
        return 150

    round_num = _to_int(tourn_round)
    if round_num is not None:
        return 400 - round_num
    return 0


def _round_sort_from_label(round_label: Any) -> int:
    text = str(round_label or "").strip()
    if not text:
        return 0
    upper = text.upper()

    if upper in {"FINAL"}:
        return 1000
    if upper in {"SEMIFINALS", "SEMIFINAL", "SEMI FINAL", "SF"}:
        return 900
    if upper in {"QUARTERFINALS", "QUARTERFINAL", "QUARTER FINAL", "QF"}:
        return 800

    m_round_of = re.match(r"^ROUND OF (\d+)$", upper)
    if m_round_of:
        return 700 - (_to_int(m_round_of.group(1)) or 0)

    m_r_code = re.match(r"^R(\d+)$", upper)
    if m_r_code:
        return 700 - (_to_int(m_r_code.group(1)) or 0)

    if upper.startswith("QUALIFY"):
        q_round = _qualifying_round_number(text, None)
        if q_round is not None:
            return 200 + q_round
        return 150

    return 0


def _main_draw_bucket_key(label: Any) -> Optional[str]:
    value = str(label or "").strip().upper()
    if not value:
        return None

    m_round_of = re.match(r"^ROUND OF (\d+)$", value)
    if m_round_of:
        return f"R{m_round_of.group(1)}"

    m_r_code = re.match(r"^R(\d+)$", value)
    if m_r_code:
        return f"R{m_r_code.group(1)}"

    if value in {"FINAL", "F"}:
        return "F"
    if value in {"SEMIFINALS", "SEMIFINAL", "SEMI FINAL", "SF", "S"}:
        return "SF"
    if value in {"QUARTERFINALS", "QUARTERFINAL", "QUARTER FINAL", "QF"}:
        return "QF"
    return None


def _recent_round_sort_key(row: Dict[str, Any]) -> Tuple[int, int]:
    label = str((row or {}).get("round") or "").strip()
    upper = label.upper()
    is_qualifying = upper.startswith("QUALIFY")
    return (
        1 if is_qualifying else 0,
        -_round_sort_from_label(label),
    )


def _looks_like_main_draw_round(text: Any) -> bool:
    value = str(text or "").strip().upper()
    if not value:
        return False
    if value in {"F", "FINAL", "SF", "SEMIFINAL", "SEMIFINALS", "QF", "QUARTERFINAL", "QUARTERFINALS", "RR"}:
        return True
    if re.match(r"^R\d+$", value):
        return True
    if re.match(r"^ROUND OF \d+$", value):
        return True
    return False


def _opponent_strength_rank(row: Dict[str, Any]) -> int:
    rank = _to_int(row.get("opponent_rank"))
    if rank is not None and rank > 0:
        return rank
    seed = _to_int(row.get("opponent_seed"))
    if seed is not None and seed > 0:
        return 1000 + seed
    return 10**6


def _resolve_duplicate_qualifying_rows(matches: List[Dict[str, Any]]) -> None:
    """Resolve duplicate round rows where API merges qualifying/main draws.

    Some players can have two rows for the same round code (e.g. R128 twice).
    Keep the stronger-opponent row as main draw and relabel others as
    Qualifying R{tourn_round}.
    """
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    for row in matches:
        if not isinstance(row, dict):
            continue
        if str(row.get("draw_level_type") or "").strip().upper() == "Q":
            continue
        label = str(row.get("round") or "").strip()
        if not _looks_like_main_draw_round(label):
            continue
        key = _main_draw_bucket_key(label)
        if not key:
            continue
        buckets.setdefault(key, []).append(row)

    for _round_label_key, rows in buckets.items():
        if len(rows) <= 1:
            continue

        # Keep the likely main-draw row (strongest opponent = lower rank number).
        keep_main = sorted(rows, key=lambda r: (_opponent_strength_rank(r), str(r.get("opponent_name") or "")))[0]

        # Remaining rows are qualifying rows.
        q_rows = [r for r in rows if r is not keep_main]
        for idx, row in enumerate(sorted(q_rows, key=lambda r: (_opponent_strength_rank(r), str(r.get("opponent_name") or ""))), start=1):
            q_round = _qualifying_round_number(str(row.get("round_name") or ""), row.get("tourn_round"))
            if q_round is None:
                fallback_round = _to_int(row.get("tourn_round"))
                q_round = fallback_round if (fallback_round is not None and fallback_round > 0) else idx
            row["round"] = f"Qualifying R{q_round}"


def _normalize_recent_rounds_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return payload
    tournaments = payload.get("tournaments")
    if not isinstance(tournaments, list):
        return payload

    for event in tournaments:
        if not isinstance(event, dict):
            continue
        matches = event.get("matches")
        if not isinstance(matches, list):
            continue

        for row in matches:
            if not isinstance(row, dict):
                continue
            draw_level = row.get("draw_level_type") or row.get("DrawLevelType")
            row["round"] = _round_label(
                row.get("round_name", row.get("round")),
                row.get("tourn_round"),
                draw_level,
            )

        _resolve_duplicate_qualifying_rows(matches)

        # Sort after normalization so qualifying rounds stay grouped after main draw rounds.
        matches.sort(key=lambda row: _recent_round_sort_key(row) if isinstance(row, dict) else (9, 0))

    return payload


def _flip_score_for_player_perspective(score_text: str, player_side: int) -> str:
    text = re.sub(r"\s+", " ", str(score_text or "")).strip()
    if not text:
        return ""
    if player_side != 2:
        return text.replace(" ", ", ")

    parts = []
    for token in text.split(" "):
        m = re.match(r"^(\d+)-(\d+)(?:\((\d+)\))?$", token.strip())
        if not m:
            continue
        left, right, tb = int(m.group(1)), int(m.group(2)), m.group(3)
        left, right = right, left
        if tb:
            if left > right:
                parts.append(f"{left}-{right}({tb})")
            elif right > left:
                parts.append(f"{left}({tb})-{right}")
            else:
                parts.append(f"{left}-{right}({tb})")
        else:
            parts.append(f"{left}-{right}")
    return ", ".join(parts) if parts else text.replace(" ", ", ")


def scrape_player_recent_matches(player_id: str, year: int, session: requests.Session) -> Dict[str, Any]:
    url = f"{TENNIS_API_BASE}/players/{player_id}/matches?year={year}"
    payload = fetch_json(url, session, headers={"account": "wta"},)
    matches = payload.get("matches") if isinstance(payload, dict) else []
    if not isinstance(matches, list):
        return {"year": year, "tournaments": [], "updated_at": _iso_now()}

    pid_int = _to_int(player_id)
    grouped: Dict[str, Dict[str, Any]] = {}

    for row in matches:
        if not isinstance(row, dict):
            continue
        match_year = _to_int(row.get("tourn_year"))
        if match_year is not None and match_year != year:
            continue
        if str(row.get("s_d_flag") or "S").upper() not in {"S", ""}:
            continue

        p1 = _to_int(row.get("player_1"))
        p2 = _to_int(row.get("player_2"))
        if pid_int is None or (p1 != pid_int and p2 != pid_int):
            continue
        player_side = 1 if p1 == pid_int else 2

        tournament = row.get("tournament") if isinstance(row.get("tournament"), dict) else {}
        group = tournament.get("tournamentGroup") if isinstance(tournament.get("tournamentGroup"), dict) else {}
        tournament_name = str(row.get("TournamentName") or tournament.get("title") or group.get("name") or "Tournament").strip()
        level = str(row.get("TournamentLevel") or tournament.get("level") or group.get("level") or "").strip()
        category = _category_from_level(level)
        category_label = _category_label(category)

        surface = str(row.get("Surface") or tournament.get("surface") or "Hard").title()
        surface_key = _surface_key(surface)

        city = str(row.get("city") or tournament.get("city") or "").strip().title()
        country = str(row.get("Country") or tournament.get("country") or "").strip().title()
        location = " • ".join([v for v in [city, country] if v])

        start_date = str(tournament.get("startDate") or row.get("StartDate") or "")
        end_date = str(tournament.get("endDate") or "")
        date_range = _format_date_range(start_date, end_date)

        event_key = str(row.get("tourn_nbr") or tournament.get("liveScoringId") or f"{tournament_name}:{start_date}")
        if event_key not in grouped:
            draw_sizes = str(row.get("DrawSizes") or "").strip()
            if not draw_sizes:
                singles = _to_int(tournament.get("singlesDrawSize"))
                doubles = _to_int(tournament.get("doublesDrawSize"))
                if singles or doubles:
                    draw_sizes = f"{singles or 0}M/{doubles or 0}D"

            grouped[event_key] = {
                "event_key": event_key,
                "tournament": tournament_name,
                "location": location,
                "date_range": date_range,
                "category": category,
                "category_label": category_label,
                "surface": surface.upper(),
                "surface_key": surface_key,
                "rank": _to_int(row.get("rank_1") if player_side == 1 else row.get("rank_2")),
                "seed": _to_int(row.get("seed_1") if player_side == 1 else row.get("seed_2")),
                "wta_points_gain": _to_float(row.get("points_1") if player_side == 1 else row.get("points_2")),
                "prize_money_won": _to_float(row.get("PrizeWon")),
                "draw": draw_sizes,
                "start_date": start_date,
                "matches": [],
            }

        opp = row.get("opponent") if isinstance(row.get("opponent"), dict) else {}
        opponent_name = str(opp.get("fullName") or "").strip()
        opponent_country = str(opp.get("countryCode") or "").strip().upper()
        opponent_rank = _to_int(row.get("rank_2") if player_side == 1 else row.get("rank_1"))
        opponent_seed = _to_int(row.get("seed_2") if player_side == 1 else row.get("seed_1"))
        opponent_entry = str(row.get("entry_type_2") if player_side == 1 else row.get("entry_type_1") or "").strip().upper()

        winner = _to_int(row.get("winner"))
        if winner in (1, 2):
            result = "W" if winner == player_side else "L"
        else:
            result = "-"

        grouped[event_key]["matches"].append(
            {
                "round": _round_label(
                    row.get("round_name"),
                    row.get("tourn_round"),
                    row.get("DrawLevelType") or row.get("draw_level_type"),
                ),
                "round_sort": _round_sort_value(
                    row.get("round_name"),
                    row.get("tourn_round"),
                    row.get("DrawLevelType") or row.get("draw_level_type"),
                ),
                "round_name": str(row.get("round_name") or "").strip(),
                "tourn_round": _to_int(row.get("tourn_round")),
                "draw_level_type": str(row.get("DrawLevelType") or row.get("draw_level_type") or "").strip().upper(),
                "result": result,
                "opponent_name": opponent_name,
                "opponent_country": opponent_country,
                "opponent_seed": opponent_seed,
                "opponent_entry": opponent_entry,
                "score": _flip_score_for_player_perspective(row.get("scores"), player_side),
                "opponent_rank": opponent_rank,
            }
        )

        # Keep best available tournament-level values while iterating rows.
        current_points = _to_float(row.get("points_1") if player_side == 1 else row.get("points_2"))
        if current_points is not None:
            prev_points = grouped[event_key].get("wta_points_gain")
            if prev_points is None or current_points > prev_points:
                grouped[event_key]["wta_points_gain"] = current_points
        current_prize = _to_float(row.get("PrizeWon"))
        if current_prize is not None:
            prev_prize = grouped[event_key].get("prize_money_won")
            if prev_prize is None or current_prize > prev_prize:
                grouped[event_key]["prize_money_won"] = current_prize

    tournaments = []
    for event in grouped.values():
        event["matches"].sort(key=lambda m: m.get("round_sort", 0), reverse=True)
        for item in event["matches"]:
            item.pop("round_sort", None)
        event["summary"] = {
            "rank": event.get("rank"),
            "seed": event.get("seed"),
            "wta_points_gain": _format_points(event.get("wta_points_gain")),
            "prize_money_won": _format_money(event.get("prize_money_won")),
            "draw": event.get("draw") or "",
        }
        event.pop("event_key", None)
        event["_sort_start_date"] = event.get("start_date") or ""
        event.pop("start_date", None)
        tournaments.append(event)

    tournaments.sort(key=lambda t: str(t.get("_sort_start_date") or ""), reverse=True)
    for event in tournaments:
        event.pop("_sort_start_date", None)
    payload = {
        "year": year,
        "tournaments": tournaments,
        "updated_at": _iso_now(),
    }
    return _normalize_recent_rounds_payload(payload)


def scrape_player_stats(page, player_url: str) -> Dict[str, str]:
    try:
        _ = page
    except Exception as exc:
        raise RuntimeError("playwright not available") from exc

    stats_url = f"{player_url}/stats"
    page.goto(stats_url, wait_until="domcontentloaded")
    page.wait_for_timeout(DEFAULT_WAIT_STATS_OPEN_MS)
    _dismiss_cookie_banner(page)
    _click_if_exists(page, "button:has-text('Singles')")
    _select_year_2026(page)
    page.wait_for_timeout(DEFAULT_WAIT_STATS_FILTER_MS)
    text = page.inner_text("body")
    stats = parse_stats_from_text(text)
    return stats


def scrape_player_records(page, player_url: str) -> Dict[str, List[Dict[str, str]]]:
    # Prefer player record page HTML
    record_url = f"{player_url}/record"
    try:
        session = requests.Session()
        html = fetch_html(record_url, session)
        records = parse_records_tab(html)
        if records.get("summary") or records.get("yearly"):
            return records
    except Exception:
        pass

    # Fallback to stats page record tab
    stats_url = f"{player_url}/stats"
    page.goto(stats_url, wait_until="domcontentloaded")
    page.wait_for_timeout(DEFAULT_WAIT_RECORD_OPEN_MS)
    _dismiss_cookie_banner(page)
    _click_if_exists(page, "button:has-text('Record')")
    _click_if_exists(page, "button:has-text('Records')")
    page.wait_for_timeout(DEFAULT_WAIT_RECORD_OPEN_MS)
    text = page.inner_text("body")
    return parse_records_tab(text)


def fetch_player_overview(player_id: str, session: requests.Session) -> Dict:
    url = f"{TENNIS_API_BASE}/players/{player_id}/detailed"
    return fetch_json(url, session, headers={"account": "wta"})


def scrape_player_profile(player_url: str, player_id: str) -> Dict[str, str]:
    session = requests.Session()
    overview = {}
    try:
        overview = fetch_player_overview(player_id, session)
    except Exception:
        overview = {}

    bio = overview.get("bio", {}) if isinstance(overview, dict) else {}
    player = overview.get("player", {}) if isinstance(overview, dict) else {}

    name = (
        player.get("fullName")
        or f"{bio.get('firstname', '')} {bio.get('lastname', '')}".strip()
    )
    age = str(bio.get("age") or "")
    height = str(bio.get("height") or "")
    country = str(bio.get("countryname") or player.get("countryCode") or "")
    plays = str(bio.get("playhand") or "")

    # Fallback when API payload is incomplete for a player.
    if not name or not plays or not country or not height or not age:
        html = fetch_html(player_url, session)

        if not name:
            json_ld_match = re.search(
                r'<script type="application/ld\+json">([^<]+)</script>', html
            )
            if json_ld_match:
                try:
                    json_ld = json.loads(json_ld_match.group(1))
                    if isinstance(json_ld, dict):
                        name = json_ld.get("name", "") or name
                except Exception:
                    pass
            if not name:
                title_match = re.search(r"<title>([^<]+)</title>", html)
                name = title_match.group(1).split("|")[0].strip() if title_match else ""

        if not age:
            age_match = re.search(r"(\d{2})\s*yrs", html)
            age = age_match.group(1) if age_match else ""

        if not height:
            height_match = re.search(r"(\d+'\s*\d+\".*?\(\d\.\d{2}m\))", html)
            height = height_match.group(1) if height_match else ""

        if not plays:
            plays_match = re.search(r"Plays\s*([A-Za-z\-]+(?:\s*[A-Za-z\-]+)*)", html)
            plays = plays_match.group(1).strip() if plays_match else ""

        if not country:
            country_match = re.search(r'"country":"([^"]+)"', html)
            country = country_match.group(1) if country_match else ""

    return {
        "name": name.strip(),
        "age": age,
        "country": country,
        "height": height,
        "plays": plays,
        "image_url": "",
        "url": player_url,
        "updated_at": _iso_now(),
    }


def write_json(path: Path, data: Dict) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--out", default=DEFAULT_OUT_DIR)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR)
    parser.add_argument(
        "--load-more-clicks",
        type=int,
        default=DEFAULT_LOAD_MORE_CLICKS,
        help="How many times to click 'Load More' on the WTA players page",
    )
    parser.add_argument(
        "--request-timeout",
        type=int,
        default=DEFAULT_REQUEST_TIMEOUT_SECONDS,
        help="HTTP request timeout in seconds",
    )
    parser.add_argument(
        "--headful",
        action="store_true",
        help="Run browser with UI (default is headless)",
    )
    args = parser.parse_args()

    global PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LOAD_MORE_CLICKS, REQUEST_TIMEOUT_SECONDS
    PLAYWRIGHT_HEADLESS = not args.headful
    PLAYWRIGHT_LOAD_MORE_CLICKS = max(0, int(args.load_more_clicks))
    REQUEST_TIMEOUT_SECONDS = max(5, int(args.request_timeout))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    players = get_players(args.limit)
    total = len(players)
    if total == 0:
        print("No players found.")
        return 1

    print(green(f"Found {total} players. Starting scrape..."))
    print(
        f"Config -> limit={args.limit}, year={args.year}, out='{args.out}', "
        f"delay={args.delay}s, headless={PLAYWRIGHT_HEADLESS}, "
        f"load_more_clicks={PLAYWRIGHT_LOAD_MORE_CLICKS}, "
        f"request_timeout={REQUEST_TIMEOUT_SECONDS}s"
    )

    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        print("Playwright is required to scrape stats. Install with: pip install playwright")
        return 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=PLAYWRIGHT_HEADLESS)
        page = browser.new_page()

        api_session = requests.Session()

        for idx, (pid, path) in enumerate(players, 1):
            player_url = f"{BASE_URL}{path}"
            try:
                profile = scrape_player_profile(player_url, pid)
                name = profile.get("name") or f"player_{pid}"
                slug = slugify(name)
                folder = out_dir / f"{idx:03d}_{slug}"
                folder.mkdir(parents=True, exist_ok=True)

                stats = scrape_player_stats(page, player_url)
                records_tab = scrape_player_records(page, player_url)
                if records_tab.get("summary") or records_tab.get("yearly"):
                    stats["records_tab"] = records_tab
                recent_matches_tab = scrape_player_recent_matches(pid, args.year, api_session)
                if recent_matches_tab.get("tournaments"):
                    stats["recent_matches_tab"] = recent_matches_tab

                write_json(folder / "profile.json", profile)
                write_json(folder / "stats_2026.json", stats)

            except Exception as exc:
                err_path = out_dir / "errors.log"
                with err_path.open("a", encoding="utf-8") as f:
                    f.write(f"{player_url}\t{exc}\n")

            # progress bar
            progress = int((idx / total) * 40)
            bar = green("=" * progress) + "-" * (40 - progress)
            print(f"[{bar}] {idx}/{total} {path}")
            time.sleep(args.delay)

        browser.close()

    print(green("Done."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
