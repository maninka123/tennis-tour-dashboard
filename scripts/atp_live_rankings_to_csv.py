#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import re
import sys
from typing import Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    requests = None
    import urllib.request


SOURCE_URL = "https://live-tennis.eu/en/atp-live-ranking"
FALLBACK_URL = "https://r.jina.ai/http://live-tennis.eu/en/atp-live-ranking"


def fetch_text(url: str) -> str:
    if requests:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        return resp.text
    with urllib.request.urlopen(url, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def normalize_whitespace(text: str) -> str:
    return text.replace("\xa0", " ")


def _parse_signed(value: str) -> Optional[int]:
    if not value:
        return None
    m = re.match(r"^([+-]\d+)$", value.strip())
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _assign_rank_points_change(rank_change: str, points_change: str) -> Tuple[str, str]:
    rank_val = _parse_signed(rank_change)
    points_val = _parse_signed(points_change)

    # If only one value provided, treat it as points change (rank change should be in its column)
    if rank_val is not None and points_val is None:
        return "", rank_change
    if rank_val is None and points_val is not None:
        return "", points_change
    # If both provided but rank change looks like points (very large), swap
    if rank_val is not None and points_val is not None:
        if abs(rank_val) >= 100 and abs(points_val) < 100:
            return points_change, rank_change
    return rank_change, points_change


def parse_rankings_inline(text: str) -> List[Dict[str, str]]:
    cleaned = re.sub(r"!\[[^\]]*\]\([^\)]*\)", " ", text)
    cleaned = re.sub(r"\[[^\]]*\]\([^\)]*\)", " ", cleaned)
    cleaned = cleaned.replace("\xa0", " ")
    # Find header marker
    marker = "**#****CH****Player****Age****Ctry****Pts"
    idx = cleaned.find(marker)
    if idx == -1:
        return []
    data = cleaned[idx + len(marker):]

    rows = []
    pattern = re.compile(r"(\d{1,4})\*\*(CH|NCH\s*\(\d+\)|\d+)\*\*", re.UNICODE)
    matches = list(pattern.finditer(data))
    for m_idx, m in enumerate(matches):
        start = m.end()
        end = matches[m_idx + 1].start() if m_idx + 1 < len(matches) else len(data)
        rank = m.group(1).strip()
        ch_raw = m.group(2).strip()
        block = data[start:end].strip()

        # Extract name, age, country, points from block
        tokens = block.split()
        if len(tokens) < 5:
            continue
        age_idx = None
        for t_idx, tok in enumerate(tokens):
            if tok.isdigit() and 14 <= int(tok) <= 60:
                age_idx = t_idx
                break
        if age_idx is None or age_idx + 2 >= len(tokens):
            continue
        name = " ".join(tokens[:age_idx])
        age = tokens[age_idx]
        country = tokens[age_idx + 1]
        points_token = tokens[age_idx + 2]
        points_match = re.match(r"^(\d+)(.*)$", points_token)
        points = points_match.group(1) if points_match else points_token
        points_tail = points_match.group(2).strip() if points_match else ""
        tail_tokens = tokens[age_idx + 3:]
        tail = " ".join([t for t in [points_tail] + tail_tokens if t]).strip()

        # Parse rank/points change if present
        rank_change = ""
        points_change = ""
        change_match = re.match(r"^([+-]\d+)([+-]\d+)?(.*)$", tail)
        if change_match:
            rank_change = change_match.group(1) or ""
            points_change = change_match.group(2) or ""
            tail = (change_match.group(3) or "").strip()
        rank_change, points_change = _assign_rank_points_change(rank_change, points_change)

        # Split current/previous using "Lost in" marker
        previous = ""
        current = ""
        lost_idx = tail.find("Lost in")
        if lost_idx != -1:
            current = tail[:lost_idx].strip()
            previous = tail[lost_idx:].strip()
        else:
            current = tail.strip()

        prev_ch = ""
        nch_match = re.search(r"\((\d+)\)", ch_raw)
        if nch_match:
            prev_ch = nch_match.group(1)

        is_new_career_high = "NCH" in ch_raw
        career_high = ""
        if is_new_career_high:
            career_high = rank
        elif ch_raw == "CH":
            career_high = rank
        else:
            ch_num = re.search(r"\d+", ch_raw)
            if ch_num:
                career_high = ch_num.group(0)
        if is_new_career_high and not prev_ch:
            prev_match = re.search(r"\((\d+)\)", ch_raw)
            if prev_match:
                prev_ch = prev_match.group(1)

        at_career_high = "yes" if career_high and career_high == rank else "no"
        is_playing = "yes" if current and not current.lower().startswith("lost") else "no"
        flag = country if country else "WHITE"

        rows.append({
            "rank": rank,
            "ch_raw": ch_raw,
            "career_high": career_high,
            "prev_career_high": prev_ch,
            "at_career_high": at_career_high,
            "is_new_career_high": "yes" if is_new_career_high else "no",
            "player": name,
            "age": age,
            "country": country,
            "flag": flag,
            "points": re.sub(r"[^\d]", "", points),
            "rank_change": rank_change,
            "current": points_change,
            "previous": current,
            "next": previous,
            "max": "",
            "is_playing": is_playing
        })

    return rows


def parse_rankings(text: str) -> List[Dict[str, str]]:
    lines = [normalize_whitespace(l) for l in text.splitlines()]
    header_idx = None
    header_tokens = ["#", "ch", "player", "age", "ctry", "pts"]
    for i, line in enumerate(lines):
        if line.startswith("#\tCH\tPlayer\tAge\tCtry\tPts"):
            header_idx = i
            break
        lower = line.lower()
        if all(tok in lower for tok in header_tokens) and (line.count("\t") >= 5 or line.count("  ") >= 3):
            header_idx = i
            break
    if header_idx is None:
        # Try inline parser (fallback format)
        inline_rows = parse_rankings_inline(text)
        if inline_rows:
            return inline_rows
        raise ValueError("Could not find ranking table header in source text.")

    rows = []
    i = header_idx + 1
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("Advertisement"):
            i += 1
            continue

        if re.match(r"^\d+\t", line):
            rank_parts = line.split("\t")
            rank = rank_parts[0].strip()
            ch_raw = rank_parts[1].strip() if len(rank_parts) > 1 else ""

            prev_ch = ""
            # Find next data line (may be separated by blanks and NCH line)
            j = i + 1
            data_line = None
            while j < len(lines):
                candidate = lines[j]
                if not candidate.strip():
                    j += 1
                    continue
                if candidate.strip().startswith("(") and ")" in candidate:
                    prev_match = re.search(r"\((\d+)\)", candidate)
                    if prev_match and not prev_ch:
                        prev_ch = prev_match.group(1)
                    j += 1
                    continue
                if candidate.startswith("\t"):
                    data_line = candidate
                    break
                # Stop if we hit another header or rank row
                if re.match(r"^\d+\t", candidate) or candidate.startswith("#\tCH\tPlayer"):
                    break
                j += 1

            if not data_line:
                i += 1
                continue

            data_parts = [normalize_whitespace(p).strip() for p in data_line.lstrip("\t").split("\t")]
            # Pad to at least 9 columns
            while len(data_parts) < 9:
                data_parts.append("")

            player = data_parts[0]
            nch_match = re.match(r"^\((\d+)\)\s*(.*)$", player)
            if nch_match:
                prev_ch = nch_match.group(1)
                player = nch_match.group(2).strip()

            age = data_parts[1]
            raw_country = data_parts[2]
            country_match = re.match(r"([A-Z]{3})", raw_country or "")
            country = country_match.group(1) if country_match else raw_country
            points = re.sub(r"[^\d]", "", data_parts[3])
            rank_change = data_parts[4]
            current = data_parts[5]
            previous = data_parts[6]
            next_pts = data_parts[7]
            max_pts = data_parts[8]

            # Fix cases where only points change exists (rank change stays 0/blank)
            rank_change, current = _assign_rank_points_change(rank_change, current)

            career_high = ""
            ch_norm = ch_raw.strip()
            is_new_career_high = "NCH" in ch_norm
            if ch_norm == "CH":
                career_high = rank
            else:
                ch_num = re.search(r"\d+", ch_norm)
                if ch_num:
                    career_high = ch_num.group(0)
            if is_new_career_high and not career_high:
                career_high = rank
            if is_new_career_high and not prev_ch:
                prev_match = re.search(r"\((\d+)\)", ch_norm)
                if prev_match:
                    prev_ch = prev_match.group(1)

            at_career_high = "yes" if career_high and career_high == rank else "no"
            is_playing = "yes" if previous and not previous.lower().startswith("lost") else "no"
            flag = country if country else "WHITE"

            rows.append({
                "rank": rank,
                "ch_raw": ch_raw,
                "career_high": career_high,
                "prev_career_high": prev_ch,
                "at_career_high": at_career_high,
                "is_new_career_high": "yes" if is_new_career_high else "no",
                "player": player,
                "age": age,
                "country": country,
                "flag": flag,
                "points": points,
                "rank_change": rank_change,
                "current": current,
                "previous": previous,
                "next": next_pts,
                "max": max_pts,
                "is_playing": is_playing
            })
            i = j + 1
            continue

        i += 1

    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch ATP live rankings into CSV.")
    parser.add_argument("--out", default="data/atp_live_ranking.csv", help="Output CSV path")
    parser.add_argument("--source", default=SOURCE_URL, help="Primary source URL")
    parser.add_argument("--fallback", default=FALLBACK_URL, help="Fallback source URL")
    args = parser.parse_args()

    text = ""
    try:
        text = fetch_text(args.source)
        if "Just a moment" in text or "cloudflare" in text.lower():
            raise RuntimeError("Cloudflare challenge detected.")
        rows = parse_rankings(text)
    except Exception:
        text = fetch_text(args.fallback)
        rows = parse_rankings(text)
    if not rows:
        raise RuntimeError("No ranking rows parsed.")

    fieldnames = list(rows[0].keys())
    out_path = args.out
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
