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
    UPDATE_INTERVAL: 30000, // 30 seconds
    TOURNAMENT_COLORS: {
        'grand_slam': '#9B59B6',
        'masters_1000': '#F1C40F',
        'atp_500': '#3498DB',
        'atp_250': '#2ECC71',
        'atp_125': '#E67E22',
        'other': '#95A5A6'
    }
};

// ============================================
// Application State
// ============================================
const AppState = {
    currentTour: 'atp',
    liveScores: { atp: [], wta: [] },
    recentMatches: { atp: [], wta: [] },
    rankings: { atp: [], wta: [] },
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
    getPlayerImage(playerId, tour = 'atp') {
        // Use placeholder service that works reliably
        // Generate unique color based on player ID
        const colors = ['3498db', '9b59b6', 'e74c3c', 'f39c12', '1abc9c', '34495e', '16a085', 'd35400'];
        const color = colors[playerId % colors.length];
        return `https://via.placeholder.com/150/${color}/ffffff?text=P${playerId}`;
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
     * Fetch data from API
     */
    async fetch(endpoint, params = {}) {
        try {
            const url = new URL(`${CONFIG.API_BASE_URL}${endpoint}`);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                return data.data;
            } else {
                throw new Error(data.error || 'API Error');
            }
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
    async getTournamentBracket(tournamentId) {
        return await this.fetch(`/tournament/${tournamentId}/bracket`);
    },

    /**
     * Get player details
     */
    async getPlayer(playerId) {
        return await this.fetch(`/player/${playerId}`);
    }
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
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                DOM.tournamentDetailsPanel.classList.remove('visible');
                DOM.matchPopup.classList.remove('visible');
                ScoresModule.closeMatchStats();
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
            // Load data in parallel
            const [atpScores, wtaScores, atpRecent, wtaRecent, atpRankings, wtaRankings, atpTournaments, wtaTournaments] = await Promise.all([
                API.getLiveScores('atp').catch(() => []),
                API.getLiveScores('wta').catch(() => []),
                API.getRecentMatches('atp', 15).catch(() => []),
                API.getRecentMatches('wta', 15).catch(() => []),
                API.getRankings('atp', 200).catch(() => []),
                API.getRankings('wta', 200).catch(() => []),
                API.getTournaments('atp').catch(() => []),
                API.getTournaments('wta').catch(() => [])
            ]);

            // Update state
            AppState.liveScores.atp = atpScores;
            AppState.liveScores.wta = wtaScores;
            AppState.recentMatches.atp = atpRecent;
            AppState.recentMatches.wta = wtaRecent;
            AppState.rankings.atp = atpRankings;
            AppState.rankings.wta = wtaRankings;
            AppState.tournaments.atp = atpTournaments;
            AppState.tournaments.wta = wtaTournaments;

            // Render all components
            ScoresModule.renderLiveScores();
            ScoresModule.renderRecentMatches();
            RankingsModule.render();
            TournamentsModule.render();

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
        ScoresModule.renderRecentMatches();
        RankingsModule.render();
        TournamentsModule.render();
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

// Export for module use
window.TennisApp = {
    CONFIG,
    AppState,
    Utils,
    API,
    DOM,
    Scores: ScoresModule,
    BracketModule: BracketModule,
    H2HModule: H2HModule,
    openH2HModal: App.openH2HModal,
    closeH2HModal: App.closeH2HModal
};
