#!/usr/bin/env python3
"""
Initial ATP player data scraper (folder creator), matching the WTA script style.

What it does:
- Reads ATP rankings (ranked players + profile URLs)
- Scrapes each player's profile, season/career stats, and recent activity
- Saves to data/atp/<rank>_<slug>/profile.json + stats_2026.json
- Saves player image as image.jpg/png (unless --skip-images)

Source notes:
- ATP pages are Cloudflare-protected for direct scripted requests.
- This script uses r.jina.ai to fetch ATP page markdown snapshots.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

BASE_URL = "https://www.atptour.com"
RJINA_PREFIX = "https://r.jina.ai/http://"
RANKINGS_URL_TEMPLATE = f"{BASE_URL}/en/rankings/singles?rankRange={{start}}-{{end}}"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

# ============================================================
# Configurable Defaults (edit here)
# ============================================================
DEFAULT_LIMIT = 200
DEFAULT_OUT_DIR = "data/atp"
DEFAULT_DELAY_SECONDS = 0.35
DEFAULT_YEAR = 2026
DEFAULT_TIMEOUT_SECONDS = 45
DEFAULT_DOWNLOAD_IMAGES = True


def green(text: str) -> str:
    return f"\033[92m{text}\033[0m"


def yellow(text: str) -> str:
    return f"\033[93m{text}\033[0m"


def red(text: str) -> str:
    return f"\033[91m{text}\033[0m"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rjina_url(url: str) -> str:
    plain = str(url or "").strip()
    plain = re.sub(r"^https?://", "", plain)
    return f"{RJINA_PREFIX}{plain}"


def _split_markdown_row(line: str) -> List[str]:
    text = line.strip()
    if not text.startswith("|"):
        return []
    return [part.strip() for part in text.strip("|").split("|")]


def _to_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        return int(text)
    except Exception:
        return None


def _fetch_markdown(session: requests.Session, url: str, timeout: int) -> str:
    request_url = _rjina_url(url)
    max_attempts = 4
    for attempt in range(1, max_attempts + 1):
        try:
            resp = session.get(request_url, timeout=timeout)
            if resp.status_code in {429, 500, 502, 503, 504}:
                raise requests.HTTPError(
                    f"temporary upstream error {resp.status_code} for {request_url}",
                    response=resp,
                )
            resp.raise_for_status()
            text = resp.text or ""
            if text.strip():
                return text
            raise requests.HTTPError(f"empty response for {request_url}", response=resp)
        except requests.RequestException:
            if attempt >= max_attempts:
                raise
            time.sleep(min(8.0, 0.75 * (2 ** (attempt - 1))))


def _extract_profile_parts(profile_url: str) -> Tuple[str, str]:
    match = re.search(
        r"/en/players/(?P<slug>[^/]+)/(?P<player_id>[A-Za-z0-9]+)/overview",
        str(profile_url or ""),
        flags=re.IGNORECASE,
    )
    if not match:
        return "", ""
    return match.group("slug"), match.group("player_id").upper()


def _extract_player_link(player_cell: str) -> Tuple[str, str]:
    link_match = re.search(
        r"\[(?P<name>[^\]]+)\]\((?P<url>https?://www\.atptour\.com/en/players/[^)]+/overview)\)",
        player_cell,
        flags=re.IGNORECASE,
    )
    if not link_match:
        return "", ""
    return link_match.group("name").strip(), link_match.group("url").strip()


def _extract_image_link(player_cell: str) -> str:
    img_match = re.search(r"!\[[^\]]*\]\((https?://[^)]+)\)", player_cell, flags=re.IGNORECASE)
    if not img_match:
        return ""
    return img_match.group(1).strip()


def parse_rankings_markdown(markdown: str) -> List[Dict[str, Any]]:
    rows: Dict[int, Dict[str, Any]] = {}
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            continue
        cols = _split_markdown_row(line)
        if len(cols) < 3:
            continue
        rank = _to_int(cols[0])
        if rank is None:
            continue

        # Prefer the detailed table format: rank | player | age | points | ...
        # but accept fallback rows as well.
        player_col = cols[1]
        points_col = ""
        for cell in cols[2:]:
            if "rankings-breakdown" in cell.lower():
                points_col = cell
                break
        if not points_col:
            for cell in cols[2:]:
                if re.search(r"\[\d[\d,]*\]", cell):
                    points_col = cell
                    break
        if not points_col:
            for cell in cols[2:]:
                if re.search(r"\b\d[\d,]*\b", cell):
                    points_col = cell
                    break
        if not points_col:
            continue

        player_name, profile_url = _extract_player_link(player_col)
        if not profile_url:
            continue

        points_match = re.search(r"(\d[\d,]*)", points_col)
        points = points_match.group(1).replace(",", "") if points_match else ""
        slug, player_id = _extract_profile_parts(profile_url)
        if not player_id:
            continue

        image_url = _extract_image_link(player_col)
        if not image_url:
            image_url = f"{BASE_URL}/-/media/alias/player-gladiator-headshot/{player_id.lower()}"

        rows[rank] = {
            "rank": rank,
            "name": player_name,
            "profile_url": profile_url,
            "slug": slug,
            "player_id": player_id,
            "points": points,
            "image_url": image_url,
        }

    ordered = [rows[k] for k in sorted(rows.keys())]
    return ordered


def fetch_ranked_players(limit: int, session: requests.Session, timeout: int) -> List[Dict[str, Any]]:
    collected: List[Dict[str, Any]] = []
    start = 1
    while len(collected) < limit:
        end = start + 99
        url = RANKINGS_URL_TEMPLATE.format(start=start, end=end)
        try:
            markdown = _fetch_markdown(session, url, timeout)
        except requests.RequestException as exc:
            if collected:
                print(yellow(f"[WARN] rankings fetch failed for range {start}-{end}: {exc}"))
                print(yellow("[WARN] returning partial ranked list from successful ranges"))
                break
            raise
        rows = parse_rankings_markdown(markdown)
        if not rows:
            break

        for row in rows:
            if row["rank"] < start or row["rank"] > end:
                continue
            collected.append(row)
            if len(collected) >= limit:
                break

        if end >= limit and len(rows) < 100:
            break
        start += 100
        if start > 2000:
            break

    # Keep stable by rank and unique rank.
    uniq = {}
    for row in collected:
        uniq[row["rank"]] = row
    ordered = [uniq[k] for k in sorted(uniq.keys())]
    return ordered[:limit]


def _pick_regex(text: str, pattern: str) -> str:
    m = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
    return m.group(1).strip() if m else ""


def _extract_personal_details(overview_md: str) -> Dict[str, str]:
    # Most players include these in "### Personal details"
    age = _pick_regex(overview_md, r"\*\s+Age\s+([^\n]+)")
    height = _pick_regex(overview_md, r"\*\s+Height\s+([^\n]+)")
    weight = _pick_regex(overview_md, r"\*\s+Weight\s+([^\n]+)")
    country = _pick_regex(overview_md, r"\*\s+Country\s+([^\n]+)")
    birthplace = _pick_regex(overview_md, r"\*\s+Birthplace\s+([^\n]+)")
    plays = _pick_regex(overview_md, r"\*\s+Plays\s+([^\n]+)")
    coach = _pick_regex(overview_md, r"\*\s+Coach\s+([^\n]+)")
    turned_pro = _pick_regex(overview_md, r"\*\s+Turned pro\s+([^\n]+)")

    age_num = _pick_regex(age, r"^(\d{1,2})") if age else ""

    return {
        "age": age_num or age,
        "height": height,
        "weight": weight,
        "country": country,
        "birthplace": birthplace,
        "plays": plays,
        "coach": coach,
        "turned_pro": turned_pro,
    }


def _extract_overview_summary(overview_md: str) -> Dict[str, str]:
    # Career summary block appears around "Career" marker.
    career_wl = _pick_regex(overview_md, r"\n\n(\d+\s*-\s*\d+)\s+W-L")
    career_titles = _pick_regex(overview_md, r"\n\n(\d+)\s+Titles")
    career_prize = _pick_regex(
        overview_md,
        r"\n\n(\$[\d,]+)\s+Prize Money Singles & Doubles Combined",
    )
    career_high = _pick_regex(
        overview_md,
        r"Career High Rank(?:\s*\([^)]*\))?:\s*\*\*(\d+)\*\*",
    )
    ytd_rank = _pick_regex(overview_md, r"YTD Rank:\s*\*\*(\d+)\*\*")
    ytd_wl = _pick_regex(overview_md, r"YTD[\s\S]{0,140}?(\d+\s*-\s*\d+)\s+W-L")
    ytd_titles = _pick_regex(overview_md, r"YTD[\s\S]{0,180}?(\d+)\s+Titles")
    ytd_prize = _pick_regex(overview_md, r"YTD[\s\S]{0,260}?(\$[\d,]+)\s+Prize Money")

    return {
        "won_lost": career_wl,
        "singles_titles": career_titles,
        "prize_money": career_prize,
        "career_high_rank": career_high,
        "ytd_rank": ytd_rank,
        "ytd_won_lost": ytd_wl,
        "ytd_titles": ytd_titles,
        "ytd_prize_money": ytd_prize,
    }


def scrape_player_profile(ranking_row: Dict[str, Any], session: requests.Session, timeout: int) -> Dict[str, Any]:
    player_url = ranking_row["profile_url"]
    overview_md = _fetch_markdown(session, player_url, timeout)

    details = _extract_personal_details(overview_md)
    summary = _extract_overview_summary(overview_md)

    image_url = _pick_regex(
        overview_md,
        r"\((https?://[^)]+/-/media/alias/player-gladiator-headshot/[^)]+)\)",
    )
    if not image_url:
        image_url = ranking_row.get("image_url") or ""

    return {
        "name": ranking_row.get("name") or "",
        "age": details.get("age") or "",
        "country": details.get("country") or "",
        "height": details.get("height") or "",
        "weight": details.get("weight") or "",
        "plays": details.get("plays") or "",
        "coach": details.get("coach") or "",
        "turned_pro": details.get("turned_pro") or "",
        "birthplace": details.get("birthplace") or "",
        "rank": ranking_row.get("rank"),
        "points": ranking_row.get("points"),
        "career_high_rank": summary.get("career_high_rank") or "",
        "ytd_rank": summary.get("ytd_rank") or "",
        "ytd_won_lost": summary.get("ytd_won_lost") or "",
        "ytd_titles": summary.get("ytd_titles") or "",
        "ytd_prize_money": summary.get("ytd_prize_money") or "",
        "career_prize_money": summary.get("prize_money") or "",
        "image_url": image_url,
        "url": player_url,
        "player_id": ranking_row.get("player_id") or "",
        "updated_at": _iso_now(),
    }


def _extract_section(markdown: str, section_title: str, stop_titles: List[str]) -> str:
    start_pat = re.compile(rf"^###\s+{re.escape(section_title)}\s*$", flags=re.IGNORECASE | re.MULTILINE)
    start_match = start_pat.search(markdown)
    if not start_match:
        return ""
    start = start_match.end()

    end = len(markdown)
    for stop in stop_titles:
        stop_pat = re.compile(rf"^###\s+{re.escape(stop)}\s*$", flags=re.IGNORECASE | re.MULTILINE)
        stop_match = stop_pat.search(markdown, start)
        if stop_match:
            end = min(end, stop_match.start())

    return markdown[start:end].strip()


def _parse_bullets_to_map(section_text: str) -> Dict[str, str]:
    known_labels = [
        "1st Serve Return Points Won",
        "2nd Serve Return Points Won",
        "Break Points Opportunities",
        "Break Points Converted",
        "Return Games Played",
        "Return Games Won",
        "Return Points Won",
        "Total Points Won",
        "1st Serve Points Won",
        "2nd Serve Points Won",
        "Break Points Faced",
        "Break Points Saved",
        "Service Games Played",
        "Service Games Won",
        "Total Service Points Won",
        "Double Faults",
        "1st Serve",
        "Aces",
    ]
    known_labels = sorted(known_labels, key=len, reverse=True)

    out: Dict[str, str] = {}
    for line in section_text.splitlines():
        text = re.sub(r"^\*\s+", "", line.strip())
        if not text:
            continue
        for label in known_labels:
            if text.lower().startswith(label.lower()):
                value = text[len(label) :].strip()
                out[label] = value
                break
    return out


def scrape_player_stats(player_url: str, session: requests.Session, timeout: int) -> Dict[str, Any]:
    stats_url = player_url.replace("/overview", "/player-stats")
    stats_md = _fetch_markdown(session, stats_url, timeout)

    serve_section = _extract_section(stats_md, "Serve", ["Return", "News", "PROFILE"])
    return_section = _extract_section(stats_md, "Return", ["News", "PROFILE"])

    serve_map = _parse_bullets_to_map(serve_section)
    return_map = _parse_bullets_to_map(return_section)

    won_lost = _pick_regex(stats_md, r"\n\n(\d+\s*-\s*\d+)\s+W-L")
    singles_titles = _pick_regex(stats_md, r"\n\n(\d+)\s+Titles")
    prize_money = _pick_regex(stats_md, r"\n\n(\$[\d,]+)\s+Prize Money Singles & Doubles Combined")
    ytd_prize_money = _pick_regex(stats_md, r"YTD[\s\S]{0,260}?(\$[\d,]+)\s+Prize Money")

    return {
        "singles_titles": singles_titles,
        "won_lost": won_lost,
        "prize_money": prize_money,
        "ytd_prize_money": ytd_prize_money,
        "career_prize_money": prize_money,
        "singles_serving_stats": {
            "aces": serve_map.get("Aces", ""),
            "double_faults": serve_map.get("Double Faults", ""),
            "first_serve_pct": serve_map.get("1st Serve", ""),
            "first_serve_won": serve_map.get("1st Serve Points Won", ""),
            "second_serve_won": serve_map.get("2nd Serve Points Won", ""),
            "break_points_faced": serve_map.get("Break Points Faced", ""),
            "break_points_saved": serve_map.get("Break Points Saved", ""),
            "service_games_played": serve_map.get("Service Games Played", ""),
            "service_games_won": serve_map.get("Service Games Won", ""),
            "service_points_won_pct": serve_map.get("Total Service Points Won", ""),
        },
        "singles_return_stats": {
            "first_return_points_won_pct": return_map.get("1st Serve Return Points Won", ""),
            "second_return_points_won_pct": return_map.get("2nd Serve Return Points Won", ""),
            "break_points_opportunities": return_map.get("Break Points Opportunities", ""),
            "break_points_converted": return_map.get("Break Points Converted", ""),
            "return_games_played": return_map.get("Return Games Played", ""),
            "return_games_won": return_map.get("Return Games Won", ""),
            "return_points_won": return_map.get("Return Points Won", ""),
            "total_points_won": return_map.get("Total Points Won", ""),
        },
        "raw": {
            "serve_section": serve_section,
            "return_section": return_section,
        },
        "updated_at": _iso_now(),
    }


def _format_activity_score(raw_score: str) -> Tuple[str, str]:
    # Activity score blocks are flattened by markdown conversion.
    # Rebuild set pairs and infer W/L from player-perspective set totals.
    text = re.sub(r"\s+", " ", str(raw_score or "")).strip()
    text = re.sub(r"\s+Bye$", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\s+(RET|W/O|WO)$", "", text, flags=re.IGNORECASE).strip()
    if not text:
        return "-", "-"

    sets: List[Tuple[int, int, str]] = []

    # 1) Prefer explicit pair notation (e.g., 7-6(5), 6-3)
    for m in re.finditer(r"(\d+)\s*-\s*(\d+)(?:\s*(?:\((\d+)\)|\^(\d+)))?", text):
        p1 = int(m.group(1))
        p2 = int(m.group(2))
        tb_raw = m.group(3) or m.group(4) or ""
        sets.append((p1, p2, tb_raw))

    # 2) Fallback: plain number stream (e.g., "6 4 7 6 5 6 7 3 ...")
    if not sets:
        tokens = re.findall(r"\d+", text)
        i = 0
        while i + 1 < len(tokens):
            p1 = int(tokens[i])
            p2 = int(tokens[i + 1])
            i += 2
            tb_raw = ""
            if i < len(tokens) and ((p1 == 7 and p2 == 6) or (p1 == 6 and p2 == 7)):
                tb_candidate = int(tokens[i])
                if 0 <= tb_candidate <= 20:
                    tb_raw = str(tb_candidate)
                    i += 1
            sets.append((p1, p2, tb_raw))

    if not sets:
        return text, "-"

    formatted_sets = []
    p1_sets = 0
    p2_sets = 0
    for p1, p2, tb_raw in sets:
        if p1 > p2:
            p1_sets += 1
        elif p2 > p1:
            p2_sets += 1
        if tb_raw:
            formatted_sets.append(f"{p1}-{p2}({tb_raw})")
        else:
            formatted_sets.append(f"{p1}-{p2}")

    result = "-"
    if p1_sets > p2_sets:
        result = "W"
    elif p2_sets > p1_sets:
        result = "L"

    return ", ".join(formatted_sets), result


def _category_from_badge(badge_url: str) -> str:
    text = str(badge_url or "").upper()
    if "GS" in text:
        return "grand_slam"
    if "1000" in text:
        return "masters_1000"
    if "500" in text:
        return "atp_500"
    if "250" in text:
        return "atp_250"
    if "125" in text:
        return "atp_125"
    if "FINALS" in text:
        return "finals"
    return "other"


def _category_label(category: str) -> str:
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


def _surface_key(surface: str) -> str:
    val = str(surface or "").lower()
    if "clay" in val:
        return "clay"
    if "grass" in val:
        return "grass"
    if "indoor" in val:
        return "indoor"
    return "hard"


def scrape_player_recent_matches(player_url: str, year: int, session: requests.Session, timeout: int) -> Dict[str, Any]:
    activity_url = f"{player_url.replace('/overview', '/player-activity')}?year={year}"
    md = _fetch_markdown(session, activity_url, timeout)

    anchor_match = re.search(r"^###\s+Player activity\s*$", md, flags=re.IGNORECASE | re.MULTILINE)
    body = md[anchor_match.start() :] if anchor_match else md
    news_match = re.search(r"\n###\s+News\b", body, flags=re.IGNORECASE)
    if news_match:
        body = body[: news_match.start()]

    header_iter = list(
        re.finditer(
            r"\[Header\s+\d+\s+-+\s+###\s+(?P<header>.+?)\]\((?P<link>https?://[^)]+)\)",
            body,
            flags=re.IGNORECASE,
        )
    )

    tournaments: List[Dict[str, Any]] = []
    for i, hm in enumerate(header_iter):
        start = hm.end()
        end = header_iter[i + 1].start() if i + 1 < len(header_iter) else len(body)
        chunk = body[start:end]
        preface = body[max(0, hm.start() - 240) : hm.start()]

        header_text = hm.group("header").strip()
        parts = [p.strip() for p in header_text.split("|")]
        title_part = parts[0] if parts else "Tournament"
        date_range = parts[1] if len(parts) > 1 else ""
        surface = re.sub(r"[*]", "", parts[2]).strip() if len(parts) > 2 else ""
        tournament_link = hm.group("link").strip()

        # Badge image is usually near each block and indicates tournament level.
        badge_match = re.search(r"eventTypes/([^\s)]+)\.png", preface, flags=re.IGNORECASE)
        category = _category_from_badge(badge_match.group(1) if badge_match else "")

        match_rows = list(
            re.finditer(
                r"(?P<round>[A-Z0-9]{1,6})\[(?P<opp>[^\]]+)\]\((?P<opp_url>https?://[^)]+/overview)\)\s*\n\s*\n\[(?P<score>[^\]]+)\]\((?P<stats_url>https?://[^)]+)\)",
                chunk,
                flags=re.IGNORECASE,
            )
        )

        matches: List[Dict[str, Any]] = []
        for row in match_rows:
            round_raw = row.group("round").strip()
            opp_text = row.group("opp").strip()
            opp_seed = _pick_regex(opp_text, r"\*\*\((\d+)\)\*\*")
            opponent_name = re.sub(r"\*\*\([^)]*\)\*\*", "", opp_text).strip()
            opponent_slug, opponent_id = _extract_profile_parts(row.group("opp_url"))

            score_fmt, result = _format_activity_score(row.group("score"))
            matches.append(
                {
                    "round": round_raw,  # keep exactly as scraped
                    "result": result,
                    "opponent_name": opponent_name,
                    "opponent_seed": _to_int(opp_seed),
                    "opponent_rank": None,
                    "opponent_id": opponent_id,
                    "opponent_url": row.group("opp_url").strip(),
                    "score": score_fmt,
                    "score_raw": row.group("score").strip(),
                    "match_stats_url": row.group("stats_url").strip(),
                }
            )

        summary_match = re.search(
            r"Points:\s*([^,\n]+)(?:,\s*ATP Ranking:\s*([^,\n]+))?(?:,\s*Prize Money:\s*([^\n]+))?",
            chunk,
            flags=re.IGNORECASE,
        )
        summary: Dict[str, str] = {
            "rank": "",
            "seed": "",
            "wta_points_gain": "",
            "atp_points_gain": "",
            "prize_money_won": "",
            "draw": "",
            "points": "",
        }
        if summary_match:
            points_val = (summary_match.group(1) or "").strip()
            atp_rank = (summary_match.group(2) or "").strip()
            prize = (summary_match.group(3) or "").strip()
            summary["points"] = points_val
            summary["rank"] = atp_rank
            summary["atp_points_gain"] = points_val
            summary["wta_points_gain"] = points_val
            summary["prize_money_won"] = prize

        tournaments.append(
            {
                "tournament": title_part,
                "location": "",
                "date_range": date_range,
                "category": category,
                "category_label": _category_label(category),
                "surface": surface.upper(),
                "surface_key": _surface_key(surface),
                "summary": summary,
                "matches": matches,
                "tournament_url": tournament_link,
            }
        )

    return {
        "year": year,
        "tournaments": tournaments,
        "updated_at": _iso_now(),
    }


def _download_image(session: requests.Session, image_url: str, folder: Path, timeout: int) -> Optional[str]:
    if not image_url:
        return None
    try:
        resp = session.get(image_url, timeout=timeout, allow_redirects=True)
        if resp.status_code != 200:
            return None
        content_type = (resp.headers.get("Content-Type") or "").lower()
        if "image" not in content_type:
            return None

        ext = ".jpg"
        if "png" in content_type:
            ext = ".png"
        elif "webp" in content_type:
            ext = ".webp"

        out_path = folder / f"image{ext}"
        out_path.write_bytes(resp.content)

        # Clean other image.* variants.
        for other in folder.glob("image.*"):
            if other.resolve() != out_path.resolve():
                other.unlink(missing_ok=True)

        return out_path.name
    except Exception:
        return None


def write_json(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape ATP player data into data/atp folders")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--out", default=DEFAULT_OUT_DIR)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Do not download/update local player image files",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        }
    )

    try:
        ranked_players = fetch_ranked_players(limit=args.limit, session=session, timeout=args.timeout)
    except Exception as exc:
        print(red(f"[ERROR] Could not fetch ATP rankings: {exc}"))
        return 1

    if not ranked_players:
        print(red("[ERROR] No ATP ranked players parsed."))
        return 1

    total = len(ranked_players)
    print(green(f"Found {total} ATP players. Starting scrape..."))
    print(
        f"Config -> limit={args.limit}, year={args.year}, out='{args.out}', "
        f"delay={args.delay}s, timeout={args.timeout}s, download_images={not args.skip_images}"
    )

    errors: List[str] = []
    for idx, row in enumerate(ranked_players, start=1):
        rank = int(row.get("rank") or idx)
        player_name = str(row.get("name") or f"player_{rank}")
        player_slug = slugify(player_name)
        folder = out_dir / f"{rank:03d}_{player_slug}"
        folder.mkdir(parents=True, exist_ok=True)

        try:
            profile = scrape_player_profile(row, session=session, timeout=args.timeout)
            stats = scrape_player_stats(row["profile_url"], session=session, timeout=args.timeout)
            recent = scrape_player_recent_matches(
                row["profile_url"],
                year=args.year,
                session=session,
                timeout=args.timeout,
            )
            if recent.get("tournaments"):
                stats["recent_matches_tab"] = recent

            write_json(folder / "profile.json", profile)
            write_json(folder / "stats_2026.json", stats)

            if not args.skip_images:
                img_candidates = [
                    profile.get("image_url") or "",
                    row.get("image_url") or "",
                    f"{BASE_URL}/-/media/alias/player-headshot/{str(row.get('player_id') or '').lower()}",
                ]
                saved = None
                for candidate in img_candidates:
                    if not candidate:
                        continue
                    saved = _download_image(session, candidate, folder, timeout=args.timeout)
                    if saved:
                        break
                if not saved:
                    print(yellow(f"[{idx:03d}/{total:03d}] {folder.name} -> no image saved"))

        except Exception as exc:
            errors.append(f"{row.get('profile_url')}\t{exc}")
            print(red(f"[{idx:03d}/{total:03d}] {folder.name} -> ERROR: {exc}"))

        progress = int((idx / total) * 40)
        bar = green("=" * progress) + "-" * (40 - progress)
        print(f"[{bar}] {idx}/{total} rank#{rank} {player_name}")

        if args.delay > 0:
            time.sleep(args.delay)

    if errors:
        err_path = out_dir / "errors.log"
        with err_path.open("a", encoding="utf-8") as f:
            for line in errors:
                f.write(line + "\n")
        print(yellow(f"Completed with {len(errors)} errors. See: {err_path}"))
        return 2

    print(green("Done."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
