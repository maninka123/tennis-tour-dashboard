#!/usr/bin/env python3
"""
Download missing ATP/WTA player images for data_analysis from a hybrid source chain.

What this script does:
- Can discover players from:
  - full historic CSV archives (default)
  - player manifests (fallback mode)
- Creates output folders:
  - data_analysis/images/atp
  - data_analysis/images/wta
- Processes top N players by match appearance frequency (CSV mode)
- Skips players who already have an image in main app source folders (data/atp, data/wta)
- Skips players already downloaded in data_analysis/images/{tour}
- Can skip players already attempted in prior runs (success or fail), configurable on/off
- Tries multiple non-Wikipedia sources first, then Wikipedia as final fallback
- Saves as slugified player name (e.g., novak-djokovic.jpg)
- Prints progress bars and a final summary
"""

from __future__ import annotations

import csv
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

USER_AGENT = "TennisDashboardImageFetcher/1.0 (non-wikipedia)"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".avif")

REPO_ROOT = Path(__file__).resolve().parent.parent
for _candidate in Path(__file__).resolve().parents:
    if (_candidate / "data_analysis").exists() and (_candidate / "data").exists():
        REPO_ROOT = _candidate
        break
DATA_ANALYSIS_DIR = REPO_ROOT / "data_analysis"
ATP_MANIFEST = DATA_ANALYSIS_DIR / "data" / "player_manifest.json"
WTA_MANIFEST = DATA_ANALYSIS_DIR / "wta" / "data" / "player_manifest.json"
ATP_CSV_MANIFEST = DATA_ANALYSIS_DIR / "data" / "csv_manifest.json"
WTA_CSV_MANIFEST = DATA_ANALYSIS_DIR / "wta" / "data" / "csv_manifest.json"
OUTPUT_ROOT = DATA_ANALYSIS_DIR / "images"

BLOCKED_HOST_PARTS = (
    "wikipedia.org",
    "wikimedia.org",
    "mediawiki.org",
)
BLOCKED_IMAGE_HINTS = (
    "logo",
    "icon",
    "sprite",
    "placeholder",
    "default-avatar",
    "blank",
)

TRUSTED_TENNIS_HOST_PARTS = (
    "atptour.com",
    "wtatennis.com",
    "itftennis.com",
    "wimbledon.com",
    "usopen.org",
    "rolandgarros.com",
    "ausopen.com",
    "tennis.com",
    "atpchallenger.com",
)
TENNIS_KEYWORDS = (
    "tennis",
    "atp",
    "wta",
    "grand slam",
    "wimbledon",
    "roland garros",
    "australian open",
    "us open",
    "itf",
    "challenger",
)

TOUR_CONFIG = {
    "atp": {
        "manifest": ATP_MANIFEST,
        "csv_manifest": ATP_CSV_MANIFEST,
        "csv_base_dir": DATA_ANALYSIS_DIR,
        "source_data": REPO_ROOT / "data" / "atp",
        "output": OUTPUT_ROOT / "atp",
    },
    "wta": {
        "manifest": WTA_MANIFEST,
        "csv_manifest": WTA_CSV_MANIFEST,
        "csv_base_dir": DATA_ANALYSIS_DIR / "wta",
        "source_data": REPO_ROOT / "data" / "wta",
        "output": OUTPUT_ROOT / "wta",
    },
}

# ==== TOP_N ====
# Description: Max players to inspect per tour.
# Other options:
# - Any positive integer: process only top N players.
# - 0: process all discovered players.
TOP_N = 5000

# ==== PLAYER_SOURCE ====
# Description: Source used to discover players.
# Other options:
# - "csv": discover from full historic CSV files (recommended).
# - "manifest": discover only from player_manifest.json.
PLAYER_SOURCE = "csv"

# ==== MIN_APPEARANCES ====
# Description: Minimum match appearances required (only when PLAYER_SOURCE="csv").
# Other options:
# - Any integer >= 1.
MIN_APPEARANCES = 1

# ==== TOUR ====
# Description: Which tour to process.
# Other options:
# - "atp"
# - "wta"
# - "both"
TOUR = "both"

# ==== TIMEOUT_SECONDS ====
# Description: HTTP timeout for search/download requests.
# Other options:
# - Any integer > 0.
TIMEOUT_SECONDS = 20

# ==== REQUEST_DELAY_SECONDS ====
# Description: Delay between each player request.
# Other options:
# - Any float/int >= 0.
REQUEST_DELAY_SECONDS = 0.35

# ==== DRY_RUN ====
# Description: If True, simulates downloads and does not write files.
# Other options:
# - True
# - False
DRY_RUN = False

# ==== SKIP_PROCESSED ====
# Description: If True, skip players already attempted in earlier runs
# from data_analysis/images/processed_players_state_hybrid_{tour}.json.
# Other options:
# - True
# - False
SKIP_PROCESSED = True

# ==== DDG_IMAGE_RESULTS_LIMIT ====
# Description: Max image candidates to pull from DuckDuckGo image index.
# Other options:
# - Any integer >= 1.
DDG_IMAGE_RESULTS_LIMIT = 40

# ==== BING_IMAGE_RESULTS_LIMIT ====
# Description: Max image candidates to pull from Bing image index.
# Other options:
# - Any integer >= 1.
BING_IMAGE_RESULTS_LIMIT = 40

# ==== WEB_OG_RESULTS_LIMIT ====
# Description: Max web pages checked for og:image/twitter:image.
# Other options:
# - Any integer >= 1.
WEB_OG_RESULTS_LIMIT = 10

# ==== USE_WIKIPEDIA_FALLBACK ====
# Description: Use Wikipedia only as final fallback if all other sources fail.
# Other options:
# - True
# - False
USE_WIKIPEDIA_FALLBACK = True

# ==== MIN_RELEVANCE_SCORE ====
# Description: Minimum relevance score for a candidate image URL.
# Higher = stricter filtering against non-tennis / wrong-person images.
# Other options:
# - 0..200 (recommended 45-75)
MIN_RELEVANCE_SCORE = 55

# ==== MIN_IMAGE_BYTES ====
# Description: Minimum image payload size accepted.
# Other options:
# - Any integer >= 1024
MIN_IMAGE_BYTES = 4096

# ==== MIN_IMAGE_DIMENSION ====
# Description: Minimum width/height accepted (if dimensions can be read).
# Other options:
# - Any integer >= 64
MIN_IMAGE_DIMENSION = 120

# ==== ENV_TOUR_KEY ====
# Description: Environment variable name that can override TOUR at runtime.
# Useful for running ATP/WTA in two terminals in parallel.
# Example (PowerShell):
# - $env:TENNIS_IMAGE_TOUR='atp'; python <script>
# - $env:TENNIS_IMAGE_TOUR='wta'; python <script>
ENV_TOUR_KEY = "TENNIS_IMAGE_TOUR"


@dataclass
class PlayerCandidate:
    name: str
    folder: Optional[str]
    rank: Optional[int]
    folder_id: Optional[int]
    appearances: int


@dataclass
class ImageCandidate:
    url: str
    source: str
    score: int
    source_page_url: str = ""
    context: str = ""


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "unknown-player"


def normalize_name_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_int(value) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def clean_player_name(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        return ""
    if text.lower() in {"none", "nan", "null"}:
        return ""
    return text


def normalize_url(url: str) -> str:
    text = str(url or "").strip()
    if not text:
        return ""
    if text.startswith("//"):
        text = f"https:{text}"
    elif text.startswith("http://"):
        text = f"https://{text[len('http://'):]}"
    return text


def _host_for_url(url: str) -> str:
    return urllib.parse.urlparse(str(url or "")).netloc.lower()


def is_wikipedia_host(host: str) -> bool:
    text = str(host or "").lower()
    return any(part in text for part in BLOCKED_HOST_PARTS)


def is_blocked_domain(url: str, allow_wikipedia: bool = False) -> bool:
    host = urllib.parse.urlparse(str(url or "")).netloc.lower()
    if not host:
        return True
    if allow_wikipedia and is_wikipedia_host(host):
        return False
    return any(part in host for part in BLOCKED_HOST_PARTS)


def is_blocked_image_url(url: str, allow_wikipedia: bool = False) -> bool:
    text = normalize_url(url).lower()
    if not text:
        return True
    if is_blocked_domain(text, allow_wikipedia=allow_wikipedia):
        return True
    if any(token in text for token in BLOCKED_IMAGE_HINTS):
        return True
    return False


def contains_tennis_keyword(text: str) -> bool:
    lower = str(text or "").lower()
    return any(keyword in lower for keyword in TENNIS_KEYWORDS)


def is_trusted_tennis_host(url: str) -> bool:
    host = _host_for_url(url)
    return any(part in host for part in TRUSTED_TENNIS_HOST_PARTS)


def _token_present(token: str, text: str) -> bool:
    if not token:
        return False
    pattern = rf"\b{re.escape(token)}\b"
    return re.search(pattern, text) is not None


def score_candidate_relevance(
    player_name: str,
    image_url: str,
    source_page_url: str,
    context: str,
    source: str,
) -> int:
    joined_text = " ".join(
        [
            normalize_name_key(context or ""),
            normalize_name_key(image_url or ""),
            normalize_name_key(source_page_url or ""),
        ]
    )
    player_tokens = [t for t in normalize_name_key(player_name).split() if len(t) >= 2]
    first = player_tokens[0] if player_tokens else ""
    last = player_tokens[-1] if player_tokens else ""

    score = 0
    if source == "local-profile-image-url":
        score += 110
    if source == "wikipedia-fallback":
        score += 65

    if is_trusted_tennis_host(image_url):
        score += 45
    if is_trusted_tennis_host(source_page_url):
        score += 35
    if contains_tennis_keyword(joined_text):
        score += 35

    if _token_present(last, joined_text):
        score += 35
    if _token_present(first, joined_text):
        score += 20
    if player_tokens:
        matched_tokens = sum(1 for token in set(player_tokens) if _token_present(token, joined_text))
        if matched_tokens >= 2:
            score += 20

    if any(h in normalize_name_key(image_url) for h in BLOCKED_IMAGE_HINTS):
        score -= 70
    if "logo" in normalize_name_key(context):
        score -= 40

    return score


def load_players_from_manifest(manifest_path: Path, top_n: int) -> Tuple[List[PlayerCandidate], int]:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = data.get("players", [])
    players: List[PlayerCandidate] = []

    for row in rows:
        name = (row.get("name") or "").strip()
        folder = (row.get("folder") or "").strip()
        if not name:
            continue
        players.append(
            PlayerCandidate(
                name=name,
                folder=folder or None,
                rank=parse_int(row.get("rank")),
                folder_id=parse_int(row.get("folder_id")),
                appearances=0,
            )
        )

    def sort_key(p: PlayerCandidate) -> Tuple[int, int, str]:
        # ATP has rank; WTA manifest rank is often null. Fallback to folder_id.
        rank = p.rank if p.rank is not None else 999999
        folder_id = p.folder_id if p.folder_id is not None else 999999
        return (rank, folder_id, p.name.lower())

    discovered_players = len(players)
    players = sorted(players, key=sort_key)
    if top_n > 0:
        players = players[:top_n]
    return players, discovered_players


def _resolve_csv_path(base_dir: Path, raw_path: str) -> Path:
    return (base_dir / str(raw_path or "").strip()).resolve()


def _resolve_name_column(fieldnames: Iterable[str], prefix: str) -> Optional[str]:
    lower_to_original = {}
    for name in fieldnames:
        if not name:
            continue
        lower_to_original[name.strip().lower()] = name
    direct = lower_to_original.get(f"{prefix}_name")
    if direct:
        return direct
    # Fallbacks for unexpected headers.
    for candidate in lower_to_original:
        if candidate.endswith(f"{prefix}_name"):
            return lower_to_original[candidate]
    return None


def _iter_csv_player_names(csv_path: Path) -> Iterable[str]:
    with csv_path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return

        winner_col = _resolve_name_column(reader.fieldnames, "winner")
        loser_col = _resolve_name_column(reader.fieldnames, "loser")
        if not winner_col or not loser_col:
            return

        for row in reader:
            winner = clean_player_name(row.get(winner_col, ""))
            loser = clean_player_name(row.get(loser_col, ""))
            if winner:
                yield winner
            if loser:
                yield loser


def load_players_from_csv(
    tour: str,
    csv_manifest_path: Path,
    csv_base_dir: Path,
    top_n: int,
    min_appearances: int,
) -> Tuple[List[PlayerCandidate], int]:
    data = json.loads(csv_manifest_path.read_text(encoding="utf-8"))
    files = data.get("files", [])
    counter: Counter = Counter()

    total_files = len(files)
    for idx, item in enumerate(files, start=1):
        csv_path = _resolve_csv_path(csv_base_dir, item.get("path", ""))
        if not csv_path.exists():
            print(f"[WARN] {tour.upper()} CSV missing: {csv_path}")
            continue
        try:
            for name in _iter_csv_player_names(csv_path):
                counter[name] += 1
        except Exception as exc:
            print(f"[WARN] {tour.upper()} failed to scan {csv_path.name}: {exc}")
            continue

        if idx == 1 or idx == total_files or idx % 10 == 0:
            print(
                f"{tour.upper()} scan files {idx}/{total_files} | "
                f"unique players so far: {len(counter)}"
            )

    discovered_players = len(counter)
    players = [
        PlayerCandidate(
            name=name,
            folder=None,
            rank=None,
            folder_id=None,
            appearances=int(appearances),
        )
        for name, appearances in counter.items()
        if int(appearances) >= max(1, int(min_appearances))
    ]
    players.sort(key=lambda p: (-p.appearances, p.name.lower()))

    if top_n > 0:
        players = players[:top_n]

    return players, discovered_players


def _player_dir_has_image(player_dir: Path) -> bool:
    for ext in IMAGE_EXTENSIONS:
        if (player_dir / f"image{ext}").exists():
            return True
    return False


def scan_source_image_name_sets(source_data_dir: Path) -> Tuple[set, set]:
    """
    Returns two sets for players who already have main-app images:
    - normalized name keys
    - slug keys
    """
    name_keys = set()
    slugs = set()
    for profile_path in sorted(source_data_dir.glob("*/profile.json")):
        player_dir = profile_path.parent
        if not _player_dir_has_image(player_dir):
            continue
        try:
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        name = clean_player_name(profile.get("name", ""))
        if not name:
            continue
        key = normalize_name_key(name)
        if key:
            name_keys.add(key)
        slugs.add(slugify(name))
    return name_keys, slugs


def scan_source_external_image_map(source_data_dir: Path) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for profile_path in sorted(source_data_dir.glob("*/profile.json")):
        try:
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        name = clean_player_name(profile.get("name", ""))
        if not name:
            continue
        image_url = normalize_url(profile.get("image_url") or "")
        if not image_url or is_blocked_image_url(image_url):
            continue
        key = normalize_name_key(name)
        if not key:
            continue
        out.setdefault(key, [])
        if image_url not in out[key]:
            out[key].append(image_url)
    return out


def get_existing_output_slugs(output_dir: Path) -> set:
    if not output_dir.exists():
        return set()
    slugs = set()
    for path in output_dir.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() in IMAGE_EXTENSIONS:
            slugs.add(path.stem.lower())
    return slugs


def load_processed_state(state_path: Path) -> Dict[str, Dict[str, Dict]]:
    default_state: Dict[str, Dict[str, Dict]] = {"atp": {}, "wta": {}}
    if not state_path.exists():
        return default_state
    try:
        payload = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return default_state
    if not isinstance(payload, dict):
        return default_state

    for tour in ("atp", "wta"):
        rows = payload.get(tour)
        if isinstance(rows, dict):
            default_state[tour] = rows
    return default_state


def save_processed_state(state_path: Path, state: Dict[str, Dict[str, Dict]]) -> None:
    payload = {}
    for tour in ("atp", "wta"):
        rows = state.get(tour, {})
        payload[tour] = rows if isinstance(rows, dict) else {}
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def processed_state_path_for_tour(tour: str) -> Path:
    safe_tour = str(tour or "").strip().lower()
    if safe_tour not in {"atp", "wta"}:
        safe_tour = "both"
    return OUTPUT_ROOT / f"processed_players_state_hybrid_{safe_tour}.json"


def report_path_for_tour(tour: str) -> Path:
    safe_tour = str(tour or "").strip().lower()
    if safe_tour not in {"atp", "wta", "both"}:
        safe_tour = "both"
    return OUTPUT_ROOT / f"download_report_hybrid_{safe_tour}.json"


def http_get_text(url: str, timeout: int, headers: Optional[Dict[str, str]] = None) -> str:
    req_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    }
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        payload = response.read()
        encoding = response.headers.get_content_charset() or "utf-8"
        return payload.decode(encoding, errors="replace")


def http_get_json(
    url: str,
    params: Dict[str, str],
    timeout: int,
    headers: Optional[Dict[str, str]] = None,
) -> Dict:
    query = urllib.parse.urlencode(params)
    full_url = f"{url}?{query}" if query else url
    req_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,*/*;q=0.8",
    }
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(full_url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def wikipedia_image_url_for_player(name: str, timeout: int) -> Optional[str]:
    candidates = [
        f"{name} (tennis)",
        f"{name} (tennis player)",
        name,
    ]
    for title in candidates:
        try:
            data = http_get_json(
                WIKIPEDIA_API,
                {
                    "action": "query",
                    "format": "json",
                    "redirects": "1",
                    "prop": "pageimages",
                    "piprop": "original|thumbnail|name",
                    "pithumbsize": "1200",
                    "titles": title,
                },
                timeout=timeout,
            )
        except Exception:
            continue
        pages = (data.get("query") or {}).get("pages") or {}
        for _, page in pages.items():
            if "missing" in page:
                continue
            original = page.get("original") or {}
            thumbnail = page.get("thumbnail") or {}
            source = (original.get("source") or thumbnail.get("source") or "").strip()
            if source:
                return normalize_url(source)

    try:
        search_data = http_get_json(
            WIKIPEDIA_API,
            {
                "action": "query",
                "format": "json",
                "list": "search",
                "srsearch": f"{name} tennis player",
                "srlimit": "3",
            },
            timeout=timeout,
        )
    except Exception:
        return None

    hits = (search_data.get("query") or {}).get("search") or []
    for hit in hits:
        title = (hit.get("title") or "").strip()
        if not title:
            continue
        try:
            data = http_get_json(
                WIKIPEDIA_API,
                {
                    "action": "query",
                    "format": "json",
                    "redirects": "1",
                    "prop": "pageimages",
                    "piprop": "original|thumbnail|name",
                    "pithumbsize": "1200",
                    "titles": title,
                },
                timeout=timeout,
            )
        except Exception:
            continue
        pages = (data.get("query") or {}).get("pages") or {}
        for _, page in pages.items():
            if "missing" in page:
                continue
            original = page.get("original") or {}
            thumbnail = page.get("thumbnail") or {}
            source = (original.get("source") or thumbnail.get("source") or "").strip()
            if source:
                return normalize_url(source)
    return None


def _extract_ddg_vqd(payload: str) -> Optional[str]:
    patterns = [
        r"vqd=['\"]([^'\"]+)['\"]",
        r"vqd=([0-9\-]+)\&",
    ]
    for pattern in patterns:
        match = re.search(pattern, payload)
        if match:
            return match.group(1).strip()
    return None


def ddg_image_candidates(query: str, timeout: int, limit: int) -> List[Tuple[str, str, str]]:
    search_params = {"q": query, "iax": "images", "ia": "images"}
    html_text = http_get_text(
        f"https://duckduckgo.com/?{urllib.parse.urlencode(search_params)}",
        timeout=timeout,
    )
    vqd = _extract_ddg_vqd(html_text)
    if not vqd:
        return []

    payload = http_get_json(
        "https://duckduckgo.com/i.js",
        {
            "l": "us-en",
            "o": "json",
            "q": query,
            "vqd": vqd,
            "f": ",,,",
            "p": "1",
            "s": "0",
        },
        timeout=timeout,
        headers={
            "Referer": "https://duckduckgo.com/",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    rows = payload.get("results") or []
    out: List[Tuple[str, str, str]] = []
    for row in rows:
        image_url = normalize_url((row or {}).get("image") or "")
        if not image_url or is_blocked_image_url(image_url):
            continue
        source_page = normalize_url((row or {}).get("url") or "")
        title = str((row or {}).get("title") or "")
        snippet = str((row or {}).get("snippet") or "")
        source_hint = str((row or {}).get("source") or "")
        context = " ".join([title, snippet, source_hint, source_page]).strip()
        out.append((image_url, source_page, context))
        if len(out) >= max(1, int(limit)):
            break
    return out


def _decode_bing_murl(raw: str) -> str:
    text = html.unescape(str(raw or ""))
    text = text.replace("\\/", "/")
    text = text.replace("%3a", ":").replace("%2f", "/")
    return normalize_url(text)


def bing_image_candidates(query: str, timeout: int, limit: int) -> List[Tuple[str, str, str]]:
    url = f"https://www.bing.com/images/search?{urllib.parse.urlencode({'q': query})}"
    html_text = http_get_text(url, timeout=timeout, headers={"Referer": "https://www.bing.com/"})
    out: List[Tuple[str, str, str]] = []
    seen = set()
    for match in re.finditer(r'"murl":"(https?:\\\/\\\/[^"]+)"', html_text):
        candidate = _decode_bing_murl(match.group(1))
        if not candidate or candidate in seen or is_blocked_image_url(candidate):
            continue
        window_start = max(0, match.start() - 280)
        window_end = min(len(html_text), match.end() + 420)
        window = html_text[window_start:window_end]

        source_page = ""
        purl_match = re.search(r'"purl":"([^"]+)"', window)
        if purl_match:
            source_page = normalize_url(html.unescape(purl_match.group(1)))
        title_text = ""
        title_match = re.search(r'"t":"([^"]+)"', window)
        if title_match:
            title_text = html.unescape(title_match.group(1))
        context = " ".join([title_text, source_page]).strip()

        seen.add(candidate)
        out.append((candidate, source_page, context))
        if len(out) >= max(1, int(limit)):
            return out

    # Fallback extractor if metadata window parsing misses.
    if not out:
        for raw in re.findall(r"murl&quot;:&quot;(https?://[^&]+)&quot;", html_text):
            candidate = _decode_bing_murl(raw)
            if not candidate or candidate in seen or is_blocked_image_url(candidate):
                continue
            seen.add(candidate)
            out.append((candidate, "", candidate))
            if len(out) >= max(1, int(limit)):
                return out
    return out


def ddg_web_result_links(query: str, timeout: int, limit: int) -> List[str]:
    url = f"https://duckduckgo.com/html/?{urllib.parse.urlencode({'q': query})}"
    html_text = http_get_text(url, timeout=timeout)
    out: List[str] = []
    seen = set()
    for encoded in re.findall(r"uddg=([^&\"']+)", html_text):
        target = normalize_url(urllib.parse.unquote(encoded))
        if not target or target in seen:
            continue
        if is_blocked_domain(target):
            continue
        seen.add(target)
        out.append(target)
        if len(out) >= max(1, int(limit)):
            break
    return out


def extract_og_image_from_html(html_text: str) -> str:
    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html_text, flags=re.IGNORECASE)
        if match:
            return normalize_url(html.unescape(match.group(1)))
    return ""


def extract_page_context_from_html(html_text: str) -> str:
    parts: List[str] = []
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.IGNORECASE | re.DOTALL)
    if title_match:
        parts.append(html.unescape(title_match.group(1)))
    meta_patterns = [
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
        r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:site_name["\']',
    ]
    for pattern in meta_patterns:
        match = re.search(pattern, html_text, flags=re.IGNORECASE)
        if match:
            parts.append(html.unescape(match.group(1)))
    context = " ".join(str(p).strip() for p in parts if str(p).strip())
    return re.sub(r"\s+", " ", context).strip()


def og_page_image_candidates(query: str, timeout: int, limit: int) -> List[Tuple[str, str, str]]:
    links = ddg_web_result_links(query=query, timeout=timeout, limit=limit)
    out: List[Tuple[str, str, str]] = []
    seen = set()
    for link in links:
        try:
            html_text = http_get_text(link, timeout=max(8, timeout // 2))
        except Exception:
            continue
        image_url = extract_og_image_from_html(html_text)
        if not image_url or image_url in seen or is_blocked_image_url(image_url):
            continue
        page_context = extract_page_context_from_html(html_text)
        seen.add(image_url)
        out.append((image_url, link, page_context))
    return out


def gather_image_candidates(
    player_name: str,
    tour: str,
    source_external_map: Dict[str, List[str]],
    timeout: int,
    use_wikipedia_fallback: bool,
) -> List[ImageCandidate]:
    out: List[ImageCandidate] = []
    seen = set()

    def push(
        url: str,
        source: str,
        source_page_url: str = "",
        context: str = "",
        allow_wikipedia: bool = False,
    ) -> None:
        candidate = normalize_url(url)
        if not candidate or candidate in seen:
            return
        if is_blocked_image_url(candidate, allow_wikipedia=allow_wikipedia):
            return
        score = score_candidate_relevance(
            player_name=player_name,
            image_url=candidate,
            source_page_url=source_page_url,
            context=context,
            source=source,
        )
        if score < max(0, int(MIN_RELEVANCE_SCORE)):
            return
        seen.add(candidate)
        out.append(
            ImageCandidate(
                url=candidate,
                source=source,
                score=score,
                source_page_url=source_page_url,
                context=context,
            )
        )

    key = normalize_name_key(player_name)
    for url in source_external_map.get(key, []):
        push(url, "local-profile-image-url", source_page_url=url, context=url)

    query = f'"{player_name}" tennis player {tour.upper()}'
    try:
        for image_url, source_page_url, context in ddg_image_candidates(
            query=query,
            timeout=timeout,
            limit=DDG_IMAGE_RESULTS_LIMIT,
        ):
            push(
                image_url,
                "duckduckgo-images",
                source_page_url=source_page_url,
                context=context,
            )
    except Exception:
        pass
    try:
        for image_url, source_page_url, context in bing_image_candidates(
            query=query,
            timeout=timeout,
            limit=BING_IMAGE_RESULTS_LIMIT,
        ):
            push(
                image_url,
                "bing-images",
                source_page_url=source_page_url,
                context=context,
            )
    except Exception:
        pass
    try:
        for image_url, source_page_url, context in og_page_image_candidates(
            query=query,
            timeout=timeout,
            limit=WEB_OG_RESULTS_LIMIT,
        ):
            push(
                image_url,
                "web-og-image",
                source_page_url=source_page_url,
                context=context,
            )
    except Exception:
        pass

    if use_wikipedia_fallback:
        try:
            wiki_url = wikipedia_image_url_for_player(player_name, timeout=timeout)
        except Exception:
            wiki_url = None
        if wiki_url:
            push(
                wiki_url,
                "wikipedia-fallback",
                source_page_url=wiki_url,
                context=f"{player_name} tennis wikipedia",
                allow_wikipedia=True,
            )

    out.sort(key=lambda c: (-int(c.score), c.source, c.url))
    return out


def download_binary(url: str, timeout: int) -> Tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        content = response.read()
        content_type = response.headers.get("Content-Type", "")
        return content, content_type


def ext_from_url_or_type(url: str, content_type: str) -> str:
    lower_type = (content_type or "").lower()
    if "png" in lower_type:
        return ".png"
    if "webp" in lower_type:
        return ".webp"
    if "avif" in lower_type:
        return ".avif"
    if "jpeg" in lower_type or "jpg" in lower_type:
        return ".jpg"

    path = urllib.parse.urlparse(url).path.lower()
    for ext in IMAGE_EXTENSIONS:
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return ".jpg"


def image_dimensions(data: bytes) -> Tuple[Optional[int], Optional[int]]:
    if not data or len(data) < 24:
        return (None, None)

    # PNG
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")
        return (width, height)

    # JPEG
    if data[0:2] == b"\xff\xd8":
        idx = 2
        data_len = len(data)
        while idx + 9 < data_len:
            if data[idx] != 0xFF:
                idx += 1
                continue
            marker = data[idx + 1]
            if marker in {0xD8, 0xD9}:
                idx += 2
                continue
            if idx + 4 > data_len:
                break
            block_len = int.from_bytes(data[idx + 2:idx + 4], "big")
            if block_len < 2:
                break
            if marker in {
                0xC0,
                0xC1,
                0xC2,
                0xC3,
                0xC5,
                0xC6,
                0xC7,
                0xC9,
                0xCA,
                0xCB,
                0xCD,
                0xCE,
                0xCF,
            }:
                if idx + 9 <= data_len:
                    height = int.from_bytes(data[idx + 5:idx + 7], "big")
                    width = int.from_bytes(data[idx + 7:idx + 9], "big")
                    return (width, height)
                break
            idx += 2 + block_len

    # WEBP (VP8X quick parse)
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP" and len(data) >= 30:
        chunk = data[12:16]
        if chunk == b"VP8X" and len(data) >= 30:
            width_minus_one = int.from_bytes(data[24:27], "little")
            height_minus_one = int.from_bytes(data[27:30], "little")
            return (width_minus_one + 1, height_minus_one + 1)

    return (None, None)


def is_plausible_image(content: bytes, content_type: str) -> bool:
    if not content or len(content) < max(1024, int(MIN_IMAGE_BYTES)):
        return False
    lower_type = (content_type or "").lower()
    if lower_type and "image" not in lower_type:
        return False
    width, height = image_dimensions(content)
    if width is not None and height is not None:
        min_dim = max(64, int(MIN_IMAGE_DIMENSION))
        if width < min_dim or height < min_dim:
            return False
        # Reject very wide banners or very tall strips.
        ratio = (max(width, height) / max(1, min(width, height)))
        if ratio > 4.5:
            return False
    return True


def render_bar(current: int, total: int, width: int = 28) -> str:
    if total <= 0:
        return "[" + ("-" * width) + "]"
    ratio = max(0.0, min(1.0, current / total))
    filled = int(ratio * width)
    return "[" + ("#" * filled) + ("-" * (width - filled)) + "]"


def print_progress(tour: str, idx: int, total: int, saved: int, skipped: int, failed: int, name: str) -> None:
    pct = (idx / total * 100.0) if total else 100.0
    bar = render_bar(idx, total)
    line = (
        f"{tour.upper()} {bar} {idx}/{total} ({pct:5.1f}%) | "
        f"saved={saved} skipped={skipped} failed={failed} | {name}"
    )
    print(line)


def run_tour(
    tour: str,
    top_n: int,
    timeout: int,
    delay: float,
    dry_run: bool,
    player_source: str,
    min_appearances: int,
    skip_processed: bool,
    use_wikipedia_fallback: bool,
    processed_state: Optional[Dict[str, Dict[str, Dict]]] = None,
) -> Dict:
    config = TOUR_CONFIG[tour]
    manifest_path = config["manifest"]
    csv_manifest_path = config["csv_manifest"]
    csv_base_dir = config["csv_base_dir"]
    source_data_dir = config["source_data"]
    output_dir = config["output"]
    output_dir.mkdir(parents=True, exist_ok=True)

    if player_source == "csv":
        players, discovered_players = load_players_from_csv(
            tour=tour,
            csv_manifest_path=csv_manifest_path,
            csv_base_dir=csv_base_dir,
            top_n=top_n,
            min_appearances=min_appearances,
        )
    else:
        players, discovered_players = load_players_from_manifest(
            manifest_path=manifest_path,
            top_n=top_n,
        )

    source_name_keys, source_slugs = scan_source_image_name_sets(source_data_dir)
    source_external_map = scan_source_external_image_map(source_data_dir)
    existing_output = get_existing_output_slugs(output_dir)
    tour_processed = (processed_state or {}).get(tour, {})
    processed_slugs = set(tour_processed.keys()) if isinstance(tour_processed, dict) else set()

    queue: List[PlayerCandidate] = []
    skipped_source_images = 0
    skipped_existing_output = 0
    skipped_processed = 0
    for player in players:
        name_key = normalize_name_key(player.name)
        slug = slugify(player.name)
        if name_key in source_name_keys or slug in source_slugs:
            skipped_source_images += 1
            continue
        if slug in existing_output:
            skipped_existing_output += 1
            continue
        if skip_processed and slug in processed_slugs:
            skipped_processed += 1
            continue
        queue.append(player)

    total = len(queue)
    saved = 0
    skipped = skipped_source_images + skipped_existing_output + skipped_processed
    failed = 0
    results = []

    print(
        f"{tour.upper()} discovery summary | source={player_source} "
        f"discovered={discovered_players} selected={len(players)} "
        f"skip_main_app_images={skipped_source_images} "
        f"skip_existing_analysis_images={skipped_existing_output} "
        f"skip_processed={skipped_processed} "
        f"queue={total}"
    )

    if total == 0:
        print(f"{tour.upper()}: no missing images in selected players.")

    for idx, player in enumerate(queue, start=1):
        name = player.name
        slug = slugify(name)
        status = "failed"
        file_path = None
        used_image_url = ""
        used_source = ""
        used_score = None
        reason = "no_image_found"

        try:
            candidates = gather_image_candidates(
                player_name=name,
                tour=tour,
                source_external_map=source_external_map,
                timeout=timeout,
                use_wikipedia_fallback=use_wikipedia_fallback,
            )
        except Exception as exc:
            candidates = []
            reason = f"candidate_error:{exc.__class__.__name__}"

        for candidate in candidates:
            candidate_url = candidate.url
            candidate_source = candidate.source
            try:
                content, content_type = download_binary(candidate_url, timeout=timeout)
            except urllib.error.HTTPError as exc:
                reason = f"http_{exc.code}"
                continue
            except Exception as exc:
                reason = f"download_error:{exc.__class__.__name__}"
                continue

            if not is_plausible_image(content, content_type):
                reason = "invalid_image_payload"
                continue

            ext = ext_from_url_or_type(candidate_url, content_type)
            target = output_dir / f"{slug}{ext}"
            if dry_run:
                status = "would_save"
                saved += 1
                file_path = str(target.relative_to(REPO_ROOT))
            else:
                target.write_bytes(content)
                status = "saved"
                saved += 1
                file_path = str(target.relative_to(REPO_ROOT))
            used_image_url = candidate_url
            used_source = candidate_source
            used_score = int(candidate.score)
            reason = ""
            break

        if status == "failed":
            failed += 1

        results.append(
            {
                "name": name,
                "tour": tour,
                "status": status,
                "reason": reason,
                "source": used_source,
                "score": used_score,
                "file_path": file_path,
                "image_url": used_image_url,
            }
        )
        # Mark this player as processed so later runs can skip it (success or fail).
        if not dry_run and isinstance(processed_state, dict):
            tour_rows = processed_state.setdefault(tour, {})
            if isinstance(tour_rows, dict):
                prev = tour_rows.get(slug) if isinstance(tour_rows.get(slug), dict) else {}
                attempts = parse_int(prev.get("attempts")) or 0
                tour_rows[slug] = {
                    "name": name,
                    "status": status,
                    "reason": reason,
                    "source": used_source,
                    "score": used_score,
                    "last_run_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "attempts": attempts + 1,
                }
        print_progress(tour, idx, total, saved, skipped, failed, name)
        if delay > 0:
            time.sleep(delay)

    return {
        "tour": tour,
        "player_source": player_source,
        "discovered_players": discovered_players,
        "selected_players": len(players),
        "queued_missing": total,
        "skipped_main_app_images": skipped_source_images,
        "skipped_existing_analysis_images": skipped_existing_output,
        "skipped_processed": skipped_processed,
        "saved": saved,
        "skipped": skipped,
        "failed": failed,
        "results": results,
    }


def main() -> int:
    player_source = str(PLAYER_SOURCE or "csv").strip().lower()
    if player_source not in {"csv", "manifest"}:
        print(f"[WARN] Invalid PLAYER_SOURCE={PLAYER_SOURCE!r}; using 'csv'")
        player_source = "csv"

    env_tour_value = str(os.getenv(ENV_TOUR_KEY, "")).strip().lower()
    selected_tour = env_tour_value or str(TOUR or "both").strip().lower()
    if selected_tour not in {"atp", "wta", "both"}:
        raw_tour = env_tour_value if env_tour_value else TOUR
        print(f"[WARN] Invalid TOUR={raw_tour!r}; using 'both'")
        selected_tour = "both"

    top_n = parse_int(TOP_N)
    if top_n is None:
        print(f"[WARN] Invalid TOP_N={TOP_N!r}; using 5000")
        top_n = 5000

    min_appearances = parse_int(MIN_APPEARANCES)
    if min_appearances is None or min_appearances < 1:
        print(f"[WARN] Invalid MIN_APPEARANCES={MIN_APPEARANCES!r}; using 1")
        min_appearances = 1

    timeout = parse_int(TIMEOUT_SECONDS)
    if timeout is None or timeout <= 0:
        print(f"[WARN] Invalid TIMEOUT_SECONDS={TIMEOUT_SECONDS!r}; using 20")
        timeout = 20

    try:
        delay = float(REQUEST_DELAY_SECONDS)
    except Exception:
        print(f"[WARN] Invalid REQUEST_DELAY_SECONDS={REQUEST_DELAY_SECONDS!r}; using 0.35")
        delay = 0.35
    if delay < 0:
        print("[WARN] REQUEST_DELAY_SECONDS must be >= 0; using 0")
        delay = 0.0

    dry_run = bool(DRY_RUN)
    skip_processed = bool(SKIP_PROCESSED)
    use_wikipedia_fallback = bool(USE_WIKIPEDIA_FALLBACK)

    tours = ["atp", "wta"] if selected_tour == "both" else [selected_tour]

    # Ensure output root exists.
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    summary = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "hybrid_nonwiki_then_wikipedia_fallback",
        "top_n": top_n,
        "player_source": player_source,
        "min_appearances": min_appearances,
        "tour": selected_tour,
        "tour_env_key": ENV_TOUR_KEY,
        "tour_env_value": env_tour_value,
        "dry_run": dry_run,
        "skip_processed": skip_processed,
        "use_wikipedia_fallback": use_wikipedia_fallback,
        "state_files": {},
        "items": [],
    }

    for tour in tours:
        state_path = processed_state_path_for_tour(tour)
        processed_state = load_processed_state(state_path)
        print("=" * 72)
        print(
            f"Processing {tour.upper()} missing images "
            f"(non-Wikipedia first, Wikipedia fallback={use_wikipedia_fallback})"
        )
        print("=" * 72)
        result = run_tour(
            tour=tour,
            top_n=top_n,
            timeout=timeout,
            delay=delay,
            dry_run=dry_run,
            player_source=player_source,
            min_appearances=min_appearances,
            skip_processed=skip_processed,
            use_wikipedia_fallback=use_wikipedia_fallback,
            processed_state=processed_state,
        )
        result["processed_state_file"] = str(state_path.relative_to(REPO_ROOT))
        summary["items"].append(result)
        summary["state_files"][tour] = str(state_path.relative_to(REPO_ROOT))
        if not dry_run:
            save_processed_state(state_path, processed_state)

    report_path = report_path_for_tour(selected_tour)
    report_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\nFinal summary")
    print("-" * 72)
    total_saved = sum(item["saved"] for item in summary["items"])
    total_skipped = sum(item["skipped"] for item in summary["items"])
    total_failed = sum(item["failed"] for item in summary["items"])
    for item in summary["items"]:
        print(
            f"{item['tour'].upper()}: source={item['player_source']} "
            f"discovered={item['discovered_players']} "
            f"selected={item['selected_players']} "
            f"queued={item['queued_missing']} saved={item['saved']} "
            f"skipped={item['skipped']} failed={item['failed']}"
        )
    print(f"TOTAL: saved={total_saved} skipped={total_skipped} failed={total_failed}")
    print(f"Report: {report_path.relative_to(REPO_ROOT)}")
    for tour in tours:
        print(f"Processed state ({tour.upper()}): {summary['state_files'].get(tour, '-')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
