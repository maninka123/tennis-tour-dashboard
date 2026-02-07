/**
 * Tennis Live Dashboard - Main Application
 * Handles app initialization, state management, and WebSocket connections
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    API_BASE_URL: 'http://localhost:5001/api',
    WS_URL: 'http://localhost:5001',
    UPDATE_INTERVAL: 300000, // 5 minutes (live scores)
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
    rankings: { atp: [], wta: [] },
    rankingsDisplayLimit: { atp: 200, wta: 200 },
    tournaments: { atp: [], wta: [] },
    selectedTournament: null,
    socket: null,
    isConnected: false,
    lastUpdated: null
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
    scrollRecentLeft: document.getElementById('scrollRecentLeft'),
    scrollRecentRight: document.getElementById('scrollRecentRight'),
    
    // Rankings
    rankingsList: document.getElementById('rankingsList'),
    rankingsTitle: document.getElementById('rankingsTitle'),
    rankingsSubtitle: document.getElementById('rankingsSubtitle'),
    rankingsLoadMore: document.getElementById('rankingsLoadMore'),
    
    // Tournaments
    tournamentCalendar: document.getElementById('tournamentCalendar'),
    yearDisplay: document.getElementById('yearDisplay'),
    
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
        return category.replace(/_/g, '-');
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
    /**
     * Fetch data from API with timeout
     */
    async fetch(endpoint, params = {}) {
        try {
            const url = new URL(`${CONFIG.API_BASE_URL}${endpoint}`);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            // Handle both {success: true, data: ...} and direct data response
            if (data.success === false) {
                throw new Error(data.error || 'API Error');
            }
            
            return data.data || data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
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
     * Get tournaments
     */
    async getTournaments(tour = 'atp', year = null) {
        const params = year ? { year } : {};
        return await this.fetch(`/tournaments/${tour}`, params);
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
     * Search WTA players for H2H autocomplete
     */
    async searchWTAH2HPlayers(query, limit = 8) {
        return await this.fetch('/h2h/wta/search', { query, limit });
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
    Player: null
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
    },

    /**
     * Start polling if WebSocket is not available
     */
    startPolling() {
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

        // Match card click handlers
        document.addEventListener('click', (e) => {
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
                if (matchId) {
                    ScoresModule.showMatchStats(matchId);
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                DOM.tournamentDetailsPanel.classList.remove('visible');
                DOM.matchPopup.classList.remove('visible');
                ScoresModule.closeMatchStats();
                PlayerModule.close();
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
        
        // Initialize WebSocket connection
        Socket.init();
        
        // Load initial data
        await this.loadInitialData();
        this.startPeriodicRefresh();
        
        // Hide loading overlay
        setTimeout(() => {
            DOM.loadingOverlay.classList.add('hidden');
        }, 500);
        
        console.log('Dashboard initialized successfully');
    },

    /**
     * Load all initial data
     */
    async loadInitialData() {
        try {
            console.log('Fetching initial data from API...');
            // Load data in parallel
            const [atpScores, wtaScores, atpUpcoming, wtaUpcoming, atpRecent, wtaRecent, atpRankings, wtaRankings, atpTournaments, wtaTournaments] = await Promise.all([
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
            ]).catch(err => {
                console.error("One or more API calls failed:", err);
                throw err; // Re-throw to be caught by the outer try/catch
            });

            console.log('Data fetched successfully. Raw data:', { atpScores, wtaScores, atpRankings, wtaRankings, atpTournaments, wtaTournaments });

            // Update state
            AppState.liveScores.atp = atpScores || [];
            AppState.liveScores.wta = wtaScores || [];
            AppState.upcomingMatches.atp = atpUpcoming || [];
            AppState.upcomingMatches.wta = wtaUpcoming || [];
            AppState.recentMatches.atp = atpRecent || [];
            AppState.recentMatches.wta = wtaRecent || [];
            AppState.rankings.atp = atpRankings || [];
            AppState.rankings.wta = wtaRankings || [];
            AppState.tournaments.atp = atpTournaments || [];
            AppState.tournaments.wta = wtaTournaments || [];

            console.log('Application state updated:', AppState);

            // Render all components
            console.log('Rendering all modules...');
            ScoresModule.renderLiveScores();
            ScoresModule.renderUpcomingMatches();
            ScoresModule.renderRecentMatches();
            RankingsModule.render();
            TournamentsModule.render();
            console.log('All modules rendered.');

            Socket.updateLastUpdated();
        } catch (error) {
            console.error('Error loading initial data:', error);
            // Show demo data even if API fails
            this.loadDemoData();
        }
    },

    /**
     * Load demo data when API is not available
     */
    loadDemoData() {
        console.log('Loading demo data...');
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
                const [atpUpcoming, wtaUpcoming, atpRecent, wtaRecent] = await Promise.all([
                    API.getUpcomingMatches('atp'),
                    API.getUpcomingMatches('wta'),
                    API.getRecentMatches('atp', 15),
                    API.getRecentMatches('wta', 15)
                ]);

                AppState.upcomingMatches.atp = atpUpcoming || [];
                AppState.upcomingMatches.wta = wtaUpcoming || [];
                AppState.recentMatches.atp = atpRecent || [];
                AppState.recentMatches.wta = wtaRecent || [];

                ScoresModule.renderUpcomingMatches();
                ScoresModule.renderRecentMatches();
                Socket.updateLastUpdated();
            } catch (error) {
                console.error('Error refreshing recent/upcoming matches:', error);
            }
        }, CONFIG.MATCH_LIST_UPDATE_INTERVAL);
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
window.TennisApp.openH2HModal = App.openH2HModal;
window.TennisApp.closeH2HModal = App.closeH2HModal;
