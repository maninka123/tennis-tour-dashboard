/**
 * Tennis Live Dashboard - Main Application
 * Handles app initialization, state management, and WebSocket connections
 */

// ============================================
// Configuration
// ============================================
// Use config.js values, but add missing settings
const CONFIG = {
    // From config.js
    API_BASE_URL: (window.TennisApp?.CONFIG?.API_BASE_URL) || 'http://localhost:5001/api',
    IS_LOCAL: (window.TennisApp?.CONFIG?.IS_LOCAL) !== false,
    WS_URL: (window.TennisApp?.CONFIG?.API_BASE_URL?.replace('/api', '')) || 'http://localhost:5001',
    
    // App-specific settings
    UPDATE_INTERVAL: 30000, // 30 seconds (live scores)
    MATCH_LIST_UPDATE_INTERVAL: 1800000, // 30 minutes (recent + upcoming)
    TOURNAMENT_COLORS: {
        'grand_slam': '#9B59B6',
        'masters_1000': '#F1C40F',
        'atp_500': '#3498DB',
        'atp_250': '#2ECC71',
        'atp_125': '#E67E22',
        'other': '#95A5A6'
    }
};

// Lightweight player image map (real photos for headline names)
const PLAYER_IMAGE_MAP = {
    // ITF/WTA official headshots where possible
    'Novak Djokovic': 'https://www.itftennis.com/remote.axd/media.itftennis.com/assetbank-itf/servlet/display?cropmode=percentage&file=22137ab7cf680b76887ffd08.jpg%3Fcrop%3D0.28944414909327193%2C0.073837793136038762%2C0.27934313899226171%2C0.09327190028944396&height=420&rnd=133452065080000000&width=340',
    'Carlos Alcaraz': 'https://www.itftennis.com/remote.axd/media.itftennis.com/assetbank-itf/servlet/display?cropmode=percentage&file=22137ab7e56b0948907afd2e.jpg%3Fcrop%3D0.0000000000000001297794951160%2C0.016257472481415305%2C0%2C0.06682107956676149&height=420&rnd=133353580110000000&width=340',
    'Jannik Sinner': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Jannik_Sinner_Queen%27s_Club_Championships_2023_%28cropped%29.jpg/320px-Jannik_Sinner_Queen%27s_Club_Championships_2023_%28cropped%29.jpg',
    'Daniil Medvedev': 'https://www.itftennis.com/remote.axd/media.itftennis.com/asset-bank/servlet/display?cropmode=percentage&file=221379a7c3240858ba7c.jpg%3Fcrop%3D0.34884103089493274%2C0.034261496040929283%2C0.29415583921461341%2C0.27618451334874194&height=420&rnd=133353579380000000&width=340',
    'Andrey Rublev': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Rublev_RG21_%2823%29_%2848134080902%29.jpg/320px-Rublev_RG21_%2823%29_%2848134080902%29.jpg',
    'Alexander Zverev': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Zverev_RG21_%2828%29_%2848132302537%29.jpg/320px-Zverev_RG21_%2828%29_%2848132302537%29.jpg',
    'Holger Rune': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Rune_RG22_%2819%29_%2852082101786%29.jpg/320px-Rune_RG22_%2819%29_%2852082101786%29.jpg',
    'Stefanos Tsitsipas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Tsitsipas_RG21_%2827%29_%2848132382667%29.jpg/320px-Tsitsipas_RG21_%2827%29_%2848132382667%29.jpg',
    'Hubert Hurkacz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Hubert_Hurkacz_%28Roland_Garros_2023%29_11_%28cropped%29.jpg/320px-Hubert_Hurkacz_%28Roland_Garros_2023%29_11_%28cropped%29.jpg',
    'Felix Auger-Aliassime': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Auger-Aliassime_RG19_%2817%29_%2842891621052%29.jpg/320px-Auger-Aliassime_RG19_%2817%29_%2842891621052%29.jpg',
    'Iga Swiatek': 'https://photoresources.wtatennis.com/photo-resources/2025/04/14/d5c9d3a0-1235-40c8-973e-b5799b629b98/Swiatek-Torso_326408.png?height=740&width=790',
    'Aryna Sabalenka': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Aryna_Sabalenka_%282023_US_Open_%29_06_%28cropped%29.jpg/320px-Aryna_Sabalenka_%282023_US_Open_%29_06_%28cropped%29.jpg',
    'Coco Gauff': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Coco_Gauff_%2852448773887%29_%28cropped%29.jpg/320px-Coco_Gauff_%2852448773887%29_%28cropped%29.jpg',
    'Elena Rybakina': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Elena_Rybakina_2023_%28cropped%29.jpg/320px-Elena_Rybakina_2023_%28cropped%29.jpg',
    'Jessica Pegula': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Jessica_Pegula_%2852315011098%29_%28cropped%29.jpg/320px-Jessica_Pegula_%2852315011098%29_%28cropped%29.jpg',
    'Ons Jabeur': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Ons_Jabeur_%2852683211099%29_%28cropped%29.jpg/320px-Ons_Jabeur_%2852683211099%29_%28cropped%29.jpg',
    'Jannik Sinner (alt)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Jannik_Sinner_2023_US_Open.jpg/320px-Jannik_Sinner_2023_US_Open.jpg'
};

// Map demo IDs to names so Utils can resolve images when only id is provided
const PLAYER_ID_MAP = {
    1: 'Novak Djokovic',
    2: 'Carlos Alcaraz',
    3: 'Jannik Sinner',
    4: 'Daniil Medvedev',
    5: 'Andrey Rublev',
    6: 'Alexander Zverev',
    7: 'Holger Rune',
    8: 'Stefanos Tsitsipas',
    9: 'Hubert Hurkacz',
    15: 'Felix Auger-Aliassime',
    101: 'Iga Swiatek',
    102: 'Aryna Sabalenka',
    103: 'Coco Gauff',
    104: 'Elena Rybakina',
    105: 'Jessica Pegula',
    106: 'Ons Jabeur'
};

// ============================================
// Application State
// ============================================
const AppState = {
    currentTour: 'atp',
    liveScores: { atp: [], wta: [] },
    upcomingMatches: { atp: [], wta: [] },
    recentMatches: { atp: [], wta: [] },
    upcomingMatchesUpdatedAt: null,
    recentMatchesUpdatedAt: null,
    rankings: { atp: [], wta: [] },
    rankingsDisplayLimit: { atp: 200, wta: 200 },
    atpRankingsStatus: null,
    isUpdatingAtpRankings: false,
    wtaRankingsStatus: null,
    isUpdatingWtaRankings: false,
    wtaStatsStatus: null,
    isUpdatingWtaStats: false,
    wtaStatsData: null,
    atpStatsStatus: null,
    isUpdatingAtpStats: false,
    atpStatsData: null,
    tournamentsStatus: { atp: null, wta: null },
    isUpdatingTournaments: { atp: false, wta: false },
    tournaments: { atp: [], wta: [] },
    selectedTournament: null,
    socket: null,
    isConnected: false,
    livePollingBySocket: false,
    lastUpdated: null,
    apiBaseResolved: null
};

// ============================================
// DOM Elements
// ============================================
const DOM = {
    // Tour tabs
    tourTabs: document.querySelectorAll('.tour-tab'),
    
    // Live scores
    liveScoresWrapper: document.getElementById('liveScoresWrapper'),
    liveScoresContainer: document.getElementById('liveScoresContainer'),
    scrollLiveLeft: document.getElementById('scrollLiveLeft'),
    scrollLiveRight: document.getElementById('scrollLiveRight'),
    
    // Recent matches
    recentMatchesWrapper: document.getElementById('recentMatchesWrapper'),
    recentMatchesContainer: document.getElementById('recentMatchesContainer'),
    recentUpdatedAgo: document.getElementById('recentUpdatedAgo'),
    scrollRecentLeft: document.getElementById('scrollRecentLeft'),
    scrollRecentRight: document.getElementById('scrollRecentRight'),
    
    // Rankings
    rankingsList: document.getElementById('rankingsList'),
    rankingsTitle: document.getElementById('rankingsTitle'),
    rankingsLoadMore: document.getElementById('rankingsLoadMore'),
    rankingsUpdateBtn: document.getElementById('rankingsUpdateBtn'),
    rankingsUpdatedAgo: document.getElementById('rankingsUpdatedAgo'),
    statsZoneBtn: document.getElementById('statsZoneBtn'),
    
    // Tournaments
    tournamentCalendar: document.getElementById('tournamentCalendar'),
    yearDisplay: document.getElementById('yearDisplay'),
    tournamentsUpdateBtn: document.getElementById('tournamentsUpdateBtn'),
    tournamentsUpdatedAgo: document.getElementById('tournamentsUpdatedAgo'),
    
    // Bracket
    tournamentDetailsPanel: document.getElementById('tournamentDetailsPanel'),
    tournamentBracket: document.getElementById('tournamentBracket'),
    closeBracket: document.getElementById('closeBracket'),
    
    // Match popup
    matchPopup: document.getElementById('matchPopup'),
    
    // Loading & status
    loadingOverlay: document.getElementById('loadingOverlay'),
    lastUpdated: document.getElementById('lastUpdated')
};

// ============================================
// Utility Functions
// ============================================
const Utils = {
    /**
     * Get country flag emoji from country code
     */
    getFlag(countryCode) {
        const flags = {
            'SRB': '🇷🇸', 'ESP': '🇪🇸', 'ITA': '🇮🇹', 'RUS': '🇷🇺', 'GER': '🇩🇪',
            'DEN': '🇩🇰', 'GRE': '🇬🇷', 'POL': '🇵🇱', 'NOR': '🇳🇴', 'USA': '🇺🇸',
            'CAN': '🇨🇦', 'GBR': '🇬🇧', 'FRA': '🇫🇷', 'AUS': '🇦🇺', 'ARG': '🇦🇷',
            'BLR': '🇧🇾', 'KAZ': '🇰🇿', 'TUN': '🇹🇳', 'CZE': '🇨🇿', 'CHN': '🇨🇳',
            'LAT': '🇱🇻', 'BRA': '🇧🇷', 'JPN': '🇯🇵', 'KOR': '🇰🇷', 'BUL': '🇧🇬',
            'CHI': '🇨🇱', 'SUI': '🇨🇭', 'BEL': '🇧🇪', 'NED': '🇳🇱', 'SWE': '🇸🇪',
            'AUT': '🇦🇹', 'COL': '🇨🇴', 'CRO': '🇭🇷', 'RSA': '🇿🇦', 'UKR': '🇺🇦',
            'IND': '🇮🇳', 'TPE': '🇹🇼', 'ROU': '🇷🇴', 'HUN': '🇭🇺', 'POR': '🇵🇹'
        };
        return flags[countryCode] || '🏳️';
    },

    /**
     * Format category for CSS class
     */
    getCategoryClass(category) {
        const safe = String(category || 'other').trim().toLowerCase();
        if (!safe) return 'other';
        return safe
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_/g, '-') || 'other';
    },

    /**
     * Format date
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return {
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            day: date.getDate()
        };
    },

    /**
     * Format time
     */
    formatTime(date = new Date()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },

    /**
     * Generate player image placeholder URL
     */
    getPlayerImage(player, tour = 'atp') {
        // Explicit image_url from API
        if (player && player.image_url) {
            return player.image_url;
        }

        // Resolve known names next
        const name = player?.name || PLAYER_ID_MAP[player] || null;
        if (name && PLAYER_IMAGE_MAP[name]) {
            return PLAYER_IMAGE_MAP[name];
        }
        
        // Fallback to a clean placeholder with initials
        const displayName = name || '??';
        const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const colors = ['d1e8ff', 'e8f5e9', 'fff4e6', 'f3e5f5', 'e0f7fa', 'fce4ec'];
        const color = colors[((player && player.id) || Math.floor(Math.random() * colors.length)) % colors.length];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <rect width="100%" height="100%" fill="#${color}"/>
            <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="72" fill="#0f172a">${initials}</text>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    },

    /**
     * Format player name to A.LastName format
     */
    formatPlayerName(fullName) {
        if (!fullName) return '';
        const parts = fullName.split(' ');
        if (parts.length < 2) return fullName;
        // Get first initial and last name
        const firstInitial = parts[0][0];
        const lastName = parts.slice(1).join(' ');
        return `${firstInitial}. ${lastName}`;
    },

    /**
     * Format score for display
     */
    formatScore(score) {
        if (!score || !score.sets) return '';
        return score.sets.map(s => `${s.p1}-${s.p2}`).join(' ');
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ============================================
// API Functions
// ============================================
const API = {
    _buildBaseCandidates() {
        const resolved = AppState.apiBaseResolved;
        const sources = [
            resolved,
            CONFIG.API_BASE_URL,
            ...(Array.isArray(CONFIG.API_BASE_CANDIDATES) ? CONFIG.API_BASE_CANDIDATES : [])
        ];
        const unique = [];
        sources.forEach((base) => {
            const clean = String(base || '').trim().replace(/\/+$/, '');
            if (!clean || unique.includes(clean)) return;
            unique.push(clean);
        });
        return unique;
    },

    /**
     * Fetch raw API payload
     */
    async fetchRaw(endpoint, params = {}, options = {}) {
        let lastError = null;
        const candidates = this._buildBaseCandidates();

        for (const baseUrl of candidates) {
            try {
                const url = new URL(`${baseUrl}${endpoint}`);
                Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

                const controller = new AbortController();
                const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 45000;
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const fetchOptions = { ...options, signal: controller.signal };
                delete fetchOptions.timeoutMs;
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} from ${baseUrl}`);
                }

                const data = await response.json();
                if (data.success === false) {
                    throw new Error(data.error || 'API Error');
                }

                AppState.apiBaseResolved = baseUrl;
                return data;
            } catch (error) {
                lastError = error;
            }
        }

        console.error(`API Error (${endpoint}):`, lastError);
        throw lastError || new Error('API request failed');
    },

    /**
     * Fetch data from API with timeout
     */
    async fetch(endpoint, params = {}) {
        const payload = await this.fetchRaw(endpoint, params);
        return payload.data || payload;
    },

    /**
     * Get live scores
     */
    async getLiveScores(tour = 'both') {
        return await this.fetch('/live-scores', { tour });
    },

    /**
     * Get upcoming matches
     */
    async getUpcomingMatches(tour = 'both') {
        return await this.fetch('/upcoming-matches', { tour });
    },

    /**
     * Get recent matches
     */
    async getRecentMatches(tour = 'both', limit = 20) {
        return await this.fetch('/recent-matches', { tour, limit });
    },

    /**
     * Get rankings
     */
    async getRankings(tour = 'atp', limit = 200) {
        return await this.fetch(`/rankings/${tour}`, { limit });
    },

    /**
     * Get WTA rankings file status metadata
     */
    async getWtaRankingsStatus() {
        return await this.fetch('/rankings/wta/status');
    },

    /**
     * Get ATP rankings file status metadata
     */
    async getAtpRankingsStatus() {
        return await this.fetch('/rankings/atp/status');
    },

    /**
     * Refresh WTA rankings source file
     */
    async refreshWtaRankings() {
        const payload = await this.fetchRaw('/rankings/wta/refresh', {}, { method: 'POST' });
        return payload.data || payload;
    },

    /**
     * Refresh ATP rankings source file
     */
    async refreshAtpRankings() {
        const payload = await this.fetchRaw('/rankings/atp/refresh', {}, { method: 'POST' });
        return payload.data || payload;
    },

    /**
     * Get ATP Stat Zone file status metadata
     */
    async getATPStatsStatus() {
        return await this.fetch('/stats/atp/status');
    },

    /**
     * Refresh ATP Stat Zone source CSV
     */
    async refreshATPStats() {
        const payload = await this.fetchRaw('/stats/atp/refresh', {}, { method: 'POST' });
        return payload.data || payload;
    },

    /**
     * Get ATP Stat Zone leaderboard payload
     */
    async getATPStatsLeaderboard() {
        return await this.fetch('/stats/atp/leaderboard');
    },

    /**
     * Get WTA Stat Zone file status metadata
     */
    async getWTAStatsStatus() {
        return await this.fetch('/stats/wta/status');
    },

    /**
     * Refresh WTA Stat Zone source CSV
     */
    async refreshWTAStats() {
        const payload = await this.fetchRaw('/stats/wta/refresh', {}, { method: 'POST' });
        return payload.data || payload;
    },

    /**
     * Get WTA Stat Zone leaderboard payload
     */
    async getWTAStatsLeaderboard() {
        return await this.fetch('/stats/wta/leaderboard');
    },

    /**
     * Get tournaments
     */
    async getTournaments(tour = 'atp', year = null) {
        const params = year ? { year } : {};
        return await this.fetch(`/tournaments/${tour}`, params);
    },

    /**
     * Get tournament JSON status metadata
     */
    async getTournamentsStatus(tour = 'atp') {
        return await this.fetch(`/tournaments/${tour}/status`);
    },

    /**
     * Refresh tournament JSON files
     */
    async refreshTournaments(tour = 'atp', year = null, fullRefresh = false) {
        const params = {};
        if (year) {
            params.year = year;
        }
        if (fullRefresh) {
            params.full_refresh = '1';
        }
        const payload = await this.fetchRaw(
            `/tournaments/${tour}/refresh`,
            params,
            {
                method: 'POST',
                // Tournament refresh can be heavy (draw parsing + selective updates).
                timeoutMs: 900000
            }
        );
        return payload.data || payload;
    },

    /**
     * Get tournament bracket
     */
    async getTournamentBracket(tournamentId, tour = 'atp') {
        return await this.fetch(`/tournament/${tournamentId}/bracket`, { tour });
    },

    /**
     * Get player details
     */
    async getPlayer(playerId) {
        return await this.fetch(`/player/${playerId}`);
    },

    /**
     * Get on-demand WTA match statistics
     */
    async getWTAMatchStats(eventId, eventYear, matchId) {
        return await this.fetch('/match-stats/wta', {
            event_id: eventId,
            event_year: eventYear,
            match_id: matchId
        });
    },

    /**
     * Get on-demand ATP match statistics
     */
    async getATPMatchStats(statsUrl) {
        return await this.fetch('/match-stats/atp', {
            stats_url: statsUrl
        });
    },

    /**
     * Search WTA players for H2H autocomplete
     */
    async searchWTAH2HPlayers(query, limit = 8) {
        return await this.fetch('/h2h/wta/search', { query, limit });
    },

    /**
     * Search ATP players for H2H autocomplete
     */
    async searchATPH2HPlayers(query, limit = 8) {
        return await this.fetch('/h2h/atp/search', { query, limit });
    },

    /**
     * Get WTA H2H detail payload
     */
    async getWTAH2H(player1Id, player2Id, year = 2026, meetings = 5) {
        return await this.fetch('/h2h/wta', {
            player1_id: player1Id,
            player2_id: player2Id,
            year,
            meetings
        });
    },

    /**
     * Get ATP H2H detail payload
     */
    async getATPH2H(player1Code, player2Code, year = 2026, meetings = 5) {
        return await this.fetch('/h2h/atp', {
            player1_code: player1Code,
            player2_code: player2Code,
            year,
            meetings
        });
    }
};

// ============================================
// Global App Object
// ============================================
// Define the global object early so modules can access it.
window.TennisApp = {
    CONFIG,
    AppState,
    Utils,
    API,
    DOM,
    // Modules will be attached later
    Scores: null,
    Bracket: null,
    H2H: null,
    Player: null,
    StatZone: null
};

// ============================================
// WebSocket Connection
// ============================================
const Socket = {
    /**
     * Initialize WebSocket connection
     */
    init() {
        try {
            AppState.socket = io(CONFIG.WS_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10
            });

            this.setupEventListeners();
        } catch (error) {
            console.log('WebSocket not available, using polling');
            this.startPolling();
        }
    },

    /**
     * Setup WebSocket event listeners
     */
    setupEventListeners() {
        if (!AppState.socket) return;

        AppState.socket.on('connect', () => {
            console.log('Connected to WebSocket');
            AppState.isConnected = true;
        });

        AppState.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket');
            AppState.isConnected = false;
        });

        AppState.socket.on('live_scores_update', (data) => {
            console.log('Received live scores update');
            if (data.atp) {
                AppState.liveScores.atp = data.atp;
            }
            if (data.wta) {
                AppState.liveScores.wta = data.wta;
            }
            ScoresModule.renderLiveScores();
            this.updateLastUpdated();
        });

        AppState.socket.on('connected', (data) => {
            console.log('Server message:', data.message);
        });

        AppState.socket.on('rankings_update', async (data) => {
            const tour = String((data || {}).tour || '').toLowerCase();
            if (!tour || !['atp', 'wta'].includes(tour)) return;
            try {
                await App.refreshRankingsStatus(tour);
                const limit = tour === 'wta' ? 400 : 200;
                AppState.rankings[tour] = await API.getRankings(tour, limit) || [];
                RankingsModule.render();
            } catch (error) {
                console.error('Error handling rankings_update event:', error);
            }
        });

        AppState.socket.on('stats_update', async (data) => {
            if (!data || data.scope !== 'stat_zone') return;
            try {
                if (data.tour === 'atp') {
                    await App.refreshAtpStatsStatus();
                    AppState.atpStatsData = await API.getATPStatsLeaderboard();
                } else if (data.tour === 'wta') {
                    await App.refreshWtaStatsStatus();
                    AppState.wtaStatsData = await API.getWTAStatsLeaderboard();
                } else {
                    return;
                }
                if (window.StatZoneModule && typeof window.StatZoneModule.render === 'function') {
                    window.StatZoneModule.render();
                }
            } catch (error) {
                console.error('Error handling stats_update event:', error);
            }
        });

        AppState.socket.on('tournaments_update', async (data) => {
            const tour = String((data || {}).tour || '').toLowerCase();
            if (!tour || !['atp', 'wta'].includes(tour)) return;
            try {
                await App.refreshTournamentsStatus(tour);
                const year = parseInt(DOM.yearDisplay?.textContent || '', 10) || null;
                AppState.tournaments[tour] = await API.getTournaments(tour, year);
                if (tour === AppState.currentTour) {
                    TournamentsModule.render();
                }
            } catch (error) {
                console.error('Error handling tournaments_update event:', error);
            }
        });
    },

    /**
     * Start polling if WebSocket is not available
     */
    startPolling() {
        AppState.livePollingBySocket = true;
        setInterval(async () => {
            try {
                const scores = await API.getLiveScores('both');
                AppState.liveScores.atp = scores.filter(m => m.tour === 'ATP');
                AppState.liveScores.wta = scores.filter(m => m.tour === 'WTA');
                ScoresModule.renderLiveScores();
                this.updateLastUpdated();
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, CONFIG.UPDATE_INTERVAL);
    },

    /**
     * Update last updated timestamp
     */
    updateLastUpdated() {
        AppState.lastUpdated = new Date();
        DOM.lastUpdated.textContent = `Updated: ${Utils.formatTime(AppState.lastUpdated)}`;
    }
};

// ============================================
// Event Handlers
// ============================================
const EventHandlers = {
    /**
     * Initialize all event handlers
     */
    init() {
        // Tour tab switching
        DOM.tourTabs.forEach(tab => {
            tab.addEventListener('click', () => this.handleTourSwitch(tab));
        });

        // Scroll controls
        DOM.scrollLiveLeft?.addEventListener('click', () => {
            DOM.liveScoresContainer.scrollBy({ left: -300, behavior: 'smooth' });
        });
        DOM.scrollLiveRight?.addEventListener('click', () => {
            DOM.liveScoresContainer.scrollBy({ left: 300, behavior: 'smooth' });
        });
        DOM.scrollRecentLeft?.addEventListener('click', () => {
            DOM.recentMatchesContainer.scrollBy({ left: -300, behavior: 'smooth' });
        });
        DOM.scrollRecentRight?.addEventListener('click', () => {
            DOM.recentMatchesContainer.scrollBy({ left: 300, behavior: 'smooth' });
        });

        // Close bracket panel
        DOM.closeBracket?.addEventListener('click', () => {
            DOM.tournamentDetailsPanel.classList.remove('visible');
            AppState.selectedTournament = null;
        });

        // Rankings manual refresh (ATP/WTA based on current tab)
        DOM.rankingsUpdateBtn?.addEventListener('click', async () => {
            await App.refreshCurrentTourRankings();
        });

        DOM.tournamentsUpdateBtn?.addEventListener('click', async () => {
            await App.refreshCurrentTourTournaments();
        });

        // Match card click handlers
        document.addEventListener('click', (e) => {
            const playerRow = e.target.closest('.player-row[data-player-id]');
            if (playerRow && playerRow.dataset.playerId) {
                PlayerModule.showPlayerStats(playerRow.dataset.playerId);
                return;
            }

            const upcomingCard = e.target.closest('.upcoming-match-card');
            if (upcomingCard) {
                const matchId = upcomingCard.dataset.matchId;
                if (matchId) {
                    ScoresModule.showUpcomingInsights(matchId);
                }
                return;
            }

            const matchCard = e.target.closest('.match-card');
            if (matchCard) {
                const matchId = matchCard.dataset.matchId;
                const matchKey = matchCard.dataset.matchKey;
                let source = '';
                if (matchCard.closest('.recent-matches-section')) {
                    source = 'recent';
                } else if (matchCard.closest('.live-scores-section')) {
                    source = 'live';
                }
                if (matchId) {
                    ScoresModule.showMatchStats(matchId, null, { matchKey, source });
                }
            }
        });

        // Modal overlay click to close
        document.addEventListener('click', (e) => {
            if (e.target.id === 'matchStatsModal') {
                ScoresModule.closeMatchStats();
            }
            if (e.target.id === 'playerStatsModal') {
                PlayerModule.close();
            }
        });

        // Player click handler
        document.addEventListener('click', (e) => {
            const playerElement = e.target.closest('.ranking-item');
            if (playerElement && playerElement.dataset.playerId) {
                PlayerModule.showPlayerStats(playerElement.dataset.playerId);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const playerRow = e.target.closest('.player-row[data-player-id]');
            if (!playerRow || !playerRow.dataset.playerId) return;
            e.preventDefault();
            PlayerModule.showPlayerStats(playerRow.dataset.playerId);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                DOM.tournamentDetailsPanel.classList.remove('visible');
                DOM.matchPopup.classList.remove('visible');
                ScoresModule.closeMatchStats();
                PlayerModule.close();
                App.closeStatsZoneModal();
                if (window.StatZoneModule && typeof window.StatZoneModule.closeBreakdownModal === 'function') {
                    window.StatZoneModule.closeBreakdownModal();
                }
            }
        });
    },

    /**
     * Handle tour switching
     */
    handleTourSwitch(tab) {
        const tour = tab.dataset.tour;
        if (tour === AppState.currentTour) return;

        AppState.currentTour = tour;

        // Update tab UI
        DOM.tourTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update rankings title
        DOM.rankingsTitle.textContent = tour.toUpperCase();
        App.refreshRankingsStatus(tour);
        App.refreshTournamentsStatus(tour);
        App.syncTournamentHeaderState();
        if (window.StatZoneModule && typeof window.StatZoneModule.syncHeaderState === 'function') {
            window.StatZoneModule.syncHeaderState();
        }

        // Re-render all components for new tour
        ScoresModule.renderLiveScores();
        ScoresModule.renderUpcomingMatches();
        ScoresModule.renderRecentMatches();
        RankingsModule.render();
        TournamentsModule.render();
    }
};

// ============================================
// Application Initialization
// ============================================
const App = {
    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Tennis Dashboard...');
        
        // Initialize event handlers
        EventHandlers.init();
        
        // Initialize ATP match stats cache
        ScoresModule.init();
        
        // Initialize WebSocket connection
        Socket.init();
        
        // Load initial data
        await this.loadInitialData();
        await this.refreshAtpRankingsStatus();
        await this.refreshWtaRankingsStatus();
        await this.refreshAtpStatsStatus();
        await this.refreshWtaStatsStatus();
        await this.refreshTournamentsStatus('atp');
        await this.refreshTournamentsStatus('wta');
        this.syncTournamentHeaderState();
        this.startLiveScoreRefreshLoop();
        this.startPeriodicRefresh();
        
        // Hide loading overlay
        setTimeout(() => {
            DOM.loadingOverlay.classList.add('hidden');
        }, 500);
        
        console.log('Dashboard initialized successfully');
    },

    /**
     * Keep live scores on a dedicated refresh loop (independent of recent/upcoming refresh).
     * When websocket is connected, it becomes no-op to avoid duplicate traffic.
     */
    startLiveScoreRefreshLoop() {
        if (AppState.livePollingBySocket) return;
        setInterval(async () => {
            if (AppState.isConnected) return;
            try {
                const scores = await API.getLiveScores('both');
                AppState.liveScores.atp = scores.filter(m => m.tour === 'ATP');
                AppState.liveScores.wta = scores.filter(m => m.tour === 'WTA');
                ScoresModule.renderLiveScores();
                Socket.updateLastUpdated();
            } catch (error) {
                console.error('Error refreshing live scores:', error);
            }
        }, CONFIG.UPDATE_INTERVAL);
    },

    /**
     * Load all initial data
     */
    async loadInitialData() {
        try {
            console.log('Fetching initial data from API...');
            // Load data in parallel; do not fail whole screen if one endpoint is down.
            const requests = [
                API.getLiveScores('atp'),
                API.getLiveScores('wta'),
                API.getUpcomingMatches('atp'),
                API.getUpcomingMatches('wta'),
                API.getRecentMatches('atp', 15),
                API.getRecentMatches('wta', 15),
                API.getRankings('atp', 200),
                API.getRankings('wta', 400),
                API.getTournaments('atp'),
                API.getTournaments('wta')
            ];
            const keys = [
                'atpScores', 'wtaScores',
                'atpUpcoming', 'wtaUpcoming',
                'atpRecent', 'wtaRecent',
                'atpRankings', 'wtaRankings',
                'atpTournaments', 'wtaTournaments'
            ];
            const settled = await Promise.allSettled(requests);
            const resultMap = {};
            settled.forEach((result, index) => {
                const key = keys[index];
                if (result.status === 'fulfilled') {
                    resultMap[key] = result.value;
                } else {
                    resultMap[key] = [];
                    console.error(`Initial load failed for ${key}:`, result.reason);
                }
            });
            const atpScores = resultMap.atpScores;
            const wtaScores = resultMap.wtaScores;
            const atpUpcoming = resultMap.atpUpcoming;
            const wtaUpcoming = resultMap.wtaUpcoming;
            const atpRecent = resultMap.atpRecent;
            const wtaRecent = resultMap.wtaRecent;
            const atpRankings = resultMap.atpRankings;
            const wtaRankings = resultMap.wtaRankings;
            const atpTournaments = resultMap.atpTournaments;
            const wtaTournaments = resultMap.wtaTournaments;

            console.log('Data fetched successfully.', {
                atpLive: Array.isArray(atpScores) ? atpScores.length : 0,
                wtaLive: Array.isArray(wtaScores) ? wtaScores.length : 0,
                atpUpcoming: Array.isArray(atpUpcoming) ? atpUpcoming.length : 0,
                wtaUpcoming: Array.isArray(wtaUpcoming) ? wtaUpcoming.length : 0,
                atpRecent: Array.isArray(atpRecent) ? atpRecent.length : 0,
                wtaRecent: Array.isArray(wtaRecent) ? wtaRecent.length : 0,
                atpRankings: Array.isArray(atpRankings) ? atpRankings.length : 0,
                wtaRankings: Array.isArray(wtaRankings) ? wtaRankings.length : 0,
                atpTournaments: Array.isArray(atpTournaments) ? atpTournaments.length : 0,
                wtaTournaments: Array.isArray(wtaTournaments) ? wtaTournaments.length : 0
            });

            // Update state
            AppState.liveScores.atp = atpScores || [];
            AppState.liveScores.wta = wtaScores || [];
            AppState.upcomingMatches.atp = atpUpcoming || [];
            AppState.upcomingMatches.wta = wtaUpcoming || [];
            AppState.recentMatches.atp = atpRecent || [];
            AppState.recentMatches.wta = wtaRecent || [];
            AppState.upcomingMatchesUpdatedAt = new Date().toISOString();
            AppState.recentMatchesUpdatedAt = new Date().toISOString();
            AppState.rankings.atp = atpRankings || [];
            AppState.rankings.wta = wtaRankings || [];
            AppState.tournaments.atp = atpTournaments || [];
            AppState.tournaments.wta = wtaTournaments || [];

            console.log('Application state updated.');

            // Render all components
            console.log('Rendering all modules...');
            try { ScoresModule.renderLiveScores(); } catch (e) { console.error('renderLiveScores failed:', e); }
            try { ScoresModule.renderUpcomingMatches(); } catch (e) { console.error('renderUpcomingMatches failed:', e); }
            try { ScoresModule.renderRecentMatches(); } catch (e) { console.error('renderRecentMatches failed:', e); }
            try { RankingsModule.render(); } catch (e) { console.error('Rankings render failed:', e); }
            try { TournamentsModule.render(); } catch (e) { console.error('Tournaments render failed:', e); }
            console.log('All modules rendered.');

            Socket.updateLastUpdated();
        } catch (error) {
            console.error('Error loading initial data:', error);
            // Show demo data even if API fails
            this.loadDemoData();
        }
    },

    async refreshAtpRankingsStatus() {
        try {
            AppState.atpRankingsStatus = await API.getAtpRankingsStatus();
        } catch (error) {
            console.error('Failed to load ATP rankings status:', error);
        }
        if (window.RankingsModule && typeof window.RankingsModule.render === 'function') {
            window.RankingsModule.render();
        }
    },

    async refreshWtaRankingsStatus() {
        try {
            AppState.wtaRankingsStatus = await API.getWtaRankingsStatus();
        } catch (error) {
            console.error('Failed to load WTA rankings status:', error);
        }
        if (window.RankingsModule && typeof window.RankingsModule.render === 'function') {
            window.RankingsModule.render();
        }
    },

    async refreshRankingsStatus(tour = AppState.currentTour) {
        const tourName = String(tour || '').toLowerCase() === 'wta' ? 'wta' : 'atp';
        if (tourName === 'wta') {
            await this.refreshWtaRankingsStatus();
        } else {
            await this.refreshAtpRankingsStatus();
        }
    },

    async refreshAtpStatsStatus() {
        try {
            AppState.atpStatsStatus = await API.getATPStatsStatus();
        } catch (error) {
            console.error('Failed to load ATP stats status:', error);
        }
        if (window.StatZoneModule && typeof window.StatZoneModule.syncHeaderState === 'function') {
            window.StatZoneModule.syncHeaderState();
        }
    },

    async refreshWtaStatsStatus() {
        try {
            AppState.wtaStatsStatus = await API.getWTAStatsStatus();
        } catch (error) {
            console.error('Failed to load WTA stats status:', error);
        }
        if (window.StatZoneModule && typeof window.StatZoneModule.syncHeaderState === 'function') {
            window.StatZoneModule.syncHeaderState();
        }
    },

    async refreshAtpStats() {
        if (AppState.isUpdatingAtpStats) {
            return;
        }
        AppState.isUpdatingAtpStats = true;
        if (window.StatZoneModule && typeof window.StatZoneModule.syncModalActions === 'function') {
            window.StatZoneModule.syncModalActions();
        }

        try {
            const result = await API.refreshATPStats();
            AppState.atpStatsStatus = result || null;
            AppState.atpStatsData = await API.getATPStatsLeaderboard();
            if (window.StatZoneModule && typeof window.StatZoneModule.render === 'function') {
                window.StatZoneModule.render();
            }
            Socket.updateLastUpdated();
        } catch (error) {
            console.error('Error updating ATP stats:', error);
            alert(`ATP stats update failed: ${error.message}`);
        } finally {
            AppState.isUpdatingAtpStats = false;
            if (window.StatZoneModule && typeof window.StatZoneModule.syncModalActions === 'function') {
                window.StatZoneModule.syncModalActions();
            }
            if (window.StatZoneModule && typeof window.StatZoneModule.syncHeaderState === 'function') {
                window.StatZoneModule.syncHeaderState();
            }
        }
    },

    async refreshWtaStats() {
        if (AppState.isUpdatingWtaStats) {
            return;
        }
        AppState.isUpdatingWtaStats = true;
        if (window.StatZoneModule && typeof window.StatZoneModule.syncModalActions === 'function') {
            window.StatZoneModule.syncModalActions();
        }

        try {
            const result = await API.refreshWTAStats();
            AppState.wtaStatsStatus = result || null;
            AppState.wtaStatsData = await API.getWTAStatsLeaderboard();
            if (window.StatZoneModule && typeof window.StatZoneModule.render === 'function') {
                window.StatZoneModule.render();
            }
            Socket.updateLastUpdated();
        } catch (error) {
            console.error('Error updating WTA stats:', error);
            alert(`WTA stats update failed: ${error.message}`);
        } finally {
            AppState.isUpdatingWtaStats = false;
            if (window.StatZoneModule && typeof window.StatZoneModule.syncModalActions === 'function') {
                window.StatZoneModule.syncModalActions();
            }
            if (window.StatZoneModule && typeof window.StatZoneModule.syncHeaderState === 'function') {
                window.StatZoneModule.syncHeaderState();
            }
        }
    },

    async refreshAtpRankings() {
        if (AppState.isUpdatingAtpRankings) {
            return;
        }
        AppState.isUpdatingAtpRankings = true;
        if (window.RankingsModule && typeof window.RankingsModule.render === 'function') {
            window.RankingsModule.render();
        }

        try {
            const result = await API.refreshAtpRankings();
            AppState.atpRankingsStatus = result || null;
            const atpRankings = await API.getRankings('atp', 200);
            AppState.rankings.atp = atpRankings || [];
            RankingsModule.render();
            Socket.updateLastUpdated();
        } catch (error) {
            console.error('Error updating ATP rankings:', error);
            alert(`ATP rankings update failed: ${error.message}`);
        } finally {
            AppState.isUpdatingAtpRankings = false;
            RankingsModule.render();
        }
    },

    async refreshWtaRankings() {
        if (AppState.isUpdatingWtaRankings) {
            return;
        }
        AppState.isUpdatingWtaRankings = true;
        if (window.RankingsModule && typeof window.RankingsModule.render === 'function') {
            window.RankingsModule.render();
        }

        try {
            const result = await API.refreshWtaRankings();
            AppState.wtaRankingsStatus = result || null;
            const wtaRankings = await API.getRankings('wta', 400);
            AppState.rankings.wta = wtaRankings || [];
            RankingsModule.render();
            Socket.updateLastUpdated();
        } catch (error) {
            console.error('Error updating WTA rankings:', error);
            alert(`WTA rankings update failed: ${error.message}`);
        } finally {
            AppState.isUpdatingWtaRankings = false;
            RankingsModule.render();
        }
    },

    async refreshCurrentTourRankings() {
        const tour = AppState.currentTour === 'wta' ? 'wta' : 'atp';
        if (tour === 'wta') {
            await this.refreshWtaRankings();
        } else {
            await this.refreshAtpRankings();
        }
    },

    formatRelativeTime(isoText, fallback = 'Updated --') {
        if (!isoText) return fallback;
        const then = new Date(isoText);
        if (Number.isNaN(then.getTime())) return fallback;
        const now = new Date();
        const diffMs = now - then;
        if (diffMs < 0) return 'Updated just now';
        const sec = Math.floor(diffMs / 1000);
        if (sec < 45) return 'Updated just now';
        const min = Math.floor(sec / 60);
        if (min < 60) return `Updated ${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `Updated ${hr}h ago`;
        const day = Math.floor(hr / 24);
        return `Updated ${day}d ago`;
    },

    refreshTournamentsUpdatedAgo() {
        const tour = AppState.currentTour;
        const status = AppState.tournamentsStatus[tour] || {};
        if (DOM.tournamentsUpdatedAgo) {
            DOM.tournamentsUpdatedAgo.textContent = this.formatRelativeTime(status.updated_at, 'Updated --');
        }
    },

    syncTournamentHeaderState() {
        const tour = AppState.currentTour;
        const isUpdating = !!(AppState.isUpdatingTournaments[tour]);
        if (DOM.tournamentsUpdateBtn) {
            DOM.tournamentsUpdateBtn.disabled = isUpdating;
            DOM.tournamentsUpdateBtn.innerHTML = isUpdating
                ? '<i class="fas fa-spinner fa-spin"></i>'
                : '<i class="fas fa-rotate-right"></i>';
            const label = isUpdating ? `Updating ${tour.toUpperCase()} tournaments` : `Update ${tour.toUpperCase()} tournaments`;
            DOM.tournamentsUpdateBtn.setAttribute('aria-label', label);
            DOM.tournamentsUpdateBtn.setAttribute('title', label);
        }
        this.refreshTournamentsUpdatedAgo();
    },

    async refreshTournamentsStatus(tour = AppState.currentTour) {
        const tourName = String(tour || '').toLowerCase() === 'wta' ? 'wta' : 'atp';
        try {
            AppState.tournamentsStatus[tourName] = await API.getTournamentsStatus(tourName);
        } catch (error) {
            console.error(`Failed to load ${tourName.toUpperCase()} tournaments status:`, error);
        }
        if (tourName === AppState.currentTour) {
            this.syncTournamentHeaderState();
        }
    },

    async refreshCurrentTourTournaments() {
        const tour = AppState.currentTour === 'wta' ? 'wta' : 'atp';
        if (AppState.isUpdatingTournaments[tour]) {
            return;
        }

        AppState.isUpdatingTournaments[tour] = true;
        this.syncTournamentHeaderState();

        try {
            const year = parseInt(DOM.yearDisplay?.textContent || '', 10) || null;
            const result = await API.refreshTournaments(tour, year, false);
            AppState.tournamentsStatus[tour] = result || null;
            AppState.tournaments[tour] = await API.getTournaments(tour, year);
            TournamentsModule.render();
            Socket.updateLastUpdated();
        } catch (error) {
            console.error(`Error updating ${tour.toUpperCase()} tournaments:`, error);
            alert(`${tour.toUpperCase()} tournament update failed: ${error.message}`);
        } finally {
            AppState.isUpdatingTournaments[tour] = false;
            this.syncTournamentHeaderState();
        }
    },

    /**
     * Load demo data when API is not available
     */
    loadDemoData() {
        console.log('Loading demo data...');
        AppState.upcomingMatchesUpdatedAt = new Date().toISOString();
        AppState.recentMatchesUpdatedAt = new Date().toISOString();
        // Demo data will be loaded from the modules
        ScoresModule.renderLiveScores();
        ScoresModule.renderUpcomingMatches();
        ScoresModule.renderRecentMatches();
        RankingsModule.render();
        TournamentsModule.render();
    },

    /**
     * Periodic refresh for match sections
     */
    startPeriodicRefresh() {
        // Refresh recent/upcoming blocks every 30 minutes.
        setInterval(async () => {
            try {
                const settled = await Promise.allSettled([
                    API.getUpcomingMatches('atp'),
                    API.getUpcomingMatches('wta'),
                    API.getRecentMatches('atp', 15),
                    API.getRecentMatches('wta', 15)
                ]);
                const values = settled.map((item) => (item.status === 'fulfilled' ? item.value : null));
                if (settled[0].status === 'rejected') console.error('Periodic refresh failed: atpUpcoming', settled[0].reason);
                if (settled[1].status === 'rejected') console.error('Periodic refresh failed: wtaUpcoming', settled[1].reason);
                if (settled[2].status === 'rejected') console.error('Periodic refresh failed: atpRecent', settled[2].reason);
                if (settled[3].status === 'rejected') console.error('Periodic refresh failed: wtaRecent', settled[3].reason);

                AppState.upcomingMatches.atp = values[0] || AppState.upcomingMatches.atp || [];
                AppState.upcomingMatches.wta = values[1] || AppState.upcomingMatches.wta || [];
                AppState.recentMatches.atp = values[2] || AppState.recentMatches.atp || [];
                AppState.recentMatches.wta = values[3] || AppState.recentMatches.wta || [];
                AppState.upcomingMatchesUpdatedAt = new Date().toISOString();
                AppState.recentMatchesUpdatedAt = new Date().toISOString();

                ScoresModule.renderUpcomingMatches();
                ScoresModule.renderRecentMatches();
                Socket.updateLastUpdated();
            } catch (error) {
                console.error('Error refreshing recent/upcoming matches:', error);
            }
        }, CONFIG.MATCH_LIST_UPDATE_INTERVAL);

        // Keep "updated ago" label fresh.
        setInterval(() => {
            if (window.ScoresModule && typeof window.ScoresModule.refreshSectionUpdatedAgo === 'function') {
                window.ScoresModule.refreshSectionUpdatedAgo();
            }
            if (window.RankingsModule && typeof window.RankingsModule.refreshWtaUpdatedAgo === 'function') {
                window.RankingsModule.refreshWtaUpdatedAgo();
            }
            App.refreshTournamentsUpdatedAgo();
        }, 60000);
    },

    /**
     * Open H2H comparison modal
     */
    openH2HModal() {
        const modal = document.getElementById('h2hModal');
        if (modal) {
            H2HModule.reset();
            modal.classList.add('active');
            H2HModule.init();
        }
    },

    /**
     * Close H2H comparison modal
     */
    closeH2HModal() {
        const modal = document.getElementById('h2hModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    openStatsZoneModal() {
        if (window.StatZoneModule && typeof window.StatZoneModule.open === 'function') {
            window.StatZoneModule.open();
        }
    },

    closeStatsZoneModal() {
        if (window.StatZoneModule && typeof window.StatZoneModule.close === 'function') {
            window.StatZoneModule.close();
        }
    }
};

// ============================================
// Start Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// ============================================
// Finalize App Object
// ============================================
// Attach modules and final methods to the global App object
window.TennisApp.Scores = window.ScoresModule;
window.TennisApp.BracketModule = window.BracketModule;
window.TennisApp.H2HModule = window.H2HModule;
window.TennisApp.PlayerModule = window.PlayerModule;
window.TennisApp.StatZoneModule = window.StatZoneModule;
window.TennisApp.StatZone = window.StatZoneModule;
window.TennisApp.openH2HModal = App.openH2HModal;
window.TennisApp.closeH2HModal = App.closeH2HModal;
window.TennisApp.openStatsZoneModal = App.openStatsZoneModal;
window.TennisApp.closeStatsZoneModal = App.closeStatsZoneModal;
window.TennisApp.refreshAtpStats = App.refreshAtpStats.bind(App);
window.TennisApp.refreshWtaStats = App.refreshWtaStats.bind(App);
