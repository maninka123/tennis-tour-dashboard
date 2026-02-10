"""
Tennis Dashboard - Flask Backend Server
Provides REST API and WebSocket for real-time tennis data
"""

from flask import Flask, jsonify, request, send_from_directory, redirect
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import time
import sys
import os
import threading
import subprocess
import json
import re
from tennis_api import tennis_fetcher
from config import Config


# --- Player Image Manager ---
class PlayerImageManager:
    def __init__(self, data_root):
        self.data_root = data_root
        self.mapping = {'atp': {}, 'wta': {}}
        self.lock = threading.Lock()
        
    def scan_players(self):
        """Background task to scan player IDs from profile files"""
        print("[PlayerImageManager] Starting background scan...")
        sys.stdout.flush()
        for tour in ['atp', 'wta']:
            print(f"[PlayerImageManager] Scanning {tour}...")
            sys.stdout.flush()
            tour_idx = {}
            tour_path = os.path.join(self.data_root, tour)
            if not os.path.exists(tour_path): 
                print(f"[PlayerImageManager] {tour} path not found: {tour_path}")
                continue
            
            try:
                count = 0
                for entry in os.scandir(tour_path):
                    if not entry.is_dir(): continue
                    # Look for profile.json
                    try:
                        p_file = os.path.join(entry.path, 'profile.json')
                        if os.path.exists(p_file):
                            with open(p_file, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                pid = data.get('player_id')
                                
                                # Process WTA ID from URL if missing
                                if not pid and tour == 'wta':
                                    url = data.get('url', '')
                                    m = re.search(r'players/(\d+)/', url)
                                    if m: pid = m.group(1)
                                
                                if pid:
                                    # Store mapping ID -> {path, external_url}
                                    tour_idx[str(pid).upper()] = {
                                        'path': entry.path,
                                        'external_url': data.get('image_url')
                                    }
                                    count += 1
                    except Exception as e:
                        print(f"[PlayerImageManager] Error reading profile in {entry.name}: {e}")
                        continue
                print(f"[PlayerImageManager] Scanned {count} entries for {tour}")
            except Exception as e:
                print(f"[PlayerImageManager] Error scanning {tour}: {e}")
            
            with self.lock:
                self.mapping[tour] = tour_idx
        print(f"[PlayerImageManager] Indexed {len(self.mapping['atp'])} ATP and {len(self.mapping['wta'])} WTA players")
        sys.stdout.flush()

    def get_player_info(self, tour, player_id):
        if not player_id: return None
        pid = str(player_id).upper()
        
        # Try finding by ID
        with self.lock:
            info = self.mapping.get(tour, {}).get(pid)
        
        if info:
            # Check for local image file
            for ext in ['.jpg', '.png', '.jpeg']:
                img_path = os.path.join(info['path'], f'image{ext}')
                if os.path.exists(img_path):
                    return {'type': 'local', 'path': img_path}
            
            # Fallback to external URL if known
            if info.get('external_url'):
                return {'type': 'external', 'url': info['external_url']}
                
        return None

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
image_manager = PlayerImageManager(DATA_DIR)
# Start scanning in background
threading.Thread(target=image_manager.scan_players, daemon=True).start()


app = Flask(__name__)
app.config['SECRET_KEY'] = 'tennis_dashboard_secret_2024'
CORS(app, origins="*", resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', ping_timeout=60, ping_interval=25)

# --- System Update State & Logic ---
SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "Update player stats")
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
PYTHON_EXE = sys.executable

# ============== Frontend Routes ==============

@app.route('/')
def serve_index():
    """Serve the main dashboard page"""
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/update')
def serve_update():
    """Serve the system update page"""
    return send_from_directory(FRONTEND_DIR, 'update.html')


@app.route('/Images/<path:filename>')
def serve_images(filename):
    """Serve images from root Images folder"""
    images_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Images")
    try:
        return send_from_directory(images_dir, filename)
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/player/<tour>/<player_id>/image')
def serve_player_image(tour, player_id):
    """Serve player image from local data or redirect"""
    info = image_manager.get_player_info(tour, player_id)
    
    if info:
        if info['type'] == 'local':
            return send_from_directory(os.path.dirname(info['path']), os.path.basename(info['path']))
        elif info['type'] == 'external':
            return redirect(info['url'])
            
    # Check fallback param
    fallback = request.args.get('fallback')
    if fallback:
        return redirect(fallback)
        
    return jsonify({'error': 'Image not found'}), 404


@app.route('/<path:filename>')
def serve_frontend(filename):
    """Serve frontend assets (CSS, JS, images)"""
    try:
        return send_from_directory(FRONTEND_DIR, filename)
    except FileNotFoundError:
        # If file not found, return 404
        return jsonify({'error': 'Not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- System Update State & Logic ---

update_state = {
    "status": "idle",  # idle, running, completed, error
    "current_task": "",
    "log": [],
    "progress": 0
}
update_lock = threading.Lock()
update_thread = None  # Handle to the background thread

def run_update_process(targets):
    global update_state
    with update_lock:
        update_state["status"] = "running"
        update_state["log"] = ["Starting update process..."]
        update_state["progress"] = 0
    
    try:
        tasks = []
        if "atp" in targets:
            tasks.append(("[Update] Atp_player_stats.py", "Updating ATP Player Stats"))
        if "wta" in targets:
            tasks.append(("[Update] Wta_player_stats.py", "Updating WTA Player Stats"))
        if "gs" in targets:
            tasks.append(("[Update] atp_player_grandslam.py", "Updating ATP Grand Slam Data"))
            
        total_tasks = len(tasks)
        
        for idx, (script_name, desc) in enumerate(tasks):
            with update_lock:
                update_state["current_task"] = desc
                update_state["log"].append(f"Running: {desc}...")
                
            script_path = os.path.join(SCRIPTS_DIR, script_name)
            
            # Run script with unbuffered output (-u)
            process = subprocess.Popen(
                [PYTHON_EXE, "-u", script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, # Merge stderr into stdout
                text=True,
                cwd=SCRIPTS_DIR,
                bufsize=1, # Line buffered
                universal_newlines=True
            )
            
            # Stream output in real-time
            for line in iter(process.stdout.readline, ''):
                line = line.strip()
                if line:
                    with update_lock:
                        # Append to log limits size to prevent memory issues if very long
                        if len(update_state["log"]) > 1000:
                            update_state["log"] = update_state["log"][-900:]
                        update_state["log"].append(line)
            
            # Wait for completion
            process.wait()
            
            with update_lock:
                if process.returncode == 0:
                    update_state["log"].append(f"Completed: {desc}")
                else:
                    update_state["log"].append(f"Error in {desc} (Exit Code {process.returncode})")
                
                # Update progress
                update_state["progress"] = int(((idx + 1) / total_tasks) * 100)

        with update_lock:
            update_state["status"] = "completed"
            update_state["log"].append("All updates completed successfully.")
            
    except Exception as e:
        with update_lock:
            update_state["status"] = "error"
            update_state["log"].append(f"Critical Error: {str(e)}")

@app.route('/api/system/analysis', methods=['GET'])
def get_system_analysis():
    script_path = os.path.join(SCRIPTS_DIR, "[Analysis] Update stats.py")
    try:
        result = subprocess.run(
            [PYTHON_EXE, script_path, "--json"],
            capture_output=True,
            text=True,
            cwd=SCRIPTS_DIR
        )
        if result.returncode != 0:
            return jsonify({"error": "Analysis script failed", "details": result.stderr}), 500
            
        data = json.loads(result.stdout)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/system/update', methods=['POST'])
def start_system_update():
    targets = request.json.get('targets', [])
    if not targets:
        return jsonify({"error": "No targets specified"}), 400
        
    global update_state, update_thread
    
    # Check if thread is actually alive to prevent stuck "running" state
    if update_state["status"] == "running":
        if update_thread and update_thread.is_alive():
            return jsonify({"error": "Update already in progress"}), 409
        else:
            # Dead thread but status says running -> Reset
            with update_lock:
                update_state["status"] = "error"
                update_state["log"].append("Previous update process died unexpectedly.")
        
    # Start background thread
    update_thread = threading.Thread(target=run_update_process, args=(targets,))
    update_thread.daemon = True
    update_thread.start()
    
    return jsonify({"status": "started"})

@app.route('/api/system/update/status', methods=['GET'])
def get_update_status():
    return jsonify(update_state)



# Dedicated live-score background loop state
live_scores_thread_started = False
live_scores_thread_lock = threading.Lock()

def broadcast_live_scores():
    """Broadcast live scores to all connected clients"""
    try:
        atp_scores = tennis_fetcher.fetch_live_scores('atp')
        wta_scores = tennis_fetcher.fetch_live_scores('wta')
        
        socketio.emit('live_scores_update', {
            'atp': atp_scores,
            'wta': wta_scores,
            'timestamp': time.time()
        })
    except Exception as e:
        print(f"Error broadcasting live scores: {e}")

def _live_scores_loop():
    """Run live score updates in a dedicated background task."""
    while True:
        broadcast_live_scores()
        socketio.sleep(30)


def ensure_live_scores_thread():
    """Start live score background task once."""
    global live_scores_thread_started
    with live_scores_thread_lock:
        if live_scores_thread_started:
            return
        socketio.start_background_task(_live_scores_loop)
        live_scores_thread_started = True


# Start dedicated live updates loop.
ensure_live_scores_thread()


# ============== REST API Routes ==============

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Tennis Dashboard API is running'})


@app.route('/api/intro-gifs', methods=['GET'])
def get_intro_gifs():
    """Get list of intro gif files for loading screen"""
    try:
        # Path to intro gifs folder relative to backend
        gifs_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Images', 'intro gifs')
        
        # Get all gif files from the folder
        gif_files = []
        if os.path.exists(gifs_folder):
            all_files = os.listdir(gifs_folder)
            gif_files = [f for f in all_files if f.lower().endswith('.gif')]
            gif_files.sort()  # Sort for consistency
        
        return jsonify({
            'success': True,
            'data': gif_files,
            'count': len(gif_files)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'data': []}), 500


@app.route('/api/live-scores', methods=['GET'])
def get_live_scores():
    """Get current live match scores"""
    tour = str(request.args.get('tour', 'both')).strip().lower()  # 'atp', 'wta', or 'both'
    if tour not in {'atp', 'wta', 'both'}:
        tour = 'both'
    
    try:
        scores = tennis_fetcher.fetch_live_scores(tour)
        return jsonify({
            'success': True,
            'data': scores,
            'count': len(scores)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recent-matches', methods=['GET'])
def get_recent_matches():
    """Get recently completed matches"""
    tour = str(request.args.get('tour', 'both')).strip().lower()
    if tour not in {'atp', 'wta', 'both'}:
        tour = 'both'
    limit = request.args.get('limit', 20, type=int)
    
    try:
        matches = tennis_fetcher.fetch_recent_matches(tour, limit)
        return jsonify({
            'success': True,
            'data': matches,
            'count': len(matches)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/upcoming-matches', methods=['GET'])
def get_upcoming_matches():
    """Get upcoming matches in the next 7 days (or more if requested)"""
    tour = str(request.args.get('tour', 'both')).strip().lower()
    if tour not in {'atp', 'wta', 'both'}:
        tour = 'both'
    days = request.args.get('days', 7, type=int)
    
    try:
        matches = tennis_fetcher.fetch_upcoming_matches(tour, days=days)
        return jsonify({
            'success': True,
            'data': matches,
            'count': len(matches)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/rankings/<tour>', methods=['GET'])
def get_rankings(tour):
    """Get ATP or WTA rankings"""
    limit = request.args.get('limit', 200, type=int)
    limit = min(limit, 400 if tour == 'wta' else 200)
    
    try:
        rankings = tennis_fetcher.fetch_rankings(tour, limit)
        payload = {
            'success': True,
            'data': rankings,
            'count': len(rankings)
        }
        if tour == 'wta':
            payload['meta'] = tennis_fetcher.get_wta_rankings_status()
        elif tour == 'atp':
            payload['meta'] = tennis_fetcher.get_atp_rankings_status()
        return jsonify(payload)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/rankings/wta/status', methods=['GET'])
def get_wta_rankings_status():
    """Get WTA rankings file metadata."""
    try:
        return jsonify({
            'success': True,
            'data': tennis_fetcher.get_wta_rankings_status()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/rankings/wta/refresh', methods=['POST'])
def refresh_wta_rankings():
    """Refresh WTA rankings CSV and archive previous file."""
    try:
        status = tennis_fetcher.refresh_wta_rankings_csv()
        # Broadcast scoreboard/rankings refresh event.
        socketio.emit('rankings_update', {
            'tour': 'wta',
            'timestamp': time.time()
        })
        return jsonify({
            'success': True,
            'data': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/rankings/atp/status', methods=['GET'])
def get_atp_rankings_status():
    """Get ATP rankings file metadata."""
    try:
        return jsonify({
            'success': True,
            'data': tennis_fetcher.get_atp_rankings_status()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/rankings/atp/refresh', methods=['POST'])
def refresh_atp_rankings():
    """Refresh ATP rankings CSV and archive previous file."""
    try:
        status = tennis_fetcher.refresh_atp_rankings_csv()
        socketio.emit('rankings_update', {
            'tour': 'atp',
            'timestamp': time.time()
        })
        return jsonify({
            'success': True,
            'data': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats/atp/status', methods=['GET'])
def get_atp_stats_status():
    """Get ATP Stat Zone file metadata."""
    try:
        return jsonify({
            'success': True,
            'data': tennis_fetcher.get_atp_stats_status()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats/atp/leaderboard', methods=['GET'])
def get_atp_stats_leaderboard():
    """Get ATP Stat Zone leaderboard payload from cached CSV."""
    try:
        data = tennis_fetcher.fetch_atp_stats_leaderboard()
        return jsonify({
            'success': True,
            'data': data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats/atp/refresh', methods=['POST'])
def refresh_atp_stats():
    """Refresh ATP Stat Zone CSV and archive previous file."""
    try:
        status = tennis_fetcher.refresh_atp_stats_csv()
        socketio.emit('stats_update', {
            'tour': 'atp',
            'scope': 'stat_zone',
            'timestamp': time.time()
        })
        return jsonify({
            'success': True,
            'data': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats/wta/status', methods=['GET'])
def get_wta_stats_status():
    """Get WTA Stat Zone file metadata."""
    try:
        return jsonify({
            'success': True,
            'data': tennis_fetcher.get_wta_stats_status()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats/wta/leaderboard', methods=['GET'])
def get_wta_stats_leaderboard():
    """Get WTA Stat Zone leaderboard payload from cached CSV."""
    try:
        data = tennis_fetcher.fetch_wta_stats_leaderboard()
        return jsonify({
            'success': True,
            'data': data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats/wta/refresh', methods=['POST'])
def refresh_wta_stats():
    """Refresh WTA Stat Zone CSV and archive previous file."""
    try:
        status = tennis_fetcher.refresh_wta_stats_csv()
        socketio.emit('stats_update', {
            'tour': 'wta',
            'scope': 'stat_zone',
            'timestamp': time.time()
        })
        return jsonify({
            'success': True,
            'data': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/tournaments/<tour>', methods=['GET'])
def get_tournaments(tour):
    """Get tournament calendar"""
    year = request.args.get('year', type=int)
    
    try:
        tournaments = tennis_fetcher.fetch_tournaments(tour, year)
        return jsonify({
            'success': True,
            'data': tournaments,
            'count': len(tournaments)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/tournaments/<tour>/status', methods=['GET'])
def get_tournaments_status(tour):
    """Get tournament file metadata for a tour."""
    try:
        status = tennis_fetcher.get_tournaments_status(tour)
        return jsonify({
            'success': True,
            'data': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/tournaments/<tour>/refresh', methods=['POST'])
def refresh_tournaments(tour):
    """Refresh tournament JSON files for a tour."""
    payload = request.get_json(silent=True) or {}
    year = request.args.get('year', type=int)
    if year is None:
        year = payload.get('year')
    full_refresh = request.args.get('full_refresh', '').strip().lower() in {'1', 'true', 'yes'}
    if not full_refresh:
        full_refresh = bool(payload.get('full_refresh'))

    try:
        status = tennis_fetcher.refresh_tournaments_json(
            tour=tour,
            year=year,
            full_refresh=full_refresh
        )
        socketio.emit('tournaments_update', {
            'tour': str(tour or '').strip().lower(),
            'timestamp': time.time()
        })
        return jsonify({
            'success': True,
            'data': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/tournament/<int:tournament_id>/bracket', methods=['GET'])
def get_tournament_bracket(tournament_id):
    """Get tournament bracket/draw"""
    tour = request.args.get('tour', default='atp')
    try:
        bracket = tennis_fetcher.fetch_tournament_bracket(tournament_id, tour)
        return jsonify({
            'success': True,
            'data': bracket
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/player/<int:player_id>', methods=['GET'])
def get_player(player_id):
    """Get player details"""
    try:
        player = tennis_fetcher.fetch_player_details(player_id)
        if player:
            return jsonify({
                'success': True,
                'data': player
            })
        else:
            return jsonify({'success': False, 'error': 'Player not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/match-stats/wta', methods=['GET'])
def get_wta_match_stats():
    """Get on-demand WTA match stats for a specific match."""
    event_id = request.args.get('event_id', type=int)
    event_year = request.args.get('event_year', type=int)
    match_id = (request.args.get('match_id') or '').strip()
    live_flag = str(request.args.get('live') or '').strip().lower() in ('1', 'true', 'yes', 'y')

    if not event_id or not event_year or not match_id:
        return jsonify({
            'success': False,
            'error': 'event_id, event_year and match_id are required'
        }), 400

    try:
        stats = tennis_fetcher.fetch_wta_match_stats(
            event_id=event_id,
            event_year=event_year,
            match_id=match_id,
            force_refresh=live_flag
        )
        if not stats:
            return jsonify({'success': False, 'error': 'Match stats not available'}), 404
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/match-stats/atp', methods=['GET'])
def get_atp_match_stats():
    """Get on-demand ATP match stats using ATP stats-centre URL."""
    stats_url = (request.args.get('stats_url') or '').strip()
    if not stats_url:
        return jsonify({
            'success': False,
            'error': 'stats_url is required'
        }), 400

    try:
        stats = tennis_fetcher.fetch_atp_match_stats(stats_url=stats_url)
        if not stats:
            return jsonify({'success': False, 'error': 'Match stats not available'}), 404
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/player-schedule', methods=['GET'])
def get_player_schedule():
    """Fetch next scheduled match for a player (Flashscore fixtures)."""
    player_name = (request.args.get('name') or '').strip()
    tour = (request.args.get('tour') or '').strip().lower()

    if not player_name:
        return jsonify({'success': False, 'error': 'name is required'}), 400

    try:
        payload = tennis_fetcher.fetch_player_next_fixture(player_name=player_name, tour=tour)
        return jsonify({'success': True, 'data': payload})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/h2h/wta/search', methods=['GET'])
def search_wta_h2h_players():
    """Search WTA players for H2H autocomplete."""
    query = request.args.get('query', '').strip()
    limit = request.args.get('limit', 8, type=int)
    if not query:
        return jsonify({'success': True, 'data': [], 'count': 0})

    try:
        players = tennis_fetcher.search_wta_players_for_h2h(query, limit=limit)
        return jsonify({
            'success': True,
            'data': players,
            'count': len(players)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/h2h/atp/search', methods=['GET'])
def search_atp_h2h_players():
    """Search ATP players for H2H autocomplete."""
    query = request.args.get('query', '').strip()
    limit = request.args.get('limit', 8, type=int)
    if not query:
        return jsonify({'success': True, 'data': [], 'count': 0})

    try:
        players = tennis_fetcher.search_atp_players_for_h2h(query, limit=limit)
        return jsonify({
            'success': True,
            'data': players,
            'count': len(players)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/h2h/wta', methods=['GET'])
def get_wta_h2h():
    """Get WTA head-to-head details for two players."""
    player1_id = request.args.get('player1_id', type=int)
    player2_id = request.args.get('player2_id', type=int)
    year = request.args.get('year', 2026, type=int)
    meetings = request.args.get('meetings', 5, type=int)

    if not player1_id or not player2_id:
        return jsonify({'success': False, 'error': 'player1_id and player2_id are required'}), 400
    if player1_id == player2_id:
        return jsonify({'success': False, 'error': 'Please choose two different players'}), 400

    try:
        payload = tennis_fetcher.fetch_wta_h2h_details(
            player1_id=player1_id,
            player2_id=player2_id,
            year=year,
            meetings_limit=meetings
        )
        return jsonify({
            'success': True,
            'data': payload
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/h2h/atp', methods=['GET'])
def get_atp_h2h():
    """Get ATP head-to-head details for two players."""
    player1_code = request.args.get('player1_code', '').strip()
    player2_code = request.args.get('player2_code', '').strip()
    year = request.args.get('year', 2026, type=int)
    meetings = request.args.get('meetings', 5, type=int)

    if not player1_code or not player2_code:
        return jsonify({'success': False, 'error': 'player1_code and player2_code are required'}), 400
    if player1_code.upper() == player2_code.upper():
        return jsonify({'success': False, 'error': 'Please choose two different players'}), 400

    try:
        payload = tennis_fetcher.fetch_atp_h2h_details(
            player1_code=player1_code,
            player2_code=player2_code,
            year=year,
            meetings_limit=meetings
        )
        return jsonify({
            'success': True,
            'data': payload
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get tournament categories and colors"""
    return jsonify({
        'success': True,
        'data': Config.TOURNAMENT_CATEGORIES
    })


# ============== WebSocket Events ==============

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    ensure_live_scores_thread()
    # Send initial data on connect
    emit('connected', {'message': 'Connected to Tennis Dashboard'})
    
    # Send current live scores
    atp_scores = tennis_fetcher.fetch_live_scores('atp')
    wta_scores = tennis_fetcher.fetch_live_scores('wta')
    emit('live_scores_update', {
        'atp': atp_scores,
        'wta': wta_scores,
        'timestamp': time.time()
    })


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')


@socketio.on('subscribe_tournament')
def handle_subscribe_tournament(data):
    """Subscribe to tournament updates"""
    tournament_id = data.get('tournament_id')
    print(f'Client subscribed to tournament {tournament_id}')


@socketio.on('request_scores')
def handle_request_scores(data):
    """Handle manual score update request"""
    tour = data.get('tour', 'both')
    scores = tennis_fetcher.fetch_live_scores(tour)
    emit('live_scores_update', {
        tour: scores,
        'timestamp': time.time()
    })


# ============== Error Handlers ==============

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Resource not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ============== Main ==============

if __name__ == '__main__':
    print("=" * 50)
    print("Tennis Dashboard API Server")
    print("=" * 50)
    print(f"Starting server on http://{Config.HOST}:{Config.PORT}")
    print("WebSocket enabled for real-time updates")
    print("=" * 50)
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        log_output=True,
        allow_unsafe_werkzeug=True,
    )
