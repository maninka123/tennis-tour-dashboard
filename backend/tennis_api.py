"""
Tennis API - Data fetching module for live tennis data
Fetches data from various sources including web scraping and APIs

==============================================
REAL ATP/WTA API INTEGRATION GUIDE
==============================================

This file currently uses demo data. To integrate real live tennis data, 
you can use the following APIs and daata sources:

1. OFFICIAL ATP/WTA APIs (Requires Partnership/License)
   - ATP World Tour API: https://www.atptour.com/
   - WTA Tennis API: https://www.wtatennis.com/
   - These require official partnerships and licensing agreements
   
2. SPORTRADAR API (Commercial - Paid)
   - Website: https://sportradar.com/
   - Coverage: Comprehensive ATP/WTA data including live scores, rankings, player stats
   - Pricing: Enterprise-level, contact for quotes
   - Endpoints: Live scores, match statistics, player profiles, H2H records
   - Documentation: https://developer.sportradar.com/tennis/reference/intro
   
3. THE ODDS API (Free Tier Available)
   - Website: https://the-odds-api.com/
   - Coverage: Live scores, upcoming matches (limited tennis coverage)
   - Free Tier: 500 requests/month
   - API Key: Register at https://the-odds-api.com/account/
   - Endpoints: /v4/sports/tennis/scores, /v4/sports/tennis/odds
   
4. RAPID API - Tennis Live Data (Paid)
   - Website: https://rapidapi.com/
   - Search for "tennis" to find multiple providers
   - Popular: Tennis Live Data API, Ultimate Tennis API
   - Pricing: Starting from $10/month
   - Coverage: Live scores, rankings, tournaments, player stats
   
5. SPORTSDATA.IO (Paid)
   - Website: https://sportsdata.io/
   - Coverage: Comprehensive tennis data
   - Pricing: Starting from $50/month
   - Endpoints: Live scores, schedules, player stats, odds
   
6. WEB SCRAPING (Free but Limited)
   - Source: https://www.flashscore.com/tennis/
   - Source: https://www.tennislive.net/
   - Note: Check Terms of Service, may violate TOS
   - Libraries: BeautifulSoup, Selenium, Scrapy
   - Challenges: Website structure changes, rate limiting, legal concerns

IMPLEMENTATION EXAMPLES:

# Example 1: Using Sportradar API
def fetch_live_scores_sportradar(self, tour='atp'):
    api_key = 'YOUR_SPORTRADAR_API_KEY'
    endpoint = f'https://api.sportradar.us/tennis/{tour}/v3/en/schedules/live/schedule.json'
    response = requests.get(endpoint, params={'api_key': api_key})
    data = response.json()
    return self._parse_sportradar_data(data)

# Example 2: Using The Odds API
def fetch_live_scores_odds_api(self):
    api_key = 'YOUR_ODDS_API_KEY'
    endpoint = 'https://api.the-odds-api.com/v4/sports/tennis/scores'
    response = requests.get(endpoint, params={'apiKey': api_key, 'daysFrom': 1})
    return response.json()

# Example 3: Web Scraping FlashScore
def scrape_flashscore(self):
    url = 'https://www.flashscore.com/tennis/'
    response = self.session.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    # Parse match data from HTML structure
    matches = soup.find_all('div', class_='event__match')
    return self._parse_flashscore_matches(matches)

RECOMMENDED APPROACH:
1. Start with The Odds API (free tier for testing)
2. If you need more data, upgrade to Rapid API or SportsData.io
3. For production with high traffic, consider Sportradar
4. Always cache responses to minimize API calls and costs

DATA STRUCTURE REQUIREMENTS:
- Live Scores: match_id, tournament, round, player1, player2, score, status, serving
- Rankings: rank, player_name, country, points, tournaments_played
- Tournaments: id, name, category, surface, dates, location, draw_size
- Player Stats: aces, double_faults, first_serve%, break_points, winners, errors
- H2H: matches_played, wins_p1, wins_p2, recent_matches, surfaces

SECURITY NOTES:
- Store API keys in environment variables (.env file)
- Never commit API keys to version control
- Use rate limiting to avoid exceeding API quotas
- Implement proper error handling for API failures
- Set up monitoring for API usage and costs
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from cachetools import TTLCache
import random
import json
import csv
import re
import unicodedata
import difflib
import shutil
import subprocess
import sys
import time
import urllib.parse
import zlib
from pathlib import Path
from config import Config

# Caches for different data types
live_scores_cache = TTLCache(maxsize=100, ttl=Config.CACHE_LIVE_SCORES)
rankings_cache = TTLCache(maxsize=10, ttl=Config.CACHE_RANKINGS)
tournaments_cache = TTLCache(maxsize=10, ttl=Config.CACHE_TOURNAMENTS)
h2h_summary_cache = TTLCache(maxsize=1000, ttl=60 * 60 * 6)
atp_h2h_summary_cache = TTLCache(maxsize=1000, ttl=60 * 60 * 6)
wta_match_stats_cache = TTLCache(maxsize=2000, ttl=30)

WTA_TENNIS_API_BASE = 'https://api.wtatennis.com/tennis'
WTA_SEARCH_API_BASE = 'https://api.wtatennis.com/search/v2/wta/'
ATP_H2H_BASE = 'https://www.atptour.com/en/players/atp-head-2-head'
RJINA_HTTP_PREFIX = 'https://r.jina.ai/http://'

WTA_SERVING_METRICS = [
    {'key': 'aces', 'label': 'Aces', 'value_path': 'Aces', 'min_path': 'MinAces', 'avg_path': 'AverageAces', 'max_path': 'MaxAces', 'lower_is_better': False, 'is_percent': False},
    {'key': 'double-faults', 'label': 'Double Faults', 'value_path': 'Double_Faults', 'min_path': 'MinDoubleFaults', 'avg_path': 'AverageDoubleFaults', 'max_path': 'MaxDoubleFaults', 'lower_is_better': True, 'is_percent': False},
    {'key': 'first-serve-percent', 'label': '1st Serve %', 'value_path': 'first_serve_percent', 'min_path': 'MinFirstServePercent', 'avg_path': 'AverageFirstServePercent', 'max_path': 'MaxFirstServePercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'first-serve-won-percent', 'label': '1st Serve Won %', 'value_path': 'first_serve_won_percent', 'min_path': 'MinFirstServeWonPercent', 'avg_path': 'AverageFirstServeWonPercent', 'max_path': 'MaxFirstServeWonPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'second-serve-won-percent', 'label': '2nd Serve Won %', 'value_path': 'second_serve_won_percent', 'min_path': 'MinSecondServeWonPercent', 'avg_path': 'AverageSecondServeWonPercent', 'max_path': 'MaxSecondServeWonPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'break-points-saved', 'label': 'Break Points Saved %', 'value_path': 'breakpoint_saved_percent', 'min_path': 'MinBreakpointSavedPercent', 'avg_path': 'AverageBreakpointSavedPercent', 'max_path': 'MaxBreakpointSavedPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'service-points-won-percent', 'label': 'Service Points Won %', 'value_path': 'service_points_won_percent', 'min_path': 'MinServicePointsWonPercent', 'avg_path': 'AverageServicePointsWonPercent', 'max_path': 'MaxServicePointsWonPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'service-games-won-percent', 'label': 'Service Games Won %', 'value_path': 'service_games_won_percent', 'min_path': 'MinServiceGamesWonPercent', 'avg_path': 'AverageServiceGamesWonPercent', 'max_path': 'MaxServiceGamesWonPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'service-games-played', 'label': 'Service Games Played', 'value_path': 'Service_Games_Played', 'min_path': 'MinServiceGamesPlayed', 'avg_path': 'AverageServiceGamesPlayed', 'max_path': 'MaxServiceGamesPlayed', 'lower_is_better': False, 'is_percent': False}
]

WTA_RETURNING_METRICS = [
    {'key': 'return-points-won-percent', 'label': 'Return Points Won %', 'value_path': 'return_points_won_percent', 'min_path': 'MinReturnPointsWonPercent', 'avg_path': 'AverageReturnPointsWonPercent', 'max_path': 'MaxReturnPointsWonPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'first-return-points-won-percent', 'label': '1st Return Points Won %', 'value_path': 'first_return_percent', 'min_path': 'MinFirstReturnPercent', 'avg_path': 'AverageFirstReturnPercent', 'max_path': 'MaxFirstReturnPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'second-return-points-won-percent', 'label': '2nd Return Points Won %', 'value_path': 'second_return_percent', 'min_path': 'MinSecondReturnPercent', 'avg_path': 'AverageSecondReturnPercent', 'max_path': 'MaxSecondReturnPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'break-points-converted-percent', 'label': 'Break Points Converted %', 'value_path': 'breakpoint_converted_percent', 'min_path': 'MinBreakpointConvertedPercent', 'avg_path': 'AverageBreakpointConvertedPercent', 'max_path': 'MaxBreakpointConvertedPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'return-games-won-percent', 'label': 'Return Games Won %', 'value_path': 'return_games_won_percent', 'min_path': 'MinReturnGamesWonPercent', 'avg_path': 'AverageReturnGamesWonPercent', 'max_path': 'MaxReturnGamesWonPercent', 'lower_is_better': False, 'is_percent': True},
    {'key': 'return-games-played', 'label': 'Return Games Played', 'value_path': 'Return_Games_Played', 'min_path': 'MinReturnGamesPlayed', 'avg_path': 'AverageReturnGamesPlayed', 'max_path': 'MaxReturnGamesPlayed', 'lower_is_better': False, 'is_percent': False}
]


class TennisDataFetcher:
    """Fetches and processes tennis data from various sources"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        self._wta_scraped_index = None
        self._atp_scraped_index = None
        self._wta_tournament_index = None
        self._atp_tournament_index = None
        self._wta_rankings_cache = None
        self._wta_rankings_index = None
        self._atp_rankings_cache = None
        self._atp_rankings_index = None
        self._wta_connections_map = None
        self._atp_stats_cache = None
        self._wta_stats_cache = None
        self._flashscore_rankings_player_urls = {}
        self._sofascore_player_cache = {}

    def _normalize_player_name(self, name):
        if not name:
            return ""
        cleaned = unicodedata.normalize("NFKD", name)
        cleaned = cleaned.encode("ascii", "ignore").decode("ascii")
        cleaned = re.sub(r"[^A-Za-z\s]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip().lower()
        return cleaned

    def _clean_tournament_name(self, name):
        if not name:
            return ""
        cleaned = re.sub(r"\s+(presented|powered)\s+by\s+.*$", "", str(name), flags=re.IGNORECASE).strip()
        return cleaned or str(name).strip()

    def _wta_data_root(self):
        return Path(__file__).resolve().parent.parent / 'data'

    def _flashscore_to_rjina_url(self, url):
        text = str(url or '').strip()
        if not text:
            return ''
        parsed = urllib.parse.urlparse(text)
        host = parsed.netloc or parsed.path
        path = parsed.path if parsed.netloc else ''
        if not host:
            return ''
        if path and not path.startswith('/'):
            path = f'/{path}'
        query = f"?{parsed.query}" if parsed.query else ''
        return f"{RJINA_HTTP_PREFIX}{host}{path}{query}"

    def _extract_ddg_result_urls(self, html):
        urls = []
        text = str(html or '')
        if not text:
            return urls
        raw_hits = []
        raw_hits.extend(re.findall(r'href="([^"]+duckduckgo\.com/l/\?[^"]+)"', text))
        raw_hits.extend(re.findall(r'\((https?://duckduckgo\.com/l/\?[^)\s]+)\)', text))
        for match in raw_hits:
            decoded = urllib.parse.unquote(str(match))
            uddg = re.search(r'uddg=([^&]+)', decoded)
            if not uddg:
                continue
            target = urllib.parse.unquote(uddg.group(1))
            if target.startswith('//'):
                target = f"https:{target}"
            if target.startswith('http'):
                urls.append(target)
        return urls

    def _normalize_flashscore_player_fixtures_url(self, url):
        text = str(url or '').strip()
        if not text:
            return ''
        if text.startswith('//'):
            text = f'https:{text}'
        parsed = urllib.parse.urlparse(text)
        if not parsed.netloc:
            return ''
        host = parsed.netloc.lower()
        if 'flashscore' not in host:
            return ''
        path = parsed.path or ''
        if '/player/' not in path:
            return ''
        parts = [p for p in path.split('/') if p]
        # Expected shape: /player/{slug}/{id}/[{tab}/]
        if len(parts) < 3 or parts[0].lower() != 'player':
            return ''
        core_path = f"/player/{parts[1]}/{parts[2]}/fixtures/"
        path = core_path
        if not path.endswith('/'):
            path += '/'
        return urllib.parse.urlunparse(('https', parsed.netloc, path, '', '', ''))

    def _extract_flashscore_player_urls_from_text(self, text):
        out = []
        seen = set()
        for raw in re.findall(r'https?://www\.flashscore[^)\s]*/player/[A-Za-z0-9\-]+/[A-Za-z0-9]+/', str(text or '')):
            normalized = self._normalize_flashscore_player_fixtures_url(raw)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            out.append(normalized)
        return out

    def _load_flashscore_rankings_player_urls(self, tour=''):
        tour_key = str(tour or '').strip().lower()
        if tour_key not in {'wta', 'atp'}:
            return []
        cached = self._flashscore_rankings_player_urls.get(tour_key)
        if isinstance(cached, list) and cached:
            return cached

        ranking_url = f"https://www.flashscore.com.au/tennis/rankings/{tour_key}/"
        rjina_url = self._flashscore_to_rjina_url(ranking_url)
        if not rjina_url:
            return []
        urls = []
        try:
            response = self.session.get(rjina_url, timeout=25)
            if response.status_code == 200:
                urls = self._extract_flashscore_player_urls_from_text(response.text)
        except Exception:
            urls = []
        self._flashscore_rankings_player_urls[tour_key] = urls
        return urls

    def _flashscore_player_slug_score(self, url, player_name):
        norm_target = self._normalize_player_name(player_name)
        tokens = [t for t in norm_target.split() if t]
        if not tokens:
            return 0
        parsed = urllib.parse.urlparse(url)
        parts = [p for p in parsed.path.split('/') if p]
        slug = ''
        if len(parts) >= 3 and parts[0].lower() == 'player':
            slug = parts[1].lower().replace('-', ' ')
        score = 0
        for token in tokens:
            if token in slug:
                score += 2
        # Bias for last-name match.
        last = tokens[-1]
        if last and last in slug:
            score += 3
        return score

    def _search_flashscore_player_fixtures_url(self, player_name, tour=''):
        name = str(player_name or '').strip()
        if not name:
            return ''
        tour_key = str(tour or '').strip().lower()
        ranking_candidates = self._load_flashscore_rankings_player_urls(tour=tour_key)
        if ranking_candidates:
            ranked_from_rankings = sorted(
                ranking_candidates,
                key=lambda u: (self._flashscore_player_slug_score(u, name), len(u)),
                reverse=True
            )
            top = ranked_from_rankings[0]
            if self._flashscore_player_slug_score(top, name) >= 3:
                return top

        queries = [
            f'"{name}" flashscore tennis player fixtures',
            f'"{name}" flashscore fixtures',
            f'site:flashscore.com/player "{name}" tennis',
            f'site:flashscore.com.au/player "{name}" tennis',
        ]
        raw_urls = []
        for query in queries:
            ddg_url = f"https://duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}"
            rjina_ddg_url = f"{RJINA_HTTP_PREFIX}duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}"
            try:
                response = self.session.get(rjina_ddg_url, timeout=20)
                if response.status_code == 200:
                    raw_urls.extend(self._extract_ddg_result_urls(response.text))
            except Exception:
                pass
            if raw_urls:
                continue
            # Fallback path: direct DDG HTML.
            try:
                response = self.session.get(ddg_url, timeout=20)
                if response.status_code == 200:
                    raw_urls.extend(self._extract_ddg_result_urls(response.text))
            except Exception:
                continue

        candidates = []
        seen = set()
        for raw in raw_urls:
            normalized = self._normalize_flashscore_player_fixtures_url(raw)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            candidates.append(normalized)
        if not candidates:
            return ''

        ranked = sorted(
            candidates,
            key=lambda u: (self._flashscore_player_slug_score(u, name), len(u)),
            reverse=True
        )
        return ranked[0]

    def _parse_flashscore_next_fixture(self, markdown_text, player_name):
        text = str(markdown_text or '')
        if not text:
            return None
        lines = [line.strip() for line in text.splitlines()]
        if not lines:
            return None
        if re.search(r'\bNo match found\.', text, flags=re.IGNORECASE):
            return None

        scan_end = len(lines)
        for idx, line in enumerate(lines):
            if line.lower() in {'pinned leagues', 'my teams', 'calendar', 'rankings'}:
                scan_end = idx
                break

        match_idx = -1
        match_url = ''
        for idx, line in enumerate(lines[:scan_end]):
            if '/tennis/' not in line:
                continue
            hit = re.search(r'\((https?://[^)\s]+/(?:match|game)/tennis/[^)\s]+)(?:\s+"[^"]*")?\)', line)
            if hit:
                match_idx = idx
                match_url = hit.group(1)
                break
        if match_idx < 0:
            return None

        tournament_name = ''
        tournament_url = ''
        stage = ''
        for j in range(match_idx - 1, max(-1, match_idx - 20), -1):
            line = lines[j]
            m = re.match(r'^\[([^\]]+)\]\((https?://[^)\s]*/tennis/[^)\s]*)(?:\s+"[^"]*")?\)', line)
            if m:
                tournament_name = m.group(1).strip()
                tournament_url = m.group(2).strip()
                # Stage typically appears right below tournament title.
                for k in range(j + 1, min(match_idx, j + 6)):
                    stage_line = lines[k]
                    if stage_line.endswith(':') and 'SINGLES' in stage_line.upper():
                        stage = stage_line.rstrip(':').strip()
                        break
                break

        date_text = ''
        date_idx = -1
        for j in range(match_idx + 1, min(scan_end, match_idx + 14)):
            line = lines[j]
            if re.match(r'^\d{2}\.\d{2}\.\s+\d{2}:\d{2}$', line):
                date_text = line
                date_idx = j
                break
            if re.match(r'^[A-Za-z]{3}\s+\d{1,2}$', line):
                next_non_empty = ''
                next_idx = -1
                for look_ahead in range(j + 1, min(scan_end, j + 4)):
                    candidate = lines[look_ahead]
                    if candidate:
                        next_non_empty = candidate
                        next_idx = look_ahead
                        break
                if re.match(r'^\d{1,2}:\d{2}\s*(AM|PM)$', next_non_empty, flags=re.IGNORECASE):
                    date_text = f"{line} {next_non_empty}"
                    date_idx = next_idx
                    break
            if re.match(r'^\d{1,2}:\d{2}\s*(AM|PM)$', line, flags=re.IGNORECASE):
                date_text = line
                date_idx = j
                break

        player_lines = []
        start_idx = (date_idx + 1) if date_idx >= 0 else (match_idx + 1)
        for j in range(start_idx, min(scan_end, start_idx + 12)):
            line = lines[j]
            if not line:
                continue
            name_hit = re.search(r'\)([^()\[\]]+)$', line)
            if not name_hit:
                continue
            short_name = name_hit.group(1).strip()
            if short_name and short_name not in player_lines:
                player_lines.append(short_name)
            if len(player_lines) >= 2:
                break

        me_tokens = [t for t in self._normalize_player_name(player_name).split() if t]
        me_last = me_tokens[-1] if me_tokens else ''
        opponent = ''
        for short_name in player_lines:
            norm_short = self._normalize_player_name(short_name)
            if me_last and me_last in norm_short:
                continue
            opponent = short_name
            break
        if not opponent and player_lines:
            opponent = player_lines[0]

        return {
            'tournament': tournament_name or 'Upcoming Match',
            'tournament_url': tournament_url,
            'stage': stage,
            'scheduled_time': date_text,
            'opponent': opponent or 'TBD',
            'match_url': match_url,
        }

    def _parse_flashscore_latest_result(self, markdown_text, player_name):
        text = str(markdown_text or '')
        if not text:
            return None
        lines = [line.strip() for line in text.splitlines()]
        if not lines:
            return None

        scan_end = len(lines)
        for idx, line in enumerate(lines):
            if line.lower() in {'latest scores', 'scheduled', 'pinned leagues', 'my teams', 'calendar', 'rankings'}:
                scan_end = idx
                break

        match_idx = -1
        match_url = ''
        for idx, line in enumerate(lines[:scan_end]):
            if '/tennis/' not in line:
                continue
            hit = re.search(r'\((https?://[^)\s]+/(?:match|game)/tennis/[^)\s]+)(?:\s+"[^"]*")?\)', line)
            if hit:
                match_idx = idx
                match_url = hit.group(1)
                break
        if match_idx < 0:
            return None

        tournament_name = ''
        tournament_url = ''
        stage = ''
        for j in range(match_idx - 1, max(-1, match_idx - 20), -1):
            line = lines[j]
            m = re.match(r'^\[([^\]]+)\]\((https?://[^)\s]*/tennis/[^)\s]*)(?:\s+"[^"]*")?\)', line)
            if m:
                tournament_name = m.group(1).strip()
                tournament_url = m.group(2).strip()
                for k in range(j + 1, min(match_idx, j + 8)):
                    stage_line = lines[k]
                    if stage_line.endswith(':') and ('SINGLES' in stage_line.upper() or 'DOUBLES' in stage_line.upper()):
                        stage = stage_line.rstrip(':').strip()
                        break
                break

        date_text = ''
        date_idx = -1
        for j in range(match_idx + 1, min(scan_end, match_idx + 14)):
            line = lines[j]
            if re.match(r'^\d{2}\.\d{2}\.\s+\d{2}:\d{2}$', line):
                date_text = line
                date_idx = j
                break
            if re.match(r'^[A-Za-z]{3}\s+\d{1,2}$', line):
                next_non_empty = ''
                next_idx = -1
                for look_ahead in range(j + 1, min(scan_end, j + 4)):
                    candidate = lines[look_ahead]
                    if candidate:
                        next_non_empty = candidate
                        next_idx = look_ahead
                        break
                if re.match(r'^\d{1,2}:\d{2}\s*(AM|PM)$', next_non_empty, flags=re.IGNORECASE):
                    date_text = f"{line} {next_non_empty}"
                    date_idx = next_idx
                    break

        player_lines = []
        start_idx = (date_idx + 1) if date_idx >= 0 else (match_idx + 1)
        for j in range(start_idx, min(scan_end, start_idx + 14)):
            line = lines[j]
            if not line:
                continue
            name_hit = re.search(r'\)([^()\[\]]+)$', line)
            if not name_hit:
                continue
            short_name = name_hit.group(1).strip()
            if short_name and short_name not in player_lines:
                player_lines.append(short_name)
            if len(player_lines) >= 2:
                break

        me_tokens = [t for t in self._normalize_player_name(player_name).split() if t]
        me_last = me_tokens[-1] if me_tokens else ''
        opponent = ''
        for short_name in player_lines:
            norm_short = self._normalize_player_name(short_name)
            if me_last and me_last in norm_short:
                continue
            opponent = short_name
            break
        if not opponent and player_lines:
            opponent = player_lines[0]

        outcome = ''
        for j in range(start_idx, min(scan_end, start_idx + 28)):
            marker = lines[j].strip().upper()
            if marker in {'W', 'L'}:
                outcome = marker
                break

        return {
            'tournament': tournament_name or 'Latest Match',
            'tournament_url': tournament_url,
            'stage': stage,
            'finished_time': date_text,
            'opponent': opponent or 'TBD',
            'match_url': match_url,
            'outcome': outcome
        }

    def fetch_player_next_fixture(self, player_name, tour=''):
        name = str(player_name or '').strip()
        if not name:
            return {
                'scheduled': False,
                'message': 'Player name is required.'
            }
        tour_key = str(tour or '').strip().lower()
        if tour_key not in {'atp', 'wta'}:
            tour_key = ''

        def _extract_json_from_markdown(text):
            raw = str(text or '')
            start = raw.find('{')
            end = raw.rfind('}')
            if start < 0 or end <= start:
                return None
            try:
                return json.loads(raw[start:end + 1])
            except Exception:
                return None

        def _sofascore_api_json(path):
            path_text = str(path or '').strip()
            if not path_text:
                return None
            if path_text.startswith('http://') or path_text.startswith('https://'):
                api_url = path_text
            else:
                if not path_text.startswith('/'):
                    path_text = f'/{path_text}'
                api_url = f'http://api.sofascore.com{path_text}'
            rjina_url = self._flashscore_to_rjina_url(api_url)
            if not rjina_url:
                return None
            for attempt in range(2):
                try:
                    response = self.session.get(rjina_url, timeout=30)
                    if response.status_code != 200:
                        if attempt == 0:
                            time.sleep(0.5)
                        continue
                    payload = _extract_json_from_markdown(response.text)
                    if isinstance(payload, dict):
                        err = payload.get('error') or {}
                        if int(err.get('code') or 0) == 429 and attempt == 0:
                            time.sleep(0.8)
                            continue
                    return payload
                except Exception:
                    if attempt == 0:
                        time.sleep(0.5)
                        continue
                    return None
            return None

        def _sofascore_search_player(query_name, expected_tour=''):
            base_name = str(query_name or '').strip()
            if not base_name:
                return None
            cache_key = f"{expected_tour}:{self._normalize_player_name(base_name)}"
            cached = self._sofascore_player_cache.get(cache_key)
            if isinstance(cached, dict) and cached.get('id'):
                return cached
            parts = [p for p in re.split(r'\s+', base_name) if p]
            query_variants = [base_name]
            if len(parts) >= 2:
                query_variants.append(f"{parts[-1]} {parts[0]}")
            norm_name = self._normalize_player_name(base_name)
            if norm_name and norm_name not in query_variants:
                query_variants.append(norm_name)

            results = []
            for variant in query_variants[:3]:
                query = urllib.parse.quote_plus(variant)
                payload = _sofascore_api_json(f"/api/v1/search/all?q={query}")
                if not isinstance(payload, dict):
                    continue
                batch = payload.get('results') or []
                if isinstance(batch, list):
                    results.extend(batch)
                if len(results) >= 20:
                    break

            candidates = []
            norm_target = self._normalize_player_name(query_name)
            target_tokens = [t for t in norm_target.split() if t]
            for row in results:
                if not isinstance(row, dict) or row.get('type') != 'team':
                    continue
                entity = row.get('entity') or {}
                sport_name = str((entity.get('sport') or {}).get('name') or '').lower()
                if sport_name != 'tennis':
                    continue
                pid = entity.get('id')
                if not pid:
                    continue
                cand_name = str(entity.get('name') or '').strip()
                cand_slug = str(entity.get('slug') or '').strip()
                cand_gender = str(entity.get('gender') or '').upper()
                cand_norm = self._normalize_player_name(cand_name)
                score = 0
                if cand_norm == norm_target:
                    score += 12
                for token in target_tokens:
                    if token and token in cand_norm:
                        score += 2
                    if token and token in cand_slug.replace('-', ' '):
                        score += 1
                if target_tokens:
                    last = target_tokens[-1]
                    if last and last in cand_norm:
                        score += 2
                if expected_tour == 'wta' and cand_gender == 'F':
                    score += 4
                if expected_tour == 'atp' and cand_gender == 'M':
                    score += 4
                candidates.append({
                    'id': int(pid),
                    'name': cand_name,
                    'slug': cand_slug,
                    'country': (entity.get('country') or {}).get('alpha2') or '',
                    'score': score
                })
            if not candidates:
                return None
            candidates.sort(key=lambda c: c.get('score', 0), reverse=True)
            best = candidates[0]
            self._sofascore_player_cache[cache_key] = best
            return best

        def _event_matches_player(event_obj, player_id):
            if not isinstance(event_obj, dict):
                return False
            home_id = (event_obj.get('homeTeam') or {}).get('id')
            away_id = (event_obj.get('awayTeam') or {}).get('id')
            return int(home_id or -1) == int(player_id) or int(away_id or -1) == int(player_id)

        def _event_matches_tour(event_obj, expected_tour=''):
            if not expected_tour:
                return True
            cat_name = str(((event_obj.get('tournament') or {}).get('category') or {}).get('name') or '').upper()
            if expected_tour == 'wta':
                return 'WTA' in cat_name
            if expected_tour == 'atp':
                return 'ATP' in cat_name
            return True

        def _is_doubles_event(event_obj):
            tournament = event_obj.get('tournament') or {}
            unique = tournament.get('uniqueTournament') or {}
            season = event_obj.get('season') or {}
            home_name = str((event_obj.get('homeTeam') or {}).get('name') or '')
            away_name = str((event_obj.get('awayTeam') or {}).get('name') or '')
            text = ' '.join([
                str(tournament.get('name') or ''),
                str(unique.get('name') or ''),
                str(season.get('name') or ''),
            ]).lower()
            if 'doubles' in text:
                return True
            return '/' in home_name or '/' in away_name

        def _build_event_payload(event_obj, player_obj, expected_tour=''):
            if not isinstance(event_obj, dict):
                return None
            event_id = event_obj.get('id')
            details = None
            if event_id:
                detail_payload = _sofascore_api_json(f"/api/v1/event/{int(event_id)}")
                if isinstance(detail_payload, dict):
                    details = detail_payload.get('event')
            e = details if isinstance(details, dict) else event_obj

            tournament = e.get('tournament') or {}
            unique = tournament.get('uniqueTournament') or {}
            category = tournament.get('category') or {}
            round_info = e.get('roundInfo') or {}
            venue = e.get('venue') or {}
            status = e.get('status') or {}
            start_ts = e.get('startTimestamp')
            custom_id = e.get('customId') or event_obj.get('customId')
            slug = e.get('slug') or event_obj.get('slug')
            player_id = int(player_obj.get('id'))

            home = e.get('homeTeam') or {}
            away = e.get('awayTeam') or {}
            is_home = int(home.get('id') or -1) == player_id
            opponent_name = (away.get('name') if is_home else home.get('name')) or 'TBD'

            winner_code = e.get('winnerCode')
            outcome = ''
            if winner_code in (1, 2):
                outcome = 'W' if ((winner_code == 1 and is_home) or (winner_code == 2 and not is_home)) else 'L'

            cat_name = str(category.get('name') or '').upper()
            points = unique.get('tennisPoints')
            level = cat_name
            if points and cat_name in {'WTA', 'ATP'}:
                level = f"{cat_name} {points}"
            round_name = str(round_info.get('name') or '').strip()
            competition_parts = ['Tennis', level, str(tournament.get('name') or '').strip(), round_name]
            competition = ', '.join([p for p in competition_parts if p])

            venue_name = str(venue.get('name') or '')
            city_name = str((venue.get('city') or {}).get('name') or '')
            country_name = str((venue.get('country') or {}).get('name') or '')
            location = ', '.join([p for p in [city_name, country_name] if p])
            if not location:
                # Fallback from tournament title format: "Doha, Qatar".
                location = str(tournament.get('name') or '')
            ground_type = str(e.get('groundType') or unique.get('groundType') or '')
            status_type = str(status.get('type') or '').lower()

            match_url = ''
            if slug and custom_id:
                match_url = f"https://www.sofascore.com/tennis/match/{slug}/{custom_id}"
            source_url = f"https://www.sofascore.com/tennis/player/{player_obj.get('slug')}/{player_id}"

            payload = {
                'player': player_obj.get('name') or name,
                'tour': str(expected_tour or '').upper(),
                'source': 'sofascore',
                'source_url': source_url,
                'sofascore_player_id': player_id,
                'event_id': event_id,
                'match_url': match_url,
                'status_type': status_type,
                'scheduled': status_type != 'finished',
                'finished': status_type == 'finished',
                'is_doubles': _is_doubles_event(e),
                'start_timestamp': start_ts,
                'scheduled_time': datetime.utcfromtimestamp(start_ts).strftime('%Y-%m-%d %H:%M') if start_ts else '',
                'tournament': str(tournament.get('name') or '').strip() or 'Tournament',
                'stage': round_name or '-',
                'competition': competition,
                'opponent': str(opponent_name).strip() or 'TBD',
                'venue': venue_name,
                'location': location,
                'ground_type': ground_type,
                'outcome': outcome
            }
            return payload

        player_obj = _sofascore_search_player(name, expected_tour=tour_key)
        if not player_obj:
            return {
                'scheduled': False,
                'message': 'No SofaScore player profile found.'
            }

        now_ts = int(datetime.utcnow().timestamp())
        today = datetime.utcnow().date()

        upcoming_singles = []
        upcoming_doubles = []
        for d in range(0, 15):
            day = today + timedelta(days=d)
            day_key = day.strftime('%Y-%m-%d')
            day_payload = _sofascore_api_json(f"/api/v1/sport/tennis/scheduled-events/{day_key}") or {}
            day_events = day_payload.get('events') if isinstance(day_payload, dict) else []
            if not isinstance(day_events, list):
                continue
            for event in day_events:
                if not _event_matches_player(event, player_obj['id']):
                    continue
                if not _event_matches_tour(event, expected_tour=tour_key):
                    continue
                start_ts = int(event.get('startTimestamp') or 0)
                status_type = str((event.get('status') or {}).get('type') or '').lower()
                if status_type == 'finished':
                    continue
                if start_ts and start_ts < (now_ts - 3600):
                    continue
                if _is_doubles_event(event):
                    upcoming_doubles.append(event)
                else:
                    upcoming_singles.append(event)

        if upcoming_singles:
            upcoming_singles.sort(key=lambda e: int(e.get('startTimestamp') or 0))
            next_event = upcoming_singles[0]
            payload = _build_event_payload(next_event, player_obj, expected_tour=tour_key) or {}
            status_type = str(payload.get('status_type') or '')
            if status_type == 'inprogress':
                payload['message'] = 'Singles match in progress.'
            else:
                payload['message'] = 'Scheduled singles match.'
            return payload

        if upcoming_doubles:
            upcoming_doubles.sort(key=lambda e: int(e.get('startTimestamp') or 0))
            next_double = upcoming_doubles[0]
            payload = _build_event_payload(next_double, player_obj, expected_tour=tour_key) or {}
            payload['scheduled'] = False
            payload['doubles_only'] = True
            payload['message'] = 'No scheduled singles match. Next listed match is doubles.'
            return payload

        latest_finished = None
        for d in range(0, 15):
            day = today - timedelta(days=d)
            day_key = day.strftime('%Y-%m-%d')
            day_payload = _sofascore_api_json(f"/api/v1/sport/tennis/scheduled-events/{day_key}") or {}
            day_events = day_payload.get('events') if isinstance(day_payload, dict) else []
            if not isinstance(day_events, list):
                continue
            for event in day_events:
                if not _event_matches_player(event, player_obj['id']):
                    continue
                if not _event_matches_tour(event, expected_tour=tour_key):
                    continue
                if _is_doubles_event(event):
                    continue
                status_type = str((event.get('status') or {}).get('type') or '').lower()
                if status_type != 'finished':
                    continue
                if latest_finished is None or int(event.get('startTimestamp') or 0) > int(latest_finished.get('startTimestamp') or 0):
                    latest_finished = event

        if latest_finished:
            payload = _build_event_payload(latest_finished, player_obj, expected_tour=tour_key) or {}
            payload['scheduled'] = False
            payload['finished'] = True
            outcome = str(payload.get('outcome') or '').upper()
            if outcome == 'W':
                payload['message'] = 'Finished. Player won; waiting for next-round opponent.'
            elif outcome == 'L':
                payload['message'] = 'Finished. Player lost; next tournament details loading.'
            else:
                payload['message'] = 'Finished. Waiting for next fixture update.'
            return payload

        return {
            'scheduled': False,
            'player': player_obj.get('name') or name,
            'tour': str(tour_key or '').upper(),
            'source': 'sofascore',
            'source_url': f"https://www.sofascore.com/tennis/player/{player_obj.get('slug')}/{player_obj.get('id')}",
            'message': 'No scheduled singles match right now.'
        }

    def _recent_match_count(self, stats):
        if not isinstance(stats, dict):
            return 0
        total = 0
        for key in ('recent_matches_tab', 'recent_matches', 'recent_matches_from_tournaments', 'recent_matches_best'):
            section = stats.get(key) or {}
            tournaments = section.get('tournaments') if isinstance(section, dict) else None
            if not isinstance(tournaments, list):
                continue
            for t in tournaments:
                matches = (t or {}).get('matches') if isinstance(t, dict) else None
                if isinstance(matches, list):
                    total += len(matches)
        return total

    def _entry_quality_score(self, entry):
        if not isinstance(entry, dict):
            return (0, 0, 0, 0)
        profile = entry.get('profile') or {}
        stats = entry.get('stats') or {}
        image_score = 1 if str(profile.get('image_url') or '').strip() else 0
        profile_url_score = 1 if str(profile.get('url') or '').strip() else 0
        player_id_score = 1 if entry.get('player_id') is not None else 0
        match_count = self._recent_match_count(stats)
        return (image_score, profile_url_score, player_id_score, match_count)

    def _wta_rankings_csv_path(self):
        return self._wta_data_root() / 'wta_live_ranking.csv'

    def _atp_rankings_csv_path(self):
        return self._wta_data_root() / 'atp_live_ranking.csv'

    def _wta_rankings_outdated_dir(self):
        return self._wta_data_root() / 'wta_rankings_outdated'

    def _atp_rankings_outdated_dir(self):
        return self._wta_data_root() / 'atp_rankings_outdated'

    def _wta_connections_file_path(self):
        return self._wta_data_root() / 'wta_player_connections.json'

    def _atp_stats_dir(self):
        return self._wta_data_root() / 'atp_stats'

    def _atp_stats_csv_path(self):
        return self._atp_stats_dir() / 'atp_stats_leaderboard.csv'

    def _atp_stats_outdated_dir(self):
        return self._wta_data_root() / 'atp_stats_outdated'

    def _wta_stats_dir(self):
        return self._wta_data_root() / 'wta_stats'

    def _wta_stats_csv_path(self):
        return self._wta_stats_dir() / 'wta_stats_leaderboard.csv'

    def _wta_stats_outdated_dir(self):
        return self._wta_data_root() / 'wta_stats_outdated'

    def _tour_tournaments_dir(self, tour):
        tour_name = str(tour or '').strip().lower()
        if tour_name not in {'wta', 'atp'}:
            raise ValueError(f"Unsupported tour '{tour}'")
        return self._wta_data_root() / tour_name / 'tournaments'

    def _tour_tournaments_outdated_dir(self, tour):
        tour_name = str(tour or '').strip().lower()
        if tour_name not in {'wta', 'atp'}:
            raise ValueError(f"Unsupported tour '{tour}'")
        return self._wta_data_root() / f'{tour_name}_tournaments_outdated'

    def _to_iso_utc(self, ts):
        try:
            return datetime.utcfromtimestamp(float(ts)).isoformat() + 'Z'
        except Exception:
            return None

    def _stable_player_id_from_name(self, normalized_name, used_ids):
        norm = normalized_name or "unknown-player"
        base = 700000 + (zlib.crc32(norm.encode('utf-8')) % 100000)
        candidate = int(base)
        while candidate in used_ids:
            candidate += 1
        used_ids.add(candidate)
        return candidate

    def _persist_wta_player_connections(self, index):
        try:
            out_path = self._wta_connections_file_path()
            payload = {
                'updated_at': datetime.utcnow().isoformat() + 'Z',
                'players': []
            }
            for player in index.get('players', []):
                profile = player.get('profile') or {}
                folder = player.get('folder') or ''
                payload['players'].append({
                    'player_id': player.get('player_id'),
                    'name': player.get('name') or '',
                    'normalized_name': player.get('norm') or '',
                    'folder': folder,
                    'profile_path': f"{folder}/profile.json" if folder else '',
                    'stats_path': f"{folder}/stats_2026.json" if folder else '',
                    'image_url': profile.get('image_url') or '',
                    'profile_url': profile.get('url') or ''
                })
            payload['players'].sort(
                key=lambda p: (
                    p.get('player_id') if p.get('player_id') is not None else 10**9,
                    p.get('normalized_name') or ''
                )
            )
            out_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')
            by_norm = {}
            by_player_id = {}
            for row in payload['players']:
                norm = (row.get('normalized_name') or '').strip()
                pid = row.get('player_id')
                if norm and norm not in by_norm:
                    by_norm[norm] = row
                if pid is not None:
                    try:
                        by_player_id[int(pid)] = row
                    except Exception:
                        pass
            self._wta_connections_map = {
                'by_norm': by_norm,
                'by_player_id': by_player_id
            }
        except Exception:
            # Non-critical, app can work without this file.
            pass

    def _load_wta_connections_map(self):
        if self._wta_connections_map is not None:
            return self._wta_connections_map

        out = {'by_norm': {}, 'by_player_id': {}}
        path = self._wta_connections_file_path()
        if not path.exists():
            self._wta_connections_map = out
            return out
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
            for row in payload.get('players', []):
                norm = (row.get('normalized_name') or '').strip()
                pid = row.get('player_id')
                if norm and norm not in out['by_norm']:
                    out['by_norm'][norm] = row
                if pid is not None:
                    try:
                        out['by_player_id'][int(pid)] = row
                    except Exception:
                        pass
        except Exception:
            pass
        self._wta_connections_map = out
        return out

    def invalidate_wta_rankings_cache(self):
        self._wta_rankings_cache = None
        self._wta_rankings_index = None
        self._wta_scraped_index = None
        self._wta_connections_map = None
        for key in list(rankings_cache.keys()):
            if str(key).startswith('rankings_wta'):
                rankings_cache.pop(key, None)

    def invalidate_atp_rankings_cache(self):
        self._atp_rankings_cache = None
        self._atp_rankings_index = None
        self._atp_scraped_index = None
        for key in list(rankings_cache.keys()):
            if str(key).startswith('rankings_atp'):
                rankings_cache.pop(key, None)

    def get_wta_rankings_status(self):
        csv_path = self._wta_rankings_csv_path()
        exists = csv_path.exists()
        updated_at = None
        created_at = None
        size_bytes = 0
        if exists:
            stat = csv_path.stat()
            size_bytes = stat.st_size
            updated_at = self._to_iso_utc(stat.st_mtime)
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            created_at = self._to_iso_utc(birth_ts)
        outdated_dir = self._wta_rankings_outdated_dir()
        outdated_count = len(list(outdated_dir.glob('wta_live_ranking_*.csv'))) if outdated_dir.exists() else 0
        return {
            'exists': exists,
            'path': str(csv_path),
            'updated_at': updated_at,
            'created_at': created_at,
            'size_bytes': size_bytes,
            'outdated_count': outdated_count
        }

    def get_atp_rankings_status(self):
        csv_path = self._atp_rankings_csv_path()
        exists = csv_path.exists()
        updated_at = None
        created_at = None
        size_bytes = 0
        if exists:
            stat = csv_path.stat()
            size_bytes = stat.st_size
            updated_at = self._to_iso_utc(stat.st_mtime)
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            created_at = self._to_iso_utc(birth_ts)
        outdated_dir = self._atp_rankings_outdated_dir()
        outdated_count = len(list(outdated_dir.glob('atp_live_ranking_*.csv'))) if outdated_dir.exists() else 0
        return {
            'exists': exists,
            'path': str(csv_path),
            'updated_at': updated_at,
            'created_at': created_at,
            'size_bytes': size_bytes,
            'outdated_count': outdated_count
        }

    def refresh_wta_rankings_csv(self):
        csv_path = self._wta_rankings_csv_path()
        outdated_dir = self._wta_rankings_outdated_dir()
        outdated_dir.mkdir(parents=True, exist_ok=True)
        archived_path = None

        if csv_path.exists():
            stat = csv_path.stat()
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            timestamp = datetime.fromtimestamp(birth_ts).strftime('%Y%m%d_%H%M%S')
            base_name = f"wta_live_ranking_{timestamp}"
            archive_path = outdated_dir / f"{base_name}.csv"
            suffix = 1
            while archive_path.exists():
                archive_path = outdated_dir / f"{base_name}_{suffix}.csv"
                suffix += 1
            shutil.copy2(csv_path, archive_path)
            archived_path = str(archive_path)

        script_path = Path(__file__).resolve().parent.parent / 'scripts' / 'wta_live_rankings_to_csv.py'
        if not script_path.exists():
            raise RuntimeError(f"Script not found: {script_path}")

        result = subprocess.run(
            [sys.executable, str(script_path), "--out", str(csv_path)],
            capture_output=True,
            text=True,
            timeout=240
        )
        if result.returncode != 0:
            stderr = (result.stderr or '').strip()
            stdout = (result.stdout or '').strip()
            message = stderr or stdout or "Failed to refresh WTA rankings CSV."
            raise RuntimeError(message)

        self.invalidate_wta_rankings_cache()
        status = self.get_wta_rankings_status()
        status['archived_path'] = archived_path
        status['stdout'] = (result.stdout or '').strip()
        return status

    def refresh_atp_rankings_csv(self):
        csv_path = self._atp_rankings_csv_path()
        outdated_dir = self._atp_rankings_outdated_dir()
        outdated_dir.mkdir(parents=True, exist_ok=True)
        archived_path = None

        if csv_path.exists():
            stat = csv_path.stat()
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            timestamp = datetime.fromtimestamp(birth_ts).strftime('%Y%m%d_%H%M%S')
            base_name = f"atp_live_ranking_{timestamp}"
            archive_path = outdated_dir / f"{base_name}.csv"
            suffix = 1
            while archive_path.exists():
                archive_path = outdated_dir / f"{base_name}_{suffix}.csv"
                suffix += 1
            shutil.copy2(csv_path, archive_path)
            archived_path = str(archive_path)

        script_path = Path(__file__).resolve().parent.parent / 'scripts' / 'atp_live_rankings_to_csv.py'
        if not script_path.exists():
            raise RuntimeError(f"Script not found: {script_path}")

        result = subprocess.run(
            [sys.executable, str(script_path), "--out", str(csv_path)],
            capture_output=True,
            text=True,
            timeout=240
        )
        if result.returncode != 0:
            stderr = (result.stderr or '').strip()
            stdout = (result.stdout or '').strip()
            message = stderr or stdout or "Failed to refresh ATP rankings CSV."
            raise RuntimeError(message)

        self.invalidate_atp_rankings_cache()
        status = self.get_atp_rankings_status()
        status['archived_path'] = archived_path
        status['stdout'] = (result.stdout or '').strip()
        return status

    def invalidate_atp_stats_cache(self):
        self._atp_stats_cache = None

    def get_atp_stats_status(self):
        csv_path = self._atp_stats_csv_path()
        exists = csv_path.exists()
        updated_at = None
        created_at = None
        size_bytes = 0
        if exists:
            stat = csv_path.stat()
            size_bytes = stat.st_size
            updated_at = self._to_iso_utc(stat.st_mtime)
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            created_at = self._to_iso_utc(birth_ts)
        outdated_dir = self._atp_stats_outdated_dir()
        outdated_count = len(list(outdated_dir.glob('atp_stats_leaderboard_*.csv'))) if outdated_dir.exists() else 0
        return {
            'exists': exists,
            'path': str(csv_path),
            'updated_at': updated_at,
            'created_at': created_at,
            'size_bytes': size_bytes,
            'outdated_count': outdated_count
        }

    def refresh_atp_stats_csv(self):
        csv_path = self._atp_stats_csv_path()
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        outdated_dir = self._atp_stats_outdated_dir()
        outdated_dir.mkdir(parents=True, exist_ok=True)
        archived_path = None

        if csv_path.exists():
            stat = csv_path.stat()
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            timestamp = datetime.fromtimestamp(birth_ts).strftime('%Y%m%d_%H%M%S')
            base_name = f"atp_stats_leaderboard_{timestamp}"
            archive_path = outdated_dir / f"{base_name}.csv"
            suffix = 1
            while archive_path.exists():
                archive_path = outdated_dir / f"{base_name}_{suffix}.csv"
                suffix += 1
            shutil.copy2(csv_path, archive_path)
            archived_path = str(archive_path)

        scripts_dir = Path(__file__).resolve().parent.parent / 'scripts'
        script_candidates = [
            scripts_dir / 'atp_return_serve_stats_to_csv.py',
            scripts_dir / 'apt_return_serve_stats_to_csv.py',
            scripts_dir / 'atp_stats_to_csv.py',
            scripts_dir / 'apt_stats_to_csv.py',
        ]
        dynamic_patterns = [
            '*atp*return*serve*stats*to*csv*.py',
            '*apt*return*serve*stats*to*csv*.py',
            '*atp*stats*to*csv*.py',
            '*apt*stats*to*csv*.py',
        ]
        for pattern in dynamic_patterns:
            for path in sorted(scripts_dir.glob(pattern)):
                if path not in script_candidates:
                    script_candidates.append(path)

        script_path = next((p for p in script_candidates if p.exists()), None)
        if not script_path:
            raise RuntimeError(f"Script not found. Tried: {', '.join(str(p) for p in script_candidates)}")

        result = subprocess.run(
            [sys.executable, str(script_path), "--out", str(csv_path)],
            capture_output=True,
            text=True,
            timeout=240
        )
        if result.returncode != 0:
            stderr = (result.stderr or '').strip()
            stdout = (result.stdout or '').strip()
            message = stderr or stdout or "Failed to refresh ATP stats CSV."
            raise RuntimeError(message)

        self.invalidate_atp_stats_cache()
        status = self.get_atp_stats_status()
        status['archived_path'] = archived_path
        status['stdout'] = (result.stdout or '').strip()
        return status

    def fetch_atp_stats_leaderboard(self):
        if self._atp_stats_cache is not None:
            return self._atp_stats_cache

        csv_path = self._atp_stats_csv_path()
        if not csv_path.exists():
            payload = {
                'categories': {'serve': [], 'return': [], 'pressure': []},
                'top_players': {'serve': None, 'return': None, 'pressure': None},
                'formulas': {
                    'serve': 'Serve Rating = %1st Serve + %1st Serve Points Won + %2nd Serve Points Won + %Service Games Won + Avg Aces/Match - Avg Double Faults/Match',
                    'return': 'Return Rating = %1st Return Points Won + %2nd Return Points Won + %Break Points Converted + %Return Games Won',
                    'pressure': 'Under Pressure Rating = %Break Points Saved + %Break Points Converted + %Tie Breaks Won + %Deciding Sets Won'
                }
            }
            self._atp_stats_cache = payload
            return payload

        categories = {'serve': [], 'return': [], 'pressure': []}
        top_players = {'serve': None, 'return': None, 'pressure': None}
        fetched_at = None

        with csv_path.open('r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                category = (row.get('category_key') or '').strip().lower()
                if category not in categories:
                    continue

                metrics = []
                for i in range(1, 7):
                    name = (row.get(f'metric_{i}_name') or '').strip()
                    value = (row.get(f'metric_{i}_value') or '').strip()
                    if name:
                        metrics.append({'name': name, 'value': value})

                try:
                    rank = int((row.get('rank') or '').strip())
                except Exception:
                    continue

                try:
                    rating = float((row.get('rating') or '').strip())
                except Exception:
                    rating = None

                item = {
                    'rank': rank,
                    'player_name': (row.get('player_name') or '').strip(),
                    'player_id': (row.get('player_id') or '').strip(),
                    'profile_url': (row.get('profile_url') or '').strip(),
                    'image_url': (row.get('image_url') or '').strip(),
                    'rating': rating,
                    'metrics': metrics
                }
                categories[category].append(item)

                if top_players[category] is None or rank < int(top_players[category].get('rank', 10**9)):
                    top_players[category] = item

                if not fetched_at:
                    fetched_at = (row.get('fetched_at_utc') or '').strip() or None

        for key in categories:
            categories[key].sort(key=lambda x: x.get('rank', 10**9))

        payload = {
            'fetched_at': fetched_at,
            'categories': categories,
            'top_players': top_players,
            'formulas': {
                'serve': 'Serve Rating = %1st Serve + %1st Serve Points Won + %2nd Serve Points Won + %Service Games Won + Avg Aces/Match - Avg Double Faults/Match',
                'return': 'Return Rating = %1st Return Points Won + %2nd Return Points Won + %Break Points Converted + %Return Games Won',
                'pressure': 'Under Pressure Rating = %Break Points Saved + %Break Points Converted + %Tie Breaks Won + %Deciding Sets Won'
            }
        }
        self._atp_stats_cache = payload
        return payload

    def invalidate_wta_stats_cache(self):
        self._wta_stats_cache = None

    def invalidate_tournaments_cache(self, tour=None):
        tour_name = str(tour or '').strip().lower()
        if tour_name == 'wta':
            self._wta_tournament_index = None
        elif tour_name == 'atp':
            self._atp_tournament_index = None
        else:
            self._wta_tournament_index = None
            self._atp_tournament_index = None

        for key in list(tournaments_cache.keys()):
            key_text = str(key)
            if tour_name in {'wta', 'atp'}:
                if key_text.startswith(f'tournaments_{tour_name}_'):
                    tournaments_cache.pop(key, None)
            elif key_text.startswith('tournaments_'):
                tournaments_cache.pop(key, None)

    def get_tournaments_status(self, tour='wta'):
        output_dir = self._tour_tournaments_dir(tour)
        exists = output_dir.exists()
        json_files = sorted(output_dir.glob('*.json')) if exists else []
        latest_ts = 0.0
        for path in json_files:
            try:
                latest_ts = max(latest_ts, path.stat().st_mtime)
            except Exception:
                continue

        outdated_dir = self._tour_tournaments_outdated_dir(tour)
        outdated_count = 0
        if outdated_dir.exists():
            for entry in outdated_dir.iterdir():
                if entry.is_dir() or entry.suffix.lower() == '.json':
                    outdated_count += 1

        return {
            'tour': str(tour or '').strip().lower(),
            'exists': exists,
            'path': str(output_dir),
            'file_count': len(json_files),
            'updated_at': self._to_iso_utc(latest_ts) if latest_ts else None,
            'outdated_count': outdated_count
        }

    def refresh_tournaments_json(self, tour='wta', year=None, full_refresh=False):
        tour_name = str(tour or '').strip().lower()
        if tour_name not in {'wta', 'atp'}:
            raise RuntimeError("tour must be 'wta' or 'atp'")

        if year is None:
            year = datetime.now().year
        try:
            year = int(year)
        except Exception:
            year = datetime.now().year

        scripts_dir = Path(__file__).resolve().parent.parent / 'scripts'
        script_name = 'wta_tournaments_to_json.py' if tour_name == 'wta' else 'atp_tournaments_to_json.py'
        script_path = scripts_dir / script_name
        if not script_path.exists():
            raise RuntimeError(f"Script not found: {script_path}")

        output_dir = self._tour_tournaments_dir(tour_name)
        outdated_dir = self._tour_tournaments_outdated_dir(tour_name)
        output_dir.mkdir(parents=True, exist_ok=True)
        outdated_dir.mkdir(parents=True, exist_ok=True)

        cmd = [
            sys.executable,
            str(script_path),
            '--year',
            str(year),
            '--output-dir',
            str(output_dir),
            '--outdated-dir',
            str(outdated_dir),
        ]
        if full_refresh:
            cmd.append('--full-refresh')

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=1200
        )
        if result.returncode != 0:
            stderr = (result.stderr or '').strip()
            stdout = (result.stdout or '').strip()
            message = stderr or stdout or f"Failed to refresh {tour_name.upper()} tournaments."
            raise RuntimeError(message)

        self.invalidate_tournaments_cache(tour_name)
        status = self.get_tournaments_status(tour_name)
        status['year'] = year
        status['stdout'] = (result.stdout or '').strip()
        return status

    def get_wta_stats_status(self):
        csv_path = self._wta_stats_csv_path()
        exists = csv_path.exists()
        updated_at = None
        created_at = None
        size_bytes = 0
        if exists:
            stat = csv_path.stat()
            size_bytes = stat.st_size
            updated_at = self._to_iso_utc(stat.st_mtime)
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            created_at = self._to_iso_utc(birth_ts)
        outdated_dir = self._wta_stats_outdated_dir()
        outdated_count = len(list(outdated_dir.glob('wta_stats_leaderboard_*.csv'))) if outdated_dir.exists() else 0
        return {
            'exists': exists,
            'path': str(csv_path),
            'updated_at': updated_at,
            'created_at': created_at,
            'size_bytes': size_bytes,
            'outdated_count': outdated_count
        }

    def refresh_wta_stats_csv(self):
        csv_path = self._wta_stats_csv_path()
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        outdated_dir = self._wta_stats_outdated_dir()
        outdated_dir.mkdir(parents=True, exist_ok=True)
        archived_path = None

        if csv_path.exists():
            stat = csv_path.stat()
            birth_ts = getattr(stat, 'st_birthtime', None) or stat.st_ctime
            timestamp = datetime.fromtimestamp(birth_ts).strftime('%Y%m%d_%H%M%S')
            base_name = f"wta_stats_leaderboard_{timestamp}"
            archive_path = outdated_dir / f"{base_name}.csv"
            suffix = 1
            while archive_path.exists():
                archive_path = outdated_dir / f"{base_name}_{suffix}.csv"
                suffix += 1
            shutil.copy2(csv_path, archive_path)
            archived_path = str(archive_path)

        scripts_dir = Path(__file__).resolve().parent.parent / 'scripts'
        script_candidates = [
            scripts_dir / 'wta_return_serve_stats_to_csv.py',
            scripts_dir / 'wta_stats_to_csv.py',
        ]
        dynamic_patterns = [
            '*wta*return*serve*stats*to*csv*.py',
            '*wta*stats*to*csv*.py',
        ]
        for pattern in dynamic_patterns:
            for path in sorted(scripts_dir.glob(pattern)):
                if path not in script_candidates:
                    script_candidates.append(path)

        script_path = next((p for p in script_candidates if p.exists()), None)
        if not script_path:
            raise RuntimeError(f"Script not found. Tried: {', '.join(str(p) for p in script_candidates)}")

        result = subprocess.run(
            [sys.executable, str(script_path), "--out", str(csv_path)],
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode != 0:
            stderr = (result.stderr or '').strip()
            stdout = (result.stdout or '').strip()
            message = stderr or stdout or "Failed to refresh WTA stats CSV."
            raise RuntimeError(message)

        self.invalidate_wta_stats_cache()
        status = self.get_wta_stats_status()
        status['archived_path'] = archived_path
        status['stdout'] = (result.stdout or '').strip()
        return status

    def fetch_wta_stats_leaderboard(self):
        if self._wta_stats_cache is not None:
            return self._wta_stats_cache

        csv_path = self._wta_stats_csv_path()
        if not csv_path.exists():
            payload = {
                'categories': {'serve': [], 'return': []},
                'top_players': {'serve': None, 'return': None},
                'formulas': {
                    'serve': '🟣 Serve Rating = Σ(norm(metric) × weight) across serve metrics',
                    'return': '🟢 Return Rating = Σ(norm(metric) × weight) across return metrics'
                }
            }
            self._wta_stats_cache = payload
            return payload

        categories = {'serve': [], 'return': []}
        top_players = {'serve': None, 'return': None}
        fetched_at = None

        with csv_path.open('r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                category = (row.get('category_key') or '').strip().lower()
                if category not in categories:
                    continue

                metrics = []
                for i in range(1, 7):
                    name = (row.get(f'metric_{i}_name') or '').strip()
                    value = (row.get(f'metric_{i}_value') or '').strip()
                    if name:
                        metrics.append({'name': name, 'value': value})

                try:
                    rank = int((row.get('rank') or '').strip())
                except Exception:
                    continue

                try:
                    rating = float((row.get('rating') or '').strip())
                except Exception:
                    rating = None

                details = {}
                metrics_json_raw = (row.get('metrics_json') or '').strip()
                if metrics_json_raw:
                    try:
                        details = json.loads(metrics_json_raw)
                    except Exception:
                        details = {}

                item = {
                    'rank': rank,
                    'player_name': (row.get('player_name') or '').strip(),
                    'player_id': (row.get('player_id') or '').strip(),
                    'profile_url': (row.get('profile_url') or '').strip(),
                    'image_url': (row.get('image_url') or '').strip(),
                    'rating': rating,
                    'metrics': metrics,
                    'details': details
                }
                categories[category].append(item)

                if top_players[category] is None or rank < int(top_players[category].get('rank', 10**9)):
                    top_players[category] = item

                if not fetched_at:
                    fetched_at = (row.get('fetched_at_utc') or '').strip() or None

        for key in categories:
            categories[key].sort(key=lambda x: x.get('rank', 10**9))

        payload = {
            'fetched_at': fetched_at,
            'categories': categories,
            'top_players': top_players,
            'formulas': {
                'serve': '🟣 Serve Rating = Σ(norm(metric) × weight), lower-is-better metrics are inverted',
                'return': '🟢 Return Rating = Σ(norm(metric) × weight), each norm(metric) scaled to [0,100]'
            }
        }
        self._wta_stats_cache = payload
        return payload

    def _load_wta_scraped_index(self):
        if self._wta_scraped_index is not None:
            return self._wta_scraped_index

        base_dir = Path(__file__).resolve().parent.parent / 'data' / 'wta'
        index = {
            'by_full': {},
            'by_last_first': {},
            'by_last': {},
            'by_player_id': {},
            'players': []
        }
        if not base_dir.exists():
            self._wta_scraped_index = index
            return index

        for folder in sorted(base_dir.iterdir()):
            if not folder.is_dir():
                continue
            profile_path = folder / 'profile.json'
            if not profile_path.exists():
                continue
            try:
                profile = json.loads(profile_path.read_text(encoding='utf-8'))
            except Exception:
                continue
            stats_path = folder / 'stats_2026.json'
            stats = {}
            if stats_path.exists():
                try:
                    stats = json.loads(stats_path.read_text(encoding='utf-8'))
                except Exception:
                    stats = {}

            name = (profile.get('name') or '').strip()
            if not name:
                continue
            norm = self._normalize_player_name(name)
            tokens = norm.split()
            first = tokens[0] if tokens else ""
            last = tokens[-1] if tokens else ""
            entry = {
                'name': name,
                'norm': norm,
                'first': first,
                'last': last,
                'player_id': self._extract_wta_player_id_from_url(profile.get('url')),
                'profile': profile,
                'stats': stats,
                'folder': str(folder)
            }
            index['players'].append(entry)
            if norm:
                existing = index['by_full'].get(norm)
                if existing is None or self._entry_quality_score(entry) > self._entry_quality_score(existing):
                    index['by_full'][norm] = entry
            if first and last:
                key = f"{last}_{first[0]}"
                existing = index['by_last_first'].get(key)
                if existing is None or self._entry_quality_score(entry) > self._entry_quality_score(existing):
                    index['by_last_first'][key] = entry
            if last:
                index['by_last'].setdefault(last, []).append(entry)
            if entry.get('player_id') is not None:
                pid = int(entry['player_id'])
                existing = index['by_player_id'].get(pid)
                if existing is None or self._entry_quality_score(entry) > self._entry_quality_score(existing):
                    index['by_player_id'][pid] = entry

        self._persist_wta_player_connections(index)
        self._wta_scraped_index = index
        return index

    def _match_wta_scraped(self, name):
        index = self._load_wta_scraped_index()
        if not name:
            return None
        norm = self._normalize_player_name(name)
        if norm in index['by_full']:
            return index['by_full'][norm]

        tokens = norm.split()
        if tokens:
            last = tokens[-1]
            first = tokens[0]
            key = f"{last}_{first[0]}"
            if key in index['by_last_first']:
                return index['by_last_first'][key]

        choices = list(index['by_full'].keys())
        if choices:
            match = difflib.get_close_matches(norm, choices, n=1, cutoff=0.82)
            if match:
                return index['by_full'][match[0]]
        return None

    def _load_atp_scraped_index(self):
        if self._atp_scraped_index is not None:
            return self._atp_scraped_index

        base_dir = Path(__file__).resolve().parent.parent / 'data' / 'atp'
        index = {
            'by_full': {},
            'by_last_first': {},
            'by_last': {},
            'players': []
        }
        if not base_dir.exists():
            self._atp_scraped_index = index
            return index

        for folder in sorted(base_dir.iterdir()):
            if not folder.is_dir():
                continue
            profile_path = folder / 'profile.json'
            if not profile_path.exists():
                continue
            try:
                profile = json.loads(profile_path.read_text(encoding='utf-8'))
            except Exception:
                continue
            stats_path = folder / 'stats_2026.json'
            stats = {}
            if stats_path.exists():
                try:
                    stats = json.loads(stats_path.read_text(encoding='utf-8'))
                except Exception:
                    stats = {}
            
            gs_path = folder / 'grandslam_performance.json'
            gs_performance = {}
            if gs_path.exists():
                try:
                    gs_performance = json.loads(gs_path.read_text(encoding='utf-8'))
                except Exception:
                    gs_performance = {}

            name = (profile.get('name') or '').strip()
            if not name:
                continue
            norm = self._normalize_player_name(name)
            tokens = norm.split()
            first = tokens[0] if tokens else ""
            last = tokens[-1] if tokens else ""
            entry = {
                'name': name,
                'norm': norm,
                'first': first,
                'last': last,
                'profile': profile,
                'stats': stats,
                'grandslam_performance': gs_performance,
                'folder': str(folder),
                'player_code': (profile.get('player_id') or '').strip(),
                'profile_url': (profile.get('url') or '').strip()
            }
            index['players'].append(entry)
            if norm:
                existing = index['by_full'].get(norm)
                if existing is None or self._entry_quality_score(entry) > self._entry_quality_score(existing):
                    index['by_full'][norm] = entry
            if first and last:
                key = f"{last}_{first[0]}"
                existing = index['by_last_first'].get(key)
                if existing is None or self._entry_quality_score(entry) > self._entry_quality_score(existing):
                    index['by_last_first'][key] = entry
            if last:
                index['by_last'].setdefault(last, []).append(entry)

        self._atp_scraped_index = index
        return index

    def _match_atp_scraped(self, name):
        index = self._load_atp_scraped_index()
        if not name:
            return None
        norm = self._normalize_player_name(name)
        if norm in index['by_full']:
            return index['by_full'][norm]

        tokens = norm.split()
        if tokens:
            last = tokens[-1]
            first = tokens[0]
            key = f"{last}_{first[0]}"
            if key in index['by_last_first']:
                return index['by_last_first'][key]

        choices = list(index['by_full'].keys())
        if choices:
            match = difflib.get_close_matches(norm, choices, n=1, cutoff=0.82)
            if match:
                return index['by_full'][match[0]]
        return None
    
    def get_tournament_category(self, tournament_name):
        """Determine tournament category based on name"""
        name_lower = tournament_name.lower()
        
        # Check Grand Slams
        for gs in Config.GRAND_SLAMS:
            if gs.lower() in name_lower:
                return 'grand_slam'
        
        # Check Masters 1000
        for m1000 in Config.MASTERS_1000:
            if m1000.lower() in name_lower:
                return 'masters_1000'
        
        # Check for category in name
        if '1000' in name_lower:
            return 'masters_1000'
        if '500' in name_lower:
            return 'atp_500'
        if '250' in name_lower:
            return 'atp_250'
        if '125' in name_lower:
            return 'atp_125'
        
        return 'other'

    def _get_wta_rankings(self):
        if self._wta_rankings_cache is None:
            self._wta_rankings_cache = self._load_wta_rankings_csv() or []
        return self._wta_rankings_cache

    def _get_wta_rankings_index(self):
        if self._wta_rankings_index is not None:
            return self._wta_rankings_index
        index = {}
        for player in self._get_wta_rankings():
            norm = self._normalize_player_name(player.get('name') or '')
            if norm and norm not in index:
                index[norm] = player
        self._wta_rankings_index = index
        return index

    def _match_wta_ranking(self, name):
        if not name:
            return None
        norm = self._normalize_player_name(name)
        index = self._get_wta_rankings_index()
        if norm in index:
            return index[norm]
        choices = list(index.keys())
        if choices:
            match = difflib.get_close_matches(norm, choices, n=1, cutoff=0.82)
            if match:
                return index[match[0]]
        return None

    def _match_wta_ranking_strict(self, name='', player_id=None):
        pid = self._to_int(player_id)
        if pid is not None:
            for player in self._get_wta_rankings():
                if self._to_int(player.get('id')) == pid:
                    return player
        norm = self._normalize_player_name(name or '')
        if not norm:
            return None
        return self._get_wta_rankings_index().get(norm)

    def _get_atp_rankings(self):
        if self._atp_rankings_cache is None:
            self._atp_rankings_cache = self._load_atp_rankings_csv() or []
        return self._atp_rankings_cache

    def _get_atp_rankings_index(self):
        if self._atp_rankings_index is not None:
            return self._atp_rankings_index
        by_norm = {}
        by_code = {}
        by_last_first = {}
        for player in self._get_atp_rankings():
            norm = self._normalize_player_name(player.get('name') or '')
            if norm and norm not in by_norm:
                by_norm[norm] = player
            parts = norm.split()
            if len(parts) >= 2 and parts[0] and parts[-1]:
                key = f"{parts[-1]}_{parts[0][0]}"
                if key not in by_last_first:
                    by_last_first[key] = player
            code = str(player.get('player_code') or '').strip().upper()
            if code and code not in by_code:
                by_code[code] = player
        self._atp_rankings_index = {
            'by_norm': by_norm,
            'by_code': by_code,
            'by_last_first': by_last_first
        }
        return self._atp_rankings_index

    def _match_atp_ranking(self, name='', player_code=''):
        index = self._get_atp_rankings_index()
        code = str(player_code or '').strip().upper()
        if code and code in index.get('by_code', {}):
            return index['by_code'][code]

        norm = self._normalize_player_name(name or '')
        by_norm = index.get('by_norm', {})
        if norm in by_norm:
            return by_norm[norm]
        tokens = norm.split()
        if tokens:
            last = tokens[-1]
            first = tokens[0]
            key = f"{last}_{first[0]}" if first else ''
            if key and key in index.get('by_last_first', {}):
                return index['by_last_first'][key]

        choices = list(by_norm.keys())
        if choices and norm:
            match = difflib.get_close_matches(norm, choices, n=1, cutoff=0.82)
            if match:
                return by_norm[match[0]]
        return None

    def _match_wta_scraped_strict(self, name='', player_id=None):
        index = self._load_wta_scraped_index()
        pid = self._to_int(player_id)
        if pid is not None and pid in index.get('by_player_id', {}):
            return index['by_player_id'][pid]
        norm = self._normalize_player_name(name or '')
        if not norm:
            return None
        return index.get('by_full', {}).get(norm)

    def _to_float(self, value):
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _format_metric_value(self, value, is_percent=False):
        numeric = self._to_float(value)
        if numeric is None:
            return '-'
        if is_percent:
            return f"{numeric:.1f}%"
        if abs(numeric - round(numeric)) < 1e-9:
            return str(int(round(numeric)))
        return f"{numeric:.1f}"

    def _normalize_metric_value(self, value, min_value, max_value, lower_is_better=False):
        val = self._to_float(value)
        low = self._to_float(min_value)
        high = self._to_float(max_value)
        if val is None or low is None or high is None or high <= low:
            return 0.0
        scaled = (val - low) / (high - low) * 100.0
        if lower_is_better:
            scaled = 100.0 - scaled
        return max(0.0, min(100.0, scaled))

    def _wta_api_get_json(self, url, params=None, include_account_header=False):
        headers = {
            'User-Agent': self.session.headers.get('User-Agent', 'Mozilla/5.0'),
            'Referer': 'https://www.wtatennis.com/'
        }
        if include_account_header:
            headers['account'] = 'wta'
        response = self.session.get(url, params=params or {}, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()

    def _rjina_url(self, url):
        plain = str(url or '').strip()
        plain = re.sub(r'^https?://', '', plain, flags=re.IGNORECASE)
        return f"{RJINA_HTTP_PREFIX}{plain}"

    def _fetch_rjina_markdown(self, url, timeout=30):
        response = self.session.get(self._rjina_url(url), timeout=timeout)
        response.raise_for_status()
        return response.text or ''

    def _build_atp_h2h_url(self, player1_code, player2_code):
        p1 = str(player1_code or '').strip().lower()
        p2 = str(player2_code or '').strip().lower()
        return f"{ATP_H2H_BASE}/player-a-vs-player-b/{p1}/{p2}"

    def _resolve_atp_player_code(self, value='', fallback_name=''):
        raw = str(value or '').strip()
        if raw and re.match(r'^[A-Za-z0-9]{3,8}$', raw) and not raw.isdigit():
            return raw.upper()

        numeric = self._to_int(raw)
        if numeric is not None:
            for player in self._get_atp_rankings():
                if self._to_int(player.get('id')) == numeric:
                    code = str(player.get('player_code') or '').strip().upper()
                    if code:
                        return code

        candidate_name = fallback_name or raw
        ranking = self._match_atp_ranking(name=candidate_name)
        code = str((ranking or {}).get('player_code') or '').strip().upper()
        if code:
            return code

        scraped = self._match_atp_scraped(candidate_name)
        profile = (scraped or {}).get('profile') or {}
        code = str(profile.get('player_id') or (scraped or {}).get('player_code') or '').strip().upper()
        return code

    def _extract_atp_h2h_wins(self, markdown):
        if not markdown:
            return None

        lines = [line.strip() for line in str(markdown).splitlines()]

        def find_int(start, step):
            i = start
            for _ in range(12):
                if i < 0 or i >= len(lines):
                    break
                token = lines[i]
                if re.fullmatch(r'\d+', token or ''):
                    return int(token)
                i += step
            return None

        for idx, line in enumerate(lines):
            if line.lower() != 'vs':
                continue
            left = find_int(idx - 1, -1)
            wins_idx = None
            for j in range(idx + 1, min(idx + 8, len(lines))):
                if lines[j].lower() == 'wins':
                    wins_idx = j
                    break
            if wins_idx is None:
                continue
            right = find_int(wins_idx + 1, 1)
            if left is not None and right is not None:
                return {'first_wins': left, 'second_wins': right}

        pattern = re.search(
            r'\n\s*(\d+)\s*\n\s*Vs\s*\n\s*wins\s*\n\s*(\d+)\s*\n',
            markdown,
            flags=re.IGNORECASE
        )
        if pattern:
            return {'first_wins': int(pattern.group(1)), 'second_wins': int(pattern.group(2))}
        return None

    def _format_atp_h2h_score_text(self, raw_score):
        text = re.sub(r'\s+', ' ', str(raw_score or '')).strip()
        if not text:
            return ''
        tokens = text.split(' ')
        out = []
        for token in tokens:
            m = re.match(r'^(\d)-?(\d)(\(\d+\))?$', token)
            if m:
                out.append(f"{m.group(1)}-{m.group(2)}{m.group(3) or ''}")
            else:
                out.append(token)
        return ' '.join(out)

    def _extract_atp_h2h_career_summary(self, markdown):
        summary = {
            'player1': {
                'singles_titles': None,
                'doubles_titles': None,
                'prize_money': None,
                'singles_wins': None,
                'singles_losses': None,
                'doubles_wins': None,
                'doubles_losses': None
            },
            'player2': {
                'singles_titles': None,
                'doubles_titles': None,
                'prize_money': None,
                'singles_wins': None,
                'singles_losses': None,
                'doubles_wins': None,
                'doubles_losses': None
            }
        }
        if not markdown:
            return summary

        for line in str(markdown).splitlines():
            if 'Career W/L' in line:
                pairs = re.findall(r'(\d+)\s*/\s*(\d+)', line)
                if len(pairs) >= 2:
                    summary['player1']['singles_wins'] = int(pairs[0][0])
                    summary['player1']['singles_losses'] = int(pairs[0][1])
                    summary['player2']['singles_wins'] = int(pairs[1][0])
                    summary['player2']['singles_losses'] = int(pairs[1][1])
            elif 'Career titles' in line:
                nums = [self._to_int(v) for v in re.findall(r'\d+', line)]
                nums = [v for v in nums if v is not None]
                if len(nums) >= 2:
                    summary['player1']['singles_titles'] = nums[0]
                    summary['player2']['singles_titles'] = nums[1]
            elif 'Career prize money' in line:
                monies = re.findall(r'\$[\d,]+', line)
                if len(monies) >= 1:
                    summary['player1']['prize_money'] = monies[0]
                if len(monies) >= 2:
                    summary['player2']['prize_money'] = monies[1]

        return summary

    def _build_atp_h2h_player_payload(self, player_code, full_name=''):
        code = str(player_code or '').strip().upper()
        ranking = self._match_atp_ranking(name=full_name, player_code=code)
        scraped = self._match_atp_scraped((ranking or {}).get('name') or full_name)
        profile = (scraped or {}).get('profile') or {}
        country = (ranking or {}).get('country') or profile.get('country') or ''
        return {
            'id': (ranking or {}).get('id'),
            'player_code': code,
            'name': (ranking or {}).get('name') or profile.get('name') or full_name or code,
            'country': country,
            'rank': (ranking or {}).get('rank'),
            'image_url': (ranking or {}).get('image_url') or profile.get('image_url') or ''
        }

    def _parse_atp_h2h_meetings(self, markdown, player1, player2, meetings_limit=5):
        meetings = []
        if not markdown:
            return meetings

        p1_code = str((player1 or {}).get('player_code') or '').strip().upper()
        p2_code = str((player2 or {}).get('player_code') or '').strip().upper()
        p1_name_norm = self._normalize_player_name((player1 or {}).get('name') or '')
        p2_name_norm = self._normalize_player_name((player2 or {}).get('name') or '')

        for raw_line in str(markdown).splitlines():
            line = raw_line.strip()
            if not line.startswith('|'):
                continue
            cols = [c.strip() for c in line.strip('|').split('|')]
            if len(cols) < 7:
                continue
            if cols[0].lower() == 'year' or cols[0].startswith('---'):
                continue
            if not re.fullmatch(r'\d{4}', cols[0]):
                continue

            year = cols[0]
            winner_cell = cols[1]
            event_cell = cols[2]
            round_text = cols[3]
            surface_text = cols[4]
            score_cell = cols[5]

            winner_name = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', winner_cell).strip()
            winner_name = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', winner_name).strip()
            winner_code_match = re.search(
                r'/players/[^/]+/([a-z0-9]{3,8})/overview',
                winner_cell,
                flags=re.IGNORECASE
            )
            winner_code = (winner_code_match.group(1).upper() if winner_code_match else '')
            if not winner_code:
                winner_norm = self._normalize_player_name(winner_name)
                if winner_norm and winner_norm == p1_name_norm:
                    winner_code = p1_code
                elif winner_norm and winner_norm == p2_name_norm:
                    winner_code = p2_code

            event_name = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', event_cell).strip() or event_cell
            score_raw_match = re.search(r'\[([^\]]+)\]\(([^)]+)\)', score_cell)
            score_raw = score_raw_match.group(1).strip() if score_raw_match else score_cell.strip()
            score_text = self._format_atp_h2h_score_text(score_raw)
            set_scores = self._parse_h2h_set_scores(score_text, reverse_order=False)

            winner_id = None
            if winner_code and winner_code == p1_code:
                winner_id = (player1 or {}).get('id')
            elif winner_code and winner_code == p2_code:
                winner_id = (player2 or {}).get('id')
                set_scores = self._flip_h2h_set_scores(set_scores)

            category = self._wta_level_to_category('', event_name)
            meetings.append({
                'date': year,
                'tournament': event_name,
                'category': category,
                'category_label': self._category_label_for_tour(category, tour='atp'),
                'surface': surface_text or '',
                'round': round_text or '',
                'winner_id': winner_id,
                'winner_code': winner_code,
                'winner_name': winner_name,
                'score': score_text or score_raw,
                'set_scores': set_scores
            })

        meetings.sort(
            key=lambda m: self._to_int(str(m.get('date') or '').split('-')[0]) or 0,
            reverse=True
        )
        return meetings[:max(1, min(int(meetings_limit or 5), 10))]

    def _get_atp_h2h_pair_summary(self, player_a_code, player_b_code):
        a_code = self._resolve_atp_player_code(player_a_code)
        b_code = self._resolve_atp_player_code(player_b_code)
        if not a_code or not b_code or a_code == b_code:
            return None

        key = tuple(sorted((a_code, b_code)))
        if key in atp_h2h_summary_cache:
            return atp_h2h_summary_cache[key]

        first_code, second_code = key
        result = None
        try:
            url = self._build_atp_h2h_url(first_code, second_code)
            markdown = self._fetch_rjina_markdown(url, timeout=35)
            wins = self._extract_atp_h2h_wins(markdown) or {}
            first_wins = self._to_int(wins.get('first_wins'))
            second_wins = self._to_int(wins.get('second_wins'))
            if first_wins is not None and second_wins is not None:
                result = {
                    'first_code': first_code,
                    'second_code': second_code,
                    'first_wins': first_wins,
                    'second_wins': second_wins
                }
        except Exception:
            result = None

        atp_h2h_summary_cache[key] = result
        return result

    def _format_atp_h2h_text_for_match_order(self, p1_code, p2_code, p1_name='', p2_name=''):
        c1 = self._resolve_atp_player_code(p1_code, fallback_name=p1_name)
        c2 = self._resolve_atp_player_code(p2_code, fallback_name=p2_name)
        if not c1 or not c2 or c1 == c2:
            return 'N/A'

        summary = self._get_atp_h2h_pair_summary(c1, c2)
        if not summary:
            return 'N/A'

        if c1 == summary['first_code'] and c2 == summary['second_code']:
            return f"{summary['first_wins']}-{summary['second_wins']}"
        if c1 == summary['second_code'] and c2 == summary['first_code']:
            return f"{summary['second_wins']}-{summary['first_wins']}"
        return 'N/A'

    def _to_int(self, value):
        try:
            return int(value)
        except Exception:
            return None

    def _get_wta_h2h_pair_summary(self, player_a_id, player_b_id):
        a_id = self._to_int(player_a_id)
        b_id = self._to_int(player_b_id)
        if not a_id or not b_id or a_id == b_id:
            return None

        key = tuple(sorted((a_id, b_id)))
        if key in h2h_summary_cache:
            return h2h_summary_cache[key]

        first_id, second_id = key
        try:
            payload = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/players/{first_id}/headtohead/{second_id}",
                params={'sort': 'desc'},
                include_account_header=True
            )
            summary = ((payload.get('headToHeadSummary') or [{}])[0]) or {}
            first_wins = self._to_int(summary.get('wins')) or 0
            second_wins = self._to_int(summary.get('losses')) or 0
            result = {
                'first_id': first_id,
                'second_id': second_id,
                'first_wins': first_wins,
                'second_wins': second_wins
            }
        except Exception:
            result = None

        h2h_summary_cache[key] = result
        return result

    def _format_h2h_text_for_match_order(self, p1_id, p2_id):
        p1 = self._to_int(p1_id)
        p2 = self._to_int(p2_id)
        if not p1 or not p2 or p1 == p2:
            return 'N/A'

        summary = self._get_wta_h2h_pair_summary(p1, p2)
        if not summary:
            return 'N/A'

        if p1 == summary['first_id'] and p2 == summary['second_id']:
            return f"{summary['first_wins']}-{summary['second_wins']}"
        if p1 == summary['second_id'] and p2 == summary['first_id']:
            return f"{summary['second_wins']}-{summary['first_wins']}"
        return 'N/A'

    def _attach_upcoming_h2h(self, matches):
        enriched = []
        for match in matches or []:
            if not isinstance(match, dict):
                continue
            out = dict(match)
            player1 = out.get('player1') or {}
            player2 = out.get('player2') or {}
            tour_name = (out.get('tour') or '').upper()
            if tour_name == 'WTA':
                out['h2h_text'] = self._format_h2h_text_for_match_order(
                    player1.get('id'),
                    player2.get('id')
                )
            elif tour_name == 'ATP':
                out['h2h_text'] = self._format_atp_h2h_text_for_match_order(
                    player1.get('player_code') or player1.get('id'),
                    player2.get('player_code') or player2.get('id'),
                    player1.get('name') or '',
                    player2.get('name') or ''
                )
            else:
                out['h2h_text'] = 'N/A'
            enriched.append(out)
        return enriched

    def _extract_wta_player_id_from_url(self, url):
        if not url:
            return None
        match = re.search(r"/players/(\d+)", str(url))
        if not match:
            return None
        try:
            return int(match.group(1))
        except Exception:
            return None

    def _name_match_score(self, query_norm, candidate_norm):
        if not query_norm or not candidate_norm:
            return 0.0
        score = 0.0

        if candidate_norm == query_norm:
            score += 100.0
        if candidate_norm.startswith(query_norm):
            score += 35.0
        if query_norm in candidate_norm:
            score += 22.0

        query_tokens = query_norm.split()
        candidate_tokens = candidate_norm.split()
        token_hits = 0
        for token in query_tokens:
            if any(ct.startswith(token) for ct in candidate_tokens):
                token_hits += 1

        if query_tokens:
            score += token_hits * 12.0
            if token_hits == len(query_tokens):
                score += 10.0
            if len(query_tokens) == 1 and candidate_tokens and candidate_tokens[-1].startswith(query_tokens[0]):
                score += 12.0

        score += difflib.SequenceMatcher(None, query_norm, candidate_norm).ratio() * 10.0
        return score

    def _wta_level_to_category(self, tournament_level='', tournament_name=''):
        raw_level = str(tournament_level or '').upper()
        raw_name = str(tournament_name or '').upper()
        if 'GRAND' in raw_level or raw_level in ('GS',) or any(gs.upper() in raw_name for gs in Config.GRAND_SLAMS):
            return 'grand_slam'
        if any(token in raw_level for token in ('1000', 'PM', 'P1')):
            return 'masters_1000'
        if any(token in raw_level for token in ('500', 'P5')):
            return 'atp_500'
        if any(token in raw_level for token in ('250', 'P2')):
            return 'atp_250'
        if any(token in raw_level for token in ('125', 'P3')):
            return 'atp_125'
        if 'FINAL' in raw_level:
            return 'finals'
        category = self.get_tournament_category(tournament_name or '')
        return category if category != 'other' else 'other'

    def _category_label(self, category):
        return self._category_label_for_tour(category, tour='wta')

    def _category_label_for_tour(self, category, tour='wta'):
        tour_name = str(tour or '').strip().lower()
        masters_label = 'ATP 1000' if tour_name == 'atp' else 'WTA 1000'
        atp500_label = 'ATP 500' if tour_name == 'atp' else 'WTA 500'
        atp250_label = 'ATP 250' if tour_name == 'atp' else 'WTA 250'
        atp125_label = 'ATP 125' if tour_name == 'atp' else 'WTA 125'
        finals_label = 'ATP Finals' if tour_name == 'atp' else 'WTA Finals'
        labels = {
            'grand_slam': 'Grand Slam',
            'masters_1000': masters_label,
            'atp_500': atp500_label,
            'atp_250': atp250_label,
            'atp_125': atp125_label,
            'finals': finals_label,
            'other': 'Tour'
        }
        return labels.get(category, 'Tour')

    def _build_h2h_player_payload(self, player_id, full_name, country_code=''):
        ranking = self._match_wta_ranking_strict(full_name or '', player_id=player_id)
        scraped = self._match_wta_scraped_strict(full_name or '', player_id=player_id)
        profile = scraped.get('profile') if scraped else {}
        image_url = (ranking or {}).get('image_url') or profile.get('image_url') or ''
        country = country_code or (ranking or {}).get('country') or profile.get('country') or ''
        return {
            'id': int(player_id) if str(player_id).isdigit() else player_id,
            'name': full_name or '',
            'country': country,
            'rank': (ranking or {}).get('rank'),
            'image_url': image_url
        }

    def _build_wta_metric_rows(self, player_stats_payload, opponent_stats_payload, metric_specs):
        player_stats = (player_stats_payload or {}).get('stats') or {}
        opponent_stats = (opponent_stats_payload or {}).get('stats') or {}
        aggregate = player_stats.get('AggregateData') or opponent_stats.get('AggregateData') or {}

        rows = []
        for spec in metric_specs:
            player_raw = self._to_float(player_stats.get(spec['value_path']))
            opponent_raw = self._to_float(opponent_stats.get(spec['value_path']))
            avg_raw = self._to_float(aggregate.get(spec['avg_path']))
            min_raw = self._to_float(aggregate.get(spec['min_path']))
            max_raw = self._to_float(aggregate.get(spec['max_path']))

            row = {
                'key': spec['key'],
                'label': spec['label'],
                'is_percent': bool(spec.get('is_percent')),
                'lower_is_better': bool(spec.get('lower_is_better')),
                'player1_raw': player_raw,
                'player2_raw': opponent_raw,
                'tour_avg_raw': avg_raw,
                'min_raw': min_raw,
                'max_raw': max_raw,
                'player1_display': self._format_metric_value(player_raw, bool(spec.get('is_percent'))),
                'player2_display': self._format_metric_value(opponent_raw, bool(spec.get('is_percent'))),
                'tour_avg_display': self._format_metric_value(avg_raw, bool(spec.get('is_percent'))),
                'player1_norm': self._normalize_metric_value(
                    player_raw,
                    min_raw,
                    max_raw,
                    bool(spec.get('lower_is_better'))
                ),
                'player2_norm': self._normalize_metric_value(
                    opponent_raw,
                    min_raw,
                    max_raw,
                    bool(spec.get('lower_is_better'))
                ),
                'tour_avg_norm': self._normalize_metric_value(
                    avg_raw,
                    min_raw,
                    max_raw,
                    bool(spec.get('lower_is_better'))
                )
            }
            rows.append(row)
        return rows

    def _extract_wta_surface_records(self, records_payload):
        out = {}
        by_surface = (records_payload or {}).get('bySurface') or []
        for entry in by_surface:
            surface = str(entry.get('surface') or '').upper()
            stats = entry.get('statistics') or {}
            out[surface] = {
                'wins': stats.get('wins'),
                'losses': stats.get('losses'),
                'winPercentage': self._to_float(stats.get('winPercentage'))
            }
        return out

    def _extract_wta_career_summary(self, bio_rows, player_id):
        if not isinstance(bio_rows, list):
            return {}
        target = str(player_id)
        selected = None
        for row in bio_rows:
            row_pid = row.get('playerid')
            if str(row_pid) == target:
                selected = row
                break
        if selected is None:
            return {}

        def as_int(value):
            raw = re.sub(r"[^\d-]", "", str(value or ""))
            if raw in ("", "-"):
                return None
            try:
                return int(raw)
            except Exception:
                return None

        def as_text(value):
            text = str(value or "").strip()
            return text if text else None

        return {
            'singles_titles': as_int(selected.get('sglcareertitles')),
            'doubles_titles': as_int(selected.get('dblcareertitles')),
            'prize_money': as_text(selected.get('careerprize')),
            'singles_wins': as_int(selected.get('sglcareerwon')),
            'singles_losses': as_int(selected.get('sglcareerlost')),
            'doubles_wins': as_int(selected.get('dblcareerwon')),
            'doubles_losses': as_int(selected.get('dblcareerlost')),
            'career_high_singles': as_int(selected.get('sglhirank')),
            'career_high_doubles': as_int(selected.get('dblhirank'))
        }

    def _parse_h2h_set_scores(self, score_text, reverse_order=False):
        text = re.sub(r"\s+", " ", str(score_text or "")).strip()
        if not text:
            return []

        set_rows = []
        token_pattern = re.compile(r"^(\d+)-(\d+)(?:\((\d+)\))?$")
        for token in text.split(" "):
            match = token_pattern.match(token.strip())
            if not match:
                continue
            left_games = int(match.group(1))
            right_games = int(match.group(2))
            tiebreak_loser_points = match.group(3)

            if reverse_order:
                left_games, right_games = right_games, left_games

            left_won = None
            if left_games > right_games:
                left_won = True
            elif right_games > left_games:
                left_won = False

            if tiebreak_loser_points:
                if left_games > right_games:
                    display = f"{left_games}-{right_games} ({tiebreak_loser_points})"
                elif right_games > left_games:
                    display = f"{left_games} ({tiebreak_loser_points})-{right_games}"
                else:
                    display = f"{left_games}-{right_games} ({tiebreak_loser_points})"
            else:
                display = f"{left_games}-{right_games}"

            set_rows.append({
                'left_games': left_games,
                'right_games': right_games,
                'left_won': left_won,
                'display': display
            })
        return set_rows

    def _flip_h2h_set_scores(self, set_rows):
        flipped = []
        for row in set_rows or []:
            original_left = self._to_int(row.get('left_games'))
            original_right = self._to_int(row.get('right_games'))
            if original_left is None or original_right is None:
                continue
            left_games = original_right
            right_games = original_left

            left_won = None
            if left_games > right_games:
                left_won = True
            elif right_games > left_games:
                left_won = False

            raw_display = str(row.get('display') or '')
            tb_match = re.search(r"\((\d+)\)", raw_display)
            tiebreak_loser_points = tb_match.group(1) if tb_match else None
            if tiebreak_loser_points:
                if left_games > right_games:
                    display = f"{left_games}-{right_games} ({tiebreak_loser_points})"
                elif right_games > left_games:
                    display = f"{left_games} ({tiebreak_loser_points})-{right_games}"
                else:
                    display = f"{left_games}-{right_games} ({tiebreak_loser_points})"
            else:
                display = f"{left_games}-{right_games}"

            flipped.append({
                'left_games': left_games,
                'right_games': right_games,
                'left_won': left_won,
                'display': display
            })
        return flipped

    def search_atp_players_for_h2h(self, query, limit=8):
        text = (query or '').strip()
        if not text:
            return []
        query_norm = self._normalize_player_name(text)
        if not query_norm:
            return []

        limit = max(1, min(int(limit or 8), 20))
        candidates = {}

        def add_candidate(player_code, full_name, country_code='', image_url='', rank=None):
            code = str(player_code or '').strip().upper()
            if not code or not full_name:
                return
            normalized = self._normalize_player_name(full_name)
            score = self._name_match_score(query_norm, normalized)
            if score < 12.0:
                return

            ranking = self._match_atp_ranking(name=full_name, player_code=code)
            scraped = self._match_atp_scraped((ranking or {}).get('name') or full_name)
            profile = (scraped or {}).get('profile') or {}
            key = str((ranking or {}).get('id') or code)
            existing = candidates.get(key) or {}

            chosen_rank = rank if rank is not None else (ranking or {}).get('rank')
            if existing.get('rank') is not None and chosen_rank is not None:
                chosen_rank = min(existing.get('rank'), chosen_rank)
            elif existing.get('rank') is not None and chosen_rank is None:
                chosen_rank = existing.get('rank')

            candidates[key] = {
                'id': (ranking or {}).get('id'),
                'player_code': code,
                'name': (ranking or {}).get('name') or profile.get('name') or full_name,
                'country': country_code or (ranking or {}).get('country') or profile.get('country') or '',
                'rank': chosen_rank,
                'image_url': image_url or (ranking or {}).get('image_url') or profile.get('image_url') or '',
                'score': max(score, existing.get('score', 0.0))
            }

        for row in self._get_atp_rankings():
            add_candidate(
                row.get('player_code'),
                row.get('name'),
                country_code=row.get('country') or '',
                image_url=row.get('image_url') or '',
                rank=row.get('rank')
            )

        for entry in (self._load_atp_scraped_index().get('players') or []):
            profile = entry.get('profile') or {}
            add_candidate(
                entry.get('player_code') or profile.get('player_id'),
                entry.get('name'),
                country_code=profile.get('country') or '',
                image_url=profile.get('image_url') or ''
            )

        if not candidates:
            return []

        ranked = sorted(
            candidates.values(),
            key=lambda c: (
                -c.get('score', 0.0),
                c.get('rank') if c.get('rank') is not None else 10_000,
                c.get('name', '')
            )
        )
        return [
            {
                'id': row.get('id') if row.get('id') is not None else row.get('player_code'),
                'player_code': row.get('player_code'),
                'name': row.get('name'),
                'country': row.get('country') or '',
                'rank': row.get('rank'),
                'image_url': row.get('image_url') or ''
            }
            for row in ranked[:limit]
        ]

    def search_wta_players_for_h2h(self, query, limit=8):
        text = (query or '').strip()
        if not text:
            return []
        query_norm = self._normalize_player_name(text)
        if not query_norm:
            return []

        limit = max(1, min(int(limit or 8), 20))
        candidates = {}

        def add_candidate(player_id, full_name, country_code='', image_url='', rank=None, source=''):
            if not player_id or not full_name:
                return
            try:
                pid = int(player_id)
            except Exception:
                return
            normalized = self._normalize_player_name(full_name)
            score = self._name_match_score(query_norm, normalized)
            if score < 12.0:
                return

            ranking = self._match_wta_ranking_strict(full_name, player_id=pid)
            scraped = self._match_wta_scraped_strict(full_name, player_id=pid)
            profile = scraped.get('profile') if scraped else {}
            existing = candidates.get(pid) or {}
            chosen_rank = rank if rank is not None else (ranking or {}).get('rank')
            if existing.get('rank') and chosen_rank:
                chosen_rank = min(existing.get('rank'), chosen_rank)
            elif existing.get('rank') and not chosen_rank:
                chosen_rank = existing.get('rank')
            final_image = (
                image_url
                or existing.get('image_url')
                or (ranking or {}).get('image_url')
                or profile.get('image_url')
                or ''
            )
            final_country = (
                country_code
                or existing.get('country')
                or (ranking or {}).get('country')
                or profile.get('country')
                or ''
            )
            candidates[pid] = {
                'id': pid,
                'name': full_name,
                'country': final_country,
                'rank': chosen_rank,
                'image_url': final_image,
                'score': max(score, existing.get('score', 0.0)),
                'source': source or existing.get('source') or 'wta'
            }

        try:
            search_payload = self._wta_api_get_json(
                WTA_SEARCH_API_BASE,
                params={
                    'lang': 'en',
                    'terms': f"{text}*",
                    'size': 100,
                    'type': 'PLAYER',
                    'start': 0,
                    'fullObjectResponse': 'true'
                },
                include_account_header=False
            )
            for hit in search_payload.get('hits', []):
                ref = hit.get('contentReference') or {}
                add_candidate(
                    ref.get('id'),
                    ref.get('fullName'),
                    country_code=ref.get('countryCode'),
                    source='wta-search'
                )
        except Exception:
            pass

        scraped_index = self._load_wta_scraped_index()
        for entry in scraped_index.get('players', []):
            score = self._name_match_score(query_norm, entry.get('norm') or '')
            if score < 16.0:
                continue
            profile = entry.get('profile') or {}
            pid = self._extract_wta_player_id_from_url(profile.get('url'))
            add_candidate(
                pid,
                entry.get('name'),
                country_code=profile.get('country') or '',
                image_url=profile.get('image_url') or '',
                source='scraped'
            )

        if not candidates:
            return []

        ranked = sorted(
            candidates.values(),
            key=lambda c: (
                -c.get('score', 0.0),
                c.get('rank') if c.get('rank') is not None else 10_000,
                c.get('name', '')
            )
        )
        return [
            {
                'id': row['id'],
                'name': row['name'],
                'country': row.get('country') or '',
                'rank': row.get('rank'),
                'image_url': row.get('image_url') or ''
            }
            for row in ranked[:limit]
        ]

    def fetch_wta_h2h_details(self, player1_id, player2_id, year=2026, meetings_limit=5):
        p1_id = int(player1_id)
        p2_id = int(player2_id)
        year = int(year or datetime.now().year)
        meetings_limit = max(1, min(int(meetings_limit or 5), 10))

        h2h_payload = {}
        try:
            h2h_payload = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/players/{p1_id}/headtohead/{p2_id}",
                params={'sort': 'desc'},
                include_account_header=True
            )
        except Exception:
            h2h_payload = {}

        try:
            p1_year = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/players/{p1_id}/year/{year}",
                include_account_header=True
            )
        except Exception:
            p1_year = {'player': {}, 'stats': {}}
        try:
            p2_year = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/players/{p2_id}/year/{year}",
                include_account_header=True
            )
        except Exception:
            p2_year = {'player': {}, 'stats': {}}

        try:
            p1_records = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/players/{p1_id}/records",
                include_account_header=True
            )
        except Exception:
            p1_records = {}
        try:
            p2_records = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/players/{p2_id}/records",
                include_account_header=True
            )
        except Exception:
            p2_records = {}

        summary = ((h2h_payload.get('headToHeadSummary') or [{}])[0]) or {}
        p1_meta = (p1_year or {}).get('player') or {}
        p2_meta = (p2_year or {}).get('player') or {}

        p1_name = p1_meta.get('fullName') or (
            f"{summary.get('playernamefirst', '').title()} {summary.get('playernamelast', '').title()}".strip()
        )
        p2_name = p2_meta.get('fullName') or (
            f"{summary.get('opponentnamefirst', '').title()} {summary.get('opponentnamelast', '').title()}".strip()
        )

        player1 = self._build_h2h_player_payload(
            p1_id,
            p1_name or str(p1_id),
            country_code=p1_meta.get('countryCode') or ''
        )
        player2 = self._build_h2h_player_payload(
            p2_id,
            p2_name or str(p2_id),
            country_code=p2_meta.get('countryCode') or ''
        )

        meetings = []
        for match in (h2h_payload.get('matchEncounterResults') or [])[:meetings_limit]:
            p1_info = match.get('player1Info') or {}
            p2_info = match.get('player2Info') or {}
            api_player1_id = p1_info.get('id')
            api_player2_id = p2_info.get('id')
            winner_flag = match.get('winner')
            winner_id = None
            if winner_flag == 1:
                winner_id = p1_info.get('id')
            elif winner_flag == 2:
                winner_id = p2_info.get('id')

            start_date = match.get('StartDate') or ''
            try:
                date_text = datetime.fromisoformat(start_date.replace('Z', '+00:00')).date().isoformat()
            except Exception:
                date_text = start_date[:10] if start_date else ''

            tournament = self._clean_tournament_name(match.get('TournamentName') or 'Tournament')
            category = self._wta_level_to_category(match.get('TournamentLevel') or '', tournament)
            surface = str(match.get('Surface') or '').title()
            score = re.sub(r"\s+", " ", str(match.get('scores') or '')).strip()
            reverse_order = int(api_player1_id or 0) != int(p1_id)
            set_scores = self._parse_h2h_set_scores(score, reverse_order=reverse_order)

            # WTA feed can occasionally provide `scores` not aligned with player1/player2.
            # If parsed set winners contradict the declared match winner, flip set orientation.
            left_sets = sum(1 for s in set_scores if s.get('left_won') is True)
            right_sets = sum(1 for s in set_scores if s.get('left_won') is False)
            if winner_id is not None:
                try:
                    winner_id_int = int(winner_id)
                except Exception:
                    winner_id_int = None
                if winner_id_int == p1_id and right_sets > left_sets:
                    set_scores = self._flip_h2h_set_scores(set_scores)
                elif winner_id_int == p2_id and left_sets > right_sets:
                    set_scores = self._flip_h2h_set_scores(set_scores)

            meetings.append({
                'date': date_text,
                'tournament': tournament,
                'category': category,
                'category_label': self._category_label(category),
                'surface': surface,
                'round': match.get('round_name') or match.get('tourn_round') or '',
                'winner_id': winner_id,
                'winner_name': (p1_info.get('fullName') if winner_flag == 1 else p2_info.get('fullName') if winner_flag == 2 else ''),
                'score': score,
                'set_scores': set_scores
            })

        wins = int(summary.get('wins') or 0)
        losses = int(summary.get('losses') or 0)
        if wins == 0 and losses == 0 and meetings:
            for match in meetings:
                if int(match.get('winner_id') or 0) == p1_id:
                    wins += 1
                elif int(match.get('winner_id') or 0) == p2_id:
                    losses += 1

        recent_p1_wins = sum(1 for m in meetings if int(m.get('winner_id') or 0) == p1_id)
        recent_p2_wins = sum(1 for m in meetings if int(m.get('winner_id') or 0) == p2_id)

        p1_surface = self._extract_wta_surface_records(p1_records)
        p2_surface = self._extract_wta_surface_records(p2_records)
        surface_order = ['HARD', 'CLAY', 'GRASS']
        available_surfaces = [s for s in surface_order if s in p1_surface or s in p2_surface]
        for surface in sorted(set(list(p1_surface.keys()) + list(p2_surface.keys()))):
            if 'CARPET' in str(surface).upper():
                continue
            if surface not in available_surfaces:
                available_surfaces.append(surface)

        surface_records = {}
        for surface in available_surfaces:
            s1 = p1_surface.get(surface, {})
            s2 = p2_surface.get(surface, {})
            surface_records[surface] = {
                'player1': {
                    'wins': s1.get('wins'),
                    'losses': s1.get('losses'),
                    'winPercentage': s1.get('winPercentage')
                },
                'player2': {
                    'wins': s2.get('wins'),
                    'losses': s2.get('losses'),
                    'winPercentage': s2.get('winPercentage')
                }
            }

        serving_rows = self._build_wta_metric_rows(p1_year, p2_year, WTA_SERVING_METRICS)
        returning_rows = self._build_wta_metric_rows(p1_year, p2_year, WTA_RETURNING_METRICS)
        bio_rows = h2h_payload.get('bio') or []
        career_summary = {
            'player1': self._extract_wta_career_summary(bio_rows, p1_id),
            'player2': self._extract_wta_career_summary(bio_rows, p2_id)
        }

        return {
            'tour': 'wta',
            'players': {
                'player1': player1,
                'player2': player2
            },
            'head_to_head': {
                'player1_wins': wins,
                'player2_wins': losses,
                'total_matches': wins + losses,
                'recent_last_n': len(meetings),
                'recent_player1_wins': recent_p1_wins,
                'recent_player2_wins': recent_p2_wins
            },
            'season_stats': {
                'year': year,
                'serving': serving_rows,
                'returning': returning_rows
            },
            'career_summary': career_summary,
            'career_surface_records': surface_records,
            'past_meetings': meetings
        }

    def fetch_atp_h2h_details(self, player1_code, player2_code, year=2026, meetings_limit=5):
        year = int(year or datetime.now().year)
        meetings_limit = max(1, min(int(meetings_limit or 5), 10))

        p1_code = self._resolve_atp_player_code(player1_code)
        p2_code = self._resolve_atp_player_code(player2_code)
        if not p1_code or not p2_code:
            raise ValueError('player1_code and player2_code are required')
        if p1_code == p2_code:
            raise ValueError('Please choose two different players')

        markdown = self._fetch_rjina_markdown(
            self._build_atp_h2h_url(p1_code, p2_code),
            timeout=40
        )
        wins = self._extract_atp_h2h_wins(markdown) or {'first_wins': 0, 'second_wins': 0}

        title_match = re.search(
            r'^Title:\s*(.+?)\s+VS\s+(.+?)\s+\|',
            markdown,
            flags=re.IGNORECASE | re.MULTILINE
        )
        title_p1 = title_match.group(1).strip() if title_match else ''
        title_p2 = title_match.group(2).strip() if title_match else ''

        player1 = self._build_atp_h2h_player_payload(p1_code, full_name=title_p1)
        player2 = self._build_atp_h2h_player_payload(p2_code, full_name=title_p2)

        if title_match:
            if not player1.get('name') or self._normalize_player_name(player1.get('name')) == self._normalize_player_name(p1_code):
                player1['name'] = title_p1
            if not player2.get('name') or self._normalize_player_name(player2.get('name')) == self._normalize_player_name(p2_code):
                player2['name'] = title_p2

        meetings = self._parse_atp_h2h_meetings(
            markdown=markdown,
            player1=player1,
            player2=player2,
            meetings_limit=meetings_limit
        )
        career_summary = self._extract_atp_h2h_career_summary(markdown)

        p1_id = self._to_int(player1.get('id'))
        p2_id = self._to_int(player2.get('id'))
        recent_p1_wins = 0
        recent_p2_wins = 0
        for row in meetings:
            winner_id = self._to_int(row.get('winner_id'))
            winner_code = str(row.get('winner_code') or '').strip().upper()
            if winner_id is None:
                if winner_code and winner_code == p1_code:
                    recent_p1_wins += 1
                elif winner_code and winner_code == p2_code:
                    recent_p2_wins += 1
                continue
            if p1_id is not None and winner_id == p1_id:
                recent_p1_wins += 1
            elif p2_id is not None and winner_id == p2_id:
                recent_p2_wins += 1

        first_wins = self._to_int(wins.get('first_wins')) or 0
        second_wins = self._to_int(wins.get('second_wins')) or 0

        return {
            'tour': 'atp',
            'players': {
                'player1': player1,
                'player2': player2
            },
            'head_to_head': {
                'player1_wins': first_wins,
                'player2_wins': second_wins,
                'total_matches': first_wins + second_wins,
                'recent_last_n': len(meetings),
                'recent_player1_wins': recent_p1_wins,
                'recent_player2_wins': recent_p2_wins
            },
            'season_stats': {
                'year': year,
                'serving': [],
                'returning': []
            },
            'career_summary': career_summary,
            'career_surface_records': {},
            'past_meetings': meetings
        }

    def _run_matches_script(self, script_name, args=None, timeout=35, label='match'):
        script_path = Path(__file__).resolve().parent.parent / 'scripts' / script_name
        if not script_path.exists():
            print(f"{label} script not found: {script_path}")
            return None
        cmd = [sys.executable, str(script_path)]
        for arg in args or []:
            cmd.append(str(arg))
        attempts = 2 if str(label or '').upper().startswith('ATP') else 1
        last_error = None

        for attempt in range(1, attempts + 1):
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
            except Exception as exc:
                last_error = exc
                if attempt < attempts:
                    print(f"Retrying {label} script ({script_name}) after error: {exc}")
                    continue
                print(f"Error running {label} script {script_name}: {exc}")
                return None

            if result.returncode != 0:
                stderr = (result.stderr or '').strip()
                last_error = stderr or 'unknown error'
                if attempt < attempts:
                    print(f"Retrying {label} script ({script_name}) after non-zero exit: {last_error}")
                    continue
                print(f"{label} script failed ({script_name}): {last_error}")
                return None

            stdout = (result.stdout or '').strip()
            if not stdout:
                return []
            try:
                payload = json.loads(stdout)
            except Exception as exc:
                last_error = exc
                if attempt < attempts:
                    print(f"Retrying {label} script ({script_name}) after JSON parse error: {exc}")
                    continue
                print(f"Invalid JSON from {label} script {script_name}: {exc}")
                return None

            if isinstance(payload, list):
                return payload
            return []

        if last_error is not None:
            print(f"{label} script failed ({script_name}): {last_error}")
        return None

    def _run_wta_matches_script(self, script_name, args=None, timeout=35):
        return self._run_matches_script(
            script_name=script_name,
            args=args,
            timeout=timeout,
            label='WTA match'
        )

    def _run_atp_matches_script(self, script_name, args=None, timeout=60):
        return self._run_matches_script(
            script_name=script_name,
            args=args,
            timeout=timeout,
            label='ATP match'
        )

    def _format_wta_duration(self, value):
        if not value:
            return None
        try:
            parts = str(value).split(':')
            if len(parts) != 3:
                return None
            hours = int(parts[0])
            minutes = int(parts[1])
            if hours > 0:
                return f"{hours}:{minutes:02d}"
            return f"0:{minutes:02d}"
        except Exception:
            return None

    def _parse_wta_match_time(self, value):
        if not value:
            return None
        try:
            ts = value.replace('Z', '+00:00')
            dt = datetime.fromisoformat(ts)
            local_dt = dt.astimezone()
            return local_dt.strftime('%b %d %I:%M %p').lstrip('0')
        except Exception:
            return None

    def _is_grand_slam_event(self, name, level):
        level_lower = (level or '').lower()
        if 'grand slam' in level_lower:
            return True
        for gs in Config.GRAND_SLAMS:
            if gs.lower() in (name or '').lower():
                return True
        return False

    def _wta_category_from_level(self, name, level):
        level_lower = (level or '').lower()
        if self._is_grand_slam_event(name, level):
            return 'grand_slam'
        if '1000' in level_lower:
            return 'masters_1000'
        if '500' in level_lower:
            return 'atp_500'
        if '250' in level_lower:
            return 'atp_250'
        if '125' in level_lower:
            return 'atp_125'
        return 'other'

    def _normalize_draw_size(self, draw_size):
        try:
            value = int(draw_size)
        except Exception:
            return 32
        if value in (16, 28, 32, 56, 64, 96, 128):
            return value
        if value <= 16:
            return 16
        if value <= 36:
            return 32
        if value <= 60:
            return 56
        if value <= 80:
            return 64
        if value <= 110:
            return 96
        return 128

    def _wta_round_from_match(self, match, is_grand_slam, draw_size=32):
        round_id = str(match.get('RoundID') or '').strip()
        draw_level_type = str(match.get('DrawLevelType') or '').strip().upper()
        match_id = str(match.get('MatchID') or '')
        match_digits = re.sub(r'\D', '', match_id)
        match_number = int(match_digits) if match_digits.isdigit() else 0

        round_upper = round_id.upper()
        if draw_level_type == 'Q':
            if round_upper in ('Q', 'Q1'):
                return 'Qualifying R1'
            if round_upper == 'Q2':
                return 'Qualifying R2'
            if round_upper == 'Q3':
                return 'Qualifying R3'
            if round_id.isdigit():
                rid = int(round_id)
                if rid > 0:
                    return f'Qualifying R{rid}'

        if round_upper in ('F', 'SF', 'QF', 'RR', 'R128', 'R64', 'R32', 'R16'):
            return round_upper
        if round_upper == 'Q':
            return 'QF'
        if round_upper == 'S':
            return 'SF'
        if round_upper.startswith('R') and round_upper[1:].isdigit():
            numeric = int(round_upper[1:])
            if numeric in (16, 32, 64, 128):
                return f'R{numeric}'

        normalized_draw = self._normalize_draw_size(draw_size)

        if round_id.isdigit():
            rid = int(round_id)
            if is_grand_slam:
                gs_rounds = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F']
                if 1 <= rid <= len(gs_rounds):
                    return gs_rounds[rid - 1]
            else:
                if normalized_draw in (96, 56):
                    opening_round = 'R64'
                elif normalized_draw == 128:
                    opening_round = 'R128'
                elif normalized_draw in (64,):
                    opening_round = 'R64'
                elif normalized_draw in (32, 28):
                    opening_round = 'R32'
                else:
                    opening_round = 'R16'
                rounds = [opening_round]
                if opening_round == 'R128':
                    rounds.extend(['R64', 'R32', 'R16'])
                elif opening_round == 'R64':
                    rounds.extend(['R32', 'R16'])
                elif opening_round == 'R32':
                    rounds.append('R16')
                rounds.extend(['QF', 'SF', 'F'])
                if 1 <= rid <= len(rounds):
                    return rounds[rid - 1]

        if match_number:
            if match_number == 1:
                return 'F'
            if match_number in (2, 3):
                return 'SF'
            if 4 <= match_number <= 7:
                return 'QF'
            if 8 <= match_number <= 15:
                return 'R16'
            if 16 <= match_number <= 31:
                return 'R32'
            if 32 <= match_number <= 63:
                return 'R64'
            if 64 <= match_number <= 127:
                return 'R128'
        return ''

    def _parse_wta_sets(self, match):
        sets = []
        for idx in range(1, 6):
            raw_a = match.get(f'ScoreSet{idx}A')
            raw_b = match.get(f'ScoreSet{idx}B')
            if raw_a in (None, '', ' ') or raw_b in (None, '', ' '):
                continue
            try:
                games_a = int(raw_a)
                games_b = int(raw_b)
            except Exception:
                continue
            entry = {'p1': games_a, 'p2': games_b}
            raw_tb = match.get(f'ScoreTbSet{idx}')
            if raw_tb not in (None, '', ' '):
                try:
                    loser_tb = int(raw_tb)
                except Exception:
                    loser_tb = None
                if loser_tb is not None and ((games_a == 7 and games_b == 6) or (games_a == 6 and games_b == 7)):
                    winner_tb = max(7, loser_tb + 2)
                    if games_a > games_b:
                        entry['tiebreak'] = {'p1': winner_tb, 'p2': loser_tb}
                    else:
                        entry['tiebreak'] = {'p1': loser_tb, 'p2': winner_tb}
            sets.append(entry)
        return sets

    def _determine_sets_winner(self, sets):
        if not sets:
            return None
        p1_sets = sum(1 for s in sets if s['p1'] > s['p2'])
        p2_sets = sum(1 for s in sets if s['p2'] > s['p1'])
        if p1_sets > p2_sets:
            return 1
        if p2_sets > p1_sets:
            return 2
        return None

    def _resolve_wta_player(self, name, country, player_id):
        rank_entry = self._match_wta_ranking(name)
        scraped_entry = self._match_wta_scraped(name)
        resolved_id = int(player_id) if player_id and str(player_id).isdigit() else None
        if resolved_id is None:
            resolved_id = (rank_entry or {}).get('id')
        image_url = ''
        if resolved_id is not None:
            image_url = f"/api/player/wta/{resolved_id}/image"
        elif rank_entry and rank_entry.get('image_url'):
            image_url = rank_entry.get('image_url')
        elif scraped_entry:
            image_url = scraped_entry.get('profile', {}).get('image_url') or ''
            
        return {
            'id': resolved_id,
            'name': name,
            'country': country or (rank_entry or {}).get('country') or (scraped_entry or {}).get('profile', {}).get('country'),
            'rank': (rank_entry or {}).get('rank'),
            'image_url': image_url
        }

    def _resolve_atp_player(self, player_payload):
        payload = player_payload if isinstance(player_payload, dict) else {}
        name = (payload.get('name') or '').strip()
        country = (payload.get('country') or '').strip().upper()
        raw_player_code = payload.get('player_code') or payload.get('player_id') or ''
        player_code = str(raw_player_code).strip().upper()
        # Only use numeric ID as player_code if we don't have an explicit player_code
        if not player_code:
            id_as_code = str(payload.get('id') or '').strip()
            if id_as_code and not id_as_code.isdigit():
                player_code = id_as_code.upper()

        ranking = self._match_atp_ranking(name=name, player_code=player_code)
        scraped = self._match_atp_scraped((ranking or {}).get('name') or name)
        profile = scraped.get('profile') if scraped else {}

        resolved_id = None
        if ranking and ranking.get('id') is not None:
            resolved_id = ranking.get('id')
        elif str(payload.get('id') or '').isdigit():
            resolved_id = int(payload.get('id'))

        rank = payload.get('rank')
        if rank in (None, '', 0):
            rank = (ranking or {}).get('rank')

        image_url = (
            payload.get('image_url')
            or (ranking or {}).get('image_url')
            or profile.get('image_url')
            or ''
        )
        points = payload.get('points')
        if points in (None, ''):
            points = (ranking or {}).get('points')

        resolved_player_code = (
            player_code
            or str(profile.get('player_id') or '').strip().upper()
            or str((ranking or {}).get('player_code') or '').strip().upper()
        )

        if resolved_player_code:
            image_url = f"/api/player/atp/{resolved_player_code}/image"

        return {
            'id': resolved_id,
            'player_code': resolved_player_code,
            'name': (ranking or {}).get('name') or profile.get('name') or name or 'TBD',
            'country': country or (ranking or {}).get('country') or profile.get('country') or '',
            'rank': rank,
            'points': points,
            'image_url': image_url
        }

    def _enrich_atp_match(self, match):
        if not isinstance(match, dict):
            return None
        out = dict(match)
        out['tour'] = 'ATP'
        out['player1'] = self._resolve_atp_player(out.get('player1'))
        out['player2'] = self._resolve_atp_player(out.get('player2'))
        out.setdefault('h2h_text', 'N/A')
        return out

    def _parse_wta_match_stats_snapshot(self, match):
        snapshot = match.get('DetailedStats')
        if not isinstance(snapshot, dict):
            return None

        def int_or_zero(key):
            value = self._to_int(snapshot.get(key))
            return value if value is not None else 0

        def pct_or_calc(pct_key, numerator_key, denominator_key):
            pct = self._to_float(snapshot.get(pct_key))
            if pct is not None:
                return round(pct, 1)
            numerator = int_or_zero(numerator_key)
            denominator = int_or_zero(denominator_key)
            if denominator <= 0:
                return 0.0
            return round((numerator / denominator) * 100.0, 1)

        aces_p1 = int_or_zero('aces_a')
        aces_p2 = int_or_zero('aces_b')
        df_p1 = int_or_zero('double_faults_a')
        df_p2 = int_or_zero('double_faults_b')

        first_in_p1 = int_or_zero('first_serve_in_a')
        first_in_p2 = int_or_zero('first_serve_in_b')
        first_total_p1 = int_or_zero('service_points_played_a')
        first_total_p2 = int_or_zero('service_points_played_b')
        first_won_p1 = int_or_zero('first_serve_points_won_a')
        first_won_p2 = int_or_zero('first_serve_points_won_b')

        second_won_p1 = int_or_zero('second_serve_points_won_a')
        second_won_p2 = int_or_zero('second_serve_points_won_b')
        second_total_p1 = int_or_zero('second_serve_points_played_a')
        second_total_p2 = int_or_zero('second_serve_points_played_b')

        break_conv_p1 = int_or_zero('break_points_converted_a')
        break_conv_p2 = int_or_zero('break_points_converted_b')
        break_total_p1 = int_or_zero('break_points_total_a')
        break_total_p2 = int_or_zero('break_points_total_b')
        break_faced_p1 = int_or_zero('break_points_faced_a')
        break_faced_p2 = int_or_zero('break_points_faced_b')
        break_saved_p1 = int_or_zero('break_points_saved_a')
        break_saved_p2 = int_or_zero('break_points_saved_b')

        service_games_p1 = int_or_zero('service_games_played_a')
        service_games_p2 = int_or_zero('service_games_played_b')
        total_points_p1 = int_or_zero('total_points_won_a')
        total_points_p2 = int_or_zero('total_points_won_b')

        return {
            'source': 'wta_match_stats_snapshot',
            'aces': {'p1': aces_p1, 'p2': aces_p2},
            'doubleFaults': {'p1': df_p1, 'p2': df_p2},
            'firstServe': {
                'p1': pct_or_calc('first_serve_percent_a', 'first_serve_in_a', 'service_points_played_a'),
                'p2': pct_or_calc('first_serve_percent_b', 'first_serve_in_b', 'service_points_played_b'),
                'made': {'p1': first_in_p1, 'p2': first_in_p2},
                'total': {'p1': first_total_p1, 'p2': first_total_p2}
            },
            'firstServeWon': {
                'p1': pct_or_calc('first_serve_points_won_percent_a', 'first_serve_points_won_a', 'first_serve_in_a'),
                'p2': pct_or_calc('first_serve_points_won_percent_b', 'first_serve_points_won_b', 'first_serve_in_b'),
                'won': {'p1': first_won_p1, 'p2': first_won_p2},
                'total': {'p1': first_in_p1, 'p2': first_in_p2}
            },
            'secondServeWon': {
                'p1': pct_or_calc('second_serve_points_won_percent_a', 'second_serve_points_won_a', 'second_serve_points_played_a'),
                'p2': pct_or_calc('second_serve_points_won_percent_b', 'second_serve_points_won_b', 'second_serve_points_played_b'),
                'won': {'p1': second_won_p1, 'p2': second_won_p2},
                'total': {'p1': second_total_p1, 'p2': second_total_p2}
            },
            'breakPointsWon': {'p1': break_conv_p1, 'p2': break_conv_p2},
            'breakPointsTotal': {'p1': break_total_p1, 'p2': break_total_p2},
            'breakPointsRate': {
                'p1': pct_or_calc('break_points_converted_percent_a', 'break_points_converted_a', 'break_points_total_a'),
                'p2': pct_or_calc('break_points_converted_percent_b', 'break_points_converted_b', 'break_points_total_b')
            },
            'breakPointsFaced': {'p1': break_faced_p1, 'p2': break_faced_p2},
            'breakPointsSaved': {'p1': break_saved_p1, 'p2': break_saved_p2},
            'breakPointsSavedRate': {
                'p1': pct_or_calc('break_points_saved_percent_a', 'break_points_saved_a', 'break_points_faced_a'),
                'p2': pct_or_calc('break_points_saved_percent_b', 'break_points_saved_b', 'break_points_faced_b')
            },
            'serviceGamesPlayed': {'p1': service_games_p1, 'p2': service_games_p2},
            'totalPoints': {'p1': total_points_p1, 'p2': total_points_p2},
            'winners': {'p1': 0, 'p2': 0},
            'unforcedErrors': {'p1': 0, 'p2': 0},
        }

    def _pick_wta_match_stats_row(self, payload):
        if not isinstance(payload, list):
            return None
        rows = [row for row in payload if isinstance(row, dict)]
        if not rows:
            return None
        for row in rows:
            set_num = self._to_int(row.get('setnum'))
            if set_num == 0:
                return row
        return rows[0]

    def _pick_or_aggregate_wta_match_stats_row(self, payload):
        if not isinstance(payload, list):
            return None
        rows = [row for row in payload if isinstance(row, dict)]
        if not rows:
            return None

        summary_row = None
        set_rows = []
        for row in rows:
            set_num = self._to_int(row.get('setnum'))
            if set_num == 0 and summary_row is None:
                summary_row = row
            elif set_num is not None and set_num > 0:
                set_rows.append(row)

        # Prefer provided summary row when it already contains match totals.
        if summary_row is not None:
            total_a = self._to_int(summary_row.get('totservplayeda'))
            total_b = self._to_int(summary_row.get('totservplayedb'))
            if (total_a or 0) > 0 or (total_b or 0) > 0:
                return summary_row

        # Some live responses occasionally have sparse setnum=0 rows.
        # In that case, aggregate set rows to reconstruct an overall snapshot.
        if set_rows:
            numeric_fields = [
                'acesa', 'acesb',
                'dblflta', 'dblfltb',
                'ptswon1stserva', 'ptswon1stservb',
                'ptsplayed1stserva', 'ptsplayed1stservb',
                'ptstotwonserva', 'ptstotwonservb',
                'totservplayeda', 'totservplayedb',
                'breakptsconva', 'breakptsconvb',
                'breakptsplayeda', 'breakptsplayedb',
                'servgamesplayeda', 'servgamesplayedb',
                'pts1stservlosta', 'pts1stservlostb',
                'totptswona', 'totptswonb',
                'acesssa', 'acesssb',
            ]
            aggregated = {
                'eventyear': (summary_row or set_rows[0]).get('eventyear'),
                'eventid': (summary_row or set_rows[0]).get('eventid'),
                'matchid': (summary_row or set_rows[0]).get('matchid'),
                'setnum': 0,
                'settime': '',
                'scorea': '',
                'scoreb': '',
                'scoretb': '',
            }
            for key in numeric_fields:
                aggregated[key] = 0
            for row in set_rows:
                for key in numeric_fields:
                    aggregated[key] += self._to_int(row.get(key)) or 0
            return aggregated

        return summary_row or rows[0]

    def _build_wta_detailed_stats_snapshot(self, row, event_id, event_year, match_id):
        if not isinstance(row, dict):
            return None

        def as_int(key):
            value = self._to_int(row.get(key))
            return value if value is not None else 0

        def pct(numerator, denominator):
            if denominator <= 0:
                return 0.0
            return round((numerator / denominator) * 100.0, 1)

        aces_a = as_int('acesa')
        aces_b = as_int('acesb')
        dblflt_a = as_int('dblflta')
        dblflt_b = as_int('dblfltb')

        first_in_a = as_int('ptsplayed1stserva')
        first_in_b = as_int('ptsplayed1stservb')
        first_won_a = as_int('ptswon1stserva')
        first_won_b = as_int('ptswon1stservb')
        serve_pts_a = as_int('totservplayeda')
        serve_pts_b = as_int('totservplayedb')
        serve_pts_won_a = as_int('ptstotwonserva')
        serve_pts_won_b = as_int('ptstotwonservb')
        total_pts_won_a = as_int('totptswona')
        total_pts_won_b = as_int('totptswonb')

        second_played_a = max(0, serve_pts_a - first_in_a)
        second_played_b = max(0, serve_pts_b - first_in_b)
        second_won_a = max(0, serve_pts_won_a - first_won_a)
        second_won_b = max(0, serve_pts_won_b - first_won_b)

        break_conv_a = as_int('breakptsconva')
        break_conv_b = as_int('breakptsconvb')
        break_total_a = as_int('breakptsplayeda')
        break_total_b = as_int('breakptsplayedb')

        break_faced_a = break_total_b
        break_faced_b = break_total_a
        break_saved_a = max(0, break_faced_a - break_conv_b)
        break_saved_b = max(0, break_faced_b - break_conv_a)

        serv_games_a = as_int('servgamesplayeda')
        serv_games_b = as_int('servgamesplayedb')

        return {
            'event_id': str(event_id),
            'event_year': str(event_year),
            'match_id': str(match_id),
            'aces_a': aces_a,
            'aces_b': aces_b,
            'double_faults_a': dblflt_a,
            'double_faults_b': dblflt_b,
            'first_serve_in_a': first_in_a,
            'first_serve_in_b': first_in_b,
            'first_serve_points_won_a': first_won_a,
            'first_serve_points_won_b': first_won_b,
            'service_points_played_a': serve_pts_a,
            'service_points_played_b': serve_pts_b,
            'service_points_won_a': serve_pts_won_a,
            'service_points_won_b': serve_pts_won_b,
            'second_serve_points_played_a': second_played_a,
            'second_serve_points_played_b': second_played_b,
            'second_serve_points_won_a': second_won_a,
            'second_serve_points_won_b': second_won_b,
            'break_points_converted_a': break_conv_a,
            'break_points_converted_b': break_conv_b,
            'break_points_total_a': break_total_a,
            'break_points_total_b': break_total_b,
            'break_points_faced_a': break_faced_a,
            'break_points_faced_b': break_faced_b,
            'break_points_saved_a': break_saved_a,
            'break_points_saved_b': break_saved_b,
            'service_games_played_a': serv_games_a,
            'service_games_played_b': serv_games_b,
            'total_points_won_a': total_pts_won_a,
            'total_points_won_b': total_pts_won_b,
            'first_serve_percent_a': pct(first_in_a, serve_pts_a),
            'first_serve_percent_b': pct(first_in_b, serve_pts_b),
            'first_serve_points_won_percent_a': pct(first_won_a, first_in_a),
            'first_serve_points_won_percent_b': pct(first_won_b, first_in_b),
            'second_serve_points_won_percent_a': pct(second_won_a, second_played_a),
            'second_serve_points_won_percent_b': pct(second_won_b, second_played_b),
            'break_points_converted_percent_a': pct(break_conv_a, break_total_a),
            'break_points_converted_percent_b': pct(break_conv_b, break_total_b),
            'break_points_saved_percent_a': pct(break_saved_a, break_faced_a),
            'break_points_saved_percent_b': pct(break_saved_b, break_faced_b),
        }

    def fetch_wta_match_stats(self, event_id, event_year, match_id, force_refresh=False):
        event_id_val = self._to_int(event_id)
        event_year_val = self._to_int(event_year)
        match_id_val = str(match_id or '').strip()
        if not event_id_val or not event_year_val or not match_id_val:
            return None

        cache_key = f"{event_id_val}|{event_year_val}|{match_id_val}"
        if not force_refresh and cache_key in wta_match_stats_cache:
            return wta_match_stats_cache[cache_key]

        try:
            payload = self._wta_api_get_json(
                f"{WTA_TENNIS_API_BASE}/tournaments/{event_id_val}/{event_year_val}/matches/{match_id_val}/stats"
            )
            row = self._pick_or_aggregate_wta_match_stats_row(payload)
            snapshot = self._build_wta_detailed_stats_snapshot(
                row=row,
                event_id=event_id_val,
                event_year=event_year_val,
                match_id=match_id_val
            )
            stats = self._parse_wta_match_stats_snapshot({'DetailedStats': snapshot}) if snapshot else None
        except Exception:
            stats = None

        wta_match_stats_cache[cache_key] = stats
        return stats

    def fetch_atp_match_stats(self, stats_url):
        """
        Fetch ATP match stats by running the dedicated script.
        """
        script_path = Path(__file__).resolve().parent.parent / 'scripts' / '[Live] atp_match_stats.py'
        if not script_path.exists():
            return None
        
        # Use the venv python if it exists
        python_executable = sys.executable
        venv_python = Path(__file__).resolve().parent / 'venv' / 'bin' / 'python'
        if venv_python.exists():
            python_executable = str(venv_python)

        cmd = [
            python_executable,
            str(script_path),
            "--stats-url",
            stats_url
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=90,
                check=False 
            )
            if result.returncode != 0:
                print(f"Error in atp_match_stats script: {result.stderr}", file=sys.stderr)
                return None
            
            return json.loads(result.stdout)
        except (subprocess.TimeoutExpired, json.JSONDecodeError, TypeError) as e:
            print(f"Failed to fetch or parse ATP match stats: {e}", file=sys.stderr)
            return None

    def _parse_wta_match(self, match):
        tournament = match.get('Tournament') or {}
        group = tournament.get('tournamentGroup') or {}
        title = tournament.get('title') or ''
        if ' - ' in title:
            event_name = title.split(' - ')[0].strip()
        else:
            event_name = title.strip() or (group.get('name') or '').title()
        event_name = self._clean_tournament_name(event_name)
        level = group.get('level') or tournament.get('level') or ''
        is_grand_slam = self._is_grand_slam_event(event_name, level)
        category = self._wta_category_from_level(event_name, level)

        city = tournament.get('city') or ''
        country = tournament.get('country') or ''
        location = ''
        if city and country:
            location = f"{city.title()}, {country.title()}"
        elif city:
            location = city.title()
        elif country:
            location = country.title()

        surface = tournament.get('surface') or ''
        court_label = ''
        court_id = match.get('CourtID')
        try:
            if court_id is not None and str(court_id).strip() != '':
                court_label = f"Court {int(court_id)}"
        except Exception:
            court_label = ''

        first_a = (match.get('PlayerNameFirstA') or '').strip()
        last_a = (match.get('PlayerNameLastA') or '').strip()
        first_b = (match.get('PlayerNameFirstB') or '').strip()
        last_b = (match.get('PlayerNameLastB') or '').strip()
        name_a = f"{first_a} {last_a}".strip()
        name_b = f"{first_b} {last_b}".strip()

        player_a = self._resolve_wta_player(name_a, match.get('PlayerCountryA'), match.get('PlayerIDA'))
        player_b = self._resolve_wta_player(name_b, match.get('PlayerCountryB'), match.get('PlayerIDB'))

        match_state = match.get('MatchState') or ''
        status = 'upcoming'
        if match_state == 'P':
            status = 'live'
        elif match_state == 'F':
            status = 'finished'

        sets = self._parse_wta_sets(match)
        winner = self._determine_sets_winner(sets)

        score_payload = {
            'sets': sets
        }
        if status == 'live':
            point_a = match.get('PointA')
            point_b = match.get('PointB')
            if point_a or point_b:
                score_payload['current_game'] = {'p1': point_a or '', 'p2': point_b or ''}

        serving = None
        if match.get('Serve') == 'A':
            serving = 1
        elif match.get('Serve') == 'B':
            serving = 2

        match_time = None
        if status == 'live':
            match_time = self._format_wta_duration(match.get('MatchTimeTotal'))
            if not match_time:
                match_time = self._parse_wta_match_time(match.get('MatchTimeStamp'))
        draw_size = tournament.get('singlesDrawSize') or 32
        try:
            draw_size = int(draw_size)
        except Exception:
            draw_size = 32
        round_code = self._wta_round_from_match(match, is_grand_slam, draw_size=draw_size)

        parsed = {
            'id': match.get('MatchID') or f"wta_{match.get('EventID')}",
            'tour': 'WTA',
            'tournament': event_name or 'Tournament',
            'tournament_category': category,
            'wta_event_id': match.get('EventID'),
            'wta_event_year': match.get('EventYear'),
            'wta_match_id': match.get('MatchID'),
            'location': location,
            'surface': surface,
            'round': round_code,
            'court': court_label,
            'player1': player_a,
            'player2': player_b,
            'status': status,
            'serving': serving,
            'match_time': match_time,
            'scheduled_time': match.get('MatchTimeStamp')
        }

        if status == 'finished':
            parsed['final_score'] = score_payload
            parsed['winner'] = winner
            parsed['match_duration'] = self._format_wta_duration(match.get('MatchTimeTotal'))
        else:
            parsed['score'] = score_payload

        match_stats = self._parse_wta_match_stats_snapshot(match)
        if match_stats:
            parsed['match_stats'] = match_stats

        return parsed
    
    def fetch_live_scores(self, tour='both'):
        """
        Fetch live tennis scores
        tour: 'atp', 'wta', or 'both'
        """
        cache_key = f'live_scores_{tour}'
        if cache_key in live_scores_cache:
            return live_scores_cache[cache_key]
        
        live_matches = []
        if tour in ('wta', 'both'):
            wta_raw = self._run_wta_matches_script('[Live] wta_live_matches.py')
            if wta_raw is None:
                live_matches.extend(self._generate_sample_live_matches('wta'))
            else:
                wta_live = [
                    self._parse_wta_match(match)
                    for match in wta_raw
                    if isinstance(match, dict)
                ]
                live_matches.extend(wta_live)

        if tour in ('atp', 'both'):
            atp_raw = self._run_atp_matches_script('[Live] atp_live_matches.py')
            if atp_raw is None:
                live_matches.extend(self._generate_sample_live_matches('atp'))
            else:
                atp_live = []
                for match in atp_raw:
                    if not isinstance(match, dict):
                        continue
                    enriched = self._enrich_atp_match(match)
                    if enriched:
                        atp_live.append(enriched)
                live_matches.extend(atp_live)
        
        live_scores_cache[cache_key] = live_matches
        return live_matches
    
    def fetch_recent_matches(self, tour='both', limit=20):
        """Fetch recently completed matches"""
        matches = []
        if tour in ('wta', 'both'):
            wta_raw = self._run_wta_matches_script(
                '[Live] wta_recent_matches.py',
                args=['--limit', str(limit)]
            )
            if wta_raw is None:
                matches.extend(self._generate_sample_recent_matches('wta', limit))
            else:
                parsed = [self._parse_wta_match(match) for match in wta_raw if isinstance(match, dict)]
                matches.extend(parsed)

        if tour in ('atp', 'both'):
            atp_raw = self._run_atp_matches_script(
                '[Live] atp_recent_matches.py',
                args=['--limit', str(limit)]
            )
            if atp_raw is None:
                matches.extend(self._generate_sample_recent_matches('atp', limit))
            else:
                parsed = []
                for match in atp_raw:
                    if not isinstance(match, dict):
                        continue
                    enriched = self._enrich_atp_match(match)
                    if enriched:
                        parsed.append(enriched)
                matches.extend(parsed)

        return matches[:limit] if tour == 'both' else matches
    
    def fetch_upcoming_matches(self, tour='both', days=2):
        """
        Fetch upcoming matches in the next N days
        tour: 'atp', 'wta', or 'both'
        days: number of days to look ahead (default 2)
        """
        matches = []

        if tour in ('wta', 'both'):
            wta_raw = self._run_wta_matches_script(
                '[Live] wta_upcoming_matches.py',
                args=['--days', str(days)]
            )
            if wta_raw is None:
                print(f"WTA upcoming: script failed, using generated matches")
                matches.extend(self._generate_sample_upcoming_matches('wta', days))
            elif len(wta_raw) == 0:
                # Scraper ran successfully but found no matches - use generated matches as fallback
                print(f"WTA upcoming: scraper returned empty, using generated matches")
                matches.extend(self._generate_sample_upcoming_matches('wta', days))
            else:
                parsed = [self._parse_wta_match(match) for match in wta_raw if isinstance(match, dict)]
                print(f"WTA upcoming: loaded {len(parsed)} real matches from scraper")
                matches.extend(parsed)

        if tour in ('atp', 'both'):
            atp_raw = self._run_atp_matches_script(
                '[Live] atp_upcoming_matches.py',
                args=['--days', str(days)]
            )
            if atp_raw is None:
                print(f"ATP upcoming: script failed, using generated matches")
                sample_matches = self._generate_sample_upcoming_matches('atp', days)
                print(f"ATP upcoming: generated {len(sample_matches)} sample matches")
                # Enrich sample matches the same way as real matches
                for match in sample_matches:
                    enriched = self._enrich_atp_match(match)
                    if enriched:
                        matches.append(enriched)
                print(f"ATP upcoming: enriched {len([m for m in matches if m.get('tour') == 'ATP'])} ATP matches")
            elif len(atp_raw) == 0:
                # Scraper ran successfully but found no matches - use generated matches as fallback
                print(f"ATP upcoming: scraper returned empty, using generated matches")
                sample_matches = self._generate_sample_upcoming_matches('atp', days)
                print(f"ATP upcoming: generated {len(sample_matches)} sample matches")
                for match in sample_matches:
                    enriched = self._enrich_atp_match(match)
                    if enriched:
                        matches.append(enriched)
                print(f"ATP upcoming: enriched {len([m for m in matches if m.get('tour') == 'ATP'])} ATP matches")
            else:
                parsed = []
                for match in atp_raw:
                    if not isinstance(match, dict):
                        continue
                    enriched = self._enrich_atp_match(match)
                    if enriched:
                        parsed.append(enriched)
                print(f"ATP upcoming: loaded {len(parsed)} real matches from scraper")
                matches.extend(parsed)

        print(f"fetch_upcoming_matches(tour={tour}): returning {len(matches)} total matches")
        return self._attach_upcoming_h2h(matches)
    
    def fetch_rankings(self, tour='atp', limit=200):
        """
        Fetch ATP or WTA rankings
        tour: 'atp' or 'wta'
        limit: number of players to fetch (max 200)
        """
        cache_key = f'rankings_{tour}'
        if cache_key in rankings_cache:
            return rankings_cache[cache_key][:limit]

        rankings = None
        if tour == 'wta':
            rankings = self._load_wta_rankings_csv()
        elif tour == 'atp':
            rankings = self._load_atp_rankings_csv()

        # Generate sample rankings data
        if not rankings:
            rankings = self._generate_sample_rankings(tour, limit)

        rankings_cache[cache_key] = rankings
        return rankings[:limit]
    
    def fetch_tournaments(self, tour='atp', year=None):
        """Fetch tournament calendar"""
        if year is None:
            year = datetime.now().year
        
        cache_key = f'tournaments_{tour}_{year}'
        if cache_key in tournaments_cache:
            return tournaments_cache[cache_key]

        tournaments = []
        if tour == 'wta':
            tournaments = self._load_wta_tournaments_from_files(year)
        elif tour == 'atp':
            tournaments = self._load_atp_tournaments_from_files(year)

        if not tournaments:
            tournaments = self._generate_sample_tournaments(tour, year)
        tournaments_cache[cache_key] = tournaments
        return tournaments
    
    def fetch_tournament_bracket(self, tournament_id, tour='atp'):
        """Fetch tournament bracket/draw"""
        if tour == 'wta':
            bracket = self._build_wta_bracket_from_files(tournament_id)
            if bracket:
                return bracket
        elif tour == 'atp':
            bracket = self._build_atp_bracket_from_files(tournament_id)
            if bracket:
                return bracket
        return self._generate_sample_bracket(tournament_id, tour)
    
    def fetch_player_details(self, player_id):
        """Fetch player details"""
        # Player stats come from per-player JSON files on disk; force a fresh scrape index
        # so newly updated stats_2026.json are reflected without backend restart.
        self._wta_scraped_index = None
        self._atp_scraped_index = None
        wta_player = self._get_wta_player_from_csv(player_id)
        if wta_player:
            return wta_player
        atp_player = self._get_atp_player_from_csv(player_id)
        if atp_player:
            return atp_player
        return self._generate_sample_player(player_id)

    def _get_wta_player_from_csv(self, player_id):
        """Resolve WTA player details from CSV-backed rankings."""
        rankings = self._load_wta_rankings_csv()
        if not rankings:
            return None
        player = next((p for p in rankings if p.get('id') == player_id), None)
        # Backward compatibility for old synthetic IDs (100000 + rank).
        if not player and player_id >= 100000:
            rank = player_id - 100000
            player = next((p for p in rankings if p.get('rank') == rank), None)
        if not player:
            return None
        resolved_id = player.get('id') or player_id
        height = player.get('height') or f"{random.randint(170, 190)} cm"
        plays = player.get('plays') or random.choice(['Right-Handed', 'Left-Handed'])
        titles = player.get('titles') or random.randint(0, 15)
        prize_money = player.get('prize_money') or f"${random.randint(1, 50)},{random.randint(100, 999)},{random.randint(100, 999)}"
        image_url = player.get('image_url') or f"/api/player/wta/{resolved_id}/image"

        return {
            **player,
            'id': resolved_id,
            'tour': 'WTA',
            'height': height,
            'plays': plays,
            'turned_pro': random.randint(2010, 2022),
            'titles': titles,
            'prize_money': prize_money,
            'biography': f"Professional tennis player from {player.get('country', '')}.",
            'image_url': image_url,
            'stats_2026': player.get('stats_2026') or {},
            'records': player.get('records') or [],
            'records_summary': player.get('records_summary') or []
        }

    def _get_atp_player_from_csv(self, player_id):
        """Resolve ATP player details from CSV-backed rankings."""
        rankings = self._load_atp_rankings_csv()
        if not rankings:
            return None
        player = next((p for p in rankings if p.get('id') == player_id), None)
        if not player:
            return None

        resolved_id = player.get('id') or player_id
        height = player.get('height') or f"{random.randint(175, 200)} cm"
        plays = player.get('plays') or random.choice(['Right-Handed', 'Left-Handed'])
        titles = player.get('titles') or random.randint(0, 25)
        image_url = player.get('image_url') or f'https://api.sofascore.com/api/v1/player/{resolved_id}/image'
        stats_2026 = player.get('stats_2026') or {}

        prize_money_career = (
            player.get('career_prize_money')
            or player.get('prize_money')
            or stats_2026.get('career_prize_money')
            or stats_2026.get('prize_money')
            or ''
        )
        prize_money_ytd = (
            player.get('ytd_prize_money')
            or stats_2026.get('ytd_prize_money')
            or ''
        )
        ytd_won_lost = (
            player.get('ytd_won_lost')
            or stats_2026.get('ytd_won_lost')
            or ''
        )

        # Enhance with scraped data (profile, stats, grandslam_performance)
        scraped = self._match_atp_scraped(player.get('name'))
        gs_performance = (scraped or {}).get('grandslam_performance') or {}

        return {
            **player,
            'id': resolved_id,
            'tour': 'ATP',
            'height': height,
            'plays': plays,
            'turned_pro': random.randint(2005, 2023),
            'titles': titles,
            'prize_money': prize_money_career,
            'prize_money_career': prize_money_career,
            'prize_money_ytd': prize_money_ytd,
            'ytd_won_lost': ytd_won_lost,
            'biography': f"Professional tennis player from {player.get('country', '')}.",
            'image_url': image_url,
            'stats_2026': stats_2026,
            'grandslam_performance': gs_performance,
            'records': [],
            'records_summary': []
        }

    def _load_wta_tournaments_index(self):
        if self._wta_tournament_index is not None:
            return self._wta_tournament_index

        base_dir = Path(__file__).resolve().parent.parent / 'data' / 'wta' / 'tournaments'
        index = {}
        if not base_dir.exists():
            self._wta_tournament_index = index
            return index

        for file_path in base_dir.glob("*.json"):
            try:
                tournament = json.loads(file_path.read_text(encoding='utf-8'))
            except Exception:
                continue
            tid = tournament.get('tournament_group_id') or tournament.get('id') or tournament.get('order')
            if tid is None:
                continue
            index[str(tid)] = tournament
        self._wta_tournament_index = index
        return index

    def _load_atp_tournaments_index(self):
        if self._atp_tournament_index is not None:
            return self._atp_tournament_index

        base_dir = self._tour_tournaments_dir('atp')
        index = {}
        if not base_dir.exists():
            self._atp_tournament_index = index
            return index

        for file_path in base_dir.glob("*.json"):
            try:
                tournament = json.loads(file_path.read_text(encoding='utf-8'))
            except Exception:
                continue
            tid = tournament.get('tournament_group_id') or tournament.get('id') or tournament.get('order')
            if tid is None:
                continue
            index[str(tid)] = tournament

        self._atp_tournament_index = index
        return index

    def _build_atp_bracket_from_files(self, tournament_id):
        index = self._load_atp_tournaments_index()
        tournament = index.get(str(tournament_id))
        if not tournament:
            return None

        bracket = tournament.get('bracket') or {}
        if isinstance(bracket, dict) and bracket.get('matches'):
            payload = dict(bracket)
            payload.setdefault('tournament_id', tournament.get('tournament_group_id') or tournament.get('id') or tournament_id)
            payload.setdefault('tournament_name', tournament.get('name') or tournament.get('title') or f'Tournament {tournament_id}')
            payload.setdefault('tournament_category', tournament.get('category') or self._normalize_wta_level(tournament.get('level') or ''))
            payload.setdefault('tournament_surface', tournament.get('surface') or '')
            payload.setdefault('tournament_year', tournament.get('year'))
            payload.setdefault('tournament_status', tournament.get('status') or 'upcoming')
            payload.setdefault('tournament_tour', 'atp')
            payload.setdefault('draw_size', tournament.get('draw_size_singles') or 32)
            payload.setdefault('source', 'atp')
            return payload

        return None

    def _build_wta_bracket_from_files(self, tournament_id):
        index = self._load_wta_tournaments_index()
        tournament = index.get(str(tournament_id))
        if not tournament:
            return None

        matches = tournament.get('matches') or []
        draw = tournament.get('draw') or {}
        draw_size = draw.get('draw_size') or tournament.get('draw_size_singles') or 0
        if not draw_size:
            draw_lines = draw.get('draw_lines') or []
            if draw_lines:
                draw_size = len(draw_lines)
        if not draw_size:
            draw_size = 32

        rankings = self._load_wta_rankings_csv()
        rank_map = {}
        for player in rankings or []:
            norm = self._normalize_player_name(player.get('name') or '')
            if norm and player.get('rank'):
                rank_map[norm] = player.get('rank')

        # Seed lookup from draw lines
        seed_map = {}
        for line in draw.get('draw_lines') or []:
            player = line.get('player') or {}
            pid = player.get('id')
            seed = line.get('seed')
            if pid and seed:
                seed_map[str(pid)] = seed

        def round_labels_for_draw(size):
            if size >= 128:
                return ['R128', 'R64', 'R32', 'R16']
            if size >= 64:
                return ['R64', 'R32', 'R16']
            if size >= 48:
                return ['R64', 'R32', 'R16']
            if size >= 32:
                return ['R32', 'R16']
            if size >= 16:
                return ['R16']
            return []

        # Build round mapping
        numeric_rounds = sorted({int(r) for r in [m.get('round_id') for m in matches] if isinstance(r, str) and r.isdigit()})
        labels = round_labels_for_draw(draw_size)
        round_map = {}
        for idx, rid in enumerate(numeric_rounds):
            if idx < len(labels):
                round_map[str(rid)] = labels[idx]
            else:
                round_map[str(rid)] = f"R{max(2, draw_size // (2 ** idx))}"
        round_map['Q'] = 'QF'
        round_map['S'] = 'SF'
        round_map['F'] = 'F'
        round_map['R'] = 'RR'
        round_map['RR'] = 'RR'

        def _short_name(name):
            if not name:
                return ''
            parts = name.strip().split()
            if len(parts) >= 2:
                return f"{parts[0][0]}. {parts[-1]}"
            return name

        def _winner_tb(loser_tb):
            try:
                loser_val = int(loser_tb)
            except Exception:
                return None
            return max(7, loser_val + 2)

        def parse_sets(score_string):
            if score_string is None or score_string == '':
                return []
            normalized = str(score_string).replace(",", " ").strip()
            parts = normalized.split()
            rebuilt = []
            for part in parts:
                match = re.match(r"^(\d)(\d)(\(\d+\))?$", part)
                if match:
                    rebuilt.append(f"{match.group(1)}-{match.group(2)}{match.group(3) or ''}")
                else:
                    rebuilt.append(part)
            normalized = " ".join(rebuilt)
            tokens = re.findall(r"(\d+)-(\d+)(?:\((\d+)\))?", normalized)
            sets = []
            for a, b, tb in tokens:
                entry = {'p1': int(a), 'p2': int(b)}
                if tb:
                    winner_tb = _winner_tb(tb)
                    if winner_tb is not None:
                        if int(a) > int(b):
                            entry['tiebreak'] = {'p1': winner_tb, 'p2': int(tb)}
                        else:
                            entry['tiebreak'] = {'p1': int(tb), 'p2': winner_tb}
                sets.append(entry)
            return sets

        def _align_sets_to_side(sets, winner_side):
            if not sets or winner_side not in ('A', 'B'):
                return sets
            p1_sets = sum(1 for s in sets if s['p1'] > s['p2'])
            p2_sets = sum(1 for s in sets if s['p2'] > s['p1'])
            winner = 'A' if p1_sets > p2_sets else 'B' if p2_sets > p1_sets else None
            if winner and winner != winner_side:
                swapped = []
                for s in sets:
                    entry = {'p1': s['p2'], 'p2': s['p1']}
                    if s.get('tiebreak'):
                        entry['tiebreak'] = {
                            'p1': s['tiebreak'].get('p2'),
                            'p2': s['tiebreak'].get('p1')
                        }
                    swapped.append(entry)
                return swapped
            return sets

        def add_player_details(player):
            if not player:
                return None
            name = player.get('name') or ''
            entry = self._match_wta_scraped(name)
            image_url = entry.get('profile', {}).get('image_url') if entry else None
            pid = player.get('id')
            seed = seed_map.get(str(pid))
            norm_name = self._normalize_player_name(name)
            rank = rank_map.get(norm_name)
            display_name = _short_name(name)
            if not seed and rank:
                seed = rank
            return {
                'id': pid,
                'name': name,
                'display_name': display_name,
                'country': player.get('country'),
                'seed': seed,
                'rank': rank,
                'image_url': image_url
            }

        def _build_round_maps(breakdown):
            points_map = {}
            prize_map = {}
            for place in breakdown or []:
                name = (place.get('name') or '').lower()
                points = place.get('points')
                prize = place.get('prize')
                round_key = None
                if 'winner' in name:
                    round_key = 'W'
                elif 'final' in name and 'semi' not in name:
                    round_key = 'F'
                elif 'semi' in name:
                    round_key = 'SF'
                elif 'quarter' in name:
                    round_key = 'QF'
                elif 'round of 16' in name:
                    round_key = 'R16'
                elif 'round of 32' in name:
                    round_key = 'R32'
                elif 'round of 64' in name:
                    round_key = 'R64'
                elif 'round of 128' in name:
                    round_key = 'R128'

                if round_key:
                    if points is not None:
                        points_map[round_key] = points
                    if prize:
                        prize_map[round_key] = prize
            return points_map, prize_map

        round_points, round_prize = _build_round_maps(draw.get('breakdown') or [])

        draw_results = draw.get('results') or []

        def _parse_date(value):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except Exception:
                return None

        def _tournament_status():
            status_raw = (tournament.get('status') or '').lower()
            if status_raw in ['past', 'completed', 'complete', 'finished']:
                return 'finished'
            if status_raw in ['current', 'in_progress', 'in progress', 'live', 'running']:
                return 'in_progress'
            start_dt = _parse_date(tournament.get('start_date') or '')
            end_dt = _parse_date(tournament.get('end_date') or '')
            today = datetime.now().date()
            if start_dt and end_dt:
                if end_dt < today:
                    return 'finished'
                if start_dt <= today <= end_dt:
                    return 'in_progress'
                return 'upcoming'
            return 'upcoming'
        champion_info = tournament.get('champion') or {}
        champion_name = champion_info.get('name') if isinstance(champion_info, dict) else None
        champion_entry = self._match_wta_scraped(champion_name) if champion_name else None
        champion = None
        if champion_name:
            champion = {
                'name': champion_name,
                'country': champion_info.get('country'),
                'image_url': champion_entry.get('profile', {}).get('image_url') if champion_entry else None
            }
        if draw_results:
            full_rounds = []
            if draw_size >= 128:
                full_rounds = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F']
            elif draw_size >= 64 or draw_size >= 48:
                full_rounds = ['R64', 'R32', 'R16', 'QF', 'SF', 'F']
            elif draw_size >= 32:
                full_rounds = ['R32', 'R16', 'QF', 'SF', 'F']
            elif draw_size >= 16:
                full_rounds = ['R16', 'QF', 'SF', 'F']
            else:
                full_rounds = ['QF', 'SF', 'F']

            round_ids = [r.get('round_id') for r in draw_results if r.get('round_id') is not None]
            def _round_sort(val):
                try:
                    return int(val)
                except Exception:
                    return 0
            ordered_round_ids = sorted(set(round_ids), key=_round_sort, reverse=True)
            round_map = {}
            for idx, rid in enumerate(ordered_round_ids):
                if idx < len(full_rounds):
                    round_map[str(rid)] = full_rounds[idx]

            bracket_matches = []
            for round_block in draw_results:
                round_id = round_block.get('round_id')
                round_label = round_map.get(str(round_id))
                if not round_label:
                    continue
                round_matches = []
                matches_list = round_block.get('matches') or []
                def _match_sort_key(item):
                    match_id = item.get('id') if isinstance(item, dict) else ''
                    nums = re.findall(r"(\\d+)", match_id or '')
                    return int(nums[-1]) if nums else 0
                matches_list = sorted(matches_list, key=_match_sort_key)

                for idx, match in enumerate(matches_list, start=1):
                    players = match.get('players') or []
                    player_a = players[0] if len(players) > 0 else {}
                    player_b = players[1] if len(players) > 1 else {}

                    def _to_player(slot):
                        p = slot.get('player') if isinstance(slot, dict) else None
                        if not isinstance(p, dict):
                            return None
                        return {
                            'id': p.get('id') or None,
                            'name': " ".join([p.get('first_name') or '', p.get('last_name') or '']).strip() or slot.get('display') or 'TBD',
                            'country': p.get('country') or None
                        }

                    p1 = _to_player(player_a)
                    p2 = _to_player(player_b)
                    def _normalize_bye(player):
                        if not player:
                            return player
                        name = (player.get('name') or '').lower()
                        if 'bye' in name:
                            player['name'] = 'Bye'
                        return player
                    p1 = _normalize_bye(p1)
                    p2 = _normalize_bye(p2)

                    p1 = add_player_details(p1 or {})
                    p2 = add_player_details(p2 or {})

                    score_text = match.get('result_score')
                    score_sets = parse_sets(score_text)

                    score_sets = _align_sets_to_side(score_sets, match.get('winner_slot'))
                    status = 'scheduled'
                    if score_sets or match.get('winner_slot'):
                        status = 'finished'

                    def _decide_winner_slot(match_obj, sets):
                        slot = match_obj.get('winner_slot')
                        if slot in ('A', 'B'):
                            return slot
                        if not sets:
                            return None
                        p1_sets = sum(1 for s in sets if s['p1'] > s['p2'])
                        p2_sets = sum(1 for s in sets if s['p2'] > s['p1'])
                        if p1_sets > p2_sets:
                            return 'A'
                        if p2_sets > p1_sets:
                            return 'B'
                        return None

                    winner_slot = _decide_winner_slot(match, score_sets)
                    winner = None
                    if winner_slot == 'A':
                        winner = p1
                    elif winner_slot == 'B':
                        winner = p2

                    round_matches.append({
                        'id': match.get('id') or f"{round_label}_{idx}",
                        'round': round_label,
                        'match_number': idx,
                        'player1': p1,
                        'player2': p2,
                        'score': {'sets': score_sets} if score_sets else None,
                        'status': status,
                        'points': round_points.get(round_label),
                        'prize_money': round_prize.get(round_label),
                        'winner': winner
                    })
                bracket_matches.append({'round': round_label, 'matches': round_matches})

            def _build_match_from_scores(match_obj, round_label, idx):
                player1 = add_player_details(match_obj.get('player_a') or {})
                player2 = add_player_details(match_obj.get('player_b') or {})
                score_sets = parse_sets(match_obj.get('score_string') or '')
                score_sets = _align_sets_to_side(score_sets, match_obj.get('winner_side') or match_obj.get('winner_slot'))
                status = 'scheduled'
                if match_obj.get('match_state') == 'F':
                    status = 'finished'
                elif match_obj.get('match_state') in ['L', 'IP', 'P']:
                    status = 'live'
                winner = None
                winner_side = match_obj.get('winner_side') or match_obj.get('winner_slot')
                if winner_side == 'A':
                    winner = player1
                elif winner_side == 'B':
                    winner = player2
                elif status == 'finished' and score_sets:
                    p1_sets = sum(1 for s in score_sets if s['p1'] > s['p2'])
                    p2_sets = sum(1 for s in score_sets if s['p2'] > s['p1'])
                    if p1_sets > p2_sets:
                        winner = player1
                    elif p2_sets > p1_sets:
                        winner = player2
                return {
                    'id': match_obj.get('match_id') or f"{round_label}_{idx}",
                    'round': round_label,
                    'match_number': idx,
                    'player1': player1,
                    'player2': player2,
                    'score': {'sets': score_sets} if score_sets else None,
                    'status': status,
                    'points': round_points.get(round_label),
                    'prize_money': round_prize.get(round_label),
                    'winner': winner
                }

            final_round = next((r for r in bracket_matches if r.get('round') == 'F'), None)
            if not final_round or not final_round.get('matches'):
                finals = [
                    m for m in matches
                    if m.get('round_id') == 'F' and m.get('draw_match_type') == 'S'
                ]
                if finals:
                    final_match = _build_match_from_scores(finals[0], 'F', 1)
                    if final_round:
                        final_round['matches'] = [final_match]
                    else:
                        bracket_matches.append({'round': 'F', 'matches': [final_match]})

            return {
                'tournament_id': tournament_id,
                'tournament_name': tournament.get('name') or tournament.get('title') or f'Tournament {tournament_id}',
                'tournament_category': self._normalize_wta_level(tournament.get('level') or ''),
                'tournament_surface': tournament.get('surface') or '',
                'tournament_year': tournament.get('year'),
                'tournament_status': _tournament_status(),
                'tournament_tour': 'wta',
                'draw_size': draw_size,
                'rounds': [r['round'] for r in bracket_matches],
                'matches': bracket_matches,
                'round_points': round_points,
                'round_prize': round_prize,
                'champion': champion,
                'source': 'wta'
            }

        filtered = []
        for match in matches:
            if match.get('draw_match_type') != 'S':
                continue
            if match.get('draw_level_type') and match.get('draw_level_type') != 'M':
                continue
            filtered.append(match)

        if not filtered:
            return {
                'tournament_id': tournament_id,
                'tournament_name': tournament.get('name') or tournament.get('title') or f'Tournament {tournament_id}',
                'tournament_category': self._normalize_wta_level(tournament.get('level') or ''),
                'tournament_surface': tournament.get('surface') or '',
                'tournament_year': tournament.get('year'),
                'tournament_status': _tournament_status(),
                'tournament_tour': 'wta',
                'draw_size': draw_size,
                'rounds': [],
                'matches': [],
                'source': 'wta'
            }

        grouped = {}
        for match in filtered:
            round_id = match.get('round_id')
            round_label = round_map.get(str(round_id))
            if not round_label:
                continue
            grouped.setdefault(round_label, []).append(match)

        rounds_order = [label for label in labels if label in grouped]
        if 'QF' in grouped:
            rounds_order.append('QF')
        if 'SF' in grouped:
            rounds_order.append('SF')
        if 'F' in grouped:
            rounds_order.append('F')
        if 'RR' in grouped:
            rounds_order = ['RR'] + [r for r in rounds_order if r != 'RR']

        bracket_matches = []
        for round_label in rounds_order:
            round_matches = []
            for idx, match in enumerate(sorted(grouped.get(round_label, []), key=lambda m: m.get('match_id') or ''), start=1):
                player1 = add_player_details(match.get('player_a') or {})
                player2 = add_player_details(match.get('player_b') or {})
                score_sets = parse_sets(match.get('score_string') or '')
                score_sets = _align_sets_to_side(score_sets, match.get('winner_side'))
                status = 'scheduled'
                if match.get('match_state') == 'F':
                    status = 'finished'
                elif match.get('match_state') in ['L', 'IP', 'P']:
                    status = 'live'
                winner = None
                if match.get('winner_side') == 'A':
                    winner = player1
                elif match.get('winner_side') == 'B':
                    winner = player2
                elif status == 'finished' and score_sets:
                    p1_sets = sum(1 for s in score_sets if s['p1'] > s['p2'])
                    p2_sets = sum(1 for s in score_sets if s['p2'] > s['p1'])
                    if p1_sets > p2_sets:
                        winner = player1
                    elif p2_sets > p1_sets:
                        winner = player2
                round_matches.append({
                    'id': match.get('match_id') or f"{round_label}_{idx}",
                    'round': round_label,
                    'match_number': idx,
                    'player1': player1,
                    'player2': player2,
                    'score': {'sets': score_sets} if score_sets else None,
                    'status': status,
                    'points': round_points.get(round_label),
                    'prize_money': round_prize.get(round_label),
                    'winner': winner
                })
            bracket_matches.append({'round': round_label, 'matches': round_matches})

        return {
            'tournament_id': tournament_id,
            'tournament_name': tournament.get('name') or tournament.get('title') or f'Tournament {tournament_id}',
            'tournament_category': self._normalize_wta_level(tournament.get('level') or ''),
            'tournament_surface': tournament.get('surface') or '',
            'tournament_year': tournament.get('year'),
            'tournament_status': _tournament_status(),
            'tournament_tour': 'wta',
            'draw_size': draw_size,
            'rounds': rounds_order,
            'matches': bracket_matches,
            'round_points': round_points,
            'round_prize': round_prize,
            'champion': champion,
            'source': 'wta'
        }

    def _normalize_wta_level(self, level):
        upper = (level or "").upper()
        if "GRAND SLAM" in upper:
            return 'grand_slam'
        if "1000" in upper:
            return 'masters_1000'
        if "500" in upper:
            return 'atp_500'
        if "250" in upper:
            return 'atp_250'
        if "125" in upper:
            return 'atp_125'
        if "FINALS" in upper:
            return 'finals'
        return 'other'

    def _load_wta_tournaments_from_files(self, year):
        base_dir = Path(__file__).resolve().parent.parent / 'data' / 'wta' / 'tournaments'
        if not base_dir.exists():
            return []

        def _normalize_level(level, name):
            upper = (level or "").upper()
            if "GRAND SLAM" in upper or (name in Config.GRAND_SLAMS):
                return 'grand_slam'
            if "1000" in upper:
                return 'masters_1000'
            if "500" in upper:
                return 'atp_500'
            if "250" in upper:
                return 'atp_250'
            if "125" in upper:
                return 'atp_125'
            if "FINAL" in upper or "FINALS" in upper or "WTA FINALS" in (name or "").upper():
                return 'finals'
            return 'other'

        def _title_case(value):
            if not value:
                return ''
            if value.isupper():
                return value.title()
            return value

        def _parse_date(value):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except Exception:
                return None

        today = datetime.now().date()
        tournaments = []
        files = sorted(base_dir.glob("*.json"))
        for file_path in files:
            try:
                tournament = json.loads(file_path.read_text(encoding='utf-8'))
            except Exception:
                continue

            if year and tournament.get('year') and tournament.get('year') != year:
                continue

            title = tournament.get('title') or ''
            if ' - ' in title:
                name = title.split(' - ')[0].strip()
            else:
                name = tournament.get('name') or title or 'Tournament'
            name = self._clean_tournament_name(name)
            name = _title_case(name)
            level = tournament.get('level') or ''
            category = _normalize_level(level, name)

            start_date = tournament.get('start_date') or ''
            end_date = tournament.get('end_date') or ''
            start_dt = _parse_date(start_date)
            end_dt = _parse_date(end_date)

            status_raw = (tournament.get('status') or '').lower()
            if status_raw in ['past', 'completed', 'complete', 'finished']:
                status = 'finished'
            elif status_raw in ['current', 'in_progress', 'in progress', 'live', 'running']:
                status = 'in_progress'
            else:
                if start_dt and end_dt:
                    if end_dt < today:
                        status = 'finished'
                    elif start_dt <= today <= end_dt:
                        status = 'in_progress'
                    else:
                        status = 'upcoming'
                else:
                    status = 'upcoming'

            city = _title_case(tournament.get('city'))
            country = _title_case(tournament.get('country'))
            location = ", ".join([p for p in [city, country] if p])

            surface = tournament.get('surface') or ''
            if tournament.get('indoor_outdoor') == 'I' and surface and 'Indoor' not in surface:
                surface = f"{surface} (Indoor)"

            champion = tournament.get('champion') or {}
            runner_up = tournament.get('runner_up') or {}

            tournaments.append({
                'id': tournament.get('tournament_group_id') or tournament.get('order'),
                'name': name,
                'category': category,
                'location': location or tournament.get('title', ''),
                'start_date': start_date,
                'end_date': end_date,
                'surface': surface or 'Hard',
                'status': status,
                'year': tournament.get('year'),
                'winner': {
                    'name': champion.get('name'),
                    'country': champion.get('country')
                } if champion else None,
                'runner_up': {
                    'name': runner_up.get('name'),
                    'country': runner_up.get('country')
                } if runner_up else None,
            })

        tournaments.sort(key=lambda x: x.get('start_date') or '')
        return tournaments

    def _load_atp_tournaments_from_files(self, year):
        base_dir = self._tour_tournaments_dir('atp')
        if not base_dir.exists():
            return []

        def _parse_date(value):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except Exception:
                return None

        today = datetime.now().date()
        tournaments = []
        files = sorted(base_dir.glob("*.json"))
        for file_path in files:
            try:
                tournament = json.loads(file_path.read_text(encoding='utf-8'))
            except Exception:
                continue

            record_year = tournament.get('year')
            if year and record_year and int(record_year) != int(year):
                continue

            start_date = tournament.get('start_date') or ''
            end_date = tournament.get('end_date') or ''
            start_dt = _parse_date(start_date)
            end_dt = _parse_date(end_date)

            status_raw = str(tournament.get('status') or '').strip().lower()
            if status_raw in {'past', 'completed', 'complete', 'finished'}:
                status = 'finished'
            elif status_raw in {'current', 'in_progress', 'in progress', 'live', 'running'}:
                status = 'in_progress'
            else:
                if start_dt and end_dt:
                    if end_dt < today:
                        status = 'finished'
                    elif start_dt <= today <= end_dt:
                        status = 'in_progress'
                    else:
                        status = 'upcoming'
                else:
                    status = 'upcoming'

            category = tournament.get('category') or self._normalize_wta_level(tournament.get('level') or '')
            surface = tournament.get('surface') or 'Hard'
            if str(tournament.get('indoor_outdoor') or '').strip().upper().startswith('I') and 'Indoor' not in surface:
                surface = f"{surface} (Indoor)"

            champion = tournament.get('champion') or {}
            runner_up = tournament.get('runner_up') or {}
            location = tournament.get('location')
            if not location:
                city = (tournament.get('city') or '').strip()
                country = (tournament.get('country') or '').strip()
                location = ", ".join([part for part in [city, country] if part])

            tournaments.append({
                'id': tournament.get('tournament_group_id') or tournament.get('id') or tournament.get('order'),
                'name': tournament.get('name') or tournament.get('title') or 'Tournament',
                'category': category,
                'location': location or '',
                'start_date': start_date,
                'end_date': end_date,
                'surface': surface,
                'status': status,
                'year': tournament.get('year'),
                'winner': {
                    'name': champion.get('name'),
                    'country': champion.get('country')
                } if isinstance(champion, dict) and champion.get('name') else None,
                'runner_up': {
                    'name': runner_up.get('name'),
                    'country': runner_up.get('country')
                } if isinstance(runner_up, dict) and runner_up.get('name') else None,
            })

        tournaments.sort(key=lambda x: x.get('start_date') or '')
        return tournaments
    
    # Sample data generators (would be replaced with real API calls)
    
    def _generate_sample_live_matches(self, tour):
        """Generate sample live matches data"""
        atp_players = self._get_sample_atp_players()
        wta_players = self._get_sample_wta_players()
        
        atp_tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam', 'location': 'Melbourne, Australia'},
            {'name': 'Indian Wells Masters', 'category': 'masters_1000', 'location': 'Indian Wells, USA'},
            {'name': 'Dubai Tennis Championships', 'category': 'atp_500', 'location': 'Dubai, UAE'},
        ]
        wta_tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam', 'location': 'Melbourne, Australia'},
            {'name': 'Qatar Open', 'category': 'masters_1000', 'location': 'Doha, Qatar'},
            {'name': 'Dubai Championships', 'category': 'masters_1000', 'location': 'Dubai, UAE'},
        ]
        
        matches = []
        
        if tour in ['atp', 'both']:
            for i in range(3):
                p1 = atp_players[i * 2]
                p2 = atp_players[i * 2 + 1]
                tournament = atp_tournaments[i % len(atp_tournaments)]
                best_of = self._get_best_of('ATP', tournament['category'])
                
                matches.append({
                    'id': f'atp_live_{i}',
                    'tour': 'ATP',
                    'tournament': tournament['name'],
                    'tournament_category': tournament['category'],
                    'location': tournament['location'],
                    'round': ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'][random.randint(3, 6)],
                    'court': f'Court {random.randint(1, 3)}',
                    'player1': p1,
                    'player2': p2,
                    'score': self._generate_live_score(best_of=best_of),
                    'status': 'live',
                    'serving': random.choice([1, 2]),
                    'start_time': datetime.now().strftime('%H:%M')
                })
        
        if tour in ['wta', 'both']:
            for i in range(3):
                p1 = wta_players[i * 2]
                p2 = wta_players[i * 2 + 1]
                tournament = wta_tournaments[i % len(wta_tournaments)]
                best_of = self._get_best_of('WTA', tournament['category'])
                
                matches.append({
                    'id': f'wta_live_{i}',
                    'tour': 'WTA',
                    'tournament': tournament['name'],
                    'tournament_category': tournament['category'],
                    'location': tournament['location'],
                    'round': ['R64', 'R32', 'R16', 'QF', 'SF', 'F'][random.randint(2, 5)],
                    'court': f'Court {random.randint(1, 3)}',
                    'player1': p1,
                    'player2': p2,
                    'score': self._generate_live_score(best_of=best_of),
                    'status': 'live',
                    'serving': random.choice([1, 2]),
                    'start_time': datetime.now().strftime('%H:%M')
                })
        
        return matches
    
    def _generate_live_score(self, best_of=5):
        """Generate a realistic live score"""
        sets = []
        p1_sets = 0
        p2_sets = 0
        max_sets = best_of // 2 + 1
        
        # Generate completed sets
        num_completed = random.randint(0, max_sets - 1)
        for _ in range(num_completed):
            if random.random() > 0.5:
                if random.random() > 0.3:
                    set_score = {'p1': 6, 'p2': random.randint(0, 4)}
                else:
                    set_score = {'p1': 7, 'p2': random.choice([5, 6])}
                p1_sets += 1
            else:
                if random.random() > 0.3:
                    set_score = {'p1': random.randint(0, 4), 'p2': 6}
                else:
                    set_score = {'p1': random.choice([5, 6]), 'p2': 7}
                p2_sets += 1
            is_decider = (p1_sets == max_sets) or (p2_sets == max_sets)
            sets.append(self._apply_tiebreak(set_score, is_decider))
        
        # Current set
        if p1_sets < max_sets and p2_sets < max_sets:
            current_set = {
                'p1': random.randint(0, 5),
                'p2': random.randint(0, 5)
            }
            sets.append(current_set)
        
        # Current game score
        game_points = ['0', '15', '30', '40', 'AD']
        current_game = {
            'p1': game_points[random.randint(0, 3)],
            'p2': game_points[random.randint(0, 3)]
        }
        
        return {
            'sets': sets,
            'current_game': current_game,
            'p1_sets': p1_sets,
            'p2_sets': p2_sets
        }

    def _apply_tiebreak(self, set_score, is_decider=False):
        """Attach tiebreak scores for 7-6/6-7 sets."""
        if not set_score:
            return set_score
        p1 = set_score.get('p1')
        p2 = set_score.get('p2')
        if (p1, p2) == (7, 6):
            if is_decider:
                set_score['tiebreak'] = {'p1': 10, 'p2': random.choice([8, 9])}
            else:
                set_score['tiebreak'] = {'p1': 7, 'p2': random.choice([4, 5, 6])}
        elif (p1, p2) == (6, 7):
            if is_decider:
                set_score['tiebreak'] = {'p1': random.choice([8, 9]), 'p2': 10}
            else:
                set_score['tiebreak'] = {'p1': random.choice([4, 5, 6]), 'p2': 7}
        return set_score

    def _get_best_of(self, tour_name, category):
        """Determine best-of format."""
        tour = (tour_name or '').upper()
        if tour == 'ATP' and category == 'grand_slam':
            return 5
        return 3
    
    def _generate_sample_recent_matches(self, tour, limit):
        """Generate sample recently completed matches"""
        matches = []
        atp_players = self._get_sample_atp_players()
        wta_players = self._get_sample_wta_players()
        
        atp_tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam'},
            {'name': 'Rotterdam Open', 'category': 'atp_500'},
            {'name': 'Qatar Open', 'category': 'atp_250'},
        ]
        wta_tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam'},
            {'name': 'Qatar Open', 'category': 'masters_1000'},
            {'name': 'Doha Open', 'category': 'atp_500'},
        ]
        
        for i in range(limit):
            if tour == 'atp' or (tour == 'both' and i % 2 == 0):
                players = atp_players
                tour_name = 'ATP'
            else:
                players = wta_players
                tour_name = 'WTA'
            
            p1_idx = random.randint(0, len(players) - 1)
            p2_idx = random.randint(0, len(players) - 1)
            while p2_idx == p1_idx:
                p2_idx = random.randint(0, len(players) - 1)
            
            tournament = random.choice(atp_tournaments if tour_name == 'ATP' else wta_tournaments)
            best_of = self._get_best_of(tour_name, tournament['category'])
            final_score = self._generate_final_score(best_of=best_of)
            winner = 1 if final_score['p1_sets'] > final_score['p2_sets'] else 2
            
            matches.append({
                'id': f'recent_{i}',
                'tour': tour_name,
                'tournament': tournament['name'],
                'tournament_category': tournament['category'],
                'round': random.choice(['R32', 'R16', 'QF', 'SF', 'F']),
                'player1': players[p1_idx],
                'player2': players[p2_idx],
                'winner': winner,
                'final_score': final_score,
                'status': 'finished',
                'end_time': (datetime.now() - timedelta(hours=random.randint(1, 24))).strftime('%Y-%m-%d %H:%M')
            })
        
        return matches
    
    def _generate_sample_upcoming_matches(self, tour, days=2):
        """Generate sample upcoming matches for the next N days"""
        matches = []
        
        # Use actual ranking data for ATP players
        if tour == 'atp':
            atp_rankings = self._get_atp_rankings()
            if len(atp_rankings) >= 10:
                atp_players = atp_rankings[:10]
            else:
                atp_players = self._get_sample_atp_players()
        else:
            atp_players = []
        
        # Use WTA players
        wta_players = self._get_sample_wta_players()
        
        atp_tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam'},
            {'name': 'Rotterdam Open', 'category': 'atp_500'},
            {'name': 'Dubai Championships', 'category': 'atp_500'},
            {'name': 'Qatar Open', 'category': 'atp_250'},
        ]
        wta_tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam'},
            {'name': 'Qatar Open', 'category': 'masters_1000'},
            {'name': 'Dubai Championships', 'category': 'masters_1000'},
            {'name': 'Abu Dhabi Open', 'category': 'atp_500'},
        ]
        
        # Generate 2-4 upcoming matches
        for i in range(random.randint(2, 4)):
            if tour == 'atp':
                players = atp_players
                tour_name = 'ATP'
                tournaments = atp_tournaments
            elif tour == 'wta':
                players = wta_players
                tour_name = 'WTA'
                tournaments = wta_tournaments
            else:
                # Both
                if i % 2 == 0:
                    players = atp_players
                    tour_name = 'ATP'
                    tournaments = atp_tournaments
                else:
                    players = wta_players
                    tour_name = 'WTA'
                    tournaments = wta_tournaments
            
            if len(players) < 2:
                continue
                
            p1_idx = random.randint(0, len(players) - 1)
            p2_idx = random.randint(0, len(players) - 1)
            while p2_idx == p1_idx:
                p2_idx = random.randint(0, len(players) - 1)
            
            tournament = random.choice(tournaments)
            scheduled_time = datetime.now() + timedelta(hours=random.randint(1, days * 24))
            
            matches.append({
                'id': f'upcoming_{tour_name}_{i}',
                'tour': tour_name,
                'tournament': tournament['name'],
                'tournament_category': tournament['category'],
                'round': random.choice(['R32', 'R16', 'QF', 'SF', 'F']),
                'player1': dict(players[p1_idx]),
                'player2': dict(players[p2_idx]),
                'scheduled_time': scheduled_time.isoformat() + 'Z'
            })
        
        return matches
    
    def _generate_final_score(self, best_of=5):
        """Generate a realistic final score"""
        sets = []
        p1_sets = 0
        p2_sets = 0
        max_sets = best_of // 2 + 1
        
        while p1_sets < max_sets and p2_sets < max_sets:
            if random.random() > 0.5:
                if random.random() > 0.3:
                    set_score = {'p1': 6, 'p2': random.randint(0, 4)}
                else:
                    set_score = {'p1': 7, 'p2': random.choice([5, 6])}
                p1_sets += 1
            else:
                if random.random() > 0.3:
                    set_score = {'p1': random.randint(0, 4), 'p2': 6}
                else:
                    set_score = {'p1': random.choice([5, 6]), 'p2': 7}
                p2_sets += 1
            is_decider = (p1_sets == max_sets) or (p2_sets == max_sets)
            sets.append(self._apply_tiebreak(set_score, is_decider))
        
        return {'sets': sets, 'p1_sets': p1_sets, 'p2_sets': p2_sets}
    
    def _generate_sample_rankings(self, tour, limit):
        """Generate sample rankings"""
        if tour == 'atp':
            players = self._get_full_atp_rankings()
        else:
            players = self._get_full_wta_rankings()
        
        return players[:limit]

    def _load_wta_rankings_csv(self):
        """Load WTA rankings from CSV created by live-tennis.eu scraper."""
        csv_path = self._wta_rankings_csv_path()
        if not csv_path.exists():
            return None

        scraped_index = self._load_wta_scraped_index()
        connections = self._load_wta_connections_map()
        used_ids = set()
        rankings = []
        with csv_path.open('r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rank_raw = (row.get('rank') or '').strip()
                if not rank_raw.isdigit():
                    continue
                rank = int(rank_raw)
                name = (row.get('player') or '').strip()
                if not name:
                    continue
                norm_name = self._normalize_player_name(name)

                scraped = self._match_wta_scraped(name)
                profile_data = scraped.get('profile') if scraped else {}
                stats_data = scraped.get('stats') if scraped else {}
                scraped_player_id = (scraped or {}).get('player_id')

                resolved_id = None
                source_player_id = None
                if scraped_player_id is not None:
                    try:
                        resolved_id = int(scraped_player_id)
                        source_player_id = resolved_id
                    except Exception:
                        resolved_id = None
                if resolved_id is None and norm_name:
                    known_entry = (scraped_index.get('by_full') or {}).get(norm_name)
                    known_pid = (known_entry or {}).get('player_id')
                    if known_pid is not None:
                        try:
                            resolved_id = int(known_pid)
                            source_player_id = resolved_id
                        except Exception:
                            resolved_id = None
                if resolved_id is None and norm_name:
                    conn_entry = (connections.get('by_norm') or {}).get(norm_name) or {}
                    conn_pid = conn_entry.get('player_id')
                    if conn_pid is not None:
                        try:
                            resolved_id = int(conn_pid)
                            source_player_id = resolved_id
                        except Exception:
                            resolved_id = None
                if resolved_id is None:
                    resolved_id = self._stable_player_id_from_name(norm_name, used_ids)
                elif resolved_id in used_ids:
                    resolved_id = self._stable_player_id_from_name(f"{norm_name}-{rank}", used_ids)
                else:
                    used_ids.add(resolved_id)

                points_raw = re.sub(r'[^\d]', '', row.get('points') or '')
                points = int(points_raw) if points_raw else 0
                age_raw = re.sub(r'[^\d]', '', row.get('age') or '')
                age = int(age_raw) if age_raw else None
                if age is None:
                    profile_age = re.sub(r'[^\d]', '', str(profile_data.get('age') or ''))
                    age = int(profile_age) if profile_age else None

                ch_raw = re.sub(r'[^\d]', '', row.get('career_high') or '')
                career_high = int(ch_raw) if ch_raw else rank
                at_ch = (row.get('at_career_high') or '').strip().lower() == 'yes'
                is_new_ch = (row.get('is_new_career_high') or '').strip().lower() == 'yes'

                rank_change_raw = row.get('rank_change') or ''
                rank_change_clean = re.sub(r'[^-\d]', '', rank_change_raw)
                rank_change = int(rank_change_clean) if rank_change_clean else 0

                current_raw = (row.get('current') or '').strip()
                points_change = 0
                if re.match(r'^[+-]\d+$', current_raw):
                    points_change = int(current_raw)

                # If rank change looks like points change, move it over
                if abs(rank_change) >= 100:
                    if points_change == 0:
                        points_change = rank_change
                    rank_change = 0

                movement = rank_change

                country = (row.get('country') or '').strip() or profile_data.get('country') or 'WHITE'
                is_playing = (row.get('is_playing') or '').strip().lower() == 'yes'

                image_url = f"/api/player/wta/{resolved_id}/image" if resolved_id else (profile_data.get('image_url') or '')

                height = profile_data.get('height') or ''
                plays = profile_data.get('plays') or ''
                prize_money = stats_data.get('prize_money') or ''
                singles_titles = stats_data.get('singles_titles') or ''
                records_tab = stats_data.get('records_tab') or {}
                records = records_tab.get('yearly') or stats_data.get('records') or []
                records_summary = records_tab.get('summary') or []

                rankings.append({
                    'rank': rank,
                    'id': resolved_id,
                    'name': name,
                    'country': country,
                    'age': age,
                    'points': points,
                    'career_high': career_high,
                    'is_career_high': at_ch,
                    'is_new_career_high': is_new_ch,
                    'movement': movement,
                    'rank_change': rank_change,
                    'points_change': points_change,
                    'is_playing': is_playing,
                    'current': (row.get('current') or '').strip(),
                    'previous': (row.get('previous') or '').strip(),
                    'next': (row.get('next') or '').strip(),
                    'max': (row.get('max') or '').strip(),
                    'image_url': image_url,
                    'height': height,
                    'plays': plays,
                    'prize_money': prize_money,
                    'titles': singles_titles,
                    'stats_2026': stats_data,
                    'records': records,
                    'records_summary': records_summary
                })

        return rankings

    def _load_atp_rankings_csv(self):
        """Load ATP rankings from CSV created by live-tennis.eu scraper."""
        csv_path = self._atp_rankings_csv_path()
        if not csv_path.exists():
            return None

        used_ids = set()
        rankings = []
        with csv_path.open('r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rank_raw = (row.get('rank') or '').strip()
                if not rank_raw.isdigit():
                    continue
                rank = int(rank_raw)
                name = (row.get('player') or '').strip()
                if not name:
                    continue
                norm_name = self._normalize_player_name(name)

                scraped = self._match_atp_scraped(name)
                profile_data = scraped.get('profile') if scraped else {}
                stats_data = scraped.get('stats') if scraped else {}

                player_code = (
                    (profile_data.get('player_id') or '').strip()
                    or (scraped.get('player_code') if scraped else '')
                    or ''
                )
                resolved_id = self._stable_player_id_from_name(
                    f"atp:{player_code.lower()}" if player_code else f"atp:{norm_name}",
                    used_ids
                )

                points_raw = re.sub(r'[^\d]', '', row.get('points') or '')
                points = int(points_raw) if points_raw else 0
                age_raw = re.sub(r'[^\d]', '', row.get('age') or '')
                age = int(age_raw) if age_raw else None
                if age is None:
                    profile_age = re.sub(r'[^\d]', '', str(profile_data.get('age') or ''))
                    age = int(profile_age) if profile_age else None

                ch_raw = re.sub(r'[^\d]', '', row.get('career_high') or '')
                career_high = int(ch_raw) if ch_raw else rank
                at_ch = (row.get('at_career_high') or '').strip().lower() == 'yes'
                is_new_ch = (row.get('is_new_career_high') or '').strip().lower() == 'yes'

                rank_change_raw = row.get('rank_change') or ''
                rank_change_clean = re.sub(r'[^-\d]', '', rank_change_raw)
                rank_change = int(rank_change_clean) if rank_change_clean else 0

                current_raw = (row.get('current') or '').strip()
                points_change = 0
                if re.match(r'^[+-]\d+$', current_raw):
                    points_change = int(current_raw)
                if abs(rank_change) >= 100:
                    if points_change == 0:
                        points_change = rank_change
                    rank_change = 0
                movement = rank_change

                country = (row.get('country') or '').strip() or profile_data.get('country') or 'WHITE'
                is_playing = (row.get('is_playing') or '').strip().lower() == 'yes'

                image_url = f"/api/player/atp/{player_code}/image" if player_code else (profile_data.get('image_url') or '')

                height = profile_data.get('height') or ''
                plays = profile_data.get('plays') or ''
                prize_money = stats_data.get('prize_money') or ''
                ytd_prize_money = profile_data.get('ytd_prize_money') or stats_data.get('ytd_prize_money') or ''
                career_prize_money = (
                    profile_data.get('career_prize_money')
                    or stats_data.get('career_prize_money')
                    or stats_data.get('prize_money')
                    or ''
                )
                ytd_won_lost = profile_data.get('ytd_won_lost') or ''
                singles_titles = stats_data.get('singles_titles') or ''

                rankings.append({
                    'rank': rank,
                    'id': resolved_id,
                    'name': name,
                    'player_code': player_code.upper() if player_code else '',
                    'country': country,
                    'age': age,
                    'points': points,
                    'career_high': career_high,
                    'is_career_high': at_ch,
                    'is_new_career_high': is_new_ch,
                    'movement': movement,
                    'rank_change': rank_change,
                    'points_change': points_change,
                    'is_playing': is_playing,
                    'current': (row.get('current') or '').strip(),
                    'previous': (row.get('previous') or '').strip(),
                    'next': (row.get('next') or '').strip(),
                    'max': (row.get('max') or '').strip(),
                    'image_url': image_url,
                    'height': height,
                    'plays': plays,
                    'prize_money': prize_money,
                    'ytd_prize_money': ytd_prize_money,
                    'career_prize_money': career_prize_money,
                    'ytd_won_lost': ytd_won_lost,
                    'titles': singles_titles,
                    'stats_2026': stats_data,
                    'records': [],
                    'records_summary': []
                })

        return rankings
    
    def _get_sample_atp_players(self):
        """Get sample ATP players with real IDs, player codes, and image URLs"""
        players = [
            {'id': 4878, 'name': 'Novak Djokovic', 'country': 'SRB', 'rank': 1, 'player_code': 'D643'},
            {'id': 216431, 'name': 'Carlos Alcaraz', 'country': 'ESP', 'rank': 2, 'player_code': 'A0E2'},
            {'id': 139170, 'name': 'Jannik Sinner', 'country': 'ITA', 'rank': 3, 'player_code': 'S0AG'},
            {'id': 38758, 'name': 'Daniil Medvedev', 'country': 'RUS', 'rank': 4, 'player_code': 'MM58'},
            {'id': 39667, 'name': 'Andrey Rublev', 'country': 'RUS', 'rank': 5, 'player_code': 'RE44'},
            {'id': 40285, 'name': 'Alexander Zverev', 'country': 'GER', 'rank': 6, 'player_code': 'Z355'},
            {'id': 124335, 'name': 'Holger Rune', 'country': 'DEN', 'rank': 7, 'player_code': 'R0DG'},
            {'id': 41379, 'name': 'Stefanos Tsitsipas', 'country': 'GRE', 'rank': 8, 'player_code': 'TE51'},
            {'id': 59642, 'name': 'Hubert Hurkacz', 'country': 'POL', 'rank': 9, 'player_code': 'HB71'},
            {'id': 63343, 'name': 'Casper Ruud', 'country': 'NOR', 'rank': 10, 'player_code': 'RH16'},
        ]
        for player in players:
            player['image_url'] = f'https://api.sofascore.com/api/v1/player/{player["id"]}/image'
        return players
    
    def _get_sample_wta_players(self):
        """Get sample WTA players with current ranking data when available."""
        rankings = self._load_wta_rankings_csv()
        if rankings:
            players = []
            for player in rankings[:10]:
                players.append({
                    'id': player['id'],
                    'name': player['name'],
                    'country': player['country'],
                    'rank': player['rank'],
                    'age': player.get('age'),
                    'points': player.get('points'),
                    'career_high': player.get('career_high'),
                    'is_career_high': player.get('is_career_high'),
                    'image_url': player.get('image_url') or f'https://api.sofascore.com/api/v1/player/{player["id"]}/image'
                })
            return players

        players = [
            {'id': 126388, 'name': 'Iga Swiatek', 'country': 'POL', 'rank': 1},
            {'id': 83528, 'name': 'Aryna Sabalenka', 'country': 'BLR', 'rank': 2},
            {'id': 198151, 'name': 'Coco Gauff', 'country': 'USA', 'rank': 3},
            {'id': 98622, 'name': 'Elena Rybakina', 'country': 'KAZ', 'rank': 4},
            {'id': 56223, 'name': 'Jessica Pegula', 'country': 'USA', 'rank': 5},
            {'id': 47320, 'name': 'Ons Jabeur', 'country': 'TUN', 'rank': 6},
            {'id': 97090, 'name': 'Marketa Vondrousova', 'country': 'CZE', 'rank': 7},
            {'id': 137839, 'name': 'Qinwen Zheng', 'country': 'CHN', 'rank': 8},
            {'id': 42043, 'name': 'Maria Sakkari', 'country': 'GRE', 'rank': 9},
            {'id': 33634, 'name': 'Jelena Ostapenko', 'country': 'LAT', 'rank': 10},
        ]
        for player in players:
            player['image_url'] = f'https://api.sofascore.com/api/v1/player/{player["id"]}/image'
        return players
    
    def _get_full_atp_rankings(self):
        """Generate full ATP rankings (top 200)"""
        top_players = [
            # id, name, country, age, points, career_high, is_career_high
            (4878, 'Novak Djokovic', 'SRB', 36, 11245, 1, True),
            (216431, 'Carlos Alcaraz', 'ESP', 20, 9255, 1, True),
            (139170, 'Jannik Sinner', 'ITA', 22, 8710, 3, True),
            (38758, 'Daniil Medvedev', 'RUS', 27, 7165, 1, False),
            (39667, 'Andrey Rublev', 'RUS', 26, 5110, 5, True),
            (40285, 'Alexander Zverev', 'GER', 26, 5085, 2, False),
            (124335, 'Holger Rune', 'DEN', 20, 4210, 4, False),
            (41379, 'Stefanos Tsitsipas', 'GRE', 25, 4175, 3, False),
            (59642, 'Hubert Hurkacz', 'POL', 26, 3955, 9, True),
            (63343, 'Casper Ruud', 'NOR', 25, 3825, 2, False),
            (59333, 'Taylor Fritz', 'USA', 26, 3505, 11, True),
            (67580, 'Tommy Paul', 'USA', 26, 3170, 12, True),
            (247511, 'Ben Shelton', 'USA', 21, 2920, 13, True),
            (17869, 'Grigor Dimitrov', 'BUL', 32, 2885, 3, False),
            (67581, 'Felix Auger-Aliassime', 'CAN', 23, 2660, 6, False),
            (43187, 'Karen Khachanov', 'RUS', 27, 2605, 8, False),
            (67578, 'Frances Tiafoe', 'USA', 25, 2505, 10, False),
            (56447, 'Ugo Humbert', 'FRA', 25, 2490, 18, True),
            (107537, 'Sebastian Korda', 'USA', 23, 2385, 19, True),
            (60121, 'Nicolas Jarry', 'CHI', 28, 2330, 20, True),
        ]
        
        rankings = []
        for i, (player_id, name, country, age, points, career_high, is_career_high) in enumerate(top_players, 1):
            movement = random.choice([-2, -1, 0, 0, 0, 1, 1, 2])
            rankings.append({
                'rank': i,
                'id': player_id,
                'name': name,
                'country': country,
                'age': age,
                'points': points,
                'career_high': career_high,
                'is_career_high': is_career_high,
                'movement': movement,
                'image_url': f'https://api.sofascore.com/api/v1/player/{player_id}/image'
            })
        
        # Generate remaining players
        countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'ARG', 'AUS', 'GBR', 'JPN', 'KOR']
        first_names = ['Alex', 'Marco', 'Pablo', 'John', 'David', 'Lucas', 'Max', 'Leo', 'Hugo', 'Jack']
        last_names = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis']
        
        for i in range(len(top_players) + 1, 201):
            player_id = i + 5000 # Use a high, random ID
            rankings.append({
                'rank': i,
                'id': player_id,
                'name': f'{random.choice(first_names)} {random.choice(last_names)}',
                'country': random.choice(countries),
                'age': random.randint(19, 35),
                'points': max(100, 2300 - (i * 10) + random.randint(-50, 50)),
                'career_high': random.randint(max(1, i - 50), i),
                'is_career_high': random.random() > 0.9,
                'movement': random.choice([-3, -2, -1, 0, 0, 1, 2, 3]),
                'image_url': f'https://api.sofascore.com/api/v1/player/{player_id}/image'
            })
        
        return rankings
    
    def _get_full_wta_rankings(self):
        """Generate full WTA rankings (top 200)"""
        rankings = self._load_wta_rankings_csv()
        if rankings:
            return rankings[:200]

        top_players = [
            # id, name, country, age, points, career_high, is_career_high
            (126388, 'Iga Swiatek', 'POL', 22, 10715, 1, True),
            (83528, 'Aryna Sabalenka', 'BLR', 25, 8725, 1, True),
            (198151, 'Coco Gauff', 'USA', 19, 6770, 3, True),
            (98622, 'Elena Rybakina', 'KAZ', 24, 5973, 3, True),
            (56223, 'Jessica Pegula', 'USA', 29, 5580, 3, False),
            (47320, 'Ons Jabeur', 'TUN', 29, 4316, 2, False),
            (97090, 'Marketa Vondrousova', 'CZE', 24, 4075, 7, True),
            (137839, 'Qinwen Zheng', 'CHN', 21, 4005, 8, True),
            (42043, 'Maria Sakkari', 'GRE', 28, 3835, 3, False),
            (42043, 'Jelena Ostapenko', 'LAT', 26, 3438, 5, False),
            (68979, 'Daria Kasatkina', 'RUS', 26, 3130, 8, False),
            (24452, 'Madison Keys', 'USA', 28, 2993, 7, False),
            (82992, 'Liudmila Samsonova', 'RUS', 24, 2985, 11, False),
            (82992, 'Beatriz Haddad Maia', 'BRA', 27, 2956, 10, False),
            (88591, 'Karolina Muchova', 'CZE', 27, 2905, 8, False),
            (64951, 'Ekaterina Alexandrova', 'RUS', 29, 2625, 12, False),
            (24438, 'Caroline Garcia', 'FRA', 30, 2605, 4, False),
            (68978, 'Veronika Kudermetova', 'RUS', 26, 2501, 9, False),
            (88589, 'Barbora Krejcikova', 'CZE', 27, 2436, 2, False),
            (242137, 'Emma Navarro', 'USA', 22, 2380, 20, True),
        ]
        
        rankings = []
        for i, (player_id, name, country, age, points, career_high, is_career_high) in enumerate(top_players, 1):
            movement = random.choice([-2, -1, 0, 0, 0, 1, 1, 2])
            rankings.append({
                'rank': i,
                'id': player_id,
                'name': name,
                'country': country,
                'age': age,
                'points': points,
                'career_high': career_high,
                'is_career_high': is_career_high,
                'movement': movement,
                'image_url': f'https://api.sofascore.com/api/v1/player/{player_id}/image'
            })
        
        # Generate remaining players
        countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'RUS', 'AUS', 'GBR', 'JPN', 'CHN']
        first_names = ['Anna', 'Maria', 'Emma', 'Sofia', 'Elena', 'Victoria', 'Anastasia', 'Nina', 'Sara', 'Julia']
        last_names = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis']
        
        for i in range(len(top_players) + 1, 201):
            player_id = i + 10000 # Use a high, random ID
            rankings.append({
                'rank': i,
                'id': player_id,
                'name': f'{random.choice(first_names)} {random.choice(last_names)}',
                'country': random.choice(countries),
                'age': random.randint(17, 34),
                'points': max(50, 2300 - (i * 10) + random.randint(-50, 50)),
                'career_high': random.randint(max(1, i - 50), i),
                'is_career_high': random.random() > 0.9,
                'movement': random.choice([-3, -2, -1, 0, 0, 1, 2, 3]),
                'image_url': f'https://api.sofascore.com/api/v1/player/{player_id}/image'
            })
        
        return rankings
    
    def _generate_sample_tournaments(self, tour, year):
        """Generate sample tournament calendar"""
        tournaments = []
        
        if tour == 'atp':
            tournament_data = [
                # Grand Slams
                {'name': 'Australian Open', 'category': 'grand_slam', 'location': 'Melbourne, Australia',
                 'start': f'{year}-01-14', 'end': f'{year}-01-28', 'surface': 'Hard'},
                {'name': 'Roland Garros', 'category': 'grand_slam', 'location': 'Paris, France',
                 'start': f'{year}-05-26', 'end': f'{year}-06-09', 'surface': 'Clay'},
                {'name': 'Wimbledon', 'category': 'grand_slam', 'location': 'London, UK',
                 'start': f'{year}-07-01', 'end': f'{year}-07-14', 'surface': 'Grass'},
                {'name': 'US Open', 'category': 'grand_slam', 'location': 'New York, USA',
                 'start': f'{year}-08-26', 'end': f'{year}-09-08', 'surface': 'Hard'},
                # Masters 1000
                {'name': 'Indian Wells Masters', 'category': 'masters_1000', 'location': 'Indian Wells, USA',
                 'start': f'{year}-03-06', 'end': f'{year}-03-17', 'surface': 'Hard'},
                {'name': 'Miami Open', 'category': 'masters_1000', 'location': 'Miami, USA',
                 'start': f'{year}-03-20', 'end': f'{year}-03-31', 'surface': 'Hard'},
                {'name': 'Monte-Carlo Masters', 'category': 'masters_1000', 'location': 'Monte Carlo, Monaco',
                 'start': f'{year}-04-07', 'end': f'{year}-04-14', 'surface': 'Clay'},
                {'name': 'Madrid Open', 'category': 'masters_1000', 'location': 'Madrid, Spain',
                 'start': f'{year}-04-25', 'end': f'{year}-05-05', 'surface': 'Clay'},
                {'name': 'Italian Open', 'category': 'masters_1000', 'location': 'Rome, Italy',
                 'start': f'{year}-05-08', 'end': f'{year}-05-19', 'surface': 'Clay'},
                {'name': 'Canadian Open', 'category': 'masters_1000', 'location': 'Toronto/Montreal, Canada',
                 'start': f'{year}-08-05', 'end': f'{year}-08-11', 'surface': 'Hard'},
                {'name': 'Cincinnati Masters', 'category': 'masters_1000', 'location': 'Cincinnati, USA',
                 'start': f'{year}-08-12', 'end': f'{year}-08-18', 'surface': 'Hard'},
                {'name': 'Shanghai Masters', 'category': 'masters_1000', 'location': 'Shanghai, China',
                 'start': f'{year}-10-02', 'end': f'{year}-10-13', 'surface': 'Hard'},
                {'name': 'Paris Masters', 'category': 'masters_1000', 'location': 'Paris, France',
                 'start': f'{year}-10-28', 'end': f'{year}-11-03', 'surface': 'Hard (Indoor)'},
                # ATP 500
                {'name': 'Rotterdam Open', 'category': 'atp_500', 'location': 'Rotterdam, Netherlands',
                 'start': f'{year}-02-05', 'end': f'{year}-02-11', 'surface': 'Hard (Indoor)'},
                {'name': 'Dubai Tennis Championships', 'category': 'atp_500', 'location': 'Dubai, UAE',
                 'start': f'{year}-02-26', 'end': f'{year}-03-02', 'surface': 'Hard'},
                {'name': 'Barcelona Open', 'category': 'atp_500', 'location': 'Barcelona, Spain',
                 'start': f'{year}-04-15', 'end': f'{year}-04-21', 'surface': 'Clay'},
                {'name': "Queen's Club Championships", 'category': 'atp_500', 'location': 'London, UK',
                 'start': f'{year}-06-17', 'end': f'{year}-06-23', 'surface': 'Grass'},
                {'name': 'Halle Open', 'category': 'atp_500', 'location': 'Halle, Germany',
                 'start': f'{year}-06-17', 'end': f'{year}-06-23', 'surface': 'Grass'},
                {'name': 'Washington Open', 'category': 'atp_500', 'location': 'Washington D.C., USA',
                 'start': f'{year}-07-29', 'end': f'{year}-08-04', 'surface': 'Hard'},
                {'name': 'Tokyo Open', 'category': 'atp_500', 'location': 'Tokyo, Japan',
                 'start': f'{year}-09-25', 'end': f'{year}-10-01', 'surface': 'Hard'},
                {'name': 'Basel Open', 'category': 'atp_500', 'location': 'Basel, Switzerland',
                 'start': f'{year}-10-21', 'end': f'{year}-10-27', 'surface': 'Hard (Indoor)'},
                {'name': 'Vienna Open', 'category': 'atp_500', 'location': 'Vienna, Austria',
                 'start': f'{year}-10-21', 'end': f'{year}-10-27', 'surface': 'Hard (Indoor)'},
                # ATP 250
                {'name': 'Brisbane International', 'category': 'atp_250', 'location': 'Brisbane, Australia',
                 'start': f'{year}-01-01', 'end': f'{year}-01-07', 'surface': 'Hard'},
                {'name': 'Adelaide International', 'category': 'atp_250', 'location': 'Adelaide, Australia',
                 'start': f'{year}-01-08', 'end': f'{year}-01-13', 'surface': 'Hard'},
                {'name': 'Montpellier Open', 'category': 'atp_250', 'location': 'Montpellier, France',
                 'start': f'{year}-02-05', 'end': f'{year}-02-11', 'surface': 'Hard (Indoor)'},
                {'name': 'Dallas Open', 'category': 'atp_250', 'location': 'Dallas, USA',
                 'start': f'{year}-02-05', 'end': f'{year}-02-11', 'surface': 'Hard (Indoor)'},
                {'name': 'Lyon Open', 'category': 'atp_250', 'location': 'Lyon, France',
                 'start': f'{year}-05-20', 'end': f'{year}-05-25', 'surface': 'Clay'},
                {'name': 'Stuttgart Open', 'category': 'atp_250', 'location': 'Stuttgart, Germany',
                 'start': f'{year}-06-10', 'end': f'{year}-06-16', 'surface': 'Grass'},
                {'name': 'Eastbourne International', 'category': 'atp_250', 'location': 'Eastbourne, UK',
                 'start': f'{year}-06-24', 'end': f'{year}-06-29', 'surface': 'Grass'},
                {'name': 'Atlanta Open', 'category': 'atp_250', 'location': 'Atlanta, USA',
                 'start': f'{year}-07-22', 'end': f'{year}-07-28', 'surface': 'Hard'},
                {'name': 'Winston-Salem Open', 'category': 'atp_250', 'location': 'Winston-Salem, USA',
                 'start': f'{year}-08-19', 'end': f'{year}-08-24', 'surface': 'Hard'},
                {'name': 'Chengdu Open', 'category': 'atp_250', 'location': 'Chengdu, China',
                 'start': f'{year}-09-16', 'end': f'{year}-09-22', 'surface': 'Hard'},
                {'name': 'Stockholm Open', 'category': 'atp_250', 'location': 'Stockholm, Sweden',
                 'start': f'{year}-10-14', 'end': f'{year}-10-20', 'surface': 'Hard (Indoor)'},
                {'name': 'Antwerp Open', 'category': 'atp_250', 'location': 'Antwerp, Belgium',
                 'start': f'{year}-10-14', 'end': f'{year}-10-20', 'surface': 'Hard (Indoor)'},
            ]
        else:
            tournament_data = [
                # Grand Slams
                {'name': 'Australian Open', 'category': 'grand_slam', 'location': 'Melbourne, Australia',
                 'start': f'{year}-01-14', 'end': f'{year}-01-28', 'surface': 'Hard'},
                {'name': 'Roland Garros', 'category': 'grand_slam', 'location': 'Paris, France',
                 'start': f'{year}-05-26', 'end': f'{year}-06-09', 'surface': 'Clay'},
                {'name': 'Wimbledon', 'category': 'grand_slam', 'location': 'London, UK',
                 'start': f'{year}-07-01', 'end': f'{year}-07-14', 'surface': 'Grass'},
                {'name': 'US Open', 'category': 'grand_slam', 'location': 'New York, USA',
                 'start': f'{year}-08-26', 'end': f'{year}-09-08', 'surface': 'Hard'},
                # WTA 1000 (mapped to masters_1000 for styling)
                {'name': 'Qatar Open', 'category': 'masters_1000', 'location': 'Doha, Qatar',
                 'start': f'{year}-02-10', 'end': f'{year}-02-17', 'surface': 'Hard'},
                {'name': 'Dubai Championships', 'category': 'masters_1000', 'location': 'Dubai, UAE',
                 'start': f'{year}-02-19', 'end': f'{year}-02-25', 'surface': 'Hard'},
                {'name': 'Indian Wells Open', 'category': 'masters_1000', 'location': 'Indian Wells, USA',
                 'start': f'{year}-03-06', 'end': f'{year}-03-17', 'surface': 'Hard'},
                {'name': 'Miami Open', 'category': 'masters_1000', 'location': 'Miami, USA',
                 'start': f'{year}-03-20', 'end': f'{year}-03-31', 'surface': 'Hard'},
                {'name': 'Madrid Open', 'category': 'masters_1000', 'location': 'Madrid, Spain',
                 'start': f'{year}-04-25', 'end': f'{year}-05-05', 'surface': 'Clay'},
                {'name': 'Italian Open', 'category': 'masters_1000', 'location': 'Rome, Italy',
                 'start': f'{year}-05-08', 'end': f'{year}-05-19', 'surface': 'Clay'},
                {'name': 'Canadian Open', 'category': 'masters_1000', 'location': 'Toronto/Montreal, Canada',
                 'start': f'{year}-08-05', 'end': f'{year}-08-11', 'surface': 'Hard'},
                {'name': 'Cincinnati Open', 'category': 'masters_1000', 'location': 'Cincinnati, USA',
                 'start': f'{year}-08-12', 'end': f'{year}-08-18', 'surface': 'Hard'},
                {'name': 'Wuhan Open', 'category': 'masters_1000', 'location': 'Wuhan, China',
                 'start': f'{year}-09-21', 'end': f'{year}-09-29', 'surface': 'Hard'},
                {'name': 'Beijing Open', 'category': 'masters_1000', 'location': 'Beijing, China',
                 'start': f'{year}-10-01', 'end': f'{year}-10-08', 'surface': 'Hard'},
                # WTA 500
                {'name': 'Adelaide International', 'category': 'atp_500', 'location': 'Adelaide, Australia',
                 'start': f'{year}-01-08', 'end': f'{year}-01-13', 'surface': 'Hard'},
                {'name': 'Stuttgart Open', 'category': 'atp_500', 'location': 'Stuttgart, Germany',
                 'start': f'{year}-04-15', 'end': f'{year}-04-21', 'surface': 'Clay'},
                {'name': 'Berlin Open', 'category': 'atp_500', 'location': 'Berlin, Germany',
                 'start': f'{year}-06-17', 'end': f'{year}-06-23', 'surface': 'Grass'},
                {'name': 'Eastbourne International', 'category': 'atp_500', 'location': 'Eastbourne, UK',
                 'start': f'{year}-06-24', 'end': f'{year}-06-29', 'surface': 'Grass'},
                {'name': 'San Diego Open', 'category': 'atp_500', 'location': 'San Diego, USA',
                 'start': f'{year}-09-09', 'end': f'{year}-09-15', 'surface': 'Hard'},
                # WTA 250
                {'name': 'Hobart International', 'category': 'atp_250', 'location': 'Hobart, Australia',
                 'start': f'{year}-01-08', 'end': f'{year}-01-13', 'surface': 'Hard'},
                {'name': 'Auckland Open', 'category': 'atp_250', 'location': 'Auckland, New Zealand',
                 'start': f'{year}-01-01', 'end': f'{year}-01-07', 'surface': 'Hard'},
                {'name': 'Linz Open', 'category': 'atp_250', 'location': 'Linz, Austria',
                 'start': f'{year}-01-27', 'end': f'{year}-02-02', 'surface': 'Hard (Indoor)'},
                {'name': 'Charleston Open', 'category': 'atp_250', 'location': 'Charleston, USA',
                 'start': f'{year}-04-01', 'end': f'{year}-04-07', 'surface': 'Clay'},
                {'name': 'Seoul Open', 'category': 'atp_250', 'location': 'Seoul, South Korea',
                 'start': f'{year}-09-16', 'end': f'{year}-09-22', 'surface': 'Hard'},
            ]
        
        today = datetime.now().date()
        
        for i, t in enumerate(tournament_data):
            start_date = datetime.strptime(t['start'], '%Y-%m-%d').date()
            end_date = datetime.strptime(t['end'], '%Y-%m-%d').date()
            
            if end_date < today:
                status = 'finished'
                # Generate winners for finished tournaments
                if tour == 'atp':
                    winner = random.choice(self._get_sample_atp_players())
                    runner_up = random.choice(self._get_sample_atp_players())
                    while runner_up['id'] == winner['id']:
                        runner_up = random.choice(self._get_sample_atp_players())
                else:
                    winner = random.choice(self._get_sample_wta_players())
                    runner_up = random.choice(self._get_sample_wta_players())
                    while runner_up['id'] == winner['id']:
                        runner_up = random.choice(self._get_sample_wta_players())
            elif start_date <= today <= end_date:
                status = 'in_progress'
                winner = None
                runner_up = None
            else:
                status = 'upcoming'
                # Show last year's winner for upcoming tournaments
                if tour == 'atp':
                    winner = random.choice(self._get_sample_atp_players())
                    runner_up = random.choice(self._get_sample_atp_players())
                    while runner_up['id'] == winner['id']:
                        runner_up = random.choice(self._get_sample_atp_players())
                else:
                    winner = random.choice(self._get_sample_wta_players())
                    runner_up = random.choice(self._get_sample_wta_players())
                    while runner_up['id'] == winner['id']:
                        runner_up = random.choice(self._get_sample_wta_players())
            
            tournaments.append({
                'id': i + 1,
                'name': t['name'],
                'category': t['category'],
                'location': t['location'],
                'start_date': t['start'],
                'end_date': t['end'],
                'surface': t['surface'],
                'status': status,
                'winner': winner,
                'runner_up': runner_up,
                'tour': tour.upper()
            })
        
        # Sort by start date
        tournaments.sort(key=lambda x: x['start_date'])
        
        return tournaments
    
    def _generate_sample_bracket(self, tournament_id, tour='atp'):
        """Generate sample tournament bracket"""
        year = datetime.now().year
        tournaments = self._generate_sample_tournaments(tour, year)
        tournament = next((t for t in tournaments if t['id'] == tournament_id), None)
        category = tournament['category'] if tournament else 'atp_250'
        surface = tournament['surface'] if tournament else 'Hard'
        name = tournament['name'] if tournament else f'Tournament {tournament_id}'

        # Determine bracket size by category
        if category == 'grand_slam':
            draw_size = 128
        elif category == 'masters_1000':
            draw_size = 64
        elif category == 'finals':
            draw_size = 8
        else:
            draw_size = 32
        
        rounds = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F']
        if draw_size == 64:
            rounds = ['R64', 'R32', 'R16', 'QF', 'SF', 'F']
        elif draw_size == 32:
            rounds = ['R32', 'R16', 'QF', 'SF', 'F']
        elif draw_size == 8:
            rounds = ['QF', 'SF', 'F']
        
        bracket = {
            'tournament_id': tournament_id,
            'tournament_name': name,
            'tournament_category': category,
            'tournament_surface': surface,
            'draw_size': draw_size,
            'rounds': rounds,
            'matches': []
        }
        
        # Generate seeded players (top 32)
        players = self._get_full_atp_rankings()[:draw_size] if tour == 'atp' else self._get_full_wta_rankings()[:draw_size]
        seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
        
        # Generate first round matches
        match_id = 1
        matches_per_round = draw_size // 2
        
        for round_idx, round_name in enumerate(rounds):
            round_matches = []
            
            for i in range(matches_per_round):
                if round_idx == 0:
                    # First round - assign players
                    p1_idx = i * 2
                    p2_idx = i * 2 + 1
                    p1 = players[p1_idx] if p1_idx < len(players) else None
                    p2 = players[p2_idx] if p2_idx < len(players) else None
                    
                    # Add seed info
                    if p1 and p1['rank'] <= 32:
                        p1['seed'] = p1['rank']
                    if p2 and p2['rank'] <= 32:
                        p2['seed'] = p2['rank']
                    
                    status = 'finished' if random.random() > 0.3 else 'scheduled'
                    winner = None
                    score = None
                    if p1 and p2 and status == 'finished':
                        best_of = self._get_best_of('ATP' if tour == 'atp' else 'WTA', category)
                        score = self._generate_final_score(best_of=best_of)
                        winner = p1 if score['p1_sets'] > score['p2_sets'] else p2
                    
                    round_matches.append({
                        'id': match_id,
                        'round': round_name,
                        'match_number': i + 1,
                        'player1': p1,
                        'player2': p2,
                        'winner': winner,
                        'score': score,
                        'status': status
                    })
                else:
                    # Later rounds - winners from previous round
                    round_matches.append({
                        'id': match_id,
                        'round': round_name,
                        'match_number': i + 1,
                        'player1': None,  # Would be filled from previous round
                        'player2': None,
                        'winner': None,
                        'score': None,
                        'status': 'scheduled'
                    })
                
                match_id += 1
            
            bracket['matches'].extend(round_matches)
            matches_per_round = matches_per_round // 2
        
        return bracket
    
    def _generate_sample_player(self, player_id):
        """Generate sample player details"""
        if player_id <= 100:
            # ATP player
            rankings = self._get_full_atp_rankings()
            player = next((p for p in rankings if p['id'] == player_id), None)
            tour = 'ATP'
        else:
            # WTA player
            rankings = self._get_full_wta_rankings()
            player = next((p for p in rankings if p['id'] == player_id), None)
            tour = 'WTA'
        
        if not player:
            return None
        
        return {
            **player,
            'tour': tour,
            'height': f"{random.randint(170, 200)} cm",
            'plays': random.choice(['Right-Handed', 'Left-Handed']),
            'turned_pro': random.randint(2010, 2022),
            'titles': random.randint(0, 30),
            'prize_money': f"${random.randint(1, 150)},{random.randint(100, 999)},{random.randint(100, 999)}",
            'biography': f"Professional tennis player from {player['country']}.",
            'image_url': f'https://api.sofascore.com/api/v1/player/{player_id}/image'
        }


# Singleton instance
tennis_fetcher = TennisDataFetcher()
