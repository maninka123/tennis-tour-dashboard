"""
Tennis API - Data fetching module for live tennis data
Fetches data from various sources including web scraping and APIs

==============================================
REAL ATP/WTA API INTEGRATION GUIDE
==============================================

This file currently uses demo data. To integrate real live tennis data, 
you can use the following APIs and data sources:

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
import math
import time
from pathlib import Path
from config import Config

# Caches for different data types
live_scores_cache = TTLCache(maxsize=100, ttl=Config.CACHE_LIVE_SCORES)
rankings_cache = TTLCache(maxsize=10, ttl=Config.CACHE_RANKINGS)
tournaments_cache = TTLCache(maxsize=10, ttl=Config.CACHE_TOURNAMENTS)


class TennisDataFetcher:
    """Fetches and processes tennis data from various sources"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        self._wta_scraped_index = None
        self._wta_tournament_index = None
        self._wta_rankings_cache = None
        self._wta_rankings_index = None
        self._wta_global_cache_fast_data = None
        self._wta_global_cache_fast_at = 0.0
        self._wta_global_cache_slow_data = None
        self._wta_global_cache_slow_at = 0.0

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

    def _load_wta_scraped_index(self):
        if self._wta_scraped_index is not None:
            return self._wta_scraped_index

        base_dir = Path(__file__).resolve().parent.parent / 'data' / 'wta'
        index = {
            'by_full': {},
            'by_last_first': {},
            'by_last': {},
            'players': []
        }
        if not base_dir.exists():
            self._wta_scraped_index = index
            return index

        for folder in base_dir.iterdir():
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
                'profile': profile,
                'stats': stats,
                'folder': str(folder)
            }
            index['players'].append(entry)
            if norm and norm not in index['by_full']:
                index['by_full'][norm] = entry
            if first and last:
                key = f"{last}_{first[0]}"
                index['by_last_first'][key] = entry
            if last:
                index['by_last'].setdefault(last, []).append(entry)

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
            if last in index['by_last'] and len(index['by_last'][last]) == 1:
                return index['by_last'][last][0]

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

    def _fetch_wta_global_matches(self):
        url = 'https://api.wtatennis.com/tennis/matches/global'
        try:
            resp = self.session.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.wtatennis.com/scores?type=S'
            }, timeout=20)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            print(f"Error fetching WTA live matches: {exc}")
            return []

        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ('Matches', 'matches', 'data'):
                if isinstance(data.get(key), list):
                    return data.get(key)
        return []

    def _get_wta_global_matches_cached(self, ttl=10, cache_slot='fast'):
        now = time.time()
        if cache_slot == 'slow':
            data = self._wta_global_cache_slow_data
            ts = self._wta_global_cache_slow_at
        else:
            data = self._wta_global_cache_fast_data
            ts = self._wta_global_cache_fast_at

        if data is not None and (now - ts) < ttl:
            return data

        matches = self._fetch_wta_global_matches()
        if cache_slot == 'slow':
            self._wta_global_cache_slow_data = matches
            self._wta_global_cache_slow_at = now
        else:
            self._wta_global_cache_fast_data = matches
            self._wta_global_cache_fast_at = now
        return matches

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

    def _wta_round_from_match(self, match, is_grand_slam, draw_size=32):
        round_id = str(match.get('RoundID') or '').strip()
        match_id = str(match.get('MatchID') or '')
        match_digits = re.sub(r'\D', '', match_id)
        match_number = int(match_digits) if match_digits.isdigit() else 0

        if match_number and match_number < 5:
            if match_number == 1:
                return 'F'
            if match_number in (2, 3):
                return 'SF'
            if match_number == 4:
                return 'QF'

        if is_grand_slam and round_id in ('1', '2', '3', '4'):
            gs_map = {'1': 'R128', '2': 'R64', '3': 'R32', '4': 'R16'}
            return gs_map[round_id]

        # Numeric round ids are common in WTA feed for some tournaments
        if round_id.isdigit():
            rid = int(round_id)
            if rid == 1:
                return f"R{max(2, draw_size)}"
            if rid == 2:
                return f"R{max(2, draw_size // 2)}"
            if rid == 3:
                return f"R{max(2, draw_size // 4)}"
            if rid == 4:
                return f"R{max(2, draw_size // 8)}"

        if match_number:
            round_of = 2 ** math.ceil(math.log2(match_number + 1))
            if round_of < 16:
                return 'QF'
            return f"R{round_of}"

        if round_id.upper() == 'Q':
            return 'QF'
        if round_id.upper() == 'S':
            return 'SF'
        if round_id.upper() == 'F':
            return 'F'
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
        image_url = ''
        if rank_entry and rank_entry.get('image_url'):
            image_url = rank_entry.get('image_url')
        elif scraped_entry:
            image_url = scraped_entry.get('profile', {}).get('image_url') or ''
        return {
            'id': (rank_entry or {}).get('id') or (int(player_id) if player_id and str(player_id).isdigit() else None),
            'name': name,
            'country': country or (rank_entry or {}).get('country') or (scraped_entry or {}).get('profile', {}).get('country'),
            'rank': (rank_entry or {}).get('rank'),
            'image_url': image_url
        }

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
            wta_raw = self._get_wta_global_matches_cached(ttl=10, cache_slot='fast')
            if not wta_raw:
                live_matches.extend(self._generate_sample_live_matches('wta'))
            else:
                wta_live = [
                    self._parse_wta_match(match)
                    for match in wta_raw
                    if isinstance(match, dict)
                    and match.get('DrawMatchType') == 'S'
                    and match.get('MatchState') == 'P'
                ]
                live_matches.extend(wta_live)

        if tour in ('atp', 'both'):
            live_matches.extend(self._generate_sample_live_matches('atp'))
        
        live_scores_cache[cache_key] = live_matches
        return live_matches
    
    def fetch_recent_matches(self, tour='both', limit=20):
        """Fetch recently completed matches"""
        matches = []
        if tour in ('wta', 'both'):
            wta_raw = self._get_wta_global_matches_cached(ttl=1800, cache_slot='slow')
            if not wta_raw:
                matches.extend(self._generate_sample_recent_matches('wta', limit))
            else:
                wta_finished = [
                    match for match in wta_raw
                    if isinstance(match, dict)
                    and match.get('DrawMatchType') == 'S'
                    and match.get('MatchState') == 'F'
                ]
                wta_finished.sort(key=lambda m: m.get('MatchTimeStamp') or '', reverse=True)
                parsed = [self._parse_wta_match(match) for match in wta_finished[:limit]]
                matches.extend(parsed)

        if tour in ('atp', 'both'):
            matches.extend(self._generate_sample_recent_matches('atp', limit))

        return matches[:limit] if tour == 'both' else matches
    
    def fetch_upcoming_matches(self, tour='both', days=2):
        """
        Fetch upcoming matches in the next N days
        tour: 'atp', 'wta', or 'both'
        days: number of days to look ahead (default 2)
        """
        matches = []
        cutoff = datetime.now().date() + timedelta(days=days)

        if tour in ('wta', 'both'):
            wta_raw = self._get_wta_global_matches_cached(ttl=1800, cache_slot='slow')
            if not wta_raw:
                matches.extend(self._generate_sample_upcoming_matches('wta', days))
            else:
                upcoming = []
                for match in wta_raw:
                    if not isinstance(match, dict):
                        continue
                    if match.get('DrawMatchType') != 'S':
                        continue
                    if match.get('MatchState') in ('P', 'F'):
                        continue
                    ts = match.get('MatchTimeStamp') or ''
                    try:
                        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                        if dt.date() > cutoff:
                            continue
                    except Exception:
                        pass
                    upcoming.append(match)

                upcoming.sort(key=lambda m: m.get('MatchTimeStamp') or '')
                parsed = [self._parse_wta_match(match) for match in upcoming]
                matches.extend(parsed)

        if tour in ('atp', 'both'):
            matches.extend(self._generate_sample_upcoming_matches('atp', days))

        return matches
    
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

        # Generate sample rankings data
        if not rankings:
            rankings = self._generate_sample_rankings(tour, limit)

        rankings_cache[cache_key] = rankings
        return rankings
    
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
        return self._generate_sample_bracket(tournament_id, tour)
    
    def fetch_player_details(self, player_id):
        """Fetch player details"""
        wta_player = self._get_wta_player_from_csv(player_id)
        if wta_player:
            return wta_player
        return self._generate_sample_player(player_id)

    def _get_wta_player_from_csv(self, player_id):
        """Resolve WTA player details from CSV-backed rankings."""
        if player_id < 100000:
            return None
        rankings = self._load_wta_rankings_csv()
        if not rankings:
            return None
        rank = player_id - 100000
        player = next((p for p in rankings if p.get('rank') == rank), None)
        if not player:
            return None
        height = player.get('height') or f"{random.randint(170, 190)} cm"
        plays = player.get('plays') or random.choice(['Right-Handed', 'Left-Handed'])
        titles = player.get('titles') or random.randint(0, 15)
        prize_money = player.get('prize_money') or f"${random.randint(1, 50)},{random.randint(100, 999)},{random.randint(100, 999)}"
        image_url = player.get('image_url') or f'https://api.sofascore.com/api/v1/player/{player_id}/image'

        return {
            **player,
            'id': player_id,
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
        atp_players = self._get_sample_atp_players()
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
            scheduled_time = datetime.now() + timedelta(hours=random.randint(1, days * 24))
            
            matches.append({
                'id': f'upcoming_{i}',
                'tour': tour_name,
                'tournament': tournament['name'],
                'tournament_category': tournament['category'],
                'round': random.choice(['R32', 'R16', 'QF', 'SF', 'F']),
                'player1': players[p1_idx],
                'player2': players[p2_idx],
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
        csv_path = Path(__file__).resolve().parent.parent / 'data' / 'wta_live_ranking.csv'
        if not csv_path.exists():
            return None

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

                scraped = self._match_wta_scraped(name)
                profile_data = scraped.get('profile') if scraped else {}
                stats_data = scraped.get('stats') if scraped else {}

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

                image_url = profile_data.get('image_url') or ''
                height = profile_data.get('height') or ''
                plays = profile_data.get('plays') or ''
                prize_money = stats_data.get('prize_money') or ''
                singles_titles = stats_data.get('singles_titles') or ''
                records_tab = stats_data.get('records_tab') or {}
                records = records_tab.get('yearly') or stats_data.get('records') or []
                records_summary = records_tab.get('summary') or []

                rankings.append({
                    'rank': rank,
                    'id': 100000 + rank,
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
    
    def _get_sample_atp_players(self):
        """Get sample ATP players with real IDs and image URLs"""
        players = [
            {'id': 4878, 'name': 'Novak Djokovic', 'country': 'SRB', 'rank': 1},
            {'id': 216431, 'name': 'Carlos Alcaraz', 'country': 'ESP', 'rank': 2},
            {'id': 139170, 'name': 'Jannik Sinner', 'country': 'ITA', 'rank': 3},
            {'id': 38758, 'name': 'Daniil Medvedev', 'country': 'RUS', 'rank': 4},
            {'id': 39667, 'name': 'Andrey Rublev', 'country': 'RUS', 'rank': 5},
            {'id': 40285, 'name': 'Alexander Zverev', 'country': 'GER', 'rank': 6},
            {'id': 124335, 'name': 'Holger Rune', 'country': 'DEN', 'rank': 7},
            {'id': 41379, 'name': 'Stefanos Tsitsipas', 'country': 'GRE', 'rank': 8},
            {'id': 59642, 'name': 'Hubert Hurkacz', 'country': 'POL', 'rank': 9},
            {'id': 63343, 'name': 'Casper Ruud', 'country': 'NOR', 'rank': 10},
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
