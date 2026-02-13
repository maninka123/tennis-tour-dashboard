import hashlib
import json
import os
import smtplib
import threading
import unicodedata
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, render_template, request


APP_DIR = Path(__file__).resolve().parent
STORAGE_DIR = APP_DIR / 'storage'
STORE_PATH = STORAGE_DIR / 'subscriptions.json'

TENNIS_API_BASE_URL = os.getenv('NOTIFY_TENNIS_API_BASE_URL', 'http://localhost:5001/api').rstrip('/')
POLL_SECONDS = max(30, int(os.getenv('NOTIFY_POLL_SECONDS', '300')))

SMTP_HOST = os.getenv('NOTIFY_SMTP_HOST', '').strip()
SMTP_PORT = int(os.getenv('NOTIFY_SMTP_PORT', '587'))
SMTP_USER = os.getenv('NOTIFY_SMTP_USER', '').strip()
SMTP_PASS = os.getenv('NOTIFY_SMTP_PASS', '').strip()
SMTP_USE_TLS = str(os.getenv('NOTIFY_SMTP_TLS', 'true')).strip().lower() in {'1', 'true', 'yes', 'on'}
SMTP_FROM = os.getenv('NOTIFY_SMTP_FROM', SMTP_USER).strip()
SMTP_REPLY_TO = os.getenv('NOTIFY_SMTP_REPLY_TO', '').strip()

MAX_RULES = 200
MAX_CONDITIONS_PER_RULE = 3

ROUND_ORDER = {
    'QUAL': 0,
    'R128': 1,
    'R64': 2,
    'R32': 3,
    'R16': 4,
    'QF': 5,
    'SF': 6,
    'F': 7,
    'TITLE': 8,
}

DEFAULT_STORE = {
    'email': '',
    'enabled': False,
    'rules': [],
    'sent_events': {},
    'rule_state': {},
    'history': [],
    'updated_at': None,
}

ALLOWED_EVENT_TYPES = {
    'upcoming_match',
    'match_result',
    'tournament_completed',
    'player_reaches_round',
    'live_match_starts',
    'set_completed',
    'upset_alert',
    'close_match_deciding_set',
    'ranking_milestone',
    'title_milestone',
    'head_to_head_breaker',
    'surface_specific_result',
    'tournament_stage_reminder',
    'time_window_schedule_alert',
}

ALLOWED_TOURS = {'both', 'atp', 'wta'}
ALLOWED_ROUND_MODE = {'any', 'min', 'exact'}
ALLOWED_CONDITION_GROUP = {'all', 'any'}
ALLOWED_SEVERITY = {'important', 'normal', 'digest'}
ALLOWED_CHANNELS = {'email', 'telegram', 'discord', 'web_push'}
ALLOWED_MILESTONES = {'top_100', 'top_50', 'top_20', 'top_10', 'career_high'}
ALLOWED_DECIDING_MODES = {'deciding_set', 'third_or_fifth', 'tiebreak'}
ALLOWED_SURFACES = {'hard', 'clay', 'grass', 'indoor', 'carpet'}
ALLOWED_STAGE_ROUNDS = {'QF', 'SF', 'F'}

NOTIFY_TELEGRAM_BOT_TOKEN = os.getenv('NOTIFY_TELEGRAM_BOT_TOKEN', '').strip()
NOTIFY_TELEGRAM_CHAT_ID = os.getenv('NOTIFY_TELEGRAM_CHAT_ID', '').strip()
NOTIFY_DISCORD_WEBHOOK_URL = os.getenv('NOTIFY_DISCORD_WEBHOOK_URL', '').strip()

DEFAULT_TIMEZONE_OFFSET = '+00:00'
STATIC_CATEGORY_OPTIONS = [
    'grand_slam',
    'atp_1000',
    'wta_1000',
    'atp_500',
    'wta_500',
    'atp_250',
    'wta_250',
    'atp_finals',
    'wta_finals',
]
_options_cache = {
    'atp': {'ts': 0.0, 'players': [], 'tournaments': []},
    'wta': {'ts': 0.0, 'players': [], 'tournaments': []},
}
_options_lock = threading.Lock()

io_lock = threading.Lock()
run_lock = threading.Lock()


app = Flask(__name__, template_folder='templates', static_folder='static')
scheduler = BackgroundScheduler(daemon=True)


def api_origin(base_url: str) -> str:
    parsed = urlparse(str(base_url or '').strip())
    if not parsed.scheme or not parsed.netloc:
        return ''
    return f'{parsed.scheme}://{parsed.netloc}'


TENNIS_API_ORIGIN = api_origin(TENNIS_API_BASE_URL)


def normalize_image_url(raw_url: str) -> str:
    value = str(raw_url or '').strip()
    if not value:
        return ''
    if value.startswith(('http://', 'https://')):
        return value
    if value.startswith('//'):
        return f'https:{value}'
    if not TENNIS_API_ORIGIN:
        return value
    if value.startswith('/'):
        return f'{TENNIS_API_ORIGIN}{value}'
    return f'{TENNIS_API_ORIGIN}/{value.lstrip("/")}'


def normalize_lookup_token(value: str) -> str:
    text = unicodedata.normalize('NFKD', str(value or '').strip().lower())
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = ''.join(ch if ch.isalnum() else ' ' for ch in text)
    return ' '.join(text.split())


def category_options_for_tour(tour: str) -> List[str]:
    selected = str(tour or '').strip().lower()
    if selected == 'atp':
        return [c for c in STATIC_CATEGORY_OPTIONS if c == 'grand_slam' or c.startswith('atp_')]
    if selected == 'wta':
        return [c for c in STATIC_CATEGORY_OPTIONS if c == 'grand_slam' or c.startswith('wta_')]
    return list(STATIC_CATEGORY_OPTIONS)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_store_file() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    if STORE_PATH.exists():
        return
    with STORE_PATH.open('w', encoding='utf-8') as fh:
        json.dump(DEFAULT_STORE, fh, indent=2)


def load_store() -> Dict[str, Any]:
    ensure_store_file()
    with io_lock:
        try:
            with STORE_PATH.open('r', encoding='utf-8') as fh:
                data = json.load(fh)
        except Exception:
            data = dict(DEFAULT_STORE)
    if not isinstance(data, dict):
        data = dict(DEFAULT_STORE)

    merged = dict(DEFAULT_STORE)
    merged.update(data)
    if not isinstance(merged.get('rules'), list):
        merged['rules'] = []
    if not isinstance(merged.get('sent_events'), dict):
        merged['sent_events'] = {}
    if not isinstance(merged.get('rule_state'), dict):
        merged['rule_state'] = {}
    if not isinstance(merged.get('history'), list):
        merged['history'] = []
    return merged


def save_store(store: Dict[str, Any]) -> None:
    store['updated_at'] = now_iso()
    with io_lock:
        with STORE_PATH.open('w', encoding='utf-8') as fh:
            json.dump(store, fh, indent=2)


def compact_sent_events(store: Dict[str, Any], keep_last: int = 5000) -> None:
    sent = store.get('sent_events') or {}
    if len(sent) <= keep_last:
        return
    items = sorted(sent.items(), key=lambda x: str(x[1]), reverse=True)
    store['sent_events'] = dict(items[:keep_last])


def append_history(store: Dict[str, Any], level: str, message: str, details: Dict[str, Any] = None) -> None:
    entry = {
        'timestamp': now_iso(),
        'level': level,
        'message': message,
        'details': details or {},
    }
    history = store.setdefault('history', [])
    history.insert(0, entry)
    if len(history) > 300:
        del history[300:]


def safe_get_json(url: str, params: Dict[str, Any] = None, timeout: int = 25) -> Dict[str, Any]:
    response = requests.get(url, params=params or {}, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict):
        return payload
    return {}


def fetch_matches() -> Dict[str, List[Dict[str, Any]]]:
    live_payload = safe_get_json(
        f'{TENNIS_API_BASE_URL}/live-scores',
        {'tour': 'both'},
    )
    upcoming_payload = safe_get_json(
        f'{TENNIS_API_BASE_URL}/upcoming-matches',
        {'tour': 'both', 'days': 7},
    )
    recent_payload = safe_get_json(
        f'{TENNIS_API_BASE_URL}/recent-matches',
        {'tour': 'both', 'limit': 120},
    )

    live = live_payload.get('data') if isinstance(live_payload.get('data'), list) else []
    upcoming = upcoming_payload.get('data') if isinstance(upcoming_payload.get('data'), list) else []
    recent = recent_payload.get('data') if isinstance(recent_payload.get('data'), list) else []

    return {
        'live': [normalize_match(m, default_status='live') for m in live if isinstance(m, dict)],
        'upcoming': [normalize_match(m, default_status='upcoming') for m in upcoming if isinstance(m, dict)],
        'recent': [normalize_match(m, default_status='finished') for m in recent if isinstance(m, dict)],
    }


def normalize_round_label(raw: str) -> str:
    text = str(raw or '').strip()
    low = text.lower()

    if 'qual' in low:
        return 'QUAL'
    if 'round of 128' in low or low == 'r128':
        return 'R128'
    if 'round of 64' in low or low == 'r64':
        return 'R64'
    if 'round of 32' in low or low in {'r32', 'round32'}:
        return 'R32'
    if 'round of 16' in low or low in {'r16', 'round16'}:
        return 'R16'
    if 'quarter' in low or low == 'qf':
        return 'QF'
    if 'semi' in low or low == 'sf':
        return 'SF'
    if low in {'f', 'final'} or ('final' in low and 'semi' not in low and 'quarter' not in low):
        return 'F'
    return text.upper() if text else 'UNKNOWN'


def round_rank(round_label: str) -> int:
    return ROUND_ORDER.get(normalize_round_label(round_label), -1)


def parse_iso_datetime(value: str) -> datetime:
    text = str(value or '').strip()
    if not text:
        return None
    try:
        text = text.replace('Z', '+00:00')
        return datetime.fromisoformat(text)
    except Exception:
        return None


def pick_winner_name(match: Dict[str, Any]) -> str:
    winner = match.get('winner')
    p1 = (match.get('player1') or {}).get('name', '')
    p2 = (match.get('player2') or {}).get('name', '')
    if winner in {1, '1', 'player1', 'p1'}:
        return str(p1)
    if winner in {2, '2', 'player2', 'p2'}:
        return str(p2)
    return ''


def normalize_match(match: Dict[str, Any], default_status: str) -> Dict[str, Any]:
    player1 = match.get('player1') or {}
    player2 = match.get('player2') or {}
    raw_round = str(match.get('round') or '').strip()
    normalized = {
        'id': str(match.get('id') or ''),
        'tour': str(match.get('tour') or '').strip().lower(),
        'status': str(match.get('status') or default_status).strip().lower(),
        'tournament': str(match.get('tournament') or ''),
        'tournament_category': str(match.get('tournament_category') or '').strip().lower(),
        'surface': str(match.get('surface') or '').strip().lower(),
        'round': raw_round,
        'round_label': normalize_round_label(raw_round),
        'round_rank': round_rank(raw_round),
        'scheduled_time': str(match.get('scheduled_time') or ''),
        'scheduled_dt': parse_iso_datetime(match.get('scheduled_time')),
        'player1': {
            'name': str(player1.get('name') or ''),
            'rank': player1.get('rank'),
            'country': str(player1.get('country') or ''),
        },
        'player2': {
            'name': str(player2.get('name') or ''),
            'rank': player2.get('rank'),
            'country': str(player2.get('country') or ''),
        },
        'winner_name': pick_winner_name(match),
        'final_score': match.get('final_score'),
        'score': match.get('score'),
        'raw': match,
    }
    if not normalized['id']:
        key = f"{normalized['tour']}|{normalized['tournament']}|{normalized['round']}|{normalized['player1']['name']}|{normalized['player2']['name']}|{normalized['scheduled_time']}"
        normalized['id'] = f'generated_{hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]}'
    return normalized


def to_slug(text: str) -> str:
    value = ''.join(ch.lower() if ch.isalnum() else '-' for ch in str(text or '').strip())
    while '--' in value:
        value = value.replace('--', '-')
    return value.strip('-')


def parse_csv_like(text: str) -> List[str]:
    parts = [p.strip() for p in str(text or '').split(',')]
    return [p for p in parts if p]


def parse_int(value: Any, default: int = 0, minimum: int = None, maximum: int = None) -> int:
    try:
        out = int(value)
    except Exception:
        out = default
    if minimum is not None:
        out = max(minimum, out)
    if maximum is not None:
        out = min(maximum, out)
    return out


def parse_rank(value: Any) -> int:
    try:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        return int(text)
    except Exception:
        return None


def parse_timezone_offset_minutes(offset_text: str) -> int:
    text = str(offset_text or DEFAULT_TIMEZONE_OFFSET).strip()
    if not text:
        return 0
    sign = 1
    if text.startswith('-'):
        sign = -1
    text = text[1:] if text[:1] in '+-' else text
    parts = text.split(':')
    hours = parse_int(parts[0] if parts else 0, 0, 0, 14)
    minutes = parse_int(parts[1] if len(parts) > 1 else 0, 0, 0, 59)
    return sign * (hours * 60 + minutes)


def in_quiet_hours(rule: Dict[str, Any], now_utc: datetime = None) -> bool:
    if not rule.get('quiet_hours_enabled'):
        return False
    now_utc = now_utc or datetime.now(timezone.utc)
    offset_minutes = parse_timezone_offset_minutes(rule.get('timezone_offset') or DEFAULT_TIMEZONE_OFFSET)
    local_now = now_utc + timedelta(minutes=offset_minutes)
    start_hour = parse_int(rule.get('quiet_start_hour'), 23, 0, 23)
    end_hour = parse_int(rule.get('quiet_end_hour'), 7, 0, 23)
    hour = local_now.hour
    if start_hour == end_hour:
        return False
    if start_hour < end_hour:
        return start_hour <= hour < end_hour
    return hour >= start_hour or hour < end_hour


def to_lower_tokens(items: List[str]) -> List[str]:
    return [str(x).strip().lower() for x in (items or []) if str(x).strip()]


def parse_score_sets(match: Dict[str, Any]) -> List[Dict[str, Any]]:
    score = match.get('score')
    if isinstance(score, dict) and isinstance(score.get('sets'), list):
        return [s for s in score.get('sets') if isinstance(s, dict)]
    final_score = match.get('final_score')
    if isinstance(final_score, dict) and isinstance(final_score.get('sets'), list):
        return [s for s in final_score.get('sets') if isinstance(s, dict)]
    return []


def count_completed_sets(match: Dict[str, Any]) -> int:
    sets = parse_score_sets(match)
    completed = 0
    for s in sets:
        p1 = s.get('p1')
        p2 = s.get('p2')
        if isinstance(p1, int) and isinstance(p2, int):
            completed += 1
    return completed


def has_tiebreak(match: Dict[str, Any]) -> bool:
    for s in parse_score_sets(match):
        tb = s.get('tiebreak')
        if isinstance(tb, dict):
            return True
    return False


def player_side(match: Dict[str, Any], player_name_lower: str) -> str:
    if not player_name_lower:
        return ''
    p1 = str((match.get('player1') or {}).get('name') or '').lower()
    p2 = str((match.get('player2') or {}).get('name') or '').lower()
    if player_name_lower in p1:
        return 'p1'
    if player_name_lower in p2:
        return 'p2'
    return ''


def winner_side(match: Dict[str, Any]) -> str:
    winner = match.get('winner')
    if winner in {1, '1', 'player1', 'p1'}:
        return 'p1'
    if winner in {2, '2', 'player2', 'p2'}:
        return 'p2'
    return ''


def _extract_player_row(raw: Dict[str, Any], tour: str) -> Dict[str, Any]:
    name = str(raw.get('name') or raw.get('player') or '').strip()
    if not name:
        return {}
    return {
        'id': raw.get('id') or raw.get('player_id') or raw.get('player_code') or '',
        'name': name,
        'country': str(raw.get('country') or raw.get('country_code') or '').strip(),
        'rank': raw.get('rank'),
        'image_url': normalize_image_url(raw.get('image_url') or ''),
        'tour': tour,
    }


def _extract_tournament_row(raw: Dict[str, Any], tour: str) -> Dict[str, Any]:
    name = str(raw.get('name') or raw.get('tournament') or raw.get('tournament_name') or '').strip()
    if not name:
        return {}
    return {
        'name': name,
        'category': str(raw.get('category') or raw.get('type') or '').strip().lower(),
        'surface': str(raw.get('surface') or '').strip(),
        'tour': tour,
    }


def _load_tour_options(tour: str) -> Dict[str, Any]:
    tour = 'wta' if str(tour).strip().lower() == 'wta' else 'atp'
    now_ts = datetime.now(timezone.utc).timestamp()
    with _options_lock:
        cached = _options_cache.get(tour) or {}
        if now_ts - float(cached.get('ts') or 0.0) < 300 and cached.get('players'):
            return {'players': cached.get('players') or [], 'tournaments': cached.get('tournaments') or []}

    players: List[Dict[str, Any]] = []
    tournaments: List[Dict[str, Any]] = []

    ranking_limit = 400 if tour == 'wta' else 200
    try:
        ranking_payload = safe_get_json(f'{TENNIS_API_BASE_URL}/rankings/{tour}', {'limit': ranking_limit})
        for row in ranking_payload.get('data') or []:
            if isinstance(row, dict):
                extracted = _extract_player_row(row, tour)
                if extracted:
                    players.append(extracted)
    except Exception:
        pass

    try:
        tournament_payload = safe_get_json(f'{TENNIS_API_BASE_URL}/tournaments/{tour}')
        for row in tournament_payload.get('data') or []:
            if isinstance(row, dict):
                extracted = _extract_tournament_row(row, tour)
                if extracted:
                    tournaments.append(extracted)
    except Exception:
        pass

    def dedupe_by_name(items: List[Dict[str, Any]], key_name: str = 'name') -> List[Dict[str, Any]]:
        seen = set()
        out: List[Dict[str, Any]] = []
        for item in items:
            key = str(item.get(key_name) or '').strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(item)
        return out

    players = dedupe_by_name(players)
    tournaments = dedupe_by_name(tournaments)

    with _options_lock:
        _options_cache[tour] = {
            'ts': now_ts,
            'players': players,
            'tournaments': tournaments,
        }

    return {'players': players, 'tournaments': tournaments}


def _search_players_from_api(tour: str, query: str, limit: int = 40) -> List[Dict[str, Any]]:
    tour = 'wta' if str(tour).strip().lower() == 'wta' else 'atp'
    query = str(query or '').strip()
    if not query:
        return []
    try:
        payload = safe_get_json(f'{TENNIS_API_BASE_URL}/h2h/{tour}/search', {'query': query, 'limit': limit})
        rows = payload.get('data') if isinstance(payload.get('data'), list) else []
        out = []
        for row in rows:
            if isinstance(row, dict):
                extracted = _extract_player_row(row, tour)
                if extracted:
                    out.append(extracted)
        return out
    except Exception:
        return []


def normalize_rule(raw: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    if not isinstance(raw, dict):
        return {}, 'Invalid rule payload'

    event_type = str(raw.get('event_type') or '').strip()
    if event_type not in ALLOWED_EVENT_TYPES:
        return {}, 'Invalid event_type'

    tour = str(raw.get('tour') or 'both').strip().lower()
    if tour not in ALLOWED_TOURS:
        return {}, 'Invalid tour value'

    round_mode = str(raw.get('round_mode') or 'any').strip().lower()
    if round_mode not in ALLOWED_ROUND_MODE:
        return {}, 'Invalid round_mode'

    condition_group = str(raw.get('condition_group') or 'all').strip().lower()
    if condition_group not in ALLOWED_CONDITION_GROUP:
        condition_group = 'all'

    severity = str(raw.get('severity') or 'normal').strip().lower()
    if severity not in ALLOWED_SEVERITY:
        severity = 'normal'

    channels_raw = raw.get('channels')
    if isinstance(channels_raw, str):
        channels_raw = parse_csv_like(channels_raw)
    channels = to_lower_tokens(channels_raw or ['email'])
    channels = [ch for ch in channels if ch in ALLOWED_CHANNELS]
    if not channels:
        channels = ['email']

    quiet_hours_enabled = bool(raw.get('quiet_hours_enabled', False))
    quiet_start_hour = parse_int(raw.get('quiet_start_hour'), 23, 0, 23)
    quiet_end_hour = parse_int(raw.get('quiet_end_hour'), 7, 0, 23)
    timezone_offset = str(raw.get('timezone_offset') or DEFAULT_TIMEZONE_OFFSET).strip() or DEFAULT_TIMEZONE_OFFSET
    cooldown_minutes = parse_int(raw.get('cooldown_minutes'), 0, 0, 1440)

    conditions = raw.get('conditions') if isinstance(raw.get('conditions'), list) else []
    if len(conditions) > MAX_CONDITIONS_PER_RULE:
        return {}, f'Max {MAX_CONDITIONS_PER_RULE} extra filters per rule'

    normalized_conditions = []
    for item in conditions:
        if not isinstance(item, dict):
            continue
        field = str(item.get('field') or '').strip()
        operator = str(item.get('operator') or '').strip()
        value = str(item.get('value') or '').strip()
        if not field or not operator or not value:
            continue
        normalized_conditions.append({'field': field, 'operator': operator, 'value': value})

    rule_id = str(raw.get('id') or '').strip() or f"rule_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    players = raw.get('players')
    tournaments = raw.get('tournaments')
    categories = raw.get('categories')

    if isinstance(players, str):
        players = parse_csv_like(players)
    if isinstance(tournaments, str):
        tournaments = parse_csv_like(tournaments)
    if isinstance(categories, str):
        categories = parse_csv_like(categories)

    params = raw.get('params') if isinstance(raw.get('params'), dict) else {}
    params = dict(params)
    params['upset_min_rank_gap'] = parse_int(params.get('upset_min_rank_gap'), 20, 1, 500)
    params['set_number'] = parse_int(params.get('set_number'), 1, 1, 5)
    params['deciding_mode'] = str(params.get('deciding_mode') or 'deciding_set').strip().lower()
    if params['deciding_mode'] not in ALLOWED_DECIDING_MODES:
        params['deciding_mode'] = 'deciding_set'
    params['ranking_milestone'] = str(params.get('ranking_milestone') or 'top_100').strip().lower()
    if params['ranking_milestone'] not in ALLOWED_MILESTONES:
        params['ranking_milestone'] = 'top_100'
    params['title_target'] = parse_int(params.get('title_target'), 1, 1, 200)
    params['rival_player'] = str(params.get('rival_player') or '').strip().lower()
    params['h2h_min_losses'] = parse_int(params.get('h2h_min_losses'), 2, 1, 20)
    params['surface_value'] = str(params.get('surface_value') or '').strip().lower()
    if params['surface_value'] and params['surface_value'] not in ALLOWED_SURFACES:
        params['surface_value'] = ''
    params['window_hours'] = parse_int(params.get('window_hours'), 24, 1, 72)
    params['emit_on_first_seen'] = bool(params.get('emit_on_first_seen', True))
    stage_rounds = params.get('stage_rounds')
    if isinstance(stage_rounds, str):
        stage_rounds = parse_csv_like(stage_rounds)
    stage_rounds = [str(x).strip().upper() for x in (stage_rounds or ['QF', 'SF', 'F']) if str(x).strip()]
    stage_rounds = [x for x in stage_rounds if x in ALLOWED_STAGE_ROUNDS]
    params['stage_rounds'] = stage_rounds or ['QF', 'SF', 'F']

    normalized = {
        'id': rule_id,
        'name': str(raw.get('name') or 'Untitled Rule').strip()[:140],
        'enabled': bool(raw.get('enabled', True)),
        'event_type': event_type,
        'tour': tour,
        'round_mode': round_mode,
        'round_value': str(raw.get('round_value') or '').strip(),
        'condition_group': condition_group,
        'categories': to_lower_tokens(categories),
        'tournaments': to_lower_tokens(tournaments),
        'players': to_lower_tokens(players),
        'tracked_player': str(raw.get('tracked_player') or '').strip().lower(),
        'conditions': normalized_conditions,
        'quiet_hours_enabled': quiet_hours_enabled,
        'quiet_start_hour': quiet_start_hour,
        'quiet_end_hour': quiet_end_hour,
        'timezone_offset': timezone_offset,
        'cooldown_minutes': cooldown_minutes,
        'channels': channels,
        'severity': severity,
        'params': params,
        'created_at': str(raw.get('created_at') or now_iso()),
    }

    if not normalized['name']:
        return {}, 'Rule name is required'
    if not normalized['round_value'] and normalized['round_mode'] in {'min', 'exact'}:
        return {}, 'round_value is required for min/exact round mode'
    if normalized['event_type'] == 'player_reaches_round' and not (normalized['tracked_player'] or normalized['players']):
        return {}, 'Player reaches round requires tracked player'
    if normalized['event_type'] in {'ranking_milestone', 'title_milestone'} and not (
        normalized['tracked_player'] or normalized['players']
    ):
        return {}, 'Ranking/title milestone rules require at least one player'
    if normalized['event_type'] == 'head_to_head_breaker':
        if not normalized['tracked_player']:
            return {}, 'Head-to-head breaker requires tracked player'
        if not normalized['params'].get('rival_player'):
            return {}, 'Head-to-head breaker requires rival player'
    if normalized['event_type'] == 'surface_specific_result' and not normalized['params'].get('surface_value'):
        return {}, 'Surface-specific result requires surface parameter'

    return normalized, ''


def match_contains_player(match: Dict[str, Any], name_lower: str) -> bool:
    p1 = (match.get('player1') or {}).get('name', '').lower()
    p2 = (match.get('player2') or {}).get('name', '').lower()
    return name_lower in p1 or name_lower in p2


def score_string(match: Dict[str, Any]) -> str:
    final_score = match.get('final_score')
    if isinstance(final_score, dict):
        sets = final_score.get('sets')
        if isinstance(sets, list) and sets:
            chunks = []
            for s in sets:
                if not isinstance(s, dict):
                    continue
                p1 = s.get('p1')
                p2 = s.get('p2')
                if p1 is None or p2 is None:
                    continue
                piece = f'{p1}-{p2}'
                tb = s.get('tiebreak')
                if isinstance(tb, dict) and tb.get('p1') is not None and tb.get('p2') is not None:
                    piece += f'({tb.get("p1")}-{tb.get("p2")})'
                chunks.append(piece)
            return ' '.join(chunks)
    return ''


def base_rule_match(rule: Dict[str, Any], match: Dict[str, Any]) -> bool:
    if rule.get('tour') != 'both':
        if match.get('tour') != rule.get('tour'):
            return False

    categories = rule.get('categories') or []
    if categories and match.get('tournament_category', '') not in categories:
        return False

    tournaments = rule.get('tournaments') or []
    if tournaments:
        tname = (match.get('tournament') or '').lower()
        if not any(token in tname for token in tournaments):
            return False

    players = rule.get('players') or []
    if players and not any(match_contains_player(match, p) for p in players):
        return False

    round_mode = rule.get('round_mode', 'any')
    if round_mode in {'min', 'exact'}:
        target_rank = round_rank(rule.get('round_value') or '')
        current = int(match.get('round_rank') or -1)
        if round_mode == 'min' and current < target_rank:
            return False
        if round_mode == 'exact' and current != target_rank:
            return False

    conditions = rule.get('conditions') or []
    if conditions:
        condition_group = str(rule.get('condition_group') or 'all').lower()
        if condition_group == 'any':
            if not any(condition_match(condition, match) for condition in conditions):
                return False
        else:
            if not all(condition_match(condition, match) for condition in conditions):
                return False

    return True


def condition_match(condition: Dict[str, str], match: Dict[str, Any]) -> bool:
    field = condition.get('field', '')
    operator = condition.get('operator', '')
    value = str(condition.get('value', '')).strip().lower()

    if field == 'tournament_name':
        left = str(match.get('tournament') or '').lower()
    elif field == 'player_name':
        left = f"{(match.get('player1') or {}).get('name', '')} {(match.get('player2') or {}).get('name', '')}".lower()
    elif field == 'category':
        left = str(match.get('tournament_category') or '').lower()
    elif field == 'surface':
        left = str(match.get('surface') or '').lower()
    elif field == 'round_rank':
        left = str(match.get('round_rank') or '')
    else:
        return True

    if operator == 'contains':
        return value in left
    if operator == 'equals':
        return left == value
    if operator == 'gte':
        try:
            return float(left) >= float(value)
        except Exception:
            return False
    if operator == 'lte':
        try:
            return float(left) <= float(value)
        except Exception:
            return False

    return True


def fetch_rankings_map(tour: str) -> Dict[str, Dict[str, Any]]:
    tours = ['atp', 'wta'] if tour == 'both' else [tour]
    out: Dict[str, Dict[str, Any]] = {}
    for t in tours:
        limit = 400 if t == 'wta' else 200
        try:
            payload = safe_get_json(f'{TENNIS_API_BASE_URL}/rankings/{t}', {'limit': limit})
            rows = payload.get('data') if isinstance(payload.get('data'), list) else []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                name = str(row.get('name') or '').strip()
                if not name:
                    continue
                key = name.lower()
                titles_raw = row.get('titles')
                titles_count = parse_int(titles_raw, 0, 0, 500)
                out[key] = {
                    'tour': t,
                    'name': name,
                    'rank': parse_rank(row.get('rank')),
                    'career_high': parse_rank(row.get('career_high')),
                    'titles': titles_count,
                    'country': str(row.get('country') or '').strip(),
                    'image_url': str(row.get('image_url') or '').strip(),
                }
        except Exception:
            continue
    return out


def ranking_milestone_reached(milestone: str, rank_value: int, career_high: int) -> bool:
    if rank_value is None:
        return False
    if milestone == 'top_100':
        return rank_value <= 100
    if milestone == 'top_50':
        return rank_value <= 50
    if milestone == 'top_20':
        return rank_value <= 20
    if milestone == 'top_10':
        return rank_value <= 10
    if milestone == 'career_high':
        return career_high is not None and rank_value <= career_high
    return False


def build_meta_event(rule: Dict[str, Any], kind: str, title: str, detail: str, unique_seed: str, tour: str = '') -> Dict[str, Any]:
    signature = f"{rule.get('id')}|{kind}|{unique_seed}"
    event_id = hashlib.sha1(signature.encode('utf-8')).hexdigest()
    return {
        'event_id': event_id,
        'kind': kind,
        'match_id': '',
        'tour': str(tour or rule.get('tour') or '').upper(),
        'tournament': '',
        'round': '',
        'title': title,
        'detail': detail,
        'player1': '',
        'player2': '',
        'scheduled_time': '',
    }


def build_event(rule: Dict[str, Any], match: Dict[str, Any], kind: str) -> Dict[str, Any]:
    p1 = (match.get('player1') or {}).get('name', 'Player 1')
    p2 = (match.get('player2') or {}).get('name', 'Player 2')
    dt = match.get('scheduled_dt')
    dt_text = dt.strftime('%Y-%m-%d %H:%M') if isinstance(dt, datetime) else 'TBD'

    if kind == 'upcoming_match':
        title = f'Upcoming: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | {match.get('round')} | {dt_text}"
    elif kind == 'match_result':
        score = score_string(match)
        winner = match.get('winner_name') or 'Winner pending'
        title = f'Result: {p1} vs {p2}'
        detail = f"Winner: {winner} | Score: {score or 'N/A'} | {match.get('tournament')} {match.get('round')}"
    elif kind == 'tournament_completed':
        winner = match.get('winner_name') or 'Winner pending'
        score = score_string(match)
        title = f'Tournament completed: {match.get("tournament")}'
        detail = f"Champion: {winner} | Final: {p1} vs {p2} | Score: {score or 'N/A'}"
    elif kind == 'live_match_starts':
        title = f'🔴 Live started: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | {match.get('round')} | Match is now live"
    elif kind == 'set_completed':
        sets_done = count_completed_sets(match)
        title = f'🎾 Set completed: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | Completed sets: {sets_done} | Live score updated"
    elif kind == 'upset_alert':
        wr = parse_rank((match.get('player1') if winner_side(match) == 'p1' else match.get('player2')).get('rank') if winner_side(match) else None)
        lr = parse_rank((match.get('player2') if winner_side(match) == 'p1' else match.get('player1')).get('rank') if winner_side(match) else None)
        title = f'⚠️ Upset alert: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | Winner rank: {wr or '-'} | Loser rank: {lr or '-'} | Score: {score_string(match) or 'N/A'}"
    elif kind == 'close_match_deciding_set':
        title = f'🔥 Deciding-set match: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | {match.get('round')} | Score: {score_string(match) or 'N/A'}"
    elif kind == 'surface_specific_result':
        title = f'🌱 Surface result: {p1} vs {p2}'
        detail = f"{match.get('surface', '').title()} | Winner: {match.get('winner_name') or 'N/A'} | {match.get('tournament')}"
    elif kind == 'tournament_stage_reminder':
        title = f'🏟 Stage reminder: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | {match.get('round')} | {dt_text}"
    elif kind == 'time_window_schedule_alert':
        title = f'⏰ Upcoming soon: {p1} vs {p2}'
        detail = f"{match.get('tournament')} | {match.get('round')} | Starts at {dt_text}"
    else:
        tracked = rule.get('tracked_player') or ', '.join(rule.get('players') or [])
        title = f'Player reached round: {tracked}'
        detail = f"{match.get('tournament')} | {match.get('round')} | {p1} vs {p2}"

    signature = f"{rule.get('id')}|{kind}|{match.get('id')}|{match.get('tournament')}|{match.get('round')}"
    event_id = hashlib.sha1(signature.encode('utf-8')).hexdigest()

    return {
        'event_id': event_id,
        'kind': kind,
        'match_id': match.get('id'),
        'tour': str(match.get('tour') or '').upper(),
        'tournament': match.get('tournament') or '',
        'round': match.get('round') or '',
        'title': title,
        'detail': detail,
        'player1': p1,
        'player2': p2,
        'scheduled_time': dt_text,
    }


def collect_rule_events(
    rule: Dict[str, Any],
    match_bundle: Dict[str, List[Dict[str, Any]]],
    rule_state: Dict[str, Any],
) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    event_type = rule.get('event_type')
    params = rule.get('params') if isinstance(rule.get('params'), dict) else {}

    if event_type == 'upcoming_match':
        for match in match_bundle.get('upcoming', []):
            if base_rule_match(rule, match):
                events.append(build_event(rule, match, 'upcoming_match'))
        return events

    if event_type == 'match_result':
        for match in match_bundle.get('recent', []):
            if match.get('status') not in {'finished', 'completed'}:
                continue
            if base_rule_match(rule, match):
                events.append(build_event(rule, match, 'match_result'))
        return events

    if event_type == 'tournament_completed':
        for match in match_bundle.get('recent', []):
            if match.get('status') not in {'finished', 'completed'}:
                continue
            if normalize_round_label(match.get('round') or '') != 'F':
                continue
            if base_rule_match(rule, match):
                events.append(build_event(rule, match, 'tournament_completed'))
        return events

    if event_type == 'player_reaches_round':
        tracked = (rule.get('tracked_player') or '').lower().strip()
        tracked_list = [tracked] if tracked else list(rule.get('players') or [])
        if not tracked_list:
            return events
        target_rank = round_rank(rule.get('round_value') or '')
        if target_rank < 0:
            return events

        for source in ('upcoming', 'recent', 'live'):
            for match in match_bundle.get(source, []):
                if not base_rule_match(rule, match):
                    continue
                if int(match.get('round_rank') or -1) < target_rank:
                    continue
                if any(match_contains_player(match, p) for p in tracked_list):
                    events.append(build_event(rule, match, 'player_reaches_round'))
        return events

    if event_type == 'live_match_starts':
        seen = rule_state.setdefault('live_seen', {})
        for match in match_bundle.get('live', []):
            if not base_rule_match(rule, match):
                continue
            match_id = str(match.get('id') or '')
            if not match_id:
                continue
            if seen.get(match_id) == 'live':
                continue
            seen[match_id] = 'live'
            events.append(build_event(rule, match, 'live_match_starts'))
        if len(seen) > 1500:
            keys = sorted(seen.keys(), reverse=True)[:1000]
            rule_state['live_seen'] = {k: seen[k] for k in keys}
        return events

    if event_type == 'set_completed':
        set_progress = rule_state.setdefault('set_progress', {})
        target_set = parse_int(params.get('set_number'), 1, 1, 5)
        for source in ('live', 'recent'):
            for match in match_bundle.get(source, []):
                if not base_rule_match(rule, match):
                    continue
                sets_done = count_completed_sets(match)
                if sets_done < target_set:
                    continue
                match_id = str(match.get('id') or '')
                prev_sets = parse_int(set_progress.get(match_id), 0, 0, 10)
                if sets_done <= prev_sets:
                    continue
                set_progress[match_id] = sets_done
                events.append(build_event(rule, match, 'set_completed'))
        return events

    if event_type == 'upset_alert':
        min_gap = parse_int(params.get('upset_min_rank_gap'), 20, 1, 500)
        for match in match_bundle.get('recent', []):
            if match.get('status') not in {'finished', 'completed'}:
                continue
            if not base_rule_match(rule, match):
                continue
            w_side = winner_side(match)
            if not w_side:
                continue
            winner_player = match.get('player1') if w_side == 'p1' else match.get('player2')
            loser_player = match.get('player2') if w_side == 'p1' else match.get('player1')
            winner_rank = parse_rank((winner_player or {}).get('rank'))
            loser_rank = parse_rank((loser_player or {}).get('rank'))
            if winner_rank is None or loser_rank is None:
                continue
            if winner_rank - loser_rank >= min_gap:
                events.append(build_event(rule, match, 'upset_alert'))
        return events

    if event_type == 'close_match_deciding_set':
        deciding_mode = str(params.get('deciding_mode') or 'deciding_set').lower()
        for match in match_bundle.get('recent', []):
            if match.get('status') not in {'finished', 'completed'}:
                continue
            if not base_rule_match(rule, match):
                continue
            sets_count = count_completed_sets(match)
            if deciding_mode == 'tiebreak':
                if has_tiebreak(match):
                    events.append(build_event(rule, match, 'close_match_deciding_set'))
            elif deciding_mode == 'third_or_fifth':
                if sets_count in {3, 5}:
                    events.append(build_event(rule, match, 'close_match_deciding_set'))
            else:
                if sets_count >= 3:
                    events.append(build_event(rule, match, 'close_match_deciding_set'))
        return events

    if event_type == 'surface_specific_result':
        surface_value = str(params.get('surface_value') or '').strip().lower()
        for match in match_bundle.get('recent', []):
            if match.get('status') not in {'finished', 'completed'}:
                continue
            if not base_rule_match(rule, match):
                continue
            if surface_value and str(match.get('surface') or '').strip().lower() != surface_value:
                continue
            events.append(build_event(rule, match, 'surface_specific_result'))
        return events

    if event_type == 'tournament_stage_reminder':
        rounds = [str(r).upper() for r in (params.get('stage_rounds') or ['QF', 'SF', 'F'])]
        allowed_rounds = set([r for r in rounds if r in ALLOWED_STAGE_ROUNDS]) or {'QF', 'SF', 'F'}
        for source in ('upcoming', 'live'):
            for match in match_bundle.get(source, []):
                if not base_rule_match(rule, match):
                    continue
                if normalize_round_label(match.get('round') or '') not in allowed_rounds:
                    continue
                events.append(build_event(rule, match, 'tournament_stage_reminder'))
        return events

    if event_type == 'time_window_schedule_alert':
        window_hours = parse_int(params.get('window_hours'), 24, 1, 72)
        now_utc = datetime.now(timezone.utc)
        for match in match_bundle.get('upcoming', []):
            if not base_rule_match(rule, match):
                continue
            scheduled_dt = match.get('scheduled_dt')
            if not isinstance(scheduled_dt, datetime):
                continue
            delta_hours = (scheduled_dt - now_utc).total_seconds() / 3600.0
            if 0 <= delta_hours <= window_hours:
                events.append(build_event(rule, match, 'time_window_schedule_alert'))
        return events

    if event_type in {'ranking_milestone', 'title_milestone'}:
        ranking_state = rule_state.setdefault('ranking_state', {})
        ranking_map = fetch_rankings_map(rule.get('tour') or 'both')
        selected_players = list(rule.get('players') or [])
        tracked = str(rule.get('tracked_player') or '').strip().lower()
        if tracked:
            selected_players.insert(0, tracked)
        selected_players = [p for p in selected_players if p]
        if not selected_players:
            return events

        milestone = str(params.get('ranking_milestone') or 'top_100').lower()
        title_target = parse_int(params.get('title_target'), 1, 1, 200)
        emit_on_first_seen = bool(params.get('emit_on_first_seen', True))

        for player_key in selected_players:
            row = ranking_map.get(player_key.lower())
            if not row:
                continue
            prev = ranking_state.get(player_key) if isinstance(ranking_state.get(player_key), dict) else {}
            cur_rank = parse_rank(row.get('rank'))
            cur_career_high = parse_rank(row.get('career_high'))
            cur_titles = parse_int(row.get('titles'), 0, 0, 500)

            if event_type == 'ranking_milestone':
                now_hit = ranking_milestone_reached(milestone, cur_rank, cur_career_high)
                prev_hit = ranking_milestone_reached(milestone, parse_rank(prev.get('rank')), parse_rank(prev.get('career_high')))
                should_emit = now_hit and (not prev_hit or (emit_on_first_seen and not prev))
                if should_emit:
                    title = f'📈 Ranking milestone: {row.get("name")}'
                    detail = f"{row.get('name')} reached {milestone.replace('_', ' ').title()} (current rank #{cur_rank or '-'})"
                    events.append(build_meta_event(rule, 'ranking_milestone', title, detail, f'{player_key}|{milestone}|{cur_rank}', row.get('tour') or ''))
            else:
                prev_titles = parse_int(prev.get('titles'), 0, 0, 500)
                if cur_titles >= title_target and (prev_titles < title_target or (emit_on_first_seen and not prev)):
                    title = f'🏆 Title milestone: {row.get("name")}'
                    detail = f"{row.get('name')} now has {cur_titles} titles (target: {title_target})"
                    events.append(build_meta_event(rule, 'title_milestone', title, detail, f'{player_key}|title|{cur_titles}', row.get('tour') or ''))

            ranking_state[player_key] = {
                'rank': cur_rank,
                'career_high': cur_career_high,
                'titles': cur_titles,
            }
        return events

    if event_type == 'head_to_head_breaker':
        tracked = str(rule.get('tracked_player') or '').strip().lower()
        rival = str(params.get('rival_player') or '').strip().lower()
        min_losses = parse_int(params.get('h2h_min_losses'), 2, 1, 20)
        if not tracked or not rival:
            return events

        pair_matches = []
        for match in match_bundle.get('recent', []):
            if match.get('status') not in {'finished', 'completed'}:
                continue
            if not base_rule_match(rule, match):
                continue
            p1 = str((match.get('player1') or {}).get('name') or '').lower()
            p2 = str((match.get('player2') or {}).get('name') or '').lower()
            if tracked in p1 and rival in p2 or tracked in p2 and rival in p1:
                pair_matches.append(match)

        pair_matches.sort(key=lambda m: m.get('scheduled_dt') or datetime.now(timezone.utc))
        loss_streak = 0
        for match in pair_matches:
            w_side = winner_side(match)
            t_side = player_side(match, tracked)
            if not w_side or not t_side:
                continue
            if w_side == t_side:
                if loss_streak >= min_losses:
                    title = f'⚔️ H2H breaker: {match.get("winner_name")}'
                    detail = f'Broke a {loss_streak}-match losing streak vs rival in {match.get("tournament")} ({score_string(match) or "N/A"})'
                    events.append(build_meta_event(rule, 'head_to_head_breaker', title, detail, f'{tracked}|{rival}|{match.get("id")}', match.get('tour') or ''))
                loss_streak = 0
            else:
                loss_streak += 1
        return events

    return events


def smtp_ready() -> Tuple[bool, str]:
    if not SMTP_HOST:
        return False, 'NOTIFY_SMTP_HOST is not configured'
    if not SMTP_FROM:
        return False, 'NOTIFY_SMTP_FROM (or NOTIFY_SMTP_USER) is not configured'
    return True, ''


def build_email_html(rule: Dict[str, Any], events: List[Dict[str, Any]]) -> str:
    rows = []
    for e in events[:25]:
        rows.append(
            f"""
            <tr>
              <td style=\"padding:10px 12px;border-bottom:1px solid #e7edf5;font-weight:700;color:#14324d;\">{e['title']}</td>
              <td style=\"padding:10px 12px;border-bottom:1px solid #e7edf5;color:#2d4f6b;\">{e['detail']}</td>
              <td style=\"padding:10px 12px;border-bottom:1px solid #e7edf5;color:#4d667f;white-space:nowrap;\">{e['tour']}</td>
            </tr>
            """
        )

    table = ''.join(rows)
    return f"""
    <div style=\"font-family:Arial,Helvetica,sans-serif;background:#f2f6fb;padding:24px;\">
      <div style=\"max-width:760px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d8e2ef;\">
        <div style=\"padding:20px;background:linear-gradient(120deg,#1f5d99,#2a9d8f);color:#fff;\">
          <div style=\"font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;\">Tennis Notification System</div>
          <h2 style=\"margin:6px 0 0;font-size:22px;\">{rule['name']}</h2>
          <p style=\"margin:8px 0 0;opacity:.95;\">{len(events)} new alert(s) matched your rule.</p>
        </div>
        <div style=\"padding:18px 20px;\">
          <table style=\"width:100%;border-collapse:collapse;border:1px solid #e7edf5;border-radius:10px;overflow:hidden;\">
            <thead>
              <tr>
                <th style=\"text-align:left;padding:10px 12px;background:#f7fbff;border-bottom:1px solid #e7edf5;font-size:12px;text-transform:uppercase;color:#5a728a;\">Alert</th>
                <th style=\"text-align:left;padding:10px 12px;background:#f7fbff;border-bottom:1px solid #e7edf5;font-size:12px;text-transform:uppercase;color:#5a728a;\">Details</th>
                <th style=\"text-align:left;padding:10px 12px;background:#f7fbff;border-bottom:1px solid #e7edf5;font-size:12px;text-transform:uppercase;color:#5a728a;\">Tour</th>
              </tr>
            </thead>
            <tbody>
              {table}
            </tbody>
          </table>
          <p style=\"margin-top:14px;color:#6c7f92;font-size:12px;\">Generated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.</p>
        </div>
      </div>
    </div>
    """


def build_email_text(rule: Dict[str, Any], events: List[Dict[str, Any]]) -> str:
    lines = [f"{rule['name']} - {len(events)} new alert(s)", '']
    for e in events:
        lines.append(f"- {e['title']}")
        lines.append(f"  {e['detail']}")
    return '\n'.join(lines)


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    if SMTP_REPLY_TO:
        msg['Reply-To'] = SMTP_REPLY_TO

    msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=25) as smtp:
        if SMTP_USE_TLS:
            smtp.starttls()
        if SMTP_USER:
            smtp.login(SMTP_USER, SMTP_PASS)
        smtp.sendmail(SMTP_FROM, [to_email], msg.as_string())


def send_discord(subject: str, text_body: str) -> None:
    if not NOTIFY_DISCORD_WEBHOOK_URL:
        raise RuntimeError('NOTIFY_DISCORD_WEBHOOK_URL is not configured')
    content = f"**{subject}**\n{text_body[:1800]}"
    response = requests.post(NOTIFY_DISCORD_WEBHOOK_URL, json={'content': content}, timeout=20)
    response.raise_for_status()


def send_telegram(subject: str, text_body: str) -> None:
    if not (NOTIFY_TELEGRAM_BOT_TOKEN and NOTIFY_TELEGRAM_CHAT_ID):
        raise RuntimeError('NOTIFY_TELEGRAM_BOT_TOKEN or NOTIFY_TELEGRAM_CHAT_ID is not configured')
    url = f'https://api.telegram.org/bot{NOTIFY_TELEGRAM_BOT_TOKEN}/sendMessage'
    payload = {'chat_id': NOTIFY_TELEGRAM_CHAT_ID, 'text': f"{subject}\n\n{text_body[:3500]}"}
    response = requests.post(url, json=payload, timeout=20)
    response.raise_for_status()


def process_notifications(manual: bool = False) -> Dict[str, Any]:
    if not run_lock.acquire(blocking=False):
        return {
            'ok': False,
            'message': 'A notification run is already in progress.',
            'sent': 0,
            'matched': 0,
        }

    try:
        store = load_store()
        email = str(store.get('email') or '').strip()
        rules = [r for r in (store.get('rules') or []) if isinstance(r, dict) and r.get('enabled')]
        rule_state = store.setdefault('rule_state', {}) if isinstance(store.get('rule_state'), dict) else {}
        store['rule_state'] = rule_state

        if not email:
            return {'ok': False, 'message': 'No recipient email configured.', 'sent': 0, 'matched': 0}

        ready, reason = smtp_ready()
        if not ready:
            append_history(store, 'error', reason)
            save_store(store)
            return {'ok': False, 'message': reason, 'sent': 0, 'matched': 0}

        if not rules:
            return {'ok': True, 'message': 'No enabled rules found.', 'sent': 0, 'matched': 0}

        matches = fetch_matches()
        sent_count = 0
        matched_count = 0

        for rule in rules:
            rule_id = str(rule.get('id') or '')
            if not rule_id:
                continue
            runtime_state = rule_state.setdefault(rule_id, {})

            if in_quiet_hours(rule):
                append_history(
                    store,
                    'info',
                    f"Skipped '{rule.get('name')}' due to quiet hours.",
                    {'rule_id': rule_id},
                )
                continue

            cooldown_minutes = parse_int(rule.get('cooldown_minutes'), 0, 0, 1440)
            if cooldown_minutes > 0:
                last_sent = runtime_state.get('last_sent_at')
                last_dt = parse_iso_datetime(last_sent) if last_sent else None
                if isinstance(last_dt, datetime):
                    age_min = (datetime.now(timezone.utc) - last_dt).total_seconds() / 60.0
                    if age_min < cooldown_minutes:
                        append_history(
                            store,
                            'info',
                            f"Skipped '{rule.get('name')}' due to cooldown ({cooldown_minutes}m).",
                            {'rule_id': rule_id},
                        )
                        continue

            events = collect_rule_events(rule, matches, runtime_state)
            if not events:
                continue

            matched_count += len(events)
            new_events = []
            for event in events:
                if store['sent_events'].get(event['event_id']):
                    continue
                new_events.append(event)

            if not new_events:
                continue

            severity = str(rule.get('severity') or 'normal').upper()
            subject = f"[{severity}] Tennis Alert: {rule['name']} ({len(new_events)} new)"
            html = build_email_html(rule, new_events)
            text = build_email_text(rule, new_events)
            channels = [ch for ch in (rule.get('channels') or ['email']) if ch in ALLOWED_CHANNELS] or ['email']
            sent_channels: List[str] = []
            failed_channels: List[str] = []

            try:
                if 'email' in channels:
                    send_email(email, subject, html, text)
                    sent_channels.append('email')
                if 'discord' in channels:
                    try:
                        send_discord(subject, text)
                        sent_channels.append('discord')
                    except Exception:
                        failed_channels.append('discord')
                if 'telegram' in channels:
                    try:
                        send_telegram(subject, text)
                        sent_channels.append('telegram')
                    except Exception:
                        failed_channels.append('telegram')
                if 'web_push' in channels:
                    sent_channels.append('web_push')
                    append_history(
                        store,
                        'info',
                        f"Web push queued for '{rule['name']}' (in-app placeholder).",
                        {'rule_id': rule_id},
                    )

                if not sent_channels:
                    raise RuntimeError('No delivery channels succeeded.')

                sent_count += len(new_events)
                runtime_state['last_sent_at'] = now_iso()
                for event in new_events:
                    store['sent_events'][event['event_id']] = now_iso()
                append_history(
                    store,
                    'info',
                    f"Sent {len(new_events)} alert(s) for rule '{rule['name']}' via {', '.join(sent_channels)}.",
                    {'rule_id': rule.get('id'), 'manual': manual, 'failed_channels': failed_channels},
                )
            except Exception as exc:
                append_history(
                    store,
                    'error',
                    f"Failed to send alerts for rule '{rule['name']}'.",
                    {'error': str(exc), 'rule_id': rule.get('id'), 'channels': channels},
                )

        compact_sent_events(store)
        save_store(store)

        return {
            'ok': True,
            'message': 'Notification run completed.',
            'sent': sent_count,
            'matched': matched_count,
        }
    except Exception as exc:
        return {
            'ok': False,
            'message': f'Notification run failed: {exc}',
            'sent': 0,
            'matched': 0,
        }
    finally:
        run_lock.release()


def scheduler_job() -> None:
    result = process_notifications(manual=False)
    if not result.get('ok'):
        store = load_store()
        append_history(store, 'error', result.get('message', 'Unknown scheduler error'))
        save_store(store)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/state', methods=['GET'])
def api_state():
    store = load_store()
    safe_store = {
        'email': store.get('email', ''),
        'enabled': True,
        'rules': store.get('rules', []),
        'history': (store.get('history') or [])[:80],
        'updated_at': store.get('updated_at'),
        'scheduler_seconds': POLL_SECONDS,
        'api_base_url': TENNIS_API_BASE_URL,
        'smtp_ready': smtp_ready()[0],
        'smtp_message': smtp_ready()[1],
    }
    return jsonify({'success': True, 'data': safe_store})


@app.route('/api/options', methods=['GET'])
def api_options():
    tour = str(request.args.get('tour') or 'both').strip().lower()
    if tour not in ALLOWED_TOURS:
        tour = 'both'
    query = str(request.args.get('query') or '').strip().lower()

    tours = ['atp', 'wta'] if tour == 'both' else [tour]
    players: List[Dict[str, Any]] = []
    tournaments: List[Dict[str, Any]] = []

    for t in tours:
        loaded = _load_tour_options(t)
        players.extend(loaded.get('players') or [])
        tournaments.extend(loaded.get('tournaments') or [])
        players.extend(_search_players_from_api(t, query, limit=30 if tour != 'both' else 20))

    def _player_sort_rank(item: Dict[str, Any]) -> int:
        rank = item.get('rank')
        return rank if isinstance(rank, int) and rank > 0 else 10_000

    def _player_quality_score(item: Dict[str, Any]) -> Tuple[int, int, int, str]:
        return (
            _player_sort_rank(item),
            0 if str(item.get('image_url') or '').strip() else 1,
            0 if str(item.get('country') or '').strip() else 1,
            str(item.get('name') or ''),
        )

    def dedupe_players(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        best_by_key: Dict[str, Dict[str, Any]] = {}
        for item in items:
            key = normalize_lookup_token(item.get('name') or '')
            if not key:
                continue
            current = best_by_key.get(key)
            if current is None or _player_quality_score(item) < _player_quality_score(current):
                best_by_key[key] = item
        return list(best_by_key.values())

    def dedupe_tournaments(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        best_by_key: Dict[str, Dict[str, Any]] = {}
        for item in items:
            name = str(item.get('name') or '').strip()
            key = normalize_lookup_token(name)
            if not key:
                continue
            current = best_by_key.get(key)
            if current is None:
                best_by_key[key] = item
                continue
            current_category = str(current.get('category') or '').strip()
            current_surface = str(current.get('surface') or '').strip()
            next_category = str(item.get('category') or '').strip()
            next_surface = str(item.get('surface') or '').strip()
            if (not current_category and next_category) or (not current_surface and next_surface):
                best_by_key[key] = item
        return list(best_by_key.values())

    players = dedupe_players(players)
    tournaments = dedupe_tournaments(tournaments)

    if query:
        query_key = normalize_lookup_token(query)
        players = [p for p in players if query_key in normalize_lookup_token(p.get('name') or '')]
        tournaments = [t for t in tournaments if query_key in normalize_lookup_token(t.get('name') or '')]

    players = sorted(
        players,
        key=lambda p: (
            p.get('rank') if isinstance(p.get('rank'), int) else 10_000,
            str(p.get('name') or ''),
        ),
    )[:500]
    tournaments = sorted(tournaments, key=lambda t: str(t.get('name') or ''))[:300]

    return jsonify({
        'success': True,
        'data': {
            'tour': tour,
            'query': query,
            'categories': category_options_for_tour(tour),
            'players': players,
            'tournaments': tournaments,
            'event_types': sorted(ALLOWED_EVENT_TYPES),
            'surfaces': sorted(ALLOWED_SURFACES),
            'milestones': sorted(ALLOWED_MILESTONES),
            'stage_rounds': sorted(ALLOWED_STAGE_ROUNDS),
            'channels': sorted(ALLOWED_CHANNELS),
            'severity_levels': sorted(ALLOWED_SEVERITY),
        }
    })


@app.route('/api/settings', methods=['POST'])
def api_settings_update():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get('email') or '').strip()

    store = load_store()
    store['email'] = email
    store['enabled'] = True
    append_history(store, 'info', 'Settings updated.', {'email': email, 'enabled': True})
    save_store(store)
    return jsonify({'success': True, 'message': 'Settings saved.'})


@app.route('/api/rules', methods=['POST'])
def api_rules_add():
    payload = request.get_json(silent=True) or {}
    rule, err = normalize_rule(payload)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    store = load_store()
    rules = store.get('rules') or []
    if len(rules) >= MAX_RULES:
        return jsonify({'success': False, 'error': f'Maximum {MAX_RULES} rules allowed.'}), 400

    rules.append(rule)
    store['rules'] = rules
    append_history(store, 'info', f"Rule '{rule['name']}' created.", {'rule_id': rule['id']})
    save_store(store)
    return jsonify({'success': True, 'data': rule})


@app.route('/api/rules/<rule_id>', methods=['PUT'])
def api_rules_update(rule_id: str):
    payload = request.get_json(silent=True) or {}
    payload['id'] = rule_id
    rule, err = normalize_rule(payload)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    store = load_store()
    rules = store.get('rules') or []
    updated = False
    for idx, existing in enumerate(rules):
        if str(existing.get('id')) == rule_id:
            rule['created_at'] = existing.get('created_at') or rule.get('created_at')
            rules[idx] = rule
            updated = True
            break

    if not updated:
        return jsonify({'success': False, 'error': 'Rule not found'}), 404

    store['rules'] = rules
    append_history(store, 'info', f"Rule '{rule['name']}' updated.", {'rule_id': rule_id})
    save_store(store)
    return jsonify({'success': True, 'data': rule})


@app.route('/api/rules/<rule_id>', methods=['DELETE'])
def api_rules_delete(rule_id: str):
    store = load_store()
    rules = store.get('rules') or []
    next_rules = [r for r in rules if str(r.get('id')) != rule_id]
    if len(next_rules) == len(rules):
        return jsonify({'success': False, 'error': 'Rule not found'}), 404

    store['rules'] = next_rules
    append_history(store, 'info', f"Rule '{rule_id}' removed.", {'rule_id': rule_id})
    save_store(store)
    return jsonify({'success': True})


@app.route('/api/run-now', methods=['POST'])
def api_run_now():
    result = process_notifications(manual=True)
    status = 200 if result.get('ok') else 500
    return jsonify({'success': result.get('ok', False), 'data': result}), status


@app.route('/api/test-email', methods=['POST'])
def api_test_email():
    payload = request.get_json(silent=True) or {}
    target = str(payload.get('email') or '').strip()

    store = load_store()
    if not target:
        target = str(store.get('email') or '').strip()

    if not target:
        return jsonify({'success': False, 'error': 'No target email provided.'}), 400

    ready, reason = smtp_ready()
    if not ready:
        return jsonify({'success': False, 'error': reason}), 400

    fake_rule = {'name': 'Test Notification'}
    fake_events = [
        {
            'title': 'Upcoming: Carlos Alcaraz vs Novak Djokovic',
            'detail': 'Indian Wells | SF | 2026-03-15 19:30',
            'tour': 'ATP',
        },
        {
            'title': 'Result: Iga Swiatek vs Aryna Sabalenka',
            'detail': 'Rome | Final | Winner: Iga Swiatek | Score: 6-4 6-3',
            'tour': 'WTA',
        },
    ]

    try:
        send_email(
            target,
            'Tennis Notification System - Test Email',
            build_email_html(fake_rule, fake_events),
            build_email_text(fake_rule, fake_events),
        )
        append_history(store, 'info', 'Test email sent.', {'email': target})
        save_store(store)
        return jsonify({'success': True, 'message': f'Test email sent to {target}.'})
    except Exception as exc:
        append_history(store, 'error', 'Test email failed.', {'error': str(exc), 'email': target})
        save_store(store)
        return jsonify({'success': False, 'error': str(exc)}), 500


@app.route('/api/history/clear', methods=['POST'])
def api_clear_history():
    store = load_store()
    store['history'] = []
    save_store(store)
    return jsonify({'success': True})


def startup() -> None:
    ensure_store_file()
    if not scheduler.get_job('notification_poll'):
        scheduler.add_job(scheduler_job, 'interval', seconds=POLL_SECONDS, id='notification_poll')
    if not scheduler.running:
        scheduler.start()


startup()


if __name__ == '__main__':
    port = int(os.getenv('NOTIFY_PORT', '5090'))
    app.run(host='0.0.0.0', port=port, debug=True)
