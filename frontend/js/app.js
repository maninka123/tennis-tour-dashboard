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
    WS_URL: (window.TennisApp?.CONFIG?.API_BASE_URL?.replace(/\/api$/, '')) || window.location.origin || 'http://localhost:5001',
    
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
    isRefreshingLiveMatches: false,
    isRefreshingRecentMatches: false,
    isRefreshingUpcomingMatches: false,
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
    socketPollingTimer: null,
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
    liveMatchesReloadBtn: document.getElementById('liveMatchesReloadBtn'),
    
    // Recent matches
    recentMatchesWrapper: document.getElementById('recentMatchesWrapper'),
    recentMatchesContainer: document.getElementById('recentMatchesContainer'),
    recentUpdatedAgo: document.getElementById('recentUpdatedAgo'),
    recentMatchesReloadBtn: document.getElementById('recentMatchesReloadBtn'),
    
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
    lastUpdated: document.getElementById('lastUpdated'),

    // Analysis launchers
    analysisLaunchCurrentBtn: document.getElementById('analysisLaunchCurrentBtn'),
    analysisLaunchTourPill: document.getElementById('analysisLaunchTourPill'),
    analysisLaunchLabel: document.getElementById('analysisLaunchLabel'),

    // Season progress strip
    seasonProgressStrip: document.getElementById('seasonProgressStrip'),
    seasonProgressTrack: document.getElementById('seasonProgressTrack'),
    seasonProgressCount: document.getElementById('seasonProgressCount'),
    seasonProgressPercent: document.getElementById('seasonProgressPercent'),
    seasonActivePill: document.getElementById('seasonActivePill'),
    seasonSurfacePill: document.getElementById('seasonSurfacePill')
};

// ============================================
// Utility Functions
// ============================================
const Utils = {
    /**
     * Get country flag as an inline <img> element (works on all platforms including Windows)
     */
    getFlag(countryCode) {
        // Map full country names to 3-letter codes (ATP search returns full names)
        const nameToCode = {
            'Spain': 'ESP', 'Italy': 'ITA', 'Serbia': 'SRB', 'Germany': 'GER',
            'Russia': 'RUS', 'Denmark': 'DEN', 'Greece': 'GRE', 'Poland': 'POL',
            'Norway': 'NOR', 'United States': 'USA', 'Canada': 'CAN',
            'Great Britain': 'GBR', 'United Kingdom': 'GBR', 'France': 'FRA',
            'Australia': 'AUS', 'Argentina': 'ARG', 'Belarus': 'BLR',
            'Kazakhstan': 'KAZ', 'Tunisia': 'TUN', 'Czech Republic': 'CZE',
            'Czechia': 'CZE', 'China': 'CHN', 'Latvia': 'LAT', 'Brazil': 'BRA',
            'Japan': 'JPN', 'South Korea': 'KOR', 'Korea': 'KOR',
            'Bulgaria': 'BUL', 'Chile': 'CHI', 'Switzerland': 'SUI',
            'Belgium': 'BEL', 'Netherlands': 'NED', 'Sweden': 'SWE',
            'Austria': 'AUT', 'Colombia': 'COL', 'Croatia': 'CRO',
            'South Africa': 'RSA', 'Ukraine': 'UKR', 'India': 'IND',
            'Chinese Taipei': 'TPE', 'Taiwan': 'TPE', 'Romania': 'ROU',
            'Hungary': 'HUN', 'Portugal': 'POR', 'Georgia': 'GEO',
            'Finland': 'FIN', 'Slovakia': 'SVK', 'Slovenia': 'SLO',
            'Mexico': 'MEX', 'Peru': 'PER', 'Uruguay': 'URU',
            'Israel': 'ISR', 'Turkey': 'TUR', 'Türkiye': 'TUR',
            'Dominican Republic': 'DOM', 'Thailand': 'THA', 'Indonesia': 'INA',
            'New Zealand': 'NZL', 'Ireland': 'IRL', 'Egypt': 'EGY',
            'Moldova': 'MDA', 'Bosnia and Herzegovina': 'BIH', 'Bosnia': 'BIH',
            'Montenegro': 'MNE', 'North Macedonia': 'MKD', 'Lithuania': 'LTU',
            'Estonia': 'EST', 'Luxembourg': 'LUX', 'Monaco': 'MON',
            'Bolivia': 'BOL', 'Ecuador': 'ECU', 'Venezuela': 'VEN',
            'Paraguay': 'PAR', 'Taiwan, Chinese Taipei': 'TPE'
        };
        // Map 3-letter sport codes to ISO 3166-1 alpha-2 for flagcdn
        const toISO2 = {
            'SRB': 'rs', 'ESP': 'es', 'ITA': 'it', 'RUS': 'ru', 'GER': 'de',
            'DEN': 'dk', 'GRE': 'gr', 'POL': 'pl', 'NOR': 'no', 'USA': 'us',
            'CAN': 'ca', 'GBR': 'gb', 'FRA': 'fr', 'AUS': 'au', 'ARG': 'ar',
            'BLR': 'by', 'KAZ': 'kz', 'TUN': 'tn', 'CZE': 'cz', 'CHN': 'cn',
            'LAT': 'lv', 'BRA': 'br', 'JPN': 'jp', 'KOR': 'kr', 'BUL': 'bg',
            'CHI': 'cl', 'SUI': 'ch', 'BEL': 'be', 'NED': 'nl', 'SWE': 'se',
            'AUT': 'at', 'COL': 'co', 'CRO': 'hr', 'RSA': 'za', 'UKR': 'ua',
            'IND': 'in', 'TPE': 'tw', 'ROU': 'ro', 'HUN': 'hu', 'POR': 'pt',
            'GEO': 'ge', 'FIN': 'fi', 'SVK': 'sk', 'SLO': 'si',
            'MEX': 'mx', 'PER': 'pe', 'URU': 'uy', 'ISR': 'il',
            'TUR': 'tr', 'DOM': 'do', 'THA': 'th', 'INA': 'id',
            'NZL': 'nz', 'IRL': 'ie', 'EGY': 'eg', 'MDA': 'md',
            'BIH': 'ba', 'MNE': 'me', 'MKD': 'mk', 'LTU': 'lt',
            'EST': 'ee', 'LUX': 'lu', 'MON': 'mc', 'BOL': 'bo',
            'ECU': 'ec', 'VEN': 've', 'PAR': 'py'
        };
        const code = nameToCode[countryCode] || countryCode;
        const iso2 = toISO2[code] || code.substring(0, 2).toLowerCase();
        return `<img class="flag-icon" src="https://flagcdn.com/w40/${iso2}.png" srcset="https://flagcdn.com/w80/${iso2}.png 2x" alt="${code}" onerror="this.style.display='none'">`;
    },

    /**
     * Format category for CSS class
     */
    getCategoryClass(category, tour = '') {
        const safe = String(category || 'other').trim().toLowerCase();
        if (!safe) return 'other';
        const normalized = safe
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        if (!normalized) return 'other';

        const explicitTour = String(tour || '').trim().toLowerCase();
        const currentTour = String(window.TennisApp?.AppState?.currentTour || '').trim().toLowerCase();
        const resolvedTour = explicitTour === 'atp' || explicitTour === 'wta'
            ? explicitTour
            : (currentTour === 'atp' || currentTour === 'wta' ? currentTour : '');

        if (normalized === 'grand_slam') return 'grand-slam';
        if (normalized === 'masters_1000' || normalized === '1000') {
            return resolvedTour === 'wta' ? 'wta-1000' : 'atp-1000';
        }
        if (normalized === 'atp_1000') return 'atp-1000';
        if (normalized === 'wta_1000') return 'wta-1000';
        if (normalized === 'atp_500') return 'atp-500';
        if (normalized === 'wta_500') return 'wta-500';
        if (normalized === '500') return resolvedTour === 'wta' ? 'wta-500' : 'atp-500';
        if (normalized === 'atp_250') return 'atp-250';
        if (normalized === 'wta_250') return 'wta-250';
        if (normalized === '250') return resolvedTour === 'wta' ? 'wta-250' : 'atp-250';
        if (normalized === 'atp_125') return 'atp-125';
        if (normalized === 'wta_125') return 'wta-125';
        if (normalized === '125') return resolvedTour === 'wta' ? 'wta-125' : 'atp-125';
        if (normalized === 'atp_finals') return 'atp-finals';
        if (normalized === 'wta_finals') return 'wta-finals';
        if (normalized === 'finals') return resolvedTour === 'wta' ? 'wta-finals' : 'atp-finals';

        return normalized.replace(/_/g, '-') || 'other';
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
    getPlayerImage(player, tour = '') {
        const explicitTour = String(tour || '').trim().toLowerCase();
        const playerTour = String(player?.tour || '').trim().toLowerCase();
        const effectiveTour = explicitTour || playerTour;
        const numericId = Number(player?.id);
        const playerCode = String(player?.player_code || '').trim().toUpperCase();
        const resolvedApiBase = AppState.apiBaseResolved
            || CONFIG.API_BASE_URL
            || window.TennisApp?.CONFIG?.API_BASE_URL
            || window.location.origin
            || '';
        const resolvedOrigin = String(resolvedApiBase).replace(/\/api\/?$/, '').replace(/\/+$/, '');

        // For WTA always prefer local player-folder image route when ID exists.
        if (effectiveTour === 'wta' && Number.isInteger(numericId) && numericId > 0) {
            return `${resolvedOrigin}/api/player/wta/${numericId}/image`;
        }

        // For ATP in main app, prefer backend proxy route when player_code exists.
        // This avoids Render mixed-content and third-party hotlink issues.
        if (effectiveTour === 'atp' && /^[A-Z0-9]{3,6}$/.test(playerCode)) {
            return `${resolvedOrigin}/api/player/atp/${playerCode}/image`;
        }

        // Explicit image_url from API
        if (player && player.image_url) {
            const rawImage = String(player.image_url || '').trim();
            if (rawImage) {
                if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith('data:')) {
                    if (rawImage.startsWith('http://') && window.location.protocol === 'https:') {
                        return `https://${rawImage.slice('http://'.length)}`;
                    }
                    return rawImage;
                }

                // Local API image paths need backend origin prepended.
                if (rawImage.startsWith('/api/')) {
                    return `${resolvedOrigin}${rawImage}`;
                }

                if (rawImage.startsWith('api/')) {
                    return `${resolvedOrigin}/${rawImage}`;
                }

                if (rawImage.startsWith('/')) {
                    return `${resolvedOrigin}${rawImage}`;
                }

                return rawImage;
            }
        }

        // Resolve known names next
        const name = player?.name || PLAYER_ID_MAP[player] || null;
        if (name && PLAYER_IMAGE_MAP[name]) {
            return PLAYER_IMAGE_MAP[name];
        }

        // Numeric IDs in live payloads usually map to SofaScore player IDs.
        if (Number.isInteger(numericId) && numericId > 1000) {
            return `https://api.sofascore.com/api/v1/player/${numericId}/image`;
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
    },

    /**
     * Generate initials SVG data URI for a player name
     */
    getPlayerInitialsSvg(name) {
        const displayName = name || '??';
        const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const colors = ['d1e8ff', 'e8f5e9', 'fff4e6', 'f3e5f5', 'e0f7fa', 'fce4ec'];
        const hash = displayName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const color = colors[hash % colors.length];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <rect width="100%" height="100%" fill="#${color}"/>
            <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="72" fill="#0f172a">${initials}</text>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
};

// Global handler: replace broken player images with initials placeholder
document.addEventListener('error', function(e) {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    // Avoid infinite loop if the fallback itself fails
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = 'true';
    // Use alt text (player name) to generate initials
    const name = img.alt || '??';
    img.src = Utils.getPlayerInitialsSvg(name);
}, true);

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
    async getWTAMatchStats(eventId, eventYear, matchId, isLive = false) {
        const params = {
            event_id: eventId,
            event_year: eventYear,
            match_id: matchId
        };
        if (isLive) {
            params.live = 1;
        }
        return await this.fetch('/match-stats/wta', params);
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
     * Get next scheduled match for a player (Flashscore fixtures source)
     */
    async getPlayerSchedule(playerName, tour = '') {
        return await this.fetch('/player-schedule', {
            name: playerName,
            tour
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
            const isLocalHost = /localhost|127\.0\.0\.1/i.test(window.location.hostname || '');
            AppState.socket = io(CONFIG.WS_URL, {
                // Start with polling in local/dev, then upgrade when possible.
                transports: isLocalHost ? ['polling', 'websocket'] : ['websocket', 'polling'],
                upgrade: true,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
                timeout: 15000
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
            if (AppState.socketPollingTimer) {
                clearInterval(AppState.socketPollingTimer);
                AppState.socketPollingTimer = null;
            }
            AppState.livePollingBySocket = false;
        });

        AppState.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket');
            AppState.isConnected = false;
        });

        AppState.socket.on('connect_error', (error) => {
            console.warn('Socket connection error, falling back to polling:', error?.message || error);
            this.startPolling();
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
            if (window.FavouritesModule) {
                FavouritesModule.render();
                FavouritesModule.updateIconGlow();
            }
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
        if (AppState.socketPollingTimer) return;
        AppState.livePollingBySocket = true;
        AppState.socketPollingTimer = setInterval(async () => {
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

        DOM.liveMatchesReloadBtn?.addEventListener('click', async () => {
            await App.refreshLiveMatches();
        });

        DOM.recentMatchesReloadBtn?.addEventListener('click', async () => {
            await App.refreshRecentMatches();
        });

        // Helper to extract player info from a DOM element
        const extractPlayerInfo = (el) => {
            if (!el) return {};
            // Try specific rank badge first, then general selectors
            const rankBadgeEl = el.querySelector('.player-rank-badge, .rank-number');
            const rankEl = rankBadgeEl || el.querySelector('.player-rank, .rank');
            const rank = parseInt((rankEl?.textContent || '').replace(/[^\d]/g, ''), 10) || null;

            // Get name: try specific name element, strip out badge/flag text
            const nameEl = el.querySelector('.player-name, .ranking-name, .name');
            let name = '';
            if (nameEl) {
                // Clone and remove badge/flag children to get clean name text
                const clone = nameEl.cloneNode(true);
                clone.querySelectorAll('.player-rank-badge, .country-flag, .career-high-badge, .serve-ball').forEach(c => c.remove());
                name = clone.textContent.trim();
            }
            if (!name) {
                const imgEl = el.querySelector('img');
                name = imgEl?.alt?.trim() || '';
            }

            const imgEl = el.querySelector('img');
            const flagEl = el.querySelector('.country-flag');
            return {
                name: name,
                rank: rank,
                country: flagEl?.textContent?.trim() || '',
                image_url: imgEl?.src || ''
            };
        };

        // Match card click handlers
        document.addEventListener('click', (e) => {
            const upcomingRefreshBtn = e.target.closest('#upcomingMatchesReloadBtn');
            if (upcomingRefreshBtn) {
                App.refreshUpcomingMatches();
                return;
            }

            const playerRow = e.target.closest('.player-row[data-player-id]');
            if (playerRow && playerRow.dataset.playerId) {
                PlayerModule.showPlayerStats(playerRow.dataset.playerId, extractPlayerInfo(playerRow));
                return;
            }

            const upcomingCard = e.target.closest('.upcoming-match-card');
            if (upcomingCard) {
                const matchId = upcomingCard.dataset.matchId;
                const matchKey = upcomingCard.dataset.matchKey;
                if (matchId) {
                    ScoresModule.showUpcomingInsights(matchId, null, { matchKey });
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
                PlayerModule.showPlayerStats(playerElement.dataset.playerId, extractPlayerInfo(playerElement));
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const playerRow = e.target.closest('.player-row[data-player-id]');
            if (!playerRow || !playerRow.dataset.playerId) return;
            e.preventDefault();
            PlayerModule.showPlayerStats(playerRow.dataset.playerId, extractPlayerInfo(playerRow));
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
        App.setupAnalysisLaunchers(tour);
        App.renderSeasonProgress(tour);
        if (window.StatZoneModule && typeof window.StatZoneModule.syncHeaderState === 'function') {
            window.StatZoneModule.syncHeaderState();
        }

        // Re-render all components for new tour
        ScoresModule.renderLiveScores();
        ScoresModule.renderUpcomingMatches();
        ScoresModule.renderRecentMatches();
        RankingsModule.render();
        TournamentsModule.render();
        App.syncMatchSectionReloadButtons();

        // Update favourites panel for the new tour
        if (window.FavouritesModule) {
            const favLabel = document.getElementById('favTourLabel');
            if (favLabel) favLabel.textContent = tour.toUpperCase();
            FavouritesModule.render();
            FavouritesModule.updateIconGlow();
        }
    }
};

// ============================================
// Application Initialization
// ============================================
const App = {
    resolveBackendOrigin() {
        const candidates = [
            AppState.apiBaseResolved,
            CONFIG.API_BASE_URL,
            window.TennisApp?.CONFIG?.API_BASE_URL,
            window.location.origin
        ];

        for (const raw of candidates) {
            const value = String(raw || '').trim();
            if (!value) continue;

            try {
                const parsed = new URL(value, window.location.origin);
                const normalized = parsed.origin + parsed.pathname;
                return normalized.replace(/\/api\/?$/, '').replace(/\/+$/, '');
            } catch (error) {
                // Skip invalid candidate and continue.
            }
        }

        return window.location.origin;
    },

    setupAnalysisLaunchers(tour = AppState.currentTour) {
        const launchBtn = DOM.analysisLaunchCurrentBtn;
        if (!launchBtn) {
            return;
        }

        const safeTour = String(tour || '').trim().toLowerCase() === 'wta' ? 'wta' : 'atp';
        const tourLabel = safeTour.toUpperCase();
        const backendOrigin = this.resolveBackendOrigin();
        launchBtn.href = `${backendOrigin}/analysis/${safeTour}/`;
        launchBtn.dataset.analysisTour = safeTour;
        launchBtn.title = `Open ${tourLabel} Data Lab`;

        launchBtn.classList.toggle('analysis-launch-atp', safeTour === 'atp');
        launchBtn.classList.toggle('analysis-launch-wta', safeTour === 'wta');

        if (DOM.analysisLaunchTourPill) {
            DOM.analysisLaunchTourPill.textContent = tourLabel;
        }

        if (DOM.analysisLaunchLabel) {
            DOM.analysisLaunchLabel.textContent = `Open ${tourLabel} Data Lab`;
        }

        const previewTitle = launchBtn.querySelector('.preview-title');
        if (previewTitle) {
            previewTitle.textContent = `${tourLabel} Data Analysis Workspace`;
        }

        const icon = launchBtn.querySelector('.fas');
        if (icon) {
            icon.classList.remove('fa-chart-area', 'fa-chart-line');
            icon.classList.add(safeTour === 'wta' ? 'fa-chart-line' : 'fa-chart-area');
        }
    },

    getSeasonSwingConfig(tour = AppState.currentTour) {
        const safeTour = String(tour || '').trim().toLowerCase() === 'wta' ? 'wta' : 'atp';
        const coreSwings = [
            { name: 'Australian Swing', months: 'JAN', startMonth: 0, surface: 'hard', typeLabel: 'Hard' },
            { name: 'Middle East Swing', months: 'FEB', startMonth: 1, surface: 'hard', typeLabel: 'Hard' },
            { name: 'Sunshine Swing', months: 'MAR', startMonth: 2, surface: 'hard', typeLabel: 'Hard' },
            { name: 'Clay Swing', months: 'APR-MAY', startMonth: 3, surface: 'clay', typeLabel: 'Clay' },
            { name: 'Grass Swing', months: 'JUN-JUL', startMonth: 5, surface: 'grass', typeLabel: 'Grass' },
            { name: 'North American Hard Swing', months: 'JUL-AUG', startMonth: 6, surface: 'hard', typeLabel: 'Hard' },
            { name: 'Asian Swing', months: 'SEP-OCT', startMonth: 8, surface: 'hard', typeLabel: 'Hard' }
        ];

        if (safeTour === 'wta') {
            return [
                ...coreSwings,
                { name: 'WTA Finals', months: 'NOV', startMonth: 10, surface: 'indoor', typeLabel: 'Indoor Hard' }
            ];
        }

        return [
            ...coreSwings,
            { name: 'Indoor European Swing', months: 'OCT-NOV', startMonth: 9, surface: 'indoor', typeLabel: 'Indoor Hard' },
            { name: 'ATP Finals', months: 'NOV', startMonth: 10, surface: 'indoor', typeLabel: 'Indoor Hard' }
        ];
    },

    getSeasonGradient(swings) {
        const colorBySurface = {
            hard: '#2d74b8',
            clay: '#c77a2a',
            grass: '#2c9b61',
            indoor: '#566176'
        };
        if (!Array.isArray(swings) || swings.length === 0) {
            return 'linear-gradient(94deg, #2d74b8 0%, #2d74b8 100%)';
        }
        const stops = swings.map((swing, idx) => {
            const pct = swings.length === 1 ? 0 : (idx / (swings.length - 1)) * 100;
            return `${colorBySurface[swing.surface] || colorBySurface.hard} ${pct.toFixed(1)}%`;
        });
        return `linear-gradient(94deg, ${stops.join(', ')})`;
    },

    renderSeasonProgress(tour = AppState.currentTour) {
        if (!DOM.seasonProgressStrip || !DOM.seasonProgressTrack) return;
        const swings = this.getSeasonSwingConfig(tour);
        if (!swings.length) return;

        const now = new Date();
        const currentMonth = now.getMonth();
        let activeIndex = 0;
        for (let i = 0; i < swings.length; i += 1) {
            if (currentMonth >= swings[i].startMonth) {
                activeIndex = i;
            }
        }

        const activeSwing = swings[activeIndex];
        const year = now.getFullYear();
        const nowDayStart = new Date(year, now.getMonth(), now.getDate()).getTime();
        const activeStart = new Date(year, activeSwing.startMonth, 1).getTime();
        const nextStart = activeIndex < swings.length - 1
            ? new Date(year, swings[activeIndex + 1].startMonth, 1).getTime()
            : new Date(year + 1, 0, 1).getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        const totalDays = Math.max(1, Math.round((nextStart - activeStart) / msPerDay));
        const elapsedDays = Math.max(1, Math.min(totalDays, Math.round((nowDayStart - activeStart) / msPerDay) + 1));
        const activeProgress = elapsedDays / totalDays;
        const activeProgressPct = Math.round(activeProgress * 100);

        DOM.seasonProgressTrack.innerHTML = swings.map((swing, idx) => {
            const stateClass = idx < activeIndex ? 'done' : (idx === activeIndex ? 'active' : '');
            const marker = idx === activeIndex
                ? `<span class="season-now-marker" style="left:${activeProgressPct}%" aria-hidden="true"></span>`
                : '';
            return `
                <div class="season-segment ${stateClass}">
                    <div class="season-segment-bar">${marker}</div>
                    <div class="season-segment-label">${swing.months}</div>
                    <div class="season-segment-name">${swing.name}</div>
                </div>
            `;
        }).join('');

        const progressPct = Math.round(((activeIndex + activeProgress) / swings.length) * 100);

        if (DOM.seasonProgressCount) {
            DOM.seasonProgressCount.textContent = `${activeIndex + 1} / ${swings.length}`;
        }
        if (DOM.seasonProgressPercent) {
            DOM.seasonProgressPercent.textContent = `${progressPct}%`;
        }
        if (DOM.seasonActivePill) {
            DOM.seasonActivePill.textContent = activeSwing.name;
        }
        if (DOM.seasonSurfacePill) {
            DOM.seasonSurfacePill.classList.remove('surface-hard', 'surface-clay', 'surface-grass', 'surface-indoor');
            DOM.seasonSurfacePill.classList.add(`surface-${activeSwing.surface}`);
            DOM.seasonSurfacePill.innerHTML = `<i class="fas fa-table-cells"></i> ${activeSwing.typeLabel.toUpperCase()}`;
        }

        DOM.seasonProgressStrip.style.setProperty('--season-progress-bg', this.getSeasonGradient(swings));
    },

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Tennis Dashboard...');
        
        // Initialize event handlers
        EventHandlers.init();
        this.setupAnalysisLaunchers();
        this.renderSeasonProgress();
        
        // Initialize ATP match stats cache
        ScoresModule.init();

        // Initialize Favourites
        if (window.FavouritesModule) FavouritesModule.init();
        
        // Initialize WebSocket connection
        Socket.init();
        
        // Load initial data
        await this.loadInitialData();
        this.setupAnalysisLaunchers();
        this.renderSeasonProgress();
        await this.refreshAtpRankingsStatus();
        await this.refreshWtaRankingsStatus();
        await this.refreshAtpStatsStatus();
        await this.refreshWtaStatsStatus();
        await this.refreshTournamentsStatus('atp');
        await this.refreshTournamentsStatus('wta');
        this.syncTournamentHeaderState();
        this.startLiveScoreRefreshLoop();
        this.startPeriodicRefresh();
        this.syncMatchSectionReloadButtons();
        
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
                if (window.FavouritesModule) FavouritesModule.updateIconGlow();
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
            const msg = error.message || String(error);
            if (msg.includes('403') || msg.includes('Forbidden')) {
                alert(`${tour.toUpperCase()} tournament refresh blocked by source website (403 Forbidden).\n\nThe ATP Tour website is blocking automated requests. Your existing local tournament data is still loaded and working.\n\nTry again later or refresh from a different network.`);
            } else {
                alert(`${tour.toUpperCase()} tournament update failed: ${msg}`);
            }
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

    syncMatchSectionReloadButtons() {
        const tour = AppState.currentTour === 'wta' ? 'wta' : 'atp';
        const tourLabel = tour.toUpperCase();
        const controls = [
            { element: DOM.liveMatchesReloadBtn, key: 'isRefreshingLiveMatches', label: 'live matches' },
            { element: DOM.recentMatchesReloadBtn, key: 'isRefreshingRecentMatches', label: 'recent matches' },
            { element: document.getElementById('upcomingMatchesReloadBtn'), key: 'isRefreshingUpcomingMatches', label: 'upcoming matches' }
        ];

        controls.forEach(({ element, key, label }) => {
            if (!element) return;
            const isRefreshing = !!AppState[key];
            element.disabled = isRefreshing;
            element.innerHTML = isRefreshing
                ? '<i class="fas fa-spinner fa-spin"></i>'
                : '<i class="fas fa-rotate-right"></i>';
            const text = isRefreshing
                ? `Reloading ${tourLabel} ${label}`
                : `Reload ${tourLabel} ${label}`;
            element.setAttribute('aria-label', text);
            element.setAttribute('title', text);
        });
    },

    async refreshLiveMatches() {
        const tour = AppState.currentTour === 'wta' ? 'wta' : 'atp';
        if (AppState.isRefreshingLiveMatches) return;

        AppState.isRefreshingLiveMatches = true;
        this.syncMatchSectionReloadButtons();
        try {
            const matches = await API.getLiveScores(tour);
            AppState.liveScores[tour] = Array.isArray(matches) ? matches : [];
            ScoresModule.renderLiveScores();
            if (window.FavouritesModule) FavouritesModule.updateIconGlow();
            Socket.updateLastUpdated();
        } catch (error) {
            console.error(`Error reloading ${tour.toUpperCase()} live matches:`, error);
            alert(`${tour.toUpperCase()} live matches reload failed: ${error.message}`);
        } finally {
            AppState.isRefreshingLiveMatches = false;
            this.syncMatchSectionReloadButtons();
        }
    },

    async refreshRecentMatches() {
        const tour = AppState.currentTour === 'wta' ? 'wta' : 'atp';
        if (AppState.isRefreshingRecentMatches) return;

        AppState.isRefreshingRecentMatches = true;
        this.syncMatchSectionReloadButtons();
        try {
            const matches = await API.getRecentMatches(tour, 15);
            AppState.recentMatches[tour] = Array.isArray(matches) ? matches : [];
            AppState.recentMatchesUpdatedAt = new Date().toISOString();
            ScoresModule.renderRecentMatches();
            Socket.updateLastUpdated();
        } catch (error) {
            console.error(`Error reloading ${tour.toUpperCase()} recent matches:`, error);
            alert(`${tour.toUpperCase()} recent matches reload failed: ${error.message}`);
        } finally {
            AppState.isRefreshingRecentMatches = false;
            this.syncMatchSectionReloadButtons();
        }
    },

    async refreshUpcomingMatches() {
        const tour = AppState.currentTour === 'wta' ? 'wta' : 'atp';
        if (AppState.isRefreshingUpcomingMatches) return;

        AppState.isRefreshingUpcomingMatches = true;
        this.syncMatchSectionReloadButtons();
        try {
            const matches = await API.getUpcomingMatches(tour);
            AppState.upcomingMatches[tour] = Array.isArray(matches) ? matches : [];
            AppState.upcomingMatchesUpdatedAt = new Date().toISOString();
            ScoresModule.renderUpcomingMatches();
            Socket.updateLastUpdated();
        } catch (error) {
            console.error(`Error reloading ${tour.toUpperCase()} upcoming matches:`, error);
            alert(`${tour.toUpperCase()} upcoming matches reload failed: ${error.message}`);
        } finally {
            AppState.isRefreshingUpcomingMatches = false;
            this.syncMatchSectionReloadButtons();
        }
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
    },

    openDataAnalysis(tour = 'atp') {
        const safeTour = String(tour || '').trim().toLowerCase() === 'wta' ? 'wta' : 'atp';
        const backendOrigin = this.resolveBackendOrigin();
        const targetUrl = `${backendOrigin}/analysis/${safeTour}/`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
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
window.TennisApp.syncMatchSectionReloadButtons = App.syncMatchSectionReloadButtons.bind(App);
window.TennisApp.refreshLiveMatches = App.refreshLiveMatches.bind(App);
window.TennisApp.refreshRecentMatches = App.refreshRecentMatches.bind(App);
window.TennisApp.refreshUpcomingMatches = App.refreshUpcomingMatches.bind(App);
window.TennisApp.openDataAnalysis = App.openDataAnalysis.bind(App);
