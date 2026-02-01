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
    
    def fetch_live_scores(self, tour='both'):
        """
        Fetch live tennis scores
        tour: 'atp', 'wta', or 'both'
        """
        cache_key = f'live_scores_{tour}'
        if cache_key in live_scores_cache:
            return live_scores_cache[cache_key]
        
        # In production, this would fetch from a real API
        # For now, we'll generate realistic sample data
        live_matches = self._generate_sample_live_matches(tour)
        
        live_scores_cache[cache_key] = live_matches
        return live_matches
    
    def fetch_recent_matches(self, tour='both', limit=20):
        """Fetch recently completed matches"""
        # Generate sample recent matches
        return self._generate_sample_recent_matches(tour, limit)
    
    def fetch_rankings(self, tour='atp', limit=200):
        """
        Fetch ATP or WTA rankings
        tour: 'atp' or 'wta'
        limit: number of players to fetch (max 200)
        """
        cache_key = f'rankings_{tour}'
        if cache_key in rankings_cache:
            return rankings_cache[cache_key][:limit]
        
        # Generate sample rankings data
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
        
        tournaments = self._generate_sample_tournaments(tour, year)
        tournaments_cache[cache_key] = tournaments
        return tournaments
    
    def fetch_tournament_bracket(self, tournament_id):
        """Fetch tournament bracket/draw"""
        return self._generate_sample_bracket(tournament_id)
    
    def fetch_player_details(self, player_id):
        """Fetch player details"""
        return self._generate_sample_player(player_id)
    
    # Sample data generators (would be replaced with real API calls)
    
    def _generate_sample_live_matches(self, tour):
        """Generate sample live matches data"""
        atp_players = [
            {'id': 1, 'name': 'Novak Djokovic', 'country': 'SRB', 'rank': 1},
            {'id': 2, 'name': 'Carlos Alcaraz', 'country': 'ESP', 'rank': 2},
            {'id': 3, 'name': 'Jannik Sinner', 'country': 'ITA', 'rank': 3},
            {'id': 4, 'name': 'Daniil Medvedev', 'country': 'RUS', 'rank': 4},
            {'id': 5, 'name': 'Andrey Rublev', 'country': 'RUS', 'rank': 5},
            {'id': 6, 'name': 'Alexander Zverev', 'country': 'GER', 'rank': 6},
            {'id': 7, 'name': 'Holger Rune', 'country': 'DEN', 'rank': 7},
            {'id': 8, 'name': 'Stefanos Tsitsipas', 'country': 'GRE', 'rank': 8},
        ]
        
        wta_players = [
            {'id': 101, 'name': 'Iga Swiatek', 'country': 'POL', 'rank': 1},
            {'id': 102, 'name': 'Aryna Sabalenka', 'country': 'BLR', 'rank': 2},
            {'id': 103, 'name': 'Coco Gauff', 'country': 'USA', 'rank': 3},
            {'id': 104, 'name': 'Elena Rybakina', 'country': 'KAZ', 'rank': 4},
            {'id': 105, 'name': 'Jessica Pegula', 'country': 'USA', 'rank': 5},
            {'id': 106, 'name': 'Ons Jabeur', 'country': 'TUN', 'rank': 6},
            {'id': 107, 'name': 'Marketa Vondrousova', 'country': 'CZE', 'rank': 7},
            {'id': 108, 'name': 'Qinwen Zheng', 'country': 'CHN', 'rank': 8},
        ]
        
        tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam', 'location': 'Melbourne, Australia'},
            {'name': 'Indian Wells Masters', 'category': 'masters_1000', 'location': 'Indian Wells, USA'},
            {'name': 'Dubai Tennis Championships', 'category': 'atp_500', 'location': 'Dubai, UAE'},
        ]
        
        matches = []
        
        if tour in ['atp', 'both']:
            for i in range(3):
                p1 = atp_players[i * 2]
                p2 = atp_players[i * 2 + 1]
                tournament = tournaments[i % len(tournaments)]
                
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
                    'score': self._generate_live_score(),
                    'status': 'live',
                    'serving': random.choice([1, 2]),
                    'start_time': datetime.now().strftime('%H:%M')
                })
        
        if tour in ['wta', 'both']:
            for i in range(3):
                p1 = wta_players[i * 2]
                p2 = wta_players[i * 2 + 1]
                tournament = tournaments[i % len(tournaments)]
                
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
                    'score': self._generate_live_score(best_of=3),
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
                    sets.append({'p1': 6, 'p2': random.randint(0, 4)})
                else:
                    sets.append({'p1': 7, 'p2': random.choice([5, 6])})
                p1_sets += 1
            else:
                if random.random() > 0.3:
                    sets.append({'p1': random.randint(0, 4), 'p2': 6})
                else:
                    sets.append({'p1': random.choice([5, 6]), 'p2': 7})
                p2_sets += 1
        
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
    
    def _generate_sample_recent_matches(self, tour, limit):
        """Generate sample recently completed matches"""
        matches = []
        atp_players = self._get_sample_atp_players()
        wta_players = self._get_sample_wta_players()
        
        tournaments = [
            {'name': 'Australian Open', 'category': 'grand_slam'},
            {'name': 'Rotterdam Open', 'category': 'atp_500'},
            {'name': 'Qatar Open', 'category': 'atp_250'},
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
            
            tournament = random.choice(tournaments)
            winner = random.choice([1, 2])
            
            matches.append({
                'id': f'recent_{i}',
                'tour': tour_name,
                'tournament': tournament['name'],
                'tournament_category': tournament['category'],
                'round': random.choice(['R32', 'R16', 'QF', 'SF', 'F']),
                'player1': players[p1_idx],
                'player2': players[p2_idx],
                'winner': winner,
                'final_score': self._generate_final_score(best_of=5 if tour_name == 'ATP' else 3),
                'status': 'finished',
                'end_time': (datetime.now() - timedelta(hours=random.randint(1, 24))).strftime('%Y-%m-%d %H:%M')
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
                    sets.append({'p1': 6, 'p2': random.randint(0, 4)})
                else:
                    sets.append({'p1': 7, 'p2': random.choice([5, 6])})
                p1_sets += 1
            else:
                if random.random() > 0.3:
                    sets.append({'p1': random.randint(0, 4), 'p2': 6})
                else:
                    sets.append({'p1': random.choice([5, 6]), 'p2': 7})
                p2_sets += 1
        
        return {'sets': sets, 'p1_sets': p1_sets, 'p2_sets': p2_sets}
    
    def _generate_sample_rankings(self, tour, limit):
        """Generate sample rankings"""
        if tour == 'atp':
            players = self._get_full_atp_rankings()
        else:
            players = self._get_full_wta_rankings()
        
        return players[:limit]
    
    def _get_sample_atp_players(self):
        """Get sample ATP players"""
        return [
            {'id': 1, 'name': 'Novak Djokovic', 'country': 'SRB', 'rank': 1},
            {'id': 2, 'name': 'Carlos Alcaraz', 'country': 'ESP', 'rank': 2},
            {'id': 3, 'name': 'Jannik Sinner', 'country': 'ITA', 'rank': 3},
            {'id': 4, 'name': 'Daniil Medvedev', 'country': 'RUS', 'rank': 4},
            {'id': 5, 'name': 'Andrey Rublev', 'country': 'RUS', 'rank': 5},
            {'id': 6, 'name': 'Alexander Zverev', 'country': 'GER', 'rank': 6},
            {'id': 7, 'name': 'Holger Rune', 'country': 'DEN', 'rank': 7},
            {'id': 8, 'name': 'Stefanos Tsitsipas', 'country': 'GRE', 'rank': 8},
            {'id': 9, 'name': 'Hubert Hurkacz', 'country': 'POL', 'rank': 9},
            {'id': 10, 'name': 'Casper Ruud', 'country': 'NOR', 'rank': 10},
        ]
    
    def _get_sample_wta_players(self):
        """Get sample WTA players"""
        return [
            {'id': 101, 'name': 'Iga Swiatek', 'country': 'POL', 'rank': 1},
            {'id': 102, 'name': 'Aryna Sabalenka', 'country': 'BLR', 'rank': 2},
            {'id': 103, 'name': 'Coco Gauff', 'country': 'USA', 'rank': 3},
            {'id': 104, 'name': 'Elena Rybakina', 'country': 'KAZ', 'rank': 4},
            {'id': 105, 'name': 'Jessica Pegula', 'country': 'USA', 'rank': 5},
            {'id': 106, 'name': 'Ons Jabeur', 'country': 'TUN', 'rank': 6},
            {'id': 107, 'name': 'Marketa Vondrousova', 'country': 'CZE', 'rank': 7},
            {'id': 108, 'name': 'Qinwen Zheng', 'country': 'CHN', 'rank': 8},
            {'id': 109, 'name': 'Maria Sakkari', 'country': 'GRE', 'rank': 9},
            {'id': 110, 'name': 'Jelena Ostapenko', 'country': 'LAT', 'rank': 10},
        ]
    
    def _get_full_atp_rankings(self):
        """Generate full ATP rankings (top 200)"""
        top_players = [
            ('Novak Djokovic', 'SRB', 36, 11245, 1, True),
            ('Carlos Alcaraz', 'ESP', 20, 9255, 1, True),
            ('Jannik Sinner', 'ITA', 22, 8710, 3, True),
            ('Daniil Medvedev', 'RUS', 27, 7165, 1, False),
            ('Andrey Rublev', 'RUS', 26, 5110, 5, True),
            ('Alexander Zverev', 'GER', 26, 5085, 2, False),
            ('Holger Rune', 'DEN', 20, 4210, 4, False),
            ('Stefanos Tsitsipas', 'GRE', 25, 4175, 3, False),
            ('Hubert Hurkacz', 'POL', 26, 3955, 9, True),
            ('Casper Ruud', 'NOR', 25, 3825, 2, False),
            ('Taylor Fritz', 'USA', 26, 3505, 11, True),
            ('Tommy Paul', 'USA', 26, 3170, 12, True),
            ('Ben Shelton', 'USA', 21, 2920, 13, True),
            ('Grigor Dimitrov', 'BUL', 32, 2885, 3, False),
            ('Felix Auger-Aliassime', 'CAN', 23, 2660, 6, False),
            ('Karen Khachanov', 'RUS', 27, 2605, 8, False),
            ('Frances Tiafoe', 'USA', 25, 2505, 10, False),
            ('Ugo Humbert', 'FRA', 25, 2490, 18, True),
            ('Sebastian Korda', 'USA', 23, 2385, 19, True),
            ('Nicolas Jarry', 'CHI', 28, 2330, 20, True),
        ]
        
        rankings = []
        for i, (name, country, age, points, career_high, is_career_high) in enumerate(top_players, 1):
            movement = random.choice([-2, -1, 0, 0, 0, 1, 1, 2])
            rankings.append({
                'rank': i,
                'id': i,
                'name': name,
                'country': country,
                'age': age,
                'points': points,
                'career_high': career_high,
                'is_career_high': is_career_high,
                'movement': movement,
                'image': f'/assets/images/atp/{i}.png'
            })
        
        # Generate remaining players
        countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'ARG', 'AUS', 'GBR', 'JPN', 'KOR']
        first_names = ['Alex', 'Marco', 'Pablo', 'John', 'David', 'Lucas', 'Max', 'Leo', 'Hugo', 'Jack']
        last_names = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis']
        
        for i in range(len(top_players) + 1, 201):
            rankings.append({
                'rank': i,
                'id': i,
                'name': f'{random.choice(first_names)} {random.choice(last_names)}',
                'country': random.choice(countries),
                'age': random.randint(19, 35),
                'points': max(100, 2300 - (i * 10) + random.randint(-50, 50)),
                'career_high': random.randint(max(1, i - 50), i),
                'is_career_high': random.random() > 0.9,
                'movement': random.choice([-3, -2, -1, 0, 0, 1, 2, 3]),
                'image': f'/assets/images/atp/{i}.png' if i <= 200 else None
            })
        
        return rankings
    
    def _get_full_wta_rankings(self):
        """Generate full WTA rankings (top 200)"""
        top_players = [
            ('Iga Swiatek', 'POL', 22, 10715, 1, True),
            ('Aryna Sabalenka', 'BLR', 25, 8725, 1, True),
            ('Coco Gauff', 'USA', 19, 6770, 3, True),
            ('Elena Rybakina', 'KAZ', 24, 5973, 3, True),
            ('Jessica Pegula', 'USA', 29, 5580, 3, False),
            ('Ons Jabeur', 'TUN', 29, 4316, 2, False),
            ('Marketa Vondrousova', 'CZE', 24, 4075, 7, True),
            ('Qinwen Zheng', 'CHN', 21, 4005, 8, True),
            ('Maria Sakkari', 'GRE', 28, 3835, 3, False),
            ('Jelena Ostapenko', 'LAT', 26, 3438, 5, False),
            ('Daria Kasatkina', 'RUS', 26, 3130, 8, False),
            ('Madison Keys', 'USA', 28, 2993, 7, False),
            ('Liudmila Samsonova', 'RUS', 24, 2985, 11, False),
            ('Beatriz Haddad Maia', 'BRA', 27, 2956, 10, False),
            ('Karolina Muchova', 'CZE', 27, 2905, 8, False),
            ('Ekaterina Alexandrova', 'RUS', 29, 2625, 12, False),
            ('Caroline Garcia', 'FRA', 30, 2605, 4, False),
            ('Veronika Kudermetova', 'RUS', 26, 2501, 9, False),
            ('Barbora Krejcikova', 'CZE', 27, 2436, 2, False),
            ('Emma Navarro', 'USA', 22, 2380, 20, True),
        ]
        
        rankings = []
        for i, (name, country, age, points, career_high, is_career_high) in enumerate(top_players, 1):
            movement = random.choice([-2, -1, 0, 0, 0, 1, 1, 2])
            rankings.append({
                'rank': i,
                'id': 100 + i,
                'name': name,
                'country': country,
                'age': age,
                'points': points,
                'career_high': career_high,
                'is_career_high': is_career_high,
                'movement': movement,
                'image': f'/assets/images/wta/{i}.png'
            })
        
        # Generate remaining players
        countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'RUS', 'AUS', 'GBR', 'JPN', 'CHN']
        first_names = ['Anna', 'Maria', 'Emma', 'Sofia', 'Elena', 'Victoria', 'Anastasia', 'Nina', 'Sara', 'Julia']
        last_names = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis']
        
        for i in range(len(top_players) + 1, 201):
            rankings.append({
                'rank': i,
                'id': 100 + i,
                'name': f'{random.choice(first_names)} {random.choice(last_names)}',
                'country': random.choice(countries),
                'age': random.randint(17, 34),
                'points': max(50, 2300 - (i * 10) + random.randint(-50, 50)),
                'career_high': random.randint(max(1, i - 50), i),
                'is_career_high': random.random() > 0.9,
                'movement': random.choice([-3, -2, -1, 0, 0, 1, 2, 3]),
                'image': f'/assets/images/wta/{i}.png' if i <= 200 else None
            })
        
        return rankings
    
    def _generate_sample_tournaments(self, tour, year):
        """Generate sample tournament calendar"""
        tournaments = []
        
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
            
            # ATP/WTA 500
            {'name': 'Rotterdam Open', 'category': 'atp_500', 'location': 'Rotterdam, Netherlands',
             'start': f'{year}-02-05', 'end': f'{year}-02-11', 'surface': 'Hard (Indoor)'},
            {'name': 'Dubai Tennis Championships', 'category': 'atp_500', 'location': 'Dubai, UAE',
             'start': f'{year}-02-26', 'end': f'{year}-03-02', 'surface': 'Hard'},
            {'name': 'Barcelona Open', 'category': 'atp_500', 'location': 'Barcelona, Spain',
             'start': f'{year}-04-15', 'end': f'{year}-04-21', 'surface': 'Clay'},
            {'name': 'Queen\'s Club Championships', 'category': 'atp_500', 'location': 'London, UK',
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
            
            # ATP/WTA 250
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
    
    def _generate_sample_bracket(self, tournament_id):
        """Generate sample tournament bracket"""
        # Determine bracket size (128, 64, 32 draw)
        draw_size = 128
        
        rounds = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F']
        if draw_size == 64:
            rounds = ['R64', 'R32', 'R16', 'QF', 'SF', 'F']
        elif draw_size == 32:
            rounds = ['R32', 'R16', 'QF', 'SF', 'F']
        
        bracket = {
            'tournament_id': tournament_id,
            'draw_size': draw_size,
            'rounds': rounds,
            'matches': []
        }
        
        # Generate seeded players (top 32)
        players = self._get_full_atp_rankings()[:draw_size]
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
                    
                    # Determine winner (higher ranked player wins more often)
                    if p1 and p2:
                        if random.random() < 0.7:  # 70% chance higher ranked wins
                            winner = p1 if p1['rank'] < p2['rank'] else p2
                        else:
                            winner = p2 if p1['rank'] < p2['rank'] else p1
                    else:
                        winner = p1 or p2
                    
                    round_matches.append({
                        'id': match_id,
                        'round': round_name,
                        'match_number': i + 1,
                        'player1': p1,
                        'player2': p2,
                        'winner': winner,
                        'score': self._generate_final_score() if winner else None,
                        'status': 'finished' if random.random() > 0.3 else 'scheduled'
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
            'biography': f"Professional tennis player from {player['country']}."
        }


# Singleton instance
tennis_fetcher = TennisDataFetcher()
