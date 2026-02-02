#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

try:
    from PIL import Image
except Exception:
    Image = None

BASE_URL = "https://www.wtatennis.com"
PLAYERS_URL = f"{BASE_URL}/players"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


def green(text: str) -> str:
    return f"\033[92m{text}\033[0m"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def fetch_html(url: str, session: requests.Session) -> str:
    resp = session.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.text


def _pick_src_from_srcset(srcset: str) -> str:
    if not srcset:
        return ""
    parts = [p.strip() for p in srcset.split(",") if p.strip()]
    if not parts:
        return ""
    # Use last (usually largest) entry
    last = parts[-1].split(" ")[0].strip()
    return last


def _make_absolute(url: str) -> str:
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return BASE_URL + url
    return url


def _extract_img_url_from_element(element) -> str:
    if not element:
        return ""
    attrs = ["src", "data-src", "data-original", "data-lazy", "data-srcset", "srcset"]
    for attr in attrs:
        try:
            val = element.get_attribute(attr)
        except Exception:
            val = None
        if not val:
            continue
        if "srcset" in attr:
            picked = _pick_src_from_srcset(val)
            if picked:
                return _make_absolute(picked)
        return _make_absolute(val)
    return ""


def _choose_player_image(urls: List[str]) -> str:
    if not urls:
        return ""
    # Prefer photoresources/torso/headshot and avoid flags
    preferred = []
    fallback = []
    for url in urls:
        if not url:
            continue
        lower = url.lower()
        if "flag" in lower or "flags" in lower:
            continue
        if "photoresources" in lower or "photo-resources" in lower or "torso" in lower or "headshot" in lower:
            preferred.append(url)
        else:
            fallback.append(url)
    return preferred[0] if preferred else (fallback[0] if fallback else "")


def _extract_bg_url_from_style(style: str) -> str:
    if not style:
        return ""
    match = re.search(r'background-image\\s*:\\s*url\\([\"\\\']?([^\"\\\')]+)[\"\\\']?\\)', style, re.IGNORECASE)
    return _make_absolute(match.group(1)) if match else ""


def _extract_img_url_from_html(html: str) -> str:
    # Prefer torso/headshot images from photoresources
    matches = re.findall(r"https://photoresources\\.wtatennis\\.com[^\"\\s]+", html)
    for m in matches:
        if any(k in m.lower() for k in ["torso", "headshot", "profile"]):
            return _make_absolute(m.rstrip(","))

    # Fallback to first wtatennis image (avoid og:image and generic share images)
    img_match = re.search(
        r"(https://www\.wtatennis\.com/sites/default/files/[^\"\s]+)", html
    )
    return _make_absolute(img_match.group(1)) if img_match else ""


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


def get_players_with_playwright(limit: int) -> List[Tuple[str, str, str]]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        raise RuntimeError("playwright not available") from exc

    players = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(PLAYERS_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        _dismiss_cookie_banner(page)

        # Hard-click Load More several times to ensure full list
        for _ in range(6):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(800)
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
                page.wait_for_timeout(1500)
                continue
            # Try scrolling a bit more to trigger lazy load
            page.evaluate("window.scrollTo(0, document.body.scrollHeight - 200)")
            page.wait_for_timeout(500)

        # After loading, collect all players
        anchors = page.query_selector_all('a[href^="/players/"]')
        for a in anchors:
            href = a.get_attribute("href")
            if not href:
                continue
            if re.match(r"/players/\d+/", href):
                parts = href.strip("/").split("/")
                pid = parts[1]
                img_url = ""
                try:
                    card = a.evaluate_handle("node => node.closest('article, li, div')")
                    if card:
                        urls = []
                        imgs = card.query_selector_all("img")
                        for img in imgs:
                            urls.append(_extract_img_url_from_element(img))
                        # Try background images on card/children
                        style = card.get_attribute("style") or ""
                        bg = _extract_bg_url_from_style(style)
                        if bg:
                            urls.append(bg)
                        for el in card.query_selector_all("[style*='background-image']"):
                            bg = _extract_bg_url_from_style(el.get_attribute("style") or "")
                            if bg:
                                urls.append(bg)
                        img_url = _choose_player_image(urls)
                except Exception:
                    img_url = ""
                if (pid, href, img_url) not in players:
                    players.append((pid, href, img_url))

        browser.close()
    return players[:limit]


def get_players(limit: int) -> List[Tuple[str, str, str]]:
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
        return [(pid, path, "") for pid, path in links[:limit]]
    # Fallback if playwright returned empty
    session = requests.Session()
    html = fetch_html(PLAYERS_URL, session)
    links = extract_player_links_from_html(html)
    return [(pid, path, "") for pid, path in links[:limit]]


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


def scrape_player_stats(page, player_url: str) -> Dict[str, str]:
    try:
        _ = page
    except Exception as exc:
        raise RuntimeError("playwright not available") from exc

    stats_url = f"{player_url}/stats"
    page.goto(stats_url, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    _dismiss_cookie_banner(page)
    _click_if_exists(page, "button:has-text('Singles')")
    _select_year_2026(page)
    page.wait_for_timeout(1200)
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
    page.wait_for_timeout(1200)
    _dismiss_cookie_banner(page)
    _click_if_exists(page, "button:has-text('Record')")
    _click_if_exists(page, "button:has-text('Records')")
    page.wait_for_timeout(1200)
    text = page.inner_text("body")
    return parse_records_tab(text)


# Note: We intentionally avoid pulling images from player pages.
# Images should come from the players list page for consistency.


def scrape_player_profile(player_url: str) -> Dict[str, str]:
    session = requests.Session()
    html = fetch_html(player_url, session)
    # name (JSON-LD or fallback)
    name = ""
    json_ld_match = re.search(
        r'<script type="application/ld\+json">([^<]+)</script>', html
    )
    if json_ld_match:
        try:
            json_ld = json.loads(json_ld_match.group(1))
            name = json_ld.get("name", "") if isinstance(json_ld, dict) else ""
        except Exception:
            name = ""
    if not name:
        title_match = re.search(r"<title>([^<]+)</title>", html)
        name = title_match.group(1).split("|")[0].strip() if title_match else ""

    # age
    age_match = re.search(r"(\d{2})\s*yrs", html)
    age = age_match.group(1) if age_match else ""

    # height
    height_match = re.search(r"(\d+'\s*\d+\".*?\(\d\.\d{2}m\))", html)
    height = height_match.group(1) if height_match else ""

    # plays
    plays_match = re.search(r"Plays\s*([A-Za-z\-]+)", html)
    plays = plays_match.group(1) if plays_match else ""

    # image (keep empty here; prefer players list image)
    img_url = ""

    # country
    country_match = re.search(r'"country":"([^"]+)"', html)
    country = country_match.group(1) if country_match else ""
    return {
        "name": name.strip(),
        "age": age,
        "country": country,
        "height": height,
        "plays": plays,
        "image_url": img_url,
        "url": player_url,
        "updated_at": _iso_now(),
    }


def _infer_ext(url: str, content_type: str) -> str:
    ct = (content_type or "").lower()
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "image" in ct:
        return ".jpg"
    for ext in [".jpg", ".jpeg", ".png", ".webp"]:
        if url.lower().endswith(ext):
            return ext if ext != ".jpeg" else ".jpg"
    return ".jpg"


def download_image(url: str, out_base: Path) -> Optional[Path]:
    if not url:
        return None
    url = url.strip().rstrip(",")
    resp = requests.get(
        url,
        timeout=30,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "image/jpeg,image/png,image/*;q=0.8",
            "Referer": BASE_URL,
        },
    )
    if resp.status_code != 200:
        return None
    ext = _infer_ext(url, resp.headers.get("Content-Type", ""))
    out_path = out_base.with_suffix(ext)
    if ext == ".webp" and Image is not None:
        try:
            with Image.open(io.BytesIO(resp.content)) as img:
                rgb = img.convert("RGB")
                out_path = out_base.with_suffix(".jpg")
                rgb.save(out_path, format="JPEG", quality=90)
                return out_path
        except Exception:
            pass
    out_path.write_bytes(resp.content)
    return out_path


def write_json(path: Path, data: Dict) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--out", default="data/wta")
    parser.add_argument("--delay", type=float, default=1.0)
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    players = get_players(args.limit)
    total = len(players)
    if total == 0:
        print("No players found.")
        return 1

    print(green(f"Found {total} players. Starting scrape..."))

    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        print("Playwright is required to scrape stats. Install with: pip install playwright")
        return 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for idx, (pid, path, list_image_url) in enumerate(players, 1):
            player_url = f"{BASE_URL}{path}"
            try:
                profile = scrape_player_profile(player_url)
                name = profile.get("name") or f"player_{pid}"
                slug = slugify(name)
                folder = out_dir / f"{idx:03d}_{slug}"
                folder.mkdir(parents=True, exist_ok=True)

                stats = scrape_player_stats(page, player_url)
                records_tab = scrape_player_records(page, player_url)
                if records_tab.get("summary") or records_tab.get("yearly"):
                    stats["records_tab"] = records_tab

                if list_image_url:
                    profile["image_url"] = list_image_url

                write_json(folder / "profile.json", profile)
                write_json(folder / "stats_2026.json", stats)

                if profile.get("image_url"):
                    download_image(profile["image_url"], folder / "image")

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
