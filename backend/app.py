"""
Tennis Dashboard - Flask Backend Server
Provides REST API and WebSocket for real-time tennis data
"""

from flask import Flask, Response, jsonify, request, send_from_directory, redirect
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import time
import sys
import os
import logging
import threading
import subprocess
import json
import re
import requests
import atexit
from datetime import datetime
from tennis_api import tennis_fetcher
from config import Config

try:
    import simple_websocket  # noqa: F401
    HAS_SIMPLE_WEBSOCKET = True
except Exception:
    HAS_SIMPLE_WEBSOCKET = False


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
            # Check for local image file (case-insensitive, Linux-safe).
            # Accept common web formats beyond jpg/png to avoid false misses.
            try:
                for entry in os.scandir(info['path']):
                    if not entry.is_file():
                        continue
                    lower_name = entry.name.lower()
                    if not lower_name.startswith('image.'):
                        continue
                    ext = os.path.splitext(lower_name)[1]
                    if ext in {'.jpg', '.jpeg', '.png', '.webp', '.avif'}:
                        return {'type': 'local', 'path': entry.path}
            except Exception:
                pass
            
            # Fallback to external URL if known
            if info.get('external_url'):
                url = str(info['external_url']).strip()
                if url.startswith('//'):
                    url = f'https:{url}'
                elif url.startswith('http://'):
                    # Prevent mixed-content blocking on HTTPS deployments (Render).
                    url = f"https://{url[len('http://'):]}"
                return {'type': 'external', 'url': url}
                
        return None

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
image_manager = PlayerImageManager(DATA_DIR)
# Start scanning in background
threading.Thread(target=image_manager.scan_players, daemon=True).start()


app = Flask(__name__)
app.config['SECRET_KEY'] = 'tennis_dashboard_secret_2024'
CORS(app, origins="*", resources={r"/api/*": {"origins": "*"}})

# Keep console output focused on warnings/errors instead of per-request 200 logs.
# Override with QUIET_HTTP_LOGS=false if detailed HTTP access logs are needed.
if os.getenv('QUIET_HTTP_LOGS', 'true').strip().lower() in {'1', 'true', 'yes', 'on'}:
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    app.logger.setLevel(logging.WARNING)


def _env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


# Werkzeug + threading mode can crash on websocket upgrade in local debug sessions.
# Prefer long-polling locally unless explicitly overridden.
allow_upgrades_default = HAS_SIMPLE_WEBSOCKET and not Config.DEBUG
allow_socket_upgrades = _env_bool('SOCKETIO_ALLOW_UPGRADES', allow_upgrades_default)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25,
    allow_upgrades=allow_socket_upgrades,
)

# --- System Update State & Logic ---
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "Update player stats")
FRONTEND_DIR = os.path.join(REPO_ROOT, "frontend")
DATA_ANALYSIS_ATP_DIR = os.path.join(REPO_ROOT, "data_analysis")
DATA_ANALYSIS_WTA_DIR = os.path.join(REPO_ROOT, "data_analysis", "wta")
NOTIFICATION_APP_DIR = os.path.join(REPO_ROOT, "backend", "notification_system")
HISTORIC_DATA_ATP_DIR = os.path.join(REPO_ROOT, "historic data")
HISTORIC_DATA_WTA_DIR = os.path.join(REPO_ROOT, "historic data_wta")
DATA_ATP_DIR = os.path.join(REPO_ROOT, "data", "atp")
DATA_WTA_DIR = os.path.join(REPO_ROOT, "data", "wta")
PYTHON_EXE = sys.executable
NOTIFICATION_APP_HOST = os.getenv('NOTIFICATION_HOST', '127.0.0.1').strip() or '127.0.0.1'
NOTIFICATION_APP_PORT = int(os.getenv('NOTIFICATION_PORT', '5090'))
NOTIFICATION_EXTERNAL_URL = os.getenv('NOTIFICATION_EXTERNAL_URL', '').strip()
notification_process = None
notification_process_lock = threading.Lock()
last_notification_launch_error = ''
NOTIFICATION_LAUNCH_LOG = os.path.join(REPO_ROOT, 'backend', 'notification_system', 'storage', 'launcher.log')


def _notification_python_candidates():
    candidates = [PYTHON_EXE]
    project_venv_python = os.path.join(REPO_ROOT, 'backend', 'venv', 'bin', 'python')
    if os.path.exists(project_venv_python):
        candidates.append(project_venv_python)
    candidates.extend(['python3', 'python'])
    # Preserve order but remove duplicates.
    seen = set()
    unique = []
    for item in candidates:
        key = str(item).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(key)
    return unique

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
    images_dir = os.path.join(REPO_ROOT, "Images")
    try:
        return send_from_directory(images_dir, filename)
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _analysis_root_for_tour(tour):
    tour_name = str(tour or '').strip().lower()
    if tour_name == 'atp':
        return DATA_ANALYSIS_ATP_DIR
    if tour_name == 'wta':
        return DATA_ANALYSIS_WTA_DIR
    return None


def _serve_file(directory, filename, not_found_message='Not found'):
    try:
        return send_from_directory(directory, filename)
    except FileNotFoundError:
        return jsonify({'error': not_found_message}), 404
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


def _notification_base_url():
    if NOTIFICATION_EXTERNAL_URL:
        return NOTIFICATION_EXTERNAL_URL.rstrip('/')
    return f'http://{NOTIFICATION_APP_HOST}:{_notification_effective_port()}'


def _notification_effective_port():
    port = NOTIFICATION_APP_PORT
    if port == Config.PORT:
        return 5090
    return port


def _notification_healthcheck(timeout=1.2):
    base_url = _notification_base_url()
    candidate_urls = [f'{base_url}/api/state']
    # Local robustness: if one loopback name is unavailable, try the other.
    if base_url.startswith('http://127.0.0.1:'):
        candidate_urls.append(base_url.replace('127.0.0.1', 'localhost', 1) + '/api/state')
    elif base_url.startswith('http://localhost:'):
        candidate_urls.append(base_url.replace('localhost', '127.0.0.1', 1) + '/api/state')

    for url in candidate_urls:
        try:
            probe = requests.get(url, timeout=timeout)
            if probe.status_code == 200:
                return True
        except Exception:
            continue
    return False


def _clear_notification_port_listeners():
    if NOTIFICATION_EXTERNAL_URL:
        return
    if NOTIFICATION_APP_PORT == Config.PORT:
        return
    try:
        output = subprocess.check_output(
            ['lsof', '-tiTCP:%s' % NOTIFICATION_APP_PORT, '-sTCP:LISTEN'],
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except Exception:
        return

    pids = []
    for token in output.split():
        try:
            pid = int(token.strip())
        except Exception:
            continue
        if pid <= 0 or pid == os.getpid():
            continue
        pids.append(pid)

    for pid in pids:
        try:
            os.kill(pid, 15)
        except Exception:
            pass
    if pids:
        time.sleep(0.4)
        for pid in pids:
            try:
                os.kill(pid, 9)
            except Exception:
                pass


def _start_notification_process_if_needed(wait_seconds=6.0):
    global notification_process
    global last_notification_launch_error

    if NOTIFICATION_EXTERNAL_URL:
        return _notification_healthcheck(timeout=2.0)

    if _notification_healthcheck():
        return True

    with notification_process_lock:
        if _notification_healthcheck():
            return True

        _clear_notification_port_listeners()
        if _notification_healthcheck():
            return True

        # If we own a running process but healthcheck is failing, recycle it.
        if notification_process is not None and notification_process.poll() is None:
            try:
                notification_process.terminate()
                notification_process.wait(timeout=1.5)
            except Exception:
                try:
                    notification_process.kill()
                except Exception:
                    pass
            finally:
                notification_process = None

        env = os.environ.copy()
        env['NOTIFY_PORT'] = str(_notification_effective_port())
        env['NOTIFY_DEBUG'] = '0'
        env['PYTHONUNBUFFERED'] = '1'
        # Prevent Flask/Werkzeug inherited FD reuse from the parent dev server.
        env.pop('WERKZEUG_SERVER_FD', None)
        env.pop('WERKZEUG_RUN_MAIN', None)
        env.pop('FLASK_RUN_FROM_CLI', None)
        launchers = _notification_python_candidates()
        launch_errors = []
        try:
            os.makedirs(os.path.dirname(NOTIFICATION_LAUNCH_LOG), exist_ok=True)
        except Exception:
            pass
        for py_exe in launchers:
            log_handle = None
            try:
                log_handle = open(NOTIFICATION_LAUNCH_LOG, 'a', encoding='utf-8')
                log_handle.write(f'\n[{datetime.now().isoformat()}] launching via {py_exe} on port {_notification_effective_port()}\n')
                log_handle.flush()
                notification_process = subprocess.Popen(
                    [py_exe, '-u', 'app.py'],
                    cwd=NOTIFICATION_APP_DIR,
                    env=env,
                    stdout=log_handle,
                    stderr=log_handle,
                    start_new_session=True,
                )
            except Exception:
                launch_errors.append(f'{py_exe}: spawn_failed')
                notification_process = None
                if log_handle is not None:
                    try:
                        log_handle.close()
                    except Exception:
                        pass
                continue

            deadline = time.time() + max(2.0, float(wait_seconds))
            while time.time() < deadline:
                if _notification_healthcheck(timeout=0.9):
                    last_notification_launch_error = ''
                    if log_handle is not None:
                        try:
                            log_handle.close()
                        except Exception:
                            pass
                    return True
                if notification_process.poll() is not None:
                    launch_errors.append(f'{py_exe}: exited_{notification_process.poll()}')
                    break
                time.sleep(0.25)
            if log_handle is not None:
                try:
                    log_handle.close()
                except Exception:
                    pass

            if notification_process.poll() is None:
                # Process is alive but still not healthy, keep trying remaining launchers.
                try:
                    notification_process.terminate()
                    notification_process.wait(timeout=1.0)
                except Exception:
                    try:
                        notification_process.kill()
                    except Exception:
                        pass
                notification_process = None
                continue

        if launch_errors:
            last_notification_launch_error = '; '.join(launch_errors)

    return _notification_healthcheck(timeout=1.5)


def _stop_notification_process():
    global notification_process
    with notification_process_lock:
        process = notification_process
        notification_process = None
    if not process or process.poll() is not None:
        return
    try:
        process.terminate()
        process.wait(timeout=1.5)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


atexit.register(_stop_notification_process)


def _load_json_list(path):
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            payload = json.load(fh)
        return payload if isinstance(payload, list) else []
    except Exception:
        return []


def _normalize_matches_tour(matches, tour_code):
    normalized = []
    expected = str(tour_code or '').strip().upper()
    for row in matches if isinstance(matches, list) else []:
        if not isinstance(row, dict):
            continue
        out = dict(row)
        if not str(out.get('tour') or '').strip():
            out['tour'] = expected
        normalized.append(out)
    return normalized


@app.route('/api/player/<tour>/<player_id>/image')
def serve_player_image(tour, player_id):
    """Serve player image from local data or redirect"""
    info = image_manager.get_player_info(tour, player_id)
    if not info:
        # Render/Gunicorn safety: if worker started before background scan completed
        # (or index became stale), rebuild once on-demand and retry.
        try:
            image_manager.scan_players()
        except Exception:
            pass
        info = image_manager.get_player_info(tour, player_id)
    
    if info:
        if info['type'] == 'local':
            return send_from_directory(os.path.dirname(info['path']), os.path.basename(info['path']))
        elif info['type'] == 'external':
            return redirect(info['url'])
            
    # Check fallback param
    fallback = request.args.get('fallback')
    if fallback:
        fallback_url = str(fallback).strip()
        if fallback_url.startswith('//'):
            fallback_url = f'https:{fallback_url}'
        elif fallback_url.startswith('http://'):
            fallback_url = f"https://{fallback_url[len('http://'):]}"
        return redirect(fallback_url)
        
    return jsonify({'error': 'Image not found'}), 404


@app.route('/analysis')
@app.route('/analysis/')
def serve_analysis_root():
    """Redirect to ATP analysis app by default."""
    return redirect('/analysis/atp/')


@app.route('/analysis/<tour>/')
def serve_analysis_index(tour):
    """Serve ATP or WTA analysis app index."""
    app_root = _analysis_root_for_tour(tour)
    if not app_root:
        return jsonify({'error': 'Unknown analysis tour'}), 404
    return _serve_file(app_root, 'index.html', 'Analysis app not found')


@app.route('/analysis/historic data/<path:filename>')
@app.route('/historic data/<path:filename>')
def serve_atp_historic_data(filename):
    """Serve ATP historic CSV archive for analysis app."""
    return _serve_file(HISTORIC_DATA_ATP_DIR, filename, 'ATP historic file not found')


@app.route('/analysis/historic data_wta/<path:filename>')
@app.route('/historic data_wta/<path:filename>')
def serve_wta_historic_data(filename):
    """Serve WTA historic CSV archive for analysis app."""
    return _serve_file(HISTORIC_DATA_WTA_DIR, filename, 'WTA historic file not found')


@app.route('/analysis/data/atp/<path:filename>')
@app.route('/data/atp/<path:filename>')
def serve_atp_player_archive(filename):
    """Serve ATP per-player data files for analysis app."""
    return _serve_file(DATA_ATP_DIR, filename, 'ATP data file not found')


@app.route('/analysis/data/wta/<path:filename>')
@app.route('/data/wta/<path:filename>')
def serve_wta_player_archive(filename):
    """Serve WTA per-player data files for analysis app."""
    return _serve_file(DATA_WTA_DIR, filename, 'WTA data file not found')


@app.route('/analysis/<tour>/<path:filename>')
def serve_analysis_assets(tour, filename):
    """Serve ATP/WTA analysis static assets."""
    app_root = _analysis_root_for_tour(tour)
    if not app_root:
        return jsonify({'error': 'Unknown analysis tour'}), 404
    return _serve_file(app_root, filename, 'Analysis asset not found')


@app.route('/api/notifications/status', methods=['GET'])
def notification_status():
    return jsonify({
        'success': True,
        'running': _notification_healthcheck(timeout=1.0),
        'url': _notification_base_url(),
        'launch_error': last_notification_launch_error,
        'launch_log': NOTIFICATION_LAUNCH_LOG,
    })


@app.route('/api/notifications/launch', methods=['POST'])
def launch_notification_app():
    started = _start_notification_process_if_needed()
    if not started:
        return jsonify({
            'success': False,
            'error': 'Notification system is not reachable.',
            'url': _notification_base_url(),
            'launch_error': last_notification_launch_error,
        }), 503
    return jsonify({
        'success': True,
        'url': _notification_base_url(),
    })


@app.route('/notifications/open')
def open_notification_app():
    started = _start_notification_process_if_needed()
    if not started:
        return jsonify({
            'success': False,
            'error': 'Notification system is not reachable.',
            'hint': f'Run manually with: cd {NOTIFICATION_APP_DIR} && {PYTHON_EXE} app.py',
            'launch_error': last_notification_launch_error,
        }), 503

    return redirect(_notification_base_url(), code=302)


@app.route('/<path:filename>')
def serve_frontend(filename):
    """Serve frontend assets (CSS, JS, images)"""
    return _serve_file(FRONTEND_DIR, filename)


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


@app.route('/api/historic-data/atp/<int:year>.csv', methods=['GET'])
def proxy_historic_atp_csv(year):
    """Proxy ATP yearly historic CSV from stats.tennismylife.org."""
    if year < 1968 or year > 2100:
        return jsonify({'success': False, 'error': 'year out of supported range'}), 400

    source_url = f'https://stats.tennismylife.org/data/{year}.csv'
    timeout = request.args.get('timeout', default=45, type=int)

    try:
        upstream = requests.get(source_url, timeout=max(5, min(timeout, 120)))
        if upstream.status_code != 200:
            return jsonify({
                'success': False,
                'error': f'upstream returned {upstream.status_code}',
                'url': source_url
            }), upstream.status_code

        response = Response(upstream.content, mimetype='text/csv')
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Source-Url'] = source_url
        last_modified = upstream.headers.get('Last-Modified')
        if last_modified:
            response.headers['Last-Modified'] = last_modified
        return response
    except Exception as exc:
        return jsonify({
            'success': False,
            'error': str(exc),
            'url': source_url
        }), 502


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
        if tour == 'atp' and not scores:
            cached_live = _load_json_list(os.path.join(REPO_ROOT, 'data', 'atp_live_matches_cache.json'))
            if cached_live:
                scores = _normalize_matches_tour(cached_live, 'ATP')
        return jsonify({
            'success': True,
            'data': scores,
            'count': len(scores)
        })
    except Exception as e:
        if tour == 'atp':
            cached_live = _load_json_list(os.path.join(REPO_ROOT, 'data', 'atp_live_matches_cache.json'))
            if cached_live:
                payload = _normalize_matches_tour(cached_live, 'ATP')
                return jsonify({
                    'success': True,
                    'data': payload,
                    'count': len(payload),
                    'warning': f'Using cached ATP live matches due to fetch error: {str(e)}'
                })
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
        if tour == 'atp':
            matches = _normalize_matches_tour(matches, 'ATP')
        # Render safety net: if ATP feed is empty, reuse last cached ATP snapshot.
        if not matches and tour == 'atp':
            cached = _load_json_list(os.path.join(REPO_ROOT, 'data', 'atp_recent_matches_cache.json'))
            if cached:
                matches = _normalize_matches_tour(
                    cached[:max(1, int(limit) if isinstance(limit, int) else 20)],
                    'ATP'
                )
        return jsonify({
            'success': True,
            'data': matches,
            'count': len(matches)
        })
    except Exception as e:
        if tour == 'atp':
            cached = _load_json_list(os.path.join(REPO_ROOT, 'data', 'atp_recent_matches_cache.json'))
            if cached:
                payload = _normalize_matches_tour(
                    cached[:max(1, int(limit) if isinstance(limit, int) else 20)],
                    'ATP'
                )
                return jsonify({
                    'success': True,
                    'data': payload,
                    'count': len(payload),
                    'warning': f'Using cached ATP recent matches due to fetch error: {str(e)}'
                })
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
        if tour == 'atp':
            matches = _normalize_matches_tour(matches, 'ATP')
        # Render safety net: if ATP feed is empty, reuse last cached ATP snapshot.
        if not matches and tour == 'atp':
            cached = _load_json_list(os.path.join(REPO_ROOT, 'data', 'atp_upcoming_matches_cache.json'))
            if cached:
                matches = _normalize_matches_tour(cached, 'ATP')
        return jsonify({
            'success': True,
            'data': matches,
            'count': len(matches)
        })
    except Exception as e:
        if tour == 'atp':
            cached = _load_json_list(os.path.join(REPO_ROOT, 'data', 'atp_upcoming_matches_cache.json'))
            if cached:
                payload = _normalize_matches_tour(cached, 'ATP')
                return jsonify({
                    'success': True,
                    'data': payload,
                    'count': len(payload),
                    'warning': f'Using cached ATP upcoming matches due to fetch error: {str(e)}'
                })
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
    print(f"SocketIO mode: threading | simple_websocket={HAS_SIMPLE_WEBSOCKET} | allow_upgrades={allow_socket_upgrades}")
    print("=" * 50)
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        log_output=True,
        allow_unsafe_werkzeug=True,
    )
