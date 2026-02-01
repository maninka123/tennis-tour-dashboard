"""
Tennis Dashboard - Flask Backend Server
Provides REST API and WebSocket for real-time tennis data
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from apscheduler.schedulers.background import BackgroundScheduler
import time
from tennis_api import tennis_fetcher
from config import Config

app = Flask(__name__)
app.config['SECRET_KEY'] = 'tennis_dashboard_secret_2024'
CORS(app, origins="*", resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', ping_timeout=60, ping_interval=25)

# Background scheduler for real-time updates
scheduler = BackgroundScheduler()

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

# Start scheduler for live score updates (after routes are initialized)
if not scheduler.running:
    scheduler.add_job(broadcast_live_scores, 'interval', seconds=30, id='live_scores_job')
    try:
        scheduler.start()
    except:
        pass  # Scheduler might already be running


# ============== REST API Routes ==============

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Tennis Dashboard API is running'})


@app.route('/api/live-scores', methods=['GET'])
def get_live_scores():
    """Get current live match scores"""
    tour = request.args.get('tour', 'both')  # 'atp', 'wta', or 'both'
    
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
    tour = request.args.get('tour', 'both')
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
    """Get upcoming matches in the next 2 days"""
    tour = request.args.get('tour', 'both')
    
    try:
        matches = tennis_fetcher.fetch_upcoming_matches(tour, days=2)
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
    limit = min(limit, 200)  # Cap at 200
    
    try:
        rankings = tennis_fetcher.fetch_rankings(tour, limit)
        return jsonify({
            'success': True,
            'data': rankings,
            'count': len(rankings)
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
    socketio.run(app, host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
