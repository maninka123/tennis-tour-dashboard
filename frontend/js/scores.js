/**
 * Tennis Live Dashboard - Live Scores Module
 * Handles rendering and updating of live and recent match scores
 */

const ScoresModule = {
    liveModalRefreshTimer: null,
    activeLiveModalMatchId: null,
    _activeMatchStatsRequestKey: null,

    // ATP Match Stats Cache - persists stats to avoid re-fetching
    atpMatchStatsCache: {},
    atpMatchStatsCacheKey: 'tennisApp_atpMatchStatsCache',
    
    init() {
        // Load cached ATP match stats from localStorage
        try {
            const cached = localStorage.getItem(this.atpMatchStatsCacheKey);
            if (cached) {
                this.atpMatchStatsCache = JSON.parse(cached);
                console.log(`Loaded ${Object.keys(this.atpMatchStatsCache).length} cached ATP match stats`);
            }
        } catch (error) {
            console.warn('Failed to load ATP match stats cache:', error);
            this.atpMatchStatsCache = {};
        }
    },
    
    saveATPMatchStatsCache() {
        try {
            localStorage.setItem(this.atpMatchStatsCacheKey, JSON.stringify(this.atpMatchStatsCache));
        } catch (error) {
            console.warn('Failed to save ATP match stats cache:', error);
        }
    },
    
    getCachedATPMatchStats(cacheKey) {
        const cached = this.atpMatchStatsCache[cacheKey];
        if (!cached) return null;
        
        // Check if cache is still valid (24 hours for completed matches)
        const now = Date.now();
        const age = now - (cached.cachedAt || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (age > maxAge) {
            delete this.atpMatchStatsCache[cacheKey];
            this.saveATPMatchStatsCache();
            return null;
        }
        
        return cached.stats;
    },
    
    cacheATPMatchStats(cacheKey, stats) {
        this.atpMatchStatsCache[cacheKey] = {
            stats: stats,
            cachedAt: Date.now()
        };
        this.saveATPMatchStatsCache();
    },

    /**
     * Demo live matches data (used when API is unavailable)
     */
    demoLiveMatches: {
        atp: [
            {
                id: 'demo_atp_1',
                tour: 'ATP',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                location: 'Melbourne, Australia',
                round: 'SF',
                court: 'Rod Laver Arena',
                player1: { id: 1, name: 'Novak Djokovic', country: 'SRB', rank: 1 },
                player2: { id: 2, name: 'Carlos Alcaraz', country: 'ESP', rank: 2 },
                score: {
                    sets: [{ p1: 6, p2: 4 }, { p1: 4, p2: 6 }, { p1: 5, p2: 4 }],
                    current_game: { p1: '30', p2: '15' },
                    p1_sets: 1,
                    p2_sets: 1
                },
                status: 'live',
                serving: 1
            },
            {
                id: 'demo_atp_2',
                tour: 'ATP',
                tournament: 'Qatar Open',
                tournament_category: 'masters_1000',
                location: 'Doha, Qatar',
                round: 'SF',
                court: 'Margaret Court Arena',
                player1: { id: 3, name: 'Jannik Sinner', country: 'ITA', rank: 3 },
                player2: { id: 4, name: 'Daniil Medvedev', country: 'RUS', rank: 4 },
                score: {
                    sets: [{ p1: 7, p2: 5 }, { p1: 3, p2: 2 }],
                    current_game: { p1: '40', p2: '30' },
                    p1_sets: 1,
                    p2_sets: 0
                },
                status: 'live',
                serving: 2
            },
            {
                id: 'demo_atp_3',
                tour: 'ATP',
                tournament: 'Rotterdam Open',
                tournament_category: 'atp_500',
                location: 'Rotterdam, Netherlands',
                round: 'QF',
                court: 'Centre Court',
                player1: { id: 5, name: 'Andrey Rublev', country: 'RUS', rank: 5 },
                player2: { id: 6, name: 'Alexander Zverev', country: 'GER', rank: 6 },
                score: {
                    sets: [{ p1: 6, p2: 3 }, { p1: 4, p2: 5 }],
                    current_game: { p1: '15', p2: '40' },
                    p1_sets: 1,
                    p2_sets: 0
                },
                status: 'live',
                serving: 1
            }
        ],
        wta: [
            {
                id: 'demo_wta_1',
                tour: 'WTA',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                location: 'Melbourne, Australia',
                round: 'F',
                court: 'Rod Laver Arena',
                player1: { id: 101, name: 'Iga Swiatek', country: 'POL', rank: 1 },
                player2: { id: 102, name: 'Aryna Sabalenka', country: 'BLR', rank: 2 },
                score: {
                    sets: [{ p1: 4, p2: 6 }, { p1: 6, p2: 3 }, { p1: 3, p2: 2 }],
                    current_game: { p1: 'AD', p2: '40' },
                    p1_sets: 1,
                    p2_sets: 1
                },
                status: 'live',
                serving: 1
            },
            {
                id: 'demo_wta_2',
                tour: 'WTA',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                location: 'Dubai, UAE',
                round: 'R16',
                court: 'Centre Court',
                player1: { id: 103, name: 'Coco Gauff', country: 'USA', rank: 3 },
                player2: { id: 104, name: 'Elena Rybakina', country: 'KAZ', rank: 4 },
                score: {
                    sets: [{ p1: 2, p2: 3 }],
                    current_game: { p1: '0', p2: '30' },
                    p1_sets: 0,
                    p2_sets: 0
                },
                status: 'live',
                serving: 2
            }
        ]
    },

    /**
     * Demo recent matches data
     */
    demoRecentMatches: {
        atp: [
            {
                id: 'recent_atp_1',
                tour: 'ATP',
                tournament: 'Qatar Open',
                tournament_category: 'masters_1000',
                round: 'QF',
                player1: { id: 1, name: 'Novak Djokovic', country: 'SRB', rank: 1 },
                player2: { id: 7, name: 'Holger Rune', country: 'DEN', rank: 7 },
                winner: 1,
                final_score: { sets: [{ p1: 6, p2: 4 }, { p1: 6, p2: 2 }, { p1: 6, p2: 3 }] },
                status: 'finished'
            },
            {
                id: 'recent_atp_2',
                tour: 'ATP',
                tournament: 'Dubai Championships',
                tournament_category: 'masters_1000',
                round: 'QF',
                player1: { id: 2, name: 'Carlos Alcaraz', country: 'ESP', rank: 2 },
                player2: { id: 8, name: 'Stefanos Tsitsipas', country: 'GRE', rank: 8 },
                winner: 1,
                final_score: { sets: [{ p1: 7, p2: 6, tiebreak: { p1: 7, p2: 5 } }, { p1: 6, p2: 4 }, { p1: 6, p2: 2 }] },
                status: 'finished'
            },
            {
                id: 'recent_atp_3',
                tour: 'ATP',
                tournament: 'Rotterdam Open',
                tournament_category: 'atp_500',
                round: 'R16',
                player1: { id: 9, name: 'Hubert Hurkacz', country: 'POL', rank: 9 },
                player2: { id: 15, name: 'Felix Auger-Aliassime', country: 'CAN', rank: 15 },
                winner: 2,
                final_score: { sets: [{ p1: 4, p2: 6 }, { p1: 6, p2: 7, tiebreak: { p1: 5, p2: 7 } }] },
                status: 'finished'
            }
        ],
        wta: [
            {
                id: 'recent_wta_1',
                tour: 'WTA',
                tournament: 'Qatar Open',
                tournament_category: 'masters_1000',
                round: 'SF',
                player1: { id: 101, name: 'Iga Swiatek', country: 'POL', rank: 1 },
                player2: { id: 105, name: 'Jessica Pegula', country: 'USA', rank: 5 },
                winner: 1,
                final_score: { sets: [{ p1: 6, p2: 2 }, { p1: 6, p2: 3 }] },
                status: 'finished'
            },
            {
                id: 'recent_wta_2',
                tour: 'WTA',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                round: 'SF',
                player1: { id: 102, name: 'Aryna Sabalenka', country: 'BLR', rank: 2 },
                player2: { id: 103, name: 'Coco Gauff', country: 'USA', rank: 3 },
                winner: 1,
                final_score: { sets: [{ p1: 6, p2: 4 }, { p1: 7, p2: 5 }] },
                status: 'finished'
            }
        ]
    },

    /**
     * Demo upcoming matches data
     */
    demoUpcomingMatches: {
        atp: [
            {
                id: 'upcoming_atp_1',
                tour: 'ATP',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                round: 'SF',
                player1: { id: 1, name: 'Novak Djokovic', country: 'SRB', rank: 1 },
                player2: { id: 2, name: 'Carlos Alcaraz', country: 'ESP', rank: 2 },
                scheduled_time: '2026-02-02T14:00:00Z'
            },
            {
                id: 'upcoming_atp_2',
                tour: 'ATP',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                round: 'SF',
                player1: { id: 3, name: 'Jannik Sinner', country: 'ITA', rank: 3 },
                player2: { id: 4, name: 'Daniil Medvedev', country: 'RUS', rank: 4 },
                scheduled_time: '2026-02-02T10:00:00Z'
            },
            {
                id: 'upcoming_atp_3',
                tour: 'ATP',
                tournament: 'Rotterdam Open',
                tournament_category: 'atp_500',
                round: 'QF',
                player1: { id: 5, name: 'Andrey Rublev', country: 'RUS', rank: 5 },
                player2: { id: 6, name: 'Alexander Zverev', country: 'GER', rank: 6 },
                scheduled_time: '2026-02-03T15:30:00Z'
            },
            {
                id: 'upcoming_atp_4',
                tour: 'ATP',
                tournament: 'Rotterdam Open',
                tournament_category: 'atp_500',
                round: 'QF',
                player1: { id: 7, name: 'Holger Rune', country: 'DEN', rank: 7 },
                player2: { id: 8, name: 'Stefanos Tsitsipas', country: 'GRE', rank: 8 },
                scheduled_time: '2026-02-03T19:00:00Z'
            }
        ],
        wta: [
            {
                id: 'upcoming_wta_1',
                tour: 'WTA',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                round: 'F',
                player1: { id: 101, name: 'Iga Swiatek', country: 'POL', rank: 1 },
                player2: { id: 102, name: 'Aryna Sabalenka', country: 'BLR', rank: 2 },
                scheduled_time: '2026-02-02T08:30:00Z'
            },
            {
                id: 'upcoming_wta_2',
                tour: 'WTA',
                tournament: 'Abu Dhabi Open',
                tournament_category: 'atp_500',
                round: 'R16',
                player1: { id: 103, name: 'Coco Gauff', country: 'USA', rank: 3 },
                player2: { id: 104, name: 'Elena Rybakina', country: 'KAZ', rank: 4 },
                scheduled_time: '2026-02-02T16:00:00Z'
            },
            {
                id: 'upcoming_wta_3',
                tour: 'WTA',
                tournament: 'Dubai Championships',
                tournament_category: 'masters_1000',
                round: 'QF',
                player1: { id: 105, name: 'Jessica Pegula', country: 'USA', rank: 5 },
                player2: { id: 106, name: 'Karolina Muchova', country: 'CZE', rank: 6 },
                scheduled_time: '2026-02-03T14:00:00Z'
            },
            {
                id: 'upcoming_wta_4',
                tour: 'WTA',
                tournament: 'Dubai Championships',
                tournament_category: 'masters_1000',
                round: 'QF',
                player1: { id: 107, name: 'Marketa Vondrousova', country: 'CZE', rank: 7 },
                player2: { id: 108, name: 'Madison Keys', country: 'USA', rank: 8 },
                scheduled_time: '2026-02-03T18:30:00Z'
            }
        ]
    },

    formatRelativeMinutes(isoText) {
        if (!isoText) return 'Updated --';
        const then = new Date(isoText);
        if (Number.isNaN(then.getTime())) return 'Updated --';
        const diffMs = Date.now() - then.getTime();
        if (diffMs < 0 || diffMs < 45000) return 'Updated just now';
        const mins = Math.max(1, Math.floor(diffMs / 60000));
        return `Updated ${mins}m ago`;
    },

    updateRecentUpdatedAgo() {
        const { AppState, DOM } = window.TennisApp;
        if (!DOM.recentUpdatedAgo) return;
        DOM.recentUpdatedAgo.textContent = this.formatRelativeMinutes(AppState.recentMatchesUpdatedAt);
    },

    updateUpcomingUpdatedAgo() {
        const { AppState } = window.TennisApp;
        const label = document.getElementById('upcomingUpdatedAgo');
        if (!label) return;
        label.textContent = this.formatRelativeMinutes(AppState.upcomingMatchesUpdatedAt);
    },

    refreshSectionUpdatedAgo() {
        this.updateRecentUpdatedAgo();
        this.updateUpcomingUpdatedAgo();
    },

    filterMatchesForActiveTour(matches, tour) {
        const expected = String(tour || '').toLowerCase() === 'wta' ? 'WTA' : 'ATP';
        const list = Array.isArray(matches) ? matches : [];
        return list.filter((m) => String(m?.tour || '').toUpperCase() === expected);
    },

    /**
     * Render live scores
     */
    renderLiveScores() {
        const { AppState, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        const matches = this.filterMatchesForActiveTour(AppState.liveScores[tour] || [], tour);

        if (matches.length === 0) {
            DOM.liveScoresWrapper.innerHTML = `
                <div class="no-live-card">
                    <div class="no-live-icon">🎾</div>
                    <div class="no-live-title">No Live Matches Right Now</div>
                    <div class="no-live-subtitle">All courts are quiet at the moment. Check back soon for live scores.</div>
                </div>
            `;
            return;
        }

        const grouped = this.groupMatchesByTournament(matches);
        DOM.liveScoresWrapper.innerHTML = grouped
            .map(group => this.renderTournamentGroup(group, true))
            .join('');
    },

    /**
     * Render recent matches
     */
    renderRecentMatches() {
        const { AppState, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Get data (demo fallback only for WTA to avoid synthetic ATP history)
        let matches = this.filterMatchesForActiveTour(AppState.recentMatches[tour], tour);
        if ((!matches || matches.length === 0) && tour === 'wta') {
            matches = this.filterMatchesForActiveTour(this.demoRecentMatches[tour] || [], tour);
        }

        if (matches.length === 0) {
            DOM.recentMatchesWrapper.innerHTML = `
                <div class="no-matches-message">
                    <p>${tour === 'atp' ? 'No recent ATP matches available right now.' : 'No recent matches'}</p>
                </div>
            `;
            this.updateRecentUpdatedAgo();
            return;
        }

        const grouped = this.groupMatchesByTournament(matches);
        DOM.recentMatchesWrapper.innerHTML = grouped
            .map(group => this.renderTournamentGroup(group, false))
            .join('');
        this.updateRecentUpdatedAgo();
    },

    /**
     * Group matches by tournament and sort by category priority
     */
    groupMatchesByTournament(matches) {
        const grouped = new Map();
        matches.forEach(match => {
            const tournament = this.sanitizeTournamentName(match.tournament || 'Tournament');
            const category = match.tournament_category || 'other';
            const key = `${tournament}__${category}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    tournament,
                    category,
                    matches: []
                });
            }
            grouped.get(key).matches.push(match);
        });

        return Array.from(grouped.values()).sort((a, b) => {
            const aRank = this.getCategoryPriority(a.category);
            const bRank = this.getCategoryPriority(b.category);
            if (aRank !== bRank) return aRank - bRank;
            return a.tournament.localeCompare(b.tournament);
        });
    },

    sanitizeTournamentName(name) {
        if (!name) return 'Tournament';
        return String(name)
            .replace(/\s+(presented|powered)\s+by\s+.*$/i, '')
            // Remove trailing season year variants: " 2026", "(2026)", "- 2026", ", 2026"
            .replace(/\s*[\-,]?\s*\(\s*(?:19|20)\d{2}\s*\)\s*$/i, '')
            .replace(/\s*[\-,]?\s*(?:19|20)\d{2}\s*$/i, '')
            .trim();
    },

    getCategoryPriority(category) {
        const key = (category || '').toLowerCase();
        const priorities = {
            grand_slam: 0,
            masters_1000: 1,
            wta_1000: 1,
            atp_500: 2,
            wta_500: 2,
            atp_250: 3,
            wta_250: 3,
            atp_125: 4,
            wta_125: 4,
            finals: 5,
            other: 6
        };
        return priorities[key] ?? 6;
    },

    renderTournamentGroup(group, isLive, renderFn = null) {
        const { Utils } = window.TennisApp;
        const categoryClass = Utils.getCategoryClass(group.category);
        const categoryLabel = this.getCategoryLabel(group.category);
        const sampleMatch = Array.isArray(group.matches) && group.matches.length > 0 ? group.matches[0] : null;
        const surfaceClass = sampleMatch ? this.getSurfaceClass(sampleMatch) : '';
        const surfaceLabel = sampleMatch ? this.getSurfaceLabel(sampleMatch) : '';
        const cardRenderer = renderFn || ((match) => this.createMatchCard(match, isLive));

        return `
            <div class="tournament-group ${categoryClass}">
                <div class="tournament-group-header">
                    <div class="tournament-group-title">
                        <span class="tournament-group-name">${group.tournament}</span>
                        <span class="category-badge ${categoryClass}">${categoryLabel}</span>
                        ${surfaceLabel ? `<span class="match-surface-pill ${surfaceClass}">${surfaceLabel}</span>` : ''}
                    </div>
                </div>
                <div class="tournament-group-row">
                    ${group.matches.map(match => cardRenderer(match)).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Expand round codes to full labels
     */
    getRoundLabel(round) {
        if (!round) return '';
        const raw = String(round).trim();
        const upper = raw.toUpperCase();
        const extractQualifierRound = (text) => {
            const value = String(text || '').trim().toUpperCase();
            if (!value || value === 'Q') return null;

            const patterns = [
                /^Q\s*([1-9])$/,
                /^QUALIF(?:YING|IER)\s+R\s*([1-9])$/,
                /^QUALIF(?:YING|IER)\s+ROUND\s*([1-9])$/,
                /^([1-9])(?:ST|ND|RD|TH)\s+ROUND\s+QUALIF(?:YING|IER)$/,
                /^ROUND\s*([1-9])\s+QUALIF(?:YING|IER)$/
            ];
            for (const pattern of patterns) {
                const match = value.match(pattern);
                if (match) {
                    return Number(match[1]);
                }
            }
            return null;
        };

        const qualifyingRound = extractQualifierRound(raw);
        if (qualifyingRound) {
            return `Qualifier R${qualifyingRound}`;
        }

        const map = {
            F: 'Final',
            SF: 'Semi Final',
            QF: 'Quarter Final',
            R128: 'Round of 128',
            R64: 'Round of 64',
            R32: 'Round of 32',
            R16: 'Round of 16',
            RR: 'Round Robin'
        };
        if (map[upper]) return map[upper];
        if (upper.startsWith('R') && /^[0-9]+$/.test(upper.slice(1))) {
            return `Round of ${upper.slice(1)}`;
        }
        return raw;
    },

    getRoundCode(round) {
        if (!round) return '';
        const upper = String(round).trim().toUpperCase();
        if (upper === 'Q') return 'QF';
        if (upper === 'S') return 'SF';
        if (upper === 'F') return 'F';
        if (upper.startsWith('R') && /^[0-9]+$/.test(upper.slice(1))) return upper;
        if (upper === 'SF' || upper === 'QF' || upper === 'RR') return upper;
        return upper;
    },

    getPointsLevel(match) {
        const category = String(match?.tournament_category || '').toLowerCase();
        if (category.includes('grand_slam')) return 'grand_slam';
        if (category.includes('1000')) return '1000';
        if (category.includes('500')) return '500';
        if (category.includes('250')) return '250';
        if (category.includes('125')) return '125';
        return '';
    },

    getRoundPoints(match) {
        const roundCode = this.getRoundCode(match?.round);
        const pointsLevel = this.getPointsLevel(match);
        if (!roundCode || !pointsLevel) return null;

        const tour = String(match?.tour || '').toUpperCase();
        const atpTable = {
            W: { grand_slam: 2000, '1000': 1000, '500': 500, '250': 250, '125': 125 },
            F: { grand_slam: 1200, '1000': 600, '500': 300, '250': 150, '125': 75 },
            SF: { grand_slam: 720, '1000': 360, '500': 180, '250': 90, '125': 45 },
            QF: { grand_slam: 360, '1000': 180, '500': 90, '250': 45, '125': 25 },
            R16: { grand_slam: 180, '1000': 90, '500': 45, '250': 20, '125': 13 },
            R32: { grand_slam: 90, '1000': 45, '500': 20, '250': 10, '125': 7 },
            R64: { grand_slam: 45, '1000': 25 },
            R128: { grand_slam: 10 }
        };
        const wtaTable = {
            W: { grand_slam: 2000, '1000': 1000, '500': 500, '250': 250, '125': 160 },
            F: { grand_slam: 1200, '1000': 650, '500': 325, '250': 163, '125': 95 },
            SF: { grand_slam: 720, '1000': 390, '500': 195, '250': 98, '125': 57 },
            QF: { grand_slam: 360, '1000': 215, '500': 108, '250': 54, '125': 30 },
            R16: { grand_slam: 180, '1000': 120, '500': 60, '250': 30, '125': 18 },
            R32: { grand_slam: 90, '1000': 65, '500': 30, '250': 18, '125': 1 },
            R64: { grand_slam: 45, '1000': 35 },
            R128: { grand_slam: 10 }
        };

        const table = tour === 'WTA' ? wtaTable : atpTable;
        return table?.[roundCode]?.[pointsLevel] ?? null;
    },

    getRoundLabelWithPoints(match) {
        const label = this.getRoundLabel(match?.round);
        if (!label) return '';
        const pts = this.getRoundPoints(match);
        return pts !== null ? `${label} (${pts} pts)` : label;
    },

    /**
     * Render upcoming matches
     */
    renderUpcomingMatches() {
        const { AppState, Utils } = window.TennisApp;
        const tour = AppState.currentTour;
        const isWtaTour = tour === 'wta';
        
        // Get data (keep demo fallback only for WTA)
        let matches = this.filterMatchesForActiveTour(AppState.upcomingMatches[tour], tour);
        if (isWtaTour && (!matches || matches.length === 0)) {
            matches = this.filterMatchesForActiveTour(this.demoUpcomingMatches[tour] || [], tour);
        }

        // Remove matches that are already showing as live or recently finished
        const liveMatches = AppState.liveScores[tour] || [];
        const recentMatches = AppState.recentMatches[tour] || [];
        if (matches && matches.length > 0 && (liveMatches.length > 0 || recentMatches.length > 0)) {
            const normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const activePlayers = new Set();
            [...liveMatches, ...recentMatches].forEach(m => {
                const p1 = normalize(m?.player1?.name);
                const p2 = normalize(m?.player2?.name);
                if (p1 && p2) activePlayers.add(`${p1}|${p2}`);
            });
            matches = matches.filter(m => {
                // Filter by status
                const st = String(m?.status || '').toLowerCase();
                if (st === 'live' || st === 'in_progress' || st === 'finished' || st === 'completed') return false;
                // Filter by player pair overlap with live/recent
                const p1 = normalize(m?.player1?.name);
                const p2 = normalize(m?.player2?.name);
                if (p1 && p2 && activePlayers.has(`${p1}|${p2}`)) return false;
                return true;
            });
        }

        // Find or create upcoming matches section after live scores
        let upcomingSection = document.getElementById('upcomingMatchesSection');
        if (!upcomingSection) {
            // Insert after live scores section
            const liveScoresSection = document.querySelector('.live-scores-section');
            if (liveScoresSection) {
                const newSection = document.createElement('section');
                newSection.className = 'upcoming-matches-section';
                newSection.id = 'upcomingMatchesSection';
                liveScoresSection.insertAdjacentElement('afterend', newSection);
                upcomingSection = newSection;
            }
        }

        if (!upcomingSection) return;

        if (matches.length === 0) {
            const emptyMessage = isWtaTour
                ? 'No upcoming matches in the next 2 days'
                : 'ATP upcoming matches are not loading right now.';
            upcomingSection.innerHTML = `
                <div class="section-header">
                    <div class="section-title-stack">
                        <h2><i class="fas fa-calendar"></i> Upcoming Matches</h2>
                        <span class="section-updated-ago" id="upcomingUpdatedAgo">Updated --</span>
                    </div>
                </div>
                <div class="no-matches-message">
                    <p>${emptyMessage}</p>
                </div>
            `;
            this.updateUpcomingUpdatedAgo();
            return;
        }

        const grouped = this.groupMatchesByTournament(matches);
        const upcomingHTML = `
            <div class="section-header">
                <div class="section-title-stack">
                    <h2><i class="fas fa-calendar"></i> Upcoming Matches (Next 2 Days)</h2>
                    <span class="section-updated-ago" id="upcomingUpdatedAgo">Updated --</span>
                </div>
            </div>
            <div class="upcoming-matches-container">
                ${grouped.map(group => this.renderTournamentGroup(group, false, (match) => this.createUpcomingMatchCard(match))).join('')}
            </div>
        `;

        upcomingSection.innerHTML = upcomingHTML;
        this.updateUpcomingUpdatedAgo();
        this.attachUpcomingInsights(matches);
    },

    attachUpcomingInsights(matches) {
        const cards = document.querySelectorAll('.upcoming-match-card');
        cards.forEach(card => {
            const matchId = card.dataset.matchId;
            const matchKey = card.dataset.matchKey;
            const match = (matchKey
                ? matches.find((m) => this.getMatchKey(m) === matchKey)
                : null)
                || matches.find((m) => String(m?.id) === String(matchId));
            if (!match) return;
            const edgeBar = card.querySelector('.edge-bar');
            if (!edgeBar) return;
            edgeBar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEdgeInsights(match);
            });
        });
    },

    showUpcomingInsights(matchId, matchOverride = null, context = {}) {
        const { AppState, Utils } = window.TennisApp;
        const tour = AppState.currentTour;
        const demoUpcoming = tour === 'wta' ? (this.demoUpcomingMatches[tour] || []) : [];
        const key = String(context?.matchKey || '').trim();
        const findByKey = (list) => {
            if (!key || !Array.isArray(list)) return null;
            return list.find((m) => this.getMatchKey(m) === key) || null;
        };
        const match = matchOverride
            || findByKey(AppState.upcomingMatches[tour])
            || AppState.upcomingMatches[tour]?.find((m) => String(m?.id) === String(matchId))
            || findByKey(demoUpcoming)
            || demoUpcoming.find((m) => String(m?.id) === String(matchId));
        if (!match) return;

        const winEdge = this.calculateWinEdge(match);
        const p1Fav = winEdge.p1 >= winEdge.p2;
        const favorite = p1Fav ? match.player1 : match.player2;
        const underdog = p1Fav ? match.player2 : match.player1;
        const favPct = p1Fav ? winEdge.p1 : winEdge.p2;
        const dogPct = 100 - favPct;
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const categoryClass = Utils.getCategoryClass(match.tournament_category);
        const surfaceClass = this.getSurfaceClass(match);
        const surfaceLabel = this.getSurfaceLabel(match);
        const previewRoundLabel = this.getRoundLabel(match.round);
        const p1Season = winEdge?.players?.p1?.seasonRecord?.total
            ? `${winEdge.players.p1.seasonRecord.wins}-${winEdge.players.p1.seasonRecord.losses}`
            : '-';
        const p2Season = winEdge?.players?.p2?.seasonRecord?.total
            ? `${winEdge.players.p2.seasonRecord.wins}-${winEdge.players.p2.seasonRecord.losses}`
            : '-';
        const p1Recent = winEdge?.players?.p1?.recentRecord?.total
            ? `${winEdge.players.p1.recentRecord.wins}-${winEdge.players.p1.recentRecord.losses}`
            : '-';
        const p2Recent = winEdge?.players?.p2?.recentRecord?.total
            ? `${winEdge.players.p2.recentRecord.wins}-${winEdge.players.p2.recentRecord.losses}`
            : '-';
        const p1Surface = winEdge?.players?.p1?.surfaceRecord?.total
            ? `${winEdge.players.p1.surfaceRecord.wins}-${winEdge.players.p1.surfaceRecord.losses}`
            : '-';
        const p2Surface = winEdge?.players?.p2?.surfaceRecord?.total
            ? `${winEdge.players.p2.surfaceRecord.wins}-${winEdge.players.p2.surfaceRecord.losses}`
            : '-';
        const p1Points = winEdge?.players?.p1?.points
            ? winEdge.players.p1.points.toLocaleString()
            : '-';
        const p2Points = winEdge?.players?.p2?.points
            ? winEdge.players.p2.points.toLocaleString()
            : '-';
        const p1Rank = winEdge?.players?.p1?.rank ? `#${winEdge.players.p1.rank}` : '-';
        const p2Rank = winEdge?.players?.p2?.rank ? `#${winEdge.players.p2.rank}` : '-';

        let modal = document.getElementById('upcomingInsightsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'upcomingInsightsModal';
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal-content edge-insights-modal prediction-modal">
                    <div class="modal-header">
                        <h3>Match Preview</h3>
                        <button class="close-modal" id="upcomingInsightsClose">&times;</button>
                    </div>
                    <div class="modal-body" id="upcomingInsightsContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'upcomingInsightsModal') {
                    modal.classList.remove('active');
                }
            });
            modal.querySelector('#upcomingInsightsClose').addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        const content = document.getElementById('upcomingInsightsContent');
        content.innerHTML = `
            <div class="match-stats-title">
                <div class="match-stats-tournament">
                    ${match.tournament}
                    ${categoryLabel ? `<span class="category-badge ${categoryClass}">${categoryLabel}</span>` : ''}
                    ${previewRoundLabel ? `<span class="match-stats-round-tag">${previewRoundLabel}</span>` : ''}
                    <span class="match-surface-pill ${surfaceClass}">${surfaceLabel}</span>
                </div>
            </div>
            <div class="prediction-hero">
                <div class="prediction-player-column left">
                    <div class="prediction-player-top">
                        <div class="prediction-player-photo-wrap">
                            <img class="prediction-player-image" src="${Utils.getPlayerImage(match.player1)}" alt="${match.player1.name}">
                        </div>
                        <div class="prediction-player-main">
                            <div class="prediction-player-name">${match.player1.name}</div>
                            <div class="prediction-player-meta">${Utils.getFlag(match.player1.country)} Rank ${p1Rank}</div>
                            <div class="prediction-player-pills">
                                <span class="prediction-pill">${p1Points} pts</span>
                                <span class="prediction-pill">${surfaceLabel} ${p1Surface}</span>
                            </div>
                        </div>
                    </div>
                    <div class="prediction-mini-grid">
                        <div class="prediction-mini-item">
                            <span class="label">Season</span>
                            <span class="value">${p1Season}</span>
                        </div>
                        <div class="prediction-mini-item">
                            <span class="label">Recent</span>
                            <span class="value">${p1Recent}</span>
                        </div>
                        <div class="prediction-mini-item">
                            <span class="label">Rank</span>
                            <span class="value">${p1Rank}</span>
                        </div>
                        <div class="prediction-mini-item">
                            <span class="label">Win Chance</span>
                            <span class="value">${winEdge.p1}%</span>
                        </div>
                    </div>
                </div>
                <div class="prediction-center">
                    <div class="prediction-scoreline">
                        <span class="pct left">${winEdge.p1}%</span>
                        <span class="dash">-</span>
                        <span class="pct right">${winEdge.p2}%</span>
                    </div>
                    <div class="edge-bar">
                        <span class="edge-pct left">${winEdge.p1}%</span>
                        <div class="edge-track">
                            <div class="edge-fill left" style="width:${winEdge.p1}%"></div>
                            <div class="edge-fill right" style="width:${winEdge.p2}%"></div>
                        </div>
                        <span class="edge-pct right">${winEdge.p2}%</span>
                    </div>
                    <div class="prediction-confidence">${winEdge.confidence || 'Low confidence'}</div>
                    <div class="prediction-h2h">H2H ${winEdge.h2hText || 'N/A'}</div>
                </div>
                <div class="prediction-player-column right">
                    <div class="prediction-player-top">
                        <div class="prediction-player-photo-wrap">
                            <img class="prediction-player-image" src="${Utils.getPlayerImage(match.player2)}" alt="${match.player2.name}">
                        </div>
                        <div class="prediction-player-main">
                            <div class="prediction-player-name">${match.player2.name}</div>
                            <div class="prediction-player-meta">${Utils.getFlag(match.player2.country)} Rank ${p2Rank}</div>
                            <div class="prediction-player-pills">
                                <span class="prediction-pill">${p2Points} pts</span>
                                <span class="prediction-pill">${surfaceLabel} ${p2Surface}</span>
                            </div>
                        </div>
                    </div>
                    <div class="prediction-mini-grid">
                        <div class="prediction-mini-item">
                            <span class="label">Season</span>
                            <span class="value">${p2Season}</span>
                        </div>
                        <div class="prediction-mini-item">
                            <span class="label">Recent</span>
                            <span class="value">${p2Recent}</span>
                        </div>
                        <div class="prediction-mini-item">
                            <span class="label">Rank</span>
                            <span class="value">${p2Rank}</span>
                        </div>
                        <div class="prediction-mini-item">
                            <span class="label">Win Chance</span>
                            <span class="value">${winEdge.p2}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="prediction-factors">
                ${(winEdge.factors || []).map((factor) => `
                    <div class="prediction-factor-row ${factor.edge > 0 ? 'left-edge' : factor.edge < 0 ? 'right-edge' : 'neutral-edge'}">
                        <div class="prediction-factor-value left">${factor.p1Display || '-'}</div>
                        <div class="prediction-factor-center">
                            <div class="prediction-factor-head">
                                <span class="label">${factor.label}</span>
                                <span class="weight">${Math.round((factor.weight || 0) * 100)}%</span>
                            </div>
                            <div class="prediction-factor-track">
                                <span class="midline"></span>
                                <span class="fill ${factor.edge > 0 ? 'left' : factor.edge < 0 ? 'right' : 'neutral'}" style="width:${factor.magnitudePct || 0}%"></span>
                            </div>
                            <div class="prediction-factor-note">${factor.note || ''}</div>
                        </div>
                        <div class="prediction-factor-value right">${factor.p2Display || '-'}</div>
                    </div>
                `).join('')}
            </div>

            <div class="prediction-summary">
                <p><strong>Prediction:</strong> ${favorite.name} is favored (${favPct}%) over ${underdog.name} (${dogPct}%).</p>
                <p class="prediction-rationale">${winEdge.reason || ''}</p>
                <ul class="edge-insights-list prediction-bullets">
                    ${(winEdge.summaryBullets || []).map((line) => `<li>${line}</li>`).join('')}
                </ul>
                <p class="prediction-conclusion">${winEdge.conclusion || ''}</p>
            </div>
        `;

        modal.classList.add('active');
    },

    showEdgeInsights(match) {
        if (!match) return;
        this.showUpcomingInsights(match.id, match);
    },

    /**
     * Create an upcoming match card (simplified - only player names)
     */
    createUpcomingMatchCard(match) {
        const { Utils } = window.TennisApp;
        const categoryClass = Utils.getCategoryClass(match.tournament_category);
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const surfaceClass = this.getSurfaceClass(match);
        const matchKey = this.getMatchKey(match);
        const tournamentName = this.sanitizeTournamentName(match.tournament);
        const roundLabel = this.getRoundLabelWithPoints(match) || 'Round TBD';
        const courtLabel = match.court || match.court_name || match.stadium || 'Stadium TBA';
        const scheduledTime = new Date(match.scheduled_time);
        const timeStr = scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = scheduledTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const player1ModalId = this.resolvePlayerModalId(match.player1);
        const player2ModalId = this.resolvePlayerModalId(match.player2);
        const player1RowAttrs = player1ModalId ? `data-player-id="${player1ModalId}" role="button" tabindex="0" title="Open player details"` : '';
        const player2RowAttrs = player2ModalId ? `data-player-id="${player2ModalId}" role="button" tabindex="0" title="Open player details"` : '';
        const player1RowClass = player1ModalId ? ' player-clickable' : '';
        const player2RowClass = player2ModalId ? ' player-clickable' : '';

        const winEdge = this.calculateWinEdge(match);

        return `
            <div class="upcoming-match-card ${categoryClass} ${surfaceClass}" data-match-id="${match.id}" data-match-key="${matchKey}">
                <div class="match-header">
                    <div class="tournament-info">
                        <div class="tournament-name compact-inline">
                            <span class="tournament-title-text">${tournamentName}</span>
                            <span class="category-badge ${categoryClass}">${categoryLabel}</span>
                        </div>
                        <div class="match-round-row">
                            <span class="match-stage-pill">${roundLabel}</span>
                        </div>
                        <div class="match-court-row">
                            <span class="match-court">${courtLabel}</span>
                        </div>
                    </div>
                    <div class="scheduled-pill-group">
                        <span class="scheduled-pill">${dateStr}</span>
                        <span class="scheduled-connector"></span>
                        <span class="scheduled-pill">${timeStr}</span>
                    </div>
                </div>
                <div class="match-players">
                    <div class="player-row${player1RowClass}" ${player1RowAttrs}>
                        <img class="player-img" src="${Utils.getPlayerImage(match.player1)}" alt="${match.player1.name}">
                        <div class="player-info">
                            <div class="player-name">
                                ${match.player1.rank ? `<span class="player-rank-badge">[${match.player1.rank}]</span>` : ''}
                                <span class="country-flag">${Utils.getFlag(match.player1.country)}</span>
                                ${Utils.formatPlayerName(match.player1.name)}
                            </div>
                        </div>
                        <div class="player-score upcoming-score">${this.formatUpcomingPlayerScore(match, 1)}</div>
                    </div>
                    <div class="player-row${player2RowClass}" ${player2RowAttrs}>
                        <img class="player-img" src="${Utils.getPlayerImage(match.player2)}" alt="${match.player2.name}">
                        <div class="player-info">
                            <div class="player-name">
                                ${match.player2.rank ? `<span class="player-rank-badge">[${match.player2.rank}]</span>` : ''}
                                <span class="country-flag">${Utils.getFlag(match.player2.country)}</span>
                                ${Utils.formatPlayerName(match.player2.name)}
                            </div>
                        </div>
                        <div class="player-score upcoming-score">${this.formatUpcomingPlayerScore(match, 2)}</div>
                    </div>
                </div>
                <div class="edge-row" data-edge-id="${match.id}">
                    <div class="h2h-chip" aria-label="Head to head">
                        <span class="h2h-label">H2H</span>
                        <span class="h2h-value">${winEdge.h2hText}</span>
                    </div>
                    <div class="edge-block">
                        <div class="edge-bar" data-edge-id="${match.id}">
                            <span class="edge-pct left">${winEdge.p1}%</span>
                            <div class="edge-track">
                                <div class="edge-fill left" style="width:${winEdge.p1}%"></div>
                                <div class="edge-fill right" style="width:${winEdge.p2}%"></div>
                            </div>
                            <span class="edge-pct right">${winEdge.p2}%</span>
                        </div>
                        <div class="edge-names">
                            <span class="edge-name left">${Utils.formatPlayerName(match.player1.name)}</span>
                            <span class="edge-name right">${Utils.formatPlayerName(match.player2.name)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Calculate a lightweight win edge metric using rank and recent form (demo)
     */
    calculateWinEdge(match) {
        const { AppState } = window.TennisApp;
        const isWTA = String(match?.tour || '').toUpperCase() === 'WTA';
        const predictor = window.WTAUpcomingPrediction;
        if (isWTA && predictor && typeof predictor.predictMatch === 'function') {
            return predictor.predictMatch(match, AppState);
        }

        const p1Rank = Number(match?.player1?.rank || 200);
        const p2Rank = Number(match?.player2?.rank || 200);
        const rawRankEdge = (p2Rank - p1Rank) / Math.max(20, Math.max(p1Rank, p2Rank));
        const rankEdge = Math.max(-1, Math.min(1, rawRankEdge));
        const p1Pct = Math.round(Math.max(5, Math.min(95, 50 + (rankEdge * 36))));
        const p2Pct = 100 - p1Pct;

        return {
            p1: p1Pct,
            p2: p2Pct,
            reason: p1Pct === p2Pct ? 'Players are closely matched on ranking baseline.' : (p1Pct > p2Pct ? `${match?.player1?.name || 'Player 1'} has the ranking edge.` : `${match?.player2?.name || 'Player 2'} has the ranking edge.`),
            h2hText: (typeof match?.h2h_text === 'string' && match.h2h_text.trim()) ? match.h2h_text : 'N/A',
            formNote: 'Ranking baseline',
            confidence: Math.abs(p1Pct - p2Pct) >= 12 ? 'Medium confidence' : 'Low confidence',
            factors: [],
            diagnostics: { weightCoverage: 0, edge: Number((rankEdge || 0).toFixed(4)) },
            players: {
                p1: { rank: Number.isFinite(p1Rank) ? p1Rank : null, points: null, seasonRecord: null, recentRecord: { wins: 0, losses: 0, total: 0 }, surfaceRecord: { wins: 0, losses: 0, total: 0 } },
                p2: { rank: Number.isFinite(p2Rank) ? p2Rank : null, points: null, seasonRecord: null, recentRecord: { wins: 0, losses: 0, total: 0 }, surfaceRecord: { wins: 0, losses: 0, total: 0 } }
            },
            summaryBullets: ['Detailed WTA background factors are unavailable for this match.'],
            conclusion: 'Prediction is based on ranking baseline only.'
        };
    },

    /**
     * Create a match card HTML
     */
    createMatchCard(match, isLive) {
        const { Utils } = window.TennisApp;
        const categoryClass = Utils.getCategoryClass(match.tournament_category);
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const surfaceClass = this.getSurfaceClass(match);
        const matchKey = this.getMatchKey(match);
        const tournamentName = this.sanitizeTournamentName(match.tournament);
        const roundLabel = this.getRoundLabelWithPoints(match);
        const courtLabel = match.court || match.court_name || '';
        const finishedDuration = !isLive
            ? this.formatFinishedDuration(match.match_duration || match.duration || '')
            : '';
        
        const resolvedWinner = !isLive ? this.getWinnerFromScore(match, match.final_score || match.score) : null;
        
        const p1IsWinner = !isLive && resolvedWinner === 1;
        const p2IsWinner = !isLive && resolvedWinner === 2;
        const p1Serving = isLive && match.serving === 1;
        const p2Serving = isLive && match.serving === 2;
        const p1RankBadge = match.player1.rank ? `<span class="player-rank-badge">[${match.player1.rank}]</span>` : '';
        const p2RankBadge = match.player2.rank ? `<span class="player-rank-badge">[${match.player2.rank}]</span>` : '';
        const player1ModalId = this.resolvePlayerModalId(match.player1);
        const player2ModalId = this.resolvePlayerModalId(match.player2);
        const player1RowAttrs = player1ModalId ? `data-player-id="${player1ModalId}" role="button" tabindex="0" title="Open player details"` : '';
        const player2RowAttrs = player2ModalId ? `data-player-id="${player2ModalId}" role="button" tabindex="0" title="Open player details"` : '';
        const player1RowClass = player1ModalId ? ' player-clickable' : '';
        const player2RowClass = player2ModalId ? ' player-clickable' : '';

        return `
            <div class="match-card ${categoryClass} ${surfaceClass}" data-match-id="${match.id}" data-match-key="${matchKey}">
                <div class="match-header">
                    <div class="tournament-info">
                        <div class="tournament-name">
                            ${tournamentName}
                            <span class="category-badge ${categoryClass}">${categoryLabel}</span>
                        </div>
                        <div class="match-round-row">
                            ${roundLabel ? `<span class="match-stage-pill">${roundLabel}</span>` : ''}
                            ${courtLabel ? `<span class="match-court">${courtLabel}</span>` : ''}
                        </div>
                    </div>
                    ${isLive ? `
                        <div class="live-badge">
                            <span class="live-label"><span class="live-dot"></span>LIVE</span>
                            ${match.match_time ? `<span class="live-time">${match.match_time}</span>` : ''}
                        </div>
                    ` : `
                        <div class="finished-stack">
                            <div class="finished-badge">Completed</div>
                            ${finishedDuration ? `<div class="finished-duration-pill">${finishedDuration}</div>` : ''}
                        </div>
                    `}
                </div>
                <div class="match-players">
                    <div class="player-row ${p1IsWinner ? 'winner' : ''} ${p1Serving ? 'serving' : ''}${player1RowClass}" ${player1RowAttrs}>
                        <img class="player-img" src="${Utils.getPlayerImage(match.player1)}" alt="${match.player1.name}">
                        <div class="player-info">
                            <div class="player-name">
                                ${p1RankBadge}
                                <span class="country-flag">${Utils.getFlag(match.player1.country)}</span>
                                ${Utils.formatPlayerName(match.player1.name)}
                                ${p1Serving ? '<span class="serve-ball" title="Serving"></span>' : ''}
                            </div>
                        </div>
                        <div class="player-score">${this.formatPlayerScore(match, 1, isLive)}</div>
                    </div>
                    <div class="player-row ${p2IsWinner ? 'winner' : ''} ${p2Serving ? 'serving' : ''}${player2RowClass}" ${player2RowAttrs}>
                        <img class="player-img" src="${Utils.getPlayerImage(match.player2)}" alt="${match.player2.name}">
                        <div class="player-info">
                            <div class="player-name">
                                ${p2RankBadge}
                                <span class="country-flag">${Utils.getFlag(match.player2.country)}</span>
                                ${Utils.formatPlayerName(match.player2.name)}
                                ${p2Serving ? '<span class="serve-ball" title="Serving"></span>' : ''}
                            </div>
                        </div>
                        <div class="player-score">${this.formatPlayerScore(match, 2, isLive)}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get tournament category label
     */
    getCategoryLabel(category) {
        const key = String(category || 'other').toLowerCase();
        const labels = {
            'grand_slam': 'Grand Slam',
            'masters_1000': '1000',
            'wta_1000': '1000',
            'atp_500': '500',
            'wta_500': '500',
            'atp_250': '250',
            'wta_250': '250',
            'atp_125': '125',
            'wta_125': '125',
            'tour': 'Tour',
            'finals': 'Finals',
            'other': 'Other'
        };
        return labels[key] || String(category || 'Other');
    },

    getSurfaceClass(match) {
        const surface = (match.surface || match.tournament_surface || '').toLowerCase();
        const name = (match.tournament || '').toLowerCase();
        if (surface.includes('clay') || name.includes('roland') || name.includes('monte-carlo') || name.includes('madrid') || name.includes('rome')) {
            return 'surface-clay';
        }
        if (surface.includes('grass') || name.includes('wimbledon') || name.includes('halle') || name.includes('queen')) {
            return 'surface-grass';
        }
        if (surface.includes('indoor')) {
            return 'surface-indoor';
        }
        return 'surface-hard';
    },

    getSurfaceLabel(match) {
        const surfaceClass = this.getSurfaceClass(match);
        const labels = {
            'surface-hard': 'Hard',
            'surface-clay': 'Clay',
            'surface-grass': 'Grass',
            'surface-indoor': 'Indoor'
        };
        return labels[surfaceClass] || 'Hard';
    },

    /**
     * Best-of format based on tour/category
     */
    getBestOfForMatch(match) {
        const category = (match?.tournament_category || '').toLowerCase();
        const tour = (match?.tour || '').toLowerCase();
        if (category === 'grand_slam' && tour === 'atp') {
            return 5;
        }
        return 3;
    },

    /**
     * Determine winner from score (if possible)
     */
    getWinnerFromScore(match, score) {
        if (!score || !Array.isArray(score.sets)) {
            return match?.winner ?? null;
        }
        const bestOf = this.getBestOfForMatch(match);
        const winSets = Math.floor(bestOf / 2) + 1;
        let p1Sets = 0;
        let p2Sets = 0;

        for (const set of score.sets) {
            if (set.p1 > set.p2) {
                p1Sets += 1;
            } else if (set.p2 > set.p1) {
                p2Sets += 1;
            }
            if (p1Sets >= winSets || p2Sets >= winSets) {
                break;
            }
        }

        if (p1Sets >= winSets && p1Sets > p2Sets) return 1;
        if (p2Sets >= winSets && p2Sets > p1Sets) return 2;
        return match?.winner ?? null;
    },

    /**
     * Format player score display
     */
    formatPlayerScore(match, playerNum, isLive) {
        const score = isLive ? match.score : (match.final_score || match.score);

        let setScoresHtml = '';
        if (score && Array.isArray(score.sets)) {
            score.sets.forEach((set, idx) => {
                const games = playerNum === 1 ? set.p1 : set.p2;
                const opponentGames = playerNum === 1 ? set.p2 : set.p1;
                const isCurrentSet = isLive && idx === score.sets.length - 1;
                
                // Check for tiebreak (7-6 or 6-7)
                const isTiebreak = (games === 7 && opponentGames === 6) || (games === 6 && opponentGames === 7);
                
                const isSetWinner = games > opponentGames;

                if (isTiebreak && set.tiebreak) {
                    const tiebreakScore = playerNum === 1 ? set.tiebreak.p1 : set.tiebreak.p2;
                    setScoresHtml += `<span class="set-score ${isSetWinner ? 'set-win' : ''} ${isCurrentSet ? 'current' : ''}">${games}<sup class="tb">(${tiebreakScore})</sup></span>`;
                } else if (isTiebreak) {
                    const fallbackTb = games === 7 ? 7 : 6;
                    setScoresHtml += `<span class="set-score ${isSetWinner ? 'set-win' : ''} ${isCurrentSet ? 'current' : ''}">${games}<sup class="tb">(${fallbackTb})</sup></span>`;
                } else {
                    setScoresHtml += `<span class="set-score ${isSetWinner ? 'set-win' : ''} ${isCurrentSet ? 'current' : ''}">${games}</span>`;
                }
            });
        }

        let html = '';

        // Current game score (only for live matches)
        if (isLive && score.current_game) {
            const gameScore = playerNum === 1 ? score.current_game.p1 : score.current_game.p2;
            setScoresHtml += `<span class="game-score">${gameScore}</span>`;
        }

        html += `<div class="set-scores-row">${setScoresHtml}</div>`;
        return html;
    },

    formatUpcomingPlayerScore(match, playerNum) {
        const score = match?.score || match?.final_score || null;
        let setScoresHtml = '';
        if (score && Array.isArray(score.sets)) {
            score.sets.forEach((set) => {
                const games = playerNum === 1 ? set.p1 : set.p2;
                const opponentGames = playerNum === 1 ? set.p2 : set.p1;
                const isTiebreak = (games === 7 && opponentGames === 6) || (games === 6 && opponentGames === 7);
                const isSetWinner = games > opponentGames;
                if (isTiebreak && set.tiebreak) {
                    const tiebreakScore = playerNum === 1 ? set.tiebreak.p1 : set.tiebreak.p2;
                    setScoresHtml += `<span class="set-score ${isSetWinner ? 'set-win' : ''}">${games}<sup class="tb">(${tiebreakScore})</sup></span>`;
                } else if (isTiebreak) {
                    const fallbackTb = games === 7 ? 7 : 6;
                    setScoresHtml += `<span class="set-score ${isSetWinner ? 'set-win' : ''}">${games}<sup class="tb">(${fallbackTb})</sup></span>`;
                } else {
                    setScoresHtml += `<span class="set-score ${isSetWinner ? 'set-win' : ''}">${games}</span>`;
                }
            });
        }
        return `<div class="set-scores-row">${setScoresHtml}</div>`;
    },

    getSetWinsFromScore(score, options = {}) {
        const parseNum = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };
        const preferExplicit = !!options.preferExplicit;
        const onlyCompleted = !!options.onlyCompleted;

        if (!score) return { p1: 0, p2: 0 };

        if (preferExplicit) {
            const p1Direct = parseNum(score.p1_sets ?? score.p1Sets);
            const p2Direct = parseNum(score.p2_sets ?? score.p2Sets);
            if (p1Direct !== null && p2Direct !== null) {
                return { p1: p1Direct, p2: p2Direct };
            }
        }

        let p1 = 0;
        let p2 = 0;
        const sets = Array.isArray(score.sets) ? score.sets : [];
        sets.forEach((set) => {
            const p1Games = parseNum(set?.p1);
            const p2Games = parseNum(set?.p2);
            if (p1Games === null || p2Games === null) return;
            if (onlyCompleted && !this.isCompletedSetScore(p1Games, p2Games)) return;
            if (p1Games > p2Games) p1 += 1;
            else if (p2Games > p1Games) p2 += 1;
        });
        return { p1, p2 };
    },

    isCompletedSetScore(p1Games, p2Games) {
        const maxGames = Math.max(p1Games, p2Games);
        const minGames = Math.min(p1Games, p2Games);
        if (maxGames >= 7) return true;
        return maxGames >= 6 && (maxGames - minGames) >= 2;
    },

    formatFinishedDuration(value) {
        const text = String(value ?? '').trim();
        if (!text) return '';
        if (/^\d{1,2}:\d{2}$/.test(text)) {
            return `${text}h`;
        }
        return text;
    },

    /**
     * Update a single match score (for real-time updates)
     */
    updateMatchScore(matchId, newScore) {
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        if (!matchCard) return;

        // Update player scores
        const playerRows = matchCard.querySelectorAll('.player-row');
        const liveSetWins = this.getSetWinsFromScore(newScore, { preferExplicit: true, onlyCompleted: true });
        if (playerRows.length >= 2) {
            playerRows[0].querySelector('.player-score').innerHTML = this.formatPlayerScore(
                { score: newScore, status: 'live' },
                1,
                true,
                { setWins: liveSetWins.p1, isWinnerSide: false }
            );
            playerRows[1].querySelector('.player-score').innerHTML = this.formatPlayerScore(
                { score: newScore, status: 'live' },
                2,
                true,
                { setWins: liveSetWins.p2, isWinnerSide: false }
            );
        }

        // Update serving indicator
        if (newScore.serving) {
            playerRows.forEach((row, idx) => {
                row.classList.toggle('serving', newScore.serving === idx + 1);
            });
        }
    },

    /**
     * Show match statistics modal
     */
    showMatchStats(matchId, matchOverride = null, context = {}) {
        const { AppState, Utils } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Find match in live or recent matches, unless an override is provided
        let match = matchOverride;
        if (!match) {
            const live = AppState.liveScores[tour] || [];
            const recent = AppState.recentMatches[tour] || [];
            const upcoming = AppState.upcomingMatches[tour] || [];
            const demoLive = this.demoLiveMatches[tour] || [];
            const demoRecent = this.demoRecentMatches[tour] || [];
            const demoUpcoming = tour === 'wta' ? (this.demoUpcomingMatches[tour] || []) : [];
            const allMatches = [...live, ...recent, ...upcoming, ...demoLive, ...demoRecent, ...demoUpcoming];
            const source = String(context?.source || '').trim().toLowerCase();
            const sourceMap = {
                live: [...live, ...demoLive],
                recent: [...recent, ...demoRecent],
                upcoming: [...upcoming, ...demoUpcoming],
            };

            const key = String(context?.matchKey || '').trim();
            if (key) {
                if (sourceMap[source]) {
                    match = sourceMap[source].find((m) => this.getMatchKey(m) === key);
                }
                if (!match) {
                    match = allMatches.find((m) => this.getMatchKey(m) === key);
                }
            }

            if (!match) {
                const sourceList = sourceMap[source] || [];
                match = sourceList.find((m) => String(m.id) === String(matchId))
                    || live.find((m) => String(m.id) === String(matchId))
                    || recent.find((m) => String(m.id) === String(matchId))
                    || upcoming.find((m) => String(m.id) === String(matchId))
                    || demoLive.find((m) => String(m.id) === String(matchId))
                    || demoRecent.find((m) => String(m.id) === String(matchId))
                    || demoUpcoming.find((m) => String(m.id) === String(matchId));
            }
        }
        
        if (!match) return;
        
        // Generate match statistics (demo data for metrics only)
        const stats = this.generateMatchStats(match);
        
        const modal = document.getElementById('matchStatsModal');
        const content = document.getElementById('matchStatsContent');
        
        const isLive = match.status === 'live';
        const score = isLive ? match.score : (match.final_score || match.score);
        stats.duration = this.resolveMatchTimeLabel(match, isLive);
        const resolvedWinner = !isLive ? this.getWinnerFromScore(match, score) : null;
        const tournamentName = context.tournament || match.tournament || 'Match Statistics';
        const roundName = match.round || context.round || '';
        const roundLabel = this.getRoundLabel(roundName);
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const categoryClass = window.TennisApp.Utils.getCategoryClass(match.tournament_category);
        const setSummary = this.formatSetSummary(score, match);
        const setLines = this.formatSetLines(score);
        const player1ModalId = this.resolvePlayerModalId(match.player1);
        const player2ModalId = this.resolvePlayerModalId(match.player2);
        const player1Points = this.resolvePlayerPoints(match.player1);
        const player2Points = this.resolvePlayerPoints(match.player2);
        const radarP1Label = Utils?.formatPlayerName
            ? Utils.formatPlayerName(match.player1?.name || 'Player 1')
            : (match.player1?.name || 'Player 1');
        const radarP2Label = Utils?.formatPlayerName
            ? Utils.formatPlayerName(match.player2?.name || 'Player 2')
            : (match.player2?.name || 'Player 2');
        
        content.innerHTML = `
            <div class="match-stats-title">
                <div class="match-stats-tournament">
                    ${tournamentName}
                    ${categoryLabel ? `<span class="category-badge ${categoryClass}">${categoryLabel}</span>` : ''}
                    ${roundLabel ? `<span class="match-stats-round-tag">${roundLabel}</span>` : ''}
                </div>
            </div>
            <div class="match-stats-hero">
                <div class="match-stats-player-card ${resolvedWinner === 1 ? 'winner' : ''} ${player1ModalId ? 'clickable' : ''}" ${player1ModalId ? `data-player-id="${player1ModalId}" role="button" tabindex="0" title="Open player details"` : ''}>
                    <img class="player-hero-img" src="${Utils.getPlayerImage(match.player1)}" alt="${match.player1.name}" onclick="event.stopPropagation(); PlayerModule.openImageLightbox(this.src, '${match.player1.name.replace(/'/g, "\\'")}')" style="cursor:pointer">
                    <div class="player-hero-name">${match.player1.name}</div>
                    <div class="player-hero-meta-row">
                        <div class="player-hero-meta">${Utils.getFlag(match.player1.country)} ${match.player1.country} • Rank ${match.player1.rank || '-'}</div>
                        ${player1Points !== null ? `<span class="player-hero-points-pill">${player1Points.toLocaleString()} pts</span>` : ''}
                    </div>
                </div>
                <div class="match-stats-scoreboard">
                    ${setSummary ? `<div class="set-summary-line">${setSummary}</div>` : ''}
                    <div class="set-lines">
                        ${setLines}
                    </div>
                    ${stats.duration ? `<div class="duration">${stats.duration}</div>` : ''}
                </div>
                <div class="match-stats-player-card ${resolvedWinner === 2 ? 'winner' : ''} ${player2ModalId ? 'clickable' : ''}" ${player2ModalId ? `data-player-id="${player2ModalId}" role="button" tabindex="0" title="Open player details"` : ''}>
                    <img class="player-hero-img" src="${Utils.getPlayerImage(match.player2)}" alt="${match.player2.name}" onclick="event.stopPropagation(); PlayerModule.openImageLightbox(this.src, '${match.player2.name.replace(/'/g, "\\'")}')" style="cursor:pointer">
                    <div class="player-hero-name">${match.player2.name}</div>
                    <div class="player-hero-meta-row">
                        <div class="player-hero-meta">${Utils.getFlag(match.player2.country)} ${match.player2.country} • Rank ${match.player2.rank || '-'}</div>
                        ${player2Points !== null ? `<span class="player-hero-points-pill">${player2Points.toLocaleString()} pts</span>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="match-stats-section">
                <h4>Service</h4>
                <div class="stats-grid">
                    ${this.createStatRow('Aces', stats.aces.p1, stats.aces.p2, stats.aces.p1, stats.aces.p2, 'higher')}
                    ${this.createStatRow('Double Faults', stats.doubleFaults.p1, stats.doubleFaults.p2, stats.doubleFaults.p1, stats.doubleFaults.p2, 'lower')}
                    ${this.createStatRow('1st Serve %', this.formatPercentCount(stats.firstServe.p1, stats.firstServeMade.p1, stats.firstServeTotal.p1), this.formatPercentCount(stats.firstServe.p2, stats.firstServeMade.p2, stats.firstServeTotal.p2), stats.firstServe.p1, stats.firstServe.p2, 'higher')}
                    ${this.createStatRow('1st Serve Points Won', this.formatPercentCount(stats.firstServeWon.p1, stats.firstServeWonCount.p1, stats.firstServeWonTotal.p1), this.formatPercentCount(stats.firstServeWon.p2, stats.firstServeWonCount.p2, stats.firstServeWonTotal.p2), stats.firstServeWon.p1, stats.firstServeWon.p2, 'higher')}
                    ${this.createStatRow('2nd Serve Points Won', this.formatPercentCount(stats.secondServeWon.p1, stats.secondServeWonCount.p1, stats.secondServeWonTotal.p1), this.formatPercentCount(stats.secondServeWon.p2, stats.secondServeWonCount.p2, stats.secondServeWonTotal.p2), stats.secondServeWon.p1, stats.secondServeWon.p2, 'higher')}
                    ${this.createStatRow('Break Points Faced', stats.breakPointsFaced.p1, stats.breakPointsFaced.p2, stats.breakPointsFaced.p1, stats.breakPointsFaced.p2, 'lower')}
                    ${this.createStatRow('Break Points Saved', this.formatPercentCount(stats.breakPointsSavedRate.p1, stats.breakPointsSaved.p1, stats.breakPointsFaced.p1), this.formatPercentCount(stats.breakPointsSavedRate.p2, stats.breakPointsSaved.p2, stats.breakPointsFaced.p2), stats.breakPointsSavedRate.p1, stats.breakPointsSavedRate.p2, 'higher')}
                    ${this.createStatRow('Service Games Played', stats.serviceGamesPlayed.p1, stats.serviceGamesPlayed.p2, stats.serviceGamesPlayed.p1, stats.serviceGamesPlayed.p2, 'higher')}
                </div>
            </div>

            <div class="match-stats-section">
                <h4>Return</h4>
                <div class="stats-grid">
                    ${this.createStatRow('1st Return Points Won', this.formatPercentCount(stats.firstReturnWon.p1, stats.firstReturnWonCount.p1, stats.firstReturnWonTotal.p1), this.formatPercentCount(stats.firstReturnWon.p2, stats.firstReturnWonCount.p2, stats.firstReturnWonTotal.p2), stats.firstReturnWon.p1, stats.firstReturnWon.p2, 'higher')}
                    ${this.createStatRow('2nd Return Points Won', this.formatPercentCount(stats.secondReturnWon.p1, stats.secondReturnWonCount.p1, stats.secondReturnWonTotal.p1), this.formatPercentCount(stats.secondReturnWon.p2, stats.secondReturnWonCount.p2, stats.secondReturnWonTotal.p2), stats.secondReturnWon.p1, stats.secondReturnWon.p2, 'higher')}
                    ${this.createStatRow('Break Points Converted', this.formatPercentCount(stats.breakPointsRate.p1, stats.breakPointsWon.p1, stats.breakPointsTotal.p1), this.formatPercentCount(stats.breakPointsRate.p2, stats.breakPointsWon.p2, stats.breakPointsTotal.p2), stats.breakPointsRate.p1, stats.breakPointsRate.p2, 'higher')}
                    ${this.createStatRow('Return Games Played', stats.returnGamesPlayed.p1, stats.returnGamesPlayed.p2, stats.returnGamesPlayed.p1, stats.returnGamesPlayed.p2, 'higher')}
                </div>
            </div>

            <div class="match-stats-section">
                <h4>Total Points</h4>
                <div class="stats-grid">
                    ${this.createStatRow('Total Service Points Won', this.formatPercentCount(stats.totalServicePointsWon.p1, stats.servicePointsWon.p1, stats.servicePointsPlayed.p1), this.formatPercentCount(stats.totalServicePointsWon.p2, stats.servicePointsWon.p2, stats.servicePointsPlayed.p2), stats.totalServicePointsWon.p1, stats.totalServicePointsWon.p2, 'higher')}
                    ${this.createStatRow('Total Return Points Won', this.formatPercentCount(stats.totalReturnPointsWon.p1, stats.returnPointsWonCount.p1, stats.returnPointsPlayed.p1), this.formatPercentCount(stats.totalReturnPointsWon.p2, stats.returnPointsWonCount.p2, stats.returnPointsPlayed.p2), stats.totalReturnPointsWon.p1, stats.totalReturnPointsWon.p2, 'higher')}
                    ${this.createStatRow('Total Points Won', this.formatPercentCount(stats.totalPointsWon.p1, stats.totalPoints.p1, stats.totalPointsPlayed.p1), this.formatPercentCount(stats.totalPointsWon.p2, stats.totalPoints.p2, stats.totalPointsPlayed.p2), stats.totalPointsWon.p1, stats.totalPointsWon.p2, 'higher')}
                </div>
            </div>

            <div class="match-stats-section match-radar-section">
                <h4>Visual Comparison</h4>
                <div class="match-radar-grid">
                    <div class="match-radar-card">
                        <div class="match-radar-head">
                            <div class="match-radar-heading">Service Radar</div>
                            <div class="match-radar-legend">
                                <span class="match-radar-legend-item p1"><span class="swatch"></span>${radarP1Label}</span>
                                <span class="match-radar-legend-item p2"><span class="swatch"></span>${radarP2Label}</span>
                            </div>
                        </div>
                        <div id="matchServeRadar" class="match-radar-canvas">
                            <div class="match-radar-fallback">Loading radar...</div>
                        </div>
                    </div>
                    <div class="match-radar-card">
                        <div class="match-radar-head">
                            <div class="match-radar-heading">Return Radar</div>
                            <div class="match-radar-legend">
                                <span class="match-radar-legend-item p1"><span class="swatch"></span>${radarP1Label}</span>
                                <span class="match-radar-legend-item p2"><span class="swatch"></span>${radarP2Label}</span>
                            </div>
                        </div>
                        <div id="matchReturnRadar" class="match-radar-canvas">
                            <div class="match-radar-fallback">Loading radar...</div>
                        </div>
                    </div>
                    <div class="match-radar-card">
                        <div class="match-radar-head">
                            <div class="match-radar-heading">Total Points Radar</div>
                            <div class="match-radar-legend">
                                <span class="match-radar-legend-item p1"><span class="swatch"></span>${radarP1Label}</span>
                                <span class="match-radar-legend-item p2"><span class="swatch"></span>${radarP2Label}</span>
                            </div>
                        </div>
                        <div id="matchTotalRadar" class="match-radar-canvas">
                            <div class="match-radar-fallback">Loading radar...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        content.querySelectorAll('.match-stats-player-card.clickable').forEach((card) => {
            const openPlayer = () => {
                const playerId = card.dataset.playerId;
                const playerModule = window.TennisApp?.PlayerModule || window.PlayerModule;
                if (playerId && playerModule?.showPlayerStats) {
                    playerModule.showPlayerStats(playerId);
                }
            };
            card.addEventListener('click', openPlayer);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPlayer();
                }
            });
        });
        
        modal.classList.add('active');
        this.renderMatchStatsRadars(match, stats);
        this.loadMatchStatsOnDemand(match, context);
        this.startLiveModalAutoRefresh(match, context);
    },

    findCurrentLiveMatch(match) {
        const { AppState } = window.TennisApp;
        const tour = AppState.currentTour;
        const list = AppState.liveScores?.[tour] || [];
        const targetId = String(match?.id || '').trim();
        const targetEventId = String(match?.wta_event_id ?? match?.event_id ?? '').trim();
        const targetMatchId = String(match?.wta_match_id ?? '').trim();

        let found = null;
        if (targetId) {
            found = list.find((m) => String(m?.id || '').trim() === targetId);
        }
        if (!found && targetEventId && targetMatchId) {
            found = list.find((m) =>
                String(m?.wta_event_id ?? m?.event_id ?? '').trim() === targetEventId
                && String(m?.wta_match_id ?? '').trim() === targetMatchId
            );
        }
        return found || null;
    },

    startLiveModalAutoRefresh(match, context = {}) {
        this.stopLiveModalAutoRefresh();
        if (!match || String(match.status || '').toLowerCase() !== 'live') return;

        this.activeLiveModalMatchId = String(match.id || '').trim();
        this.liveModalRefreshTimer = setInterval(() => {
            const modal = document.getElementById('matchStatsModal');
            if (!modal || !modal.classList.contains('active')) {
                this.stopLiveModalAutoRefresh();
                return;
            }
            const liveMatch = this.findCurrentLiveMatch(match);
            if (!liveMatch) return;
            this.showMatchStats(
                liveMatch.id,
                liveMatch,
                { ...context, source: 'live' }
            );
        }, 30000);
    },

    stopLiveModalAutoRefresh() {
        if (this.liveModalRefreshTimer) {
            clearInterval(this.liveModalRefreshTimer);
            this.liveModalRefreshTimer = null;
        }
        this.activeLiveModalMatchId = null;
    },

    /**
     * Create a statistics row
     */
    createStatRow(label, val1, val2, num1 = null, num2 = null, better = 'higher') {
        // If num1 and num2 are provided, show bar graph
        if (num1 !== null && num2 !== null) {
            const total = num1 + num2;
            const percent1 = total > 0 ? (num1 / total * 100).toFixed(1) : 50;
            const percent2 = total > 0 ? (num2 / total * 100).toFixed(1) : 50;
            const p1Wins = better === 'lower' ? num1 < num2 : num1 > num2;
            const p2Wins = better === 'lower' ? num2 < num1 : num2 > num1;
            
            return `
                <div class="stat-row">
                    <div class="stat-value left ${p1Wins ? 'winner' : ''}">${val1}</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-value right ${p2Wins ? 'winner' : ''}">${val2}</div>
                    <div class="stat-bar dual">
                        <div class="stat-bar-track">
                            <div class="stat-bar-left" style="width: ${percent1}%"></div>
                            <div class="stat-bar-right" style="width: ${percent2}%"></div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="stat-row">
                    <div class="stat-value left">${val1}</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-value right">${val2}</div>
                </div>
            `;
        }
    },

    resolvePlayerModalId(player) {
        const directId = player?.id
            ?? player?.player_id
            ?? player?.playerId
            ?? player?.profile_id
            ?? player?.profileId;
        if (directId !== null && directId !== undefined && directId !== '') {
            return String(directId);
        }
        const { AppState } = window.TennisApp || {};
        const list = AppState?.rankings?.[AppState?.currentTour] || [];
        if (!Array.isArray(list) || !player?.name) return '';
        const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const targetName = normalize(player.name);
        const targetCountry = normalize(player.country);
        const exact = list.find((row) => normalize(row.name) === targetName && (!targetCountry || normalize(row.country) === targetCountry));
        if (exact?.id !== undefined && exact?.id !== null) return String(exact.id);
        const nameOnly = list.find((row) => normalize(row.name) === targetName);
        if (nameOnly?.id !== undefined && nameOnly?.id !== null) return String(nameOnly.id);
        return '';
    },

    resolvePlayerPoints(player) {
        const parsePoints = (value) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const cleaned = String(value ?? '').replace(/[^\d]/g, '');
            if (!cleaned) return null;
            const num = Number(cleaned);
            return Number.isFinite(num) ? num : null;
        };
        const direct = parsePoints(player?.points);
        if (direct !== null) return direct;
        const { AppState } = window.TennisApp || {};
        const list = AppState?.rankings?.[AppState?.currentTour] || [];
        if (!Array.isArray(list) || !player?.name) return null;
        const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const targetName = normalize(player.name);
        const targetCountry = normalize(player.country);
        const exact = list.find((row) => normalize(row.name) === targetName && (!targetCountry || normalize(row.country) === targetCountry));
        if (exact) return parsePoints(exact.points);
        const nameOnly = list.find((row) => normalize(row.name) === targetName);
        return parsePoints(nameOnly?.points);
    },

    getMatchKey(match) {
        const normalize = (value) => String(value ?? '').trim().toLowerCase();
        return [
            normalize(match?.id),
            normalize(match?.status),
            normalize(this.sanitizeTournamentName(match?.tournament || '')),
            normalize(match?.round),
            normalize(match?.player1?.name),
            normalize(match?.player2?.name),
            normalize(match?.player1?.rank),
            normalize(match?.player2?.rank),
            normalize(match?.scheduled_time || match?.match_time || '')
        ].join('|');
    },

    async ensurePlotly() {
        if (window.Plotly) {
            return window.Plotly;
        }
        if (this.plotlyLoadPromise) {
            return this.plotlyLoadPromise;
        }
        this.plotlyLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
            script.async = true;
            script.onload = () => resolve(window.Plotly);
            script.onerror = () => reject(new Error('Failed to load Plotly'));
            document.head.appendChild(script);
        });
        return this.plotlyLoadPromise;
    },

    async renderMatchStatsRadars(match, stats) {
        const { Utils } = window.TennisApp || {};
        const p1NameRaw = match.player1?.name || 'Player 1';
        const p2NameRaw = match.player2?.name || 'Player 2';
        const p1Label = Utils?.formatPlayerName ? Utils.formatPlayerName(p1NameRaw) : p1NameRaw;
        const p2Label = Utils?.formatPlayerName ? Utils.formatPlayerName(p2NameRaw) : p2NameRaw;

        const serveMetrics = [
            { label: 'Aces', p1: stats.aces.p1, p2: stats.aces.p2, better: 'higher', suffix: '' },
            { label: 'Double Faults', p1: stats.doubleFaults.p1, p2: stats.doubleFaults.p2, better: 'lower', suffix: '' },
            { label: '1st Serve %', p1: stats.firstServe.p1, p2: stats.firstServe.p2, better: 'higher', suffix: '%' },
            { label: '1st Serve Pts Won', p1: stats.firstServeWon.p1, p2: stats.firstServeWon.p2, better: 'higher', suffix: '%' },
            { label: '2nd Serve Pts Won', p1: stats.secondServeWon.p1, p2: stats.secondServeWon.p2, better: 'higher', suffix: '%' },
            { label: 'Break Pts Saved %', p1: stats.breakPointsSavedRate.p1, p2: stats.breakPointsSavedRate.p2, better: 'higher', suffix: '%' }
        ];
        const returnMetrics = [
            { label: '1st Return Pts Won %', p1: stats.firstReturnWon.p1, p2: stats.firstReturnWon.p2, better: 'higher', suffix: '%' },
            { label: '2nd Return Pts Won %', p1: stats.secondReturnWon.p1, p2: stats.secondReturnWon.p2, better: 'higher', suffix: '%' },
            { label: 'Break Pts Conv %', p1: stats.breakPointsRate.p1, p2: stats.breakPointsRate.p2, better: 'higher', suffix: '%' },
            { label: 'Return Games Played', p1: stats.returnGamesPlayed.p1, p2: stats.returnGamesPlayed.p2, better: 'higher', suffix: '' },
            { label: 'Return Pts Won %', p1: stats.totalReturnPointsWon.p1, p2: stats.totalReturnPointsWon.p2, better: 'higher', suffix: '%' }
        ];
        const totalMetrics = [
            { label: 'Total Serv Pts Won %', p1: stats.totalServicePointsWon.p1, p2: stats.totalServicePointsWon.p2, better: 'higher', suffix: '%' },
            { label: 'Total Ret Pts Won %', p1: stats.totalReturnPointsWon.p1, p2: stats.totalReturnPointsWon.p2, better: 'higher', suffix: '%' },
            { label: 'Total Pts Won %', p1: stats.totalPointsWon.p1, p2: stats.totalPointsWon.p2, better: 'higher', suffix: '%' },
            { label: 'Total Pts Won', p1: stats.totalPoints.p1, p2: stats.totalPoints.p2, better: 'higher', suffix: '' },
            { label: 'Points Played', p1: stats.totalPointsPlayed.p1, p2: stats.totalPointsPlayed.p2, better: 'higher', suffix: '' }
        ];

        try {
            const plotly = await this.ensurePlotly();
            this.renderMatchRadarChart(plotly, 'matchServeRadar', serveMetrics, p1Label, p2Label);
            this.renderMatchRadarChart(plotly, 'matchReturnRadar', returnMetrics, p1Label, p2Label);
            this.renderMatchRadarChart(plotly, 'matchTotalRadar', totalMetrics, p1Label, p2Label);
        } catch (error) {
            console.error('Match radar rendering failed:', error);
            ['matchServeRadar', 'matchReturnRadar', 'matchTotalRadar'].forEach((id) => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = '<div class="match-radar-fallback">Radar unavailable</div>';
                }
            });
        }
    },

    renderMatchRadarChart(plotly, containerId, metrics, player1Name, player2Name) {
        const container = document.getElementById(containerId);
        if (!container || !Array.isArray(metrics) || metrics.length === 0) {
            return;
        }
        container.innerHTML = '';

        const normalizePair = (aRaw, bRaw, better) => {
            const a = Number(aRaw);
            const b = Number(bRaw);
            if (!Number.isFinite(a) || !Number.isFinite(b)) return [50, 50];
            if (better === 'lower') {
                const invA = 1 / (a + 1);
                const invB = 1 / (b + 1);
                const invTotal = invA + invB;
                if (invTotal <= 0) return [50, 50];
                return [
                    Number(((invA / invTotal) * 100).toFixed(1)),
                    Number(((invB / invTotal) * 100).toFixed(1))
                ];
            }
            const total = a + b;
            if (total <= 0) return [50, 50];
            return [
                Number(((a / total) * 100).toFixed(1)),
                Number(((b / total) * 100).toFixed(1))
            ];
        };

        const labels = metrics.map((metric) => metric.label);
        const p1Display = metrics.map((metric) => `${metric.p1}${metric.suffix || ''}`);
        const p2Display = metrics.map((metric) => `${metric.p2}${metric.suffix || ''}`);
        const p1Norm = [];
        const p2Norm = [];
        metrics.forEach((metric) => {
            const [n1, n2] = normalizePair(metric.p1, metric.p2, metric.better);
            p1Norm.push(n1);
            p2Norm.push(n2);
        });

        const closedLabels = labels.concat(labels[0]);
        const p1Closed = p1Norm.concat(p1Norm[0]);
        const p2Closed = p2Norm.concat(p2Norm[0]);
        const p1DisplayClosed = p1Display.concat(p1Display[0]);
        const p2DisplayClosed = p2Display.concat(p2Display[0]);

        const traces = [
            {
                type: 'scatterpolar',
                r: p1Closed,
                theta: closedLabels,
                name: player1Name,
                line: { color: '#1E78C3', width: 3 },
                marker: { color: '#1E78C3', size: 6 },
                fill: 'toself',
                fillcolor: 'rgba(30, 120, 195, 0.16)',
                customdata: p1DisplayClosed,
                hovertemplate: '%{theta}: %{customdata}<extra>' + player1Name + '</extra>'
            },
            {
                type: 'scatterpolar',
                r: p2Closed,
                theta: closedLabels,
                name: player2Name,
                line: { color: '#15B294', width: 3 },
                marker: { color: '#15B294', size: 6 },
                fill: 'toself',
                fillcolor: 'rgba(21, 178, 148, 0.15)',
                customdata: p2DisplayClosed,
                hovertemplate: '%{theta}: %{customdata}<extra>' + player2Name + '</extra>'
            }
        ];

        const layout = {
            autosize: true,
            height: 370,
            margin: { l: 36, r: 36, t: 4, b: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            showlegend: false,
            polar: {
                domain: { x: [0.08, 0.92], y: [0.04, 0.96] },
                bgcolor: 'rgba(0,0,0,0)',
                radialaxis: {
                    visible: true,
                    range: [0, 100],
                    showticklabels: false,
                    gridcolor: 'rgba(141, 199, 223, 0.38)',
                    gridwidth: 1
                },
                angularaxis: {
                    tickfont: { size: 9, color: '#ECF6FC' },
                    gridcolor: 'rgba(141, 199, 223, 0.32)',
                    linecolor: 'rgba(141, 199, 223, 0.32)'
                }
            }
        };

        plotly.react(container, traces, layout, { responsive: true, displayModeBar: false });
        if (plotly.Plots && typeof plotly.Plots.resize === 'function') {
            requestAnimationFrame(() => plotly.Plots.resize(container));
        }
    },

    /**
     * Format percent labels with count detail.
     */
    formatPercentCount(percent, made, total) {
        const safePercent = this.formatStatPercent(percent);
        const madeNum = Number.isFinite(Number(made)) ? Math.round(Number(made)) : 0;
        const totalNum = Number.isFinite(Number(total)) ? Math.round(Number(total)) : 0;
        return `${safePercent}% ${madeNum}/${totalNum}`;
    },

    toNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    },

    toInt(value, fallback = 0) {
        return Math.round(this.toNumber(value, fallback));
    },

    toPair(value, fallbackP1 = 0, fallbackP2 = 0) {
        return {
            p1: this.toNumber(value?.p1, fallbackP1),
            p2: this.toNumber(value?.p2, fallbackP2)
        };
    },

    toIntPair(value, fallbackP1 = 0, fallbackP2 = 0) {
        return {
            p1: this.toInt(value?.p1, fallbackP1),
            p2: this.toInt(value?.p2, fallbackP2)
        };
    },

    safePct(numerator, denominator) {
        const num = this.toNumber(numerator, 0);
        const den = this.toNumber(denominator, 0);
        if (den <= 0) return 0;
        return Math.round((num / den) * 1000) / 10;
    },

    formatStatPercent(value) {
        const num = this.toNumber(value, 0);
        return String(Math.round(num));
    },

    withDerivedMatchStats(base) {
        const servicePointsPlayed = base.servicePointsPlayed || base.firstServeTotal;
        const servicePointsWon = base.servicePointsWon || {
            p1: base.firstServeWonCount.p1 + base.secondServeWonCount.p1,
            p2: base.firstServeWonCount.p2 + base.secondServeWonCount.p2
        };

        const firstReturnWonTotal = {
            p1: base.firstServeWonTotal.p2,
            p2: base.firstServeWonTotal.p1
        };
        const firstReturnWonCount = {
            p1: Math.max(0, firstReturnWonTotal.p1 - base.firstServeWonCount.p2),
            p2: Math.max(0, firstReturnWonTotal.p2 - base.firstServeWonCount.p1)
        };
        const firstReturnWon = {
            p1: this.safePct(firstReturnWonCount.p1, firstReturnWonTotal.p1),
            p2: this.safePct(firstReturnWonCount.p2, firstReturnWonTotal.p2)
        };

        const secondReturnWonTotal = {
            p1: base.secondServeWonTotal.p2,
            p2: base.secondServeWonTotal.p1
        };
        const secondReturnWonCount = {
            p1: Math.max(0, secondReturnWonTotal.p1 - base.secondServeWonCount.p2),
            p2: Math.max(0, secondReturnWonTotal.p2 - base.secondServeWonCount.p1)
        };
        const secondReturnWon = {
            p1: this.safePct(secondReturnWonCount.p1, secondReturnWonTotal.p1),
            p2: this.safePct(secondReturnWonCount.p2, secondReturnWonTotal.p2)
        };

        const returnGamesPlayed = {
            p1: base.serviceGamesPlayed.p2,
            p2: base.serviceGamesPlayed.p1
        };

        const returnPointsWonCount = {
            p1: Math.max(0, servicePointsPlayed.p2 - servicePointsWon.p2),
            p2: Math.max(0, servicePointsPlayed.p1 - servicePointsWon.p1)
        };
        const returnPointsPlayed = {
            p1: servicePointsPlayed.p2,
            p2: servicePointsPlayed.p1
        };

        const totalServicePointsWon = {
            p1: this.safePct(servicePointsWon.p1, servicePointsPlayed.p1),
            p2: this.safePct(servicePointsWon.p2, servicePointsPlayed.p2)
        };
        const totalReturnPointsWon = {
            p1: this.safePct(returnPointsWonCount.p1, returnPointsPlayed.p1),
            p2: this.safePct(returnPointsWonCount.p2, returnPointsPlayed.p2)
        };
        const totalPointsPlayed = {
            p1: servicePointsPlayed.p1 + servicePointsPlayed.p2,
            p2: servicePointsPlayed.p1 + servicePointsPlayed.p2
        };
        const totalPointsWon = {
            p1: this.safePct(base.totalPoints.p1, totalPointsPlayed.p1),
            p2: this.safePct(base.totalPoints.p2, totalPointsPlayed.p2)
        };

        return {
            ...base,
            servicePointsPlayed,
            servicePointsWon,
            firstReturnWon,
            firstReturnWonCount,
            firstReturnWonTotal,
            secondReturnWon,
            secondReturnWonCount,
            secondReturnWonTotal,
            returnGamesPlayed,
            returnPointsWonCount,
            returnPointsPlayed,
            totalServicePointsWon,
            totalReturnPointsWon,
            totalPointsPlayed,
            totalPointsWon
        };
    },

    normalizeExtractedMatchStats(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const aces = this.toIntPair(raw.aces);
        const doubleFaults = this.toIntPair(raw.doubleFaults);
        const firstServe = this.toIntPair(raw.firstServe);
        const firstServeMade = this.toIntPair(raw?.firstServe?.made);
        const firstServeTotal = this.toIntPair(raw?.firstServe?.total);
        const firstServeWon = this.toIntPair(raw.firstServeWon);
        const firstServeWonCount = this.toIntPair(raw?.firstServeWon?.won);
        const firstServeWonTotal = this.toIntPair(raw?.firstServeWon?.total);
        const secondServeWon = this.toIntPair(raw.secondServeWon);
        const secondServeWonCount = this.toIntPair(raw?.secondServeWon?.won);
        const secondServeWonTotal = this.toIntPair(raw?.secondServeWon?.total);
        const breakPointsWon = this.toIntPair(raw.breakPointsWon);
        const breakPointsTotal = this.toIntPair(raw.breakPointsTotal);
        const breakPointsRate = this.toIntPair(raw.breakPointsRate);
        const breakPointsFaced = this.toIntPair(raw.breakPointsFaced);
        const breakPointsSaved = this.toIntPair(raw.breakPointsSaved);
        const breakPointsSavedRate = this.toIntPair(raw.breakPointsSavedRate);
        const serviceGamesPlayed = this.toIntPair(raw.serviceGamesPlayed);
        const totalPoints = this.toIntPair(raw.totalPoints);
        const base = {
            duration: '',
            aces,
            doubleFaults,
            firstServe,
            firstServeMade,
            firstServeTotal,
            firstServeWon,
            firstServeWonCount,
            firstServeWonTotal,
            secondServeWon,
            secondServeWonCount,
            secondServeWonTotal,
            breakPointsWon,
            breakPointsTotal,
            breakPointsRate,
            breakPointsFaced,
            breakPointsSaved,
            breakPointsSavedRate,
            serviceGamesPlayed,
            totalPoints,
            servicePointsPlayed: this.toIntPair(raw.servicePointsPlayed, firstServeTotal.p1, firstServeTotal.p2),
            servicePointsWon: this.toIntPair(
                raw.servicePointsWon,
                firstServeWonCount.p1 + secondServeWonCount.p1,
                firstServeWonCount.p2 + secondServeWonCount.p2
            ),
            winners: this.toIntPair(raw.winners),
            unforcedErrors: this.toIntPair(raw.unforcedErrors),
        };
        return this.withDerivedMatchStats(base);
    },

    resolveWTAMatchIdentity(match) {
        if (!match || String(match.tour || '').toUpperCase() !== 'WTA') return null;
        const eventId = match.wta_event_id ?? match.event_id ?? null;
        const eventYear = match.wta_event_year ?? match.event_year ?? null;
        const matchId = match.wta_match_id ?? match.id ?? null;
        if (!eventId || !eventYear || !matchId) return null;
        return { eventId, eventYear, matchId };
    },

    resolveATPMatchStatsUrl(match) {
        if (!match || String(match.tour || '').toUpperCase() !== 'ATP') return '';
        const url = String(
            match.atp_stats_url
            || match.stats_url
            || match.match_stats_url
            || ''
        ).trim();
        if (!url) return '';
        return url;
    },

    async loadMatchStatsOnDemand(match, context = {}) {
        if (!match) return;
        const tour = String(match.tour || '').toUpperCase();

        const isLive = String(match.status || '').toLowerCase() === 'live';
        const nowMs = Date.now();
        const lastFetchedAt = Number(match._matchStatsFetchedAt || 0);
        const liveRefreshWindowMs = 25000;
        if (match.match_stats) {
            if (!isLive) return;
            if (lastFetchedAt > 0 && nowMs - lastFetchedAt < liveRefreshWindowMs) {
                return;
            }
        }

        const ids = this.resolveWTAMatchIdentity(match);
        const atpStatsUrl = this.resolveATPMatchStatsUrl(match);

        if (tour === 'WTA' && !ids) return;
        if (tour === 'ATP' && !atpStatsUrl) return;

        const requestKey = tour === 'WTA'
            ? `${this.getMatchKey(match)}|${ids.eventId}|${ids.eventYear}|${ids.matchId}`
            : `${this.getMatchKey(match)}|${atpStatsUrl}`;
        this._activeMatchStatsRequestKey = requestKey;

        // For ATP completed matches, check cache first
        if (tour === 'ATP' && !isLive) {
            const cachedStats = this.getCachedATPMatchStats(requestKey);
            if (cachedStats) {
                console.log('Using cached ATP match stats for:', match.id);
                match.match_stats = cachedStats;
                match._matchStatsFetchedAt = Date.now();
                
                const modal = document.getElementById('matchStatsModal');
                if (modal && modal.classList.contains('active')) {
                    this.showMatchStats(match.id, match, context);
                }
                return;
            }
        }

        try {
            const api = window.TennisApp?.API;
            let stats = null;

            if (tour === 'WTA') {
                if (!api?.getWTAMatchStats) return;
                stats = await api.getWTAMatchStats(ids.eventId, ids.eventYear, ids.matchId, isLive);
            } else if (tour === 'ATP') {
                if (!api?.getATPMatchStats) return;
                console.log('Fetching ATP match stats from server:', atpStatsUrl);
                stats = await api.getATPMatchStats(atpStatsUrl);
            } else {
                return;
            }

            if (!stats) return;
            match.match_stats = stats;
            match._matchStatsFetchedAt = Date.now();

            // Cache ATP stats for completed matches
            if (tour === 'ATP' && !isLive) {
                console.log('Caching ATP match stats for:', match.id);
                this.cacheATPMatchStats(requestKey, stats);
            }

            const modal = document.getElementById('matchStatsModal');
            if (!modal || !modal.classList.contains('active')) return;
            if (this._activeMatchStatsRequestKey !== requestKey) return;

            this.showMatchStats(match.id, match, context);
        } catch (error) {
            if (tour === 'ATP') {
                console.error('Failed to load on-demand ATP match stats:', error);
            } else {
                console.error('Failed to load on-demand WTA match stats:', error);
            }
        }
    },

    /**
     * Generate match statistics
     */
    generateMatchStats(match) {
        const extracted = this.normalizeExtractedMatchStats(match?.match_stats);
        if (extracted) {
            return extracted;
        }

        // Keep fallback deterministic/neutral when detailed stats are unavailable.
        const base = {
            duration: '',
            aces: { p1: 0, p2: 0 },
            doubleFaults: { p1: 0, p2: 0 },
            firstServe: { p1: 0, p2: 0 },
            firstServeMade: { p1: 0, p2: 0 },
            firstServeTotal: { p1: 0, p2: 0 },
            firstServeWon: { p1: 0, p2: 0 },
            firstServeWonCount: { p1: 0, p2: 0 },
            firstServeWonTotal: { p1: 0, p2: 0 },
            secondServeWon: { p1: 0, p2: 0 },
            secondServeWonCount: { p1: 0, p2: 0 },
            secondServeWonTotal: { p1: 0, p2: 0 },
            breakPointsWon: { p1: 0, p2: 0 },
            breakPointsTotal: { p1: 0, p2: 0 },
            breakPointsRate: { p1: 0, p2: 0 },
            breakPointsFaced: { p1: 0, p2: 0 },
            breakPointsSaved: { p1: 0, p2: 0 },
            breakPointsSavedRate: { p1: 0, p2: 0 },
            serviceGamesPlayed: { p1: 0, p2: 0 },
            servicePointsPlayed: { p1: 0, p2: 0 },
            servicePointsWon: { p1: 0, p2: 0 },
            winners: { p1: 0, p2: 0 },
            unforcedErrors: { p1: 0, p2: 0 },
            totalPoints: { p1: 0, p2: 0 }
        };
        return this.withDerivedMatchStats(base);
    },

    resolveMatchTimeLabel(match, isLive) {
        const readText = (...values) => {
            for (const value of values) {
                if (value === null || value === undefined) continue;
                const text = String(value).trim();
                if (text) return text;
            }
            return '';
        };

        if (isLive) {
            return readText(
                match.match_time,
                match.live_time,
                match.elapsed_time,
                match.time
            );
        }

        return readText(
            match.match_duration,
            match.duration,
            match.duration_text,
            match.time
        );
    },

    formatSetLines(score) {
        if (!score || !score.sets) return '';
        return score.sets.map(set => {
            const p1 = set.p1;
            const p2 = set.p2;
            const p1Win = p1 > p2;
            const p2Win = p2 > p1;
            const isTiebreak = (p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7);
            const tbP1 = isTiebreak ? (set.tiebreak ? set.tiebreak.p1 : (p1 === 7 ? 7 : 6)) : null;
            const tbP2 = isTiebreak ? (set.tiebreak ? set.tiebreak.p2 : (p2 === 7 ? 7 : 6)) : null;
            return `
                <div class="set-line">
                    <span class="${p1Win ? 'winner' : ''}">${p1}${tbP1 !== null ? `<sup class="tb">(${tbP1})</sup>` : ''}</span>
                    <span class="dash">-</span>
                    <span class="${p2Win ? 'winner' : ''}">${p2}${tbP2 !== null ? `<sup class="tb">(${tbP2})</sup>` : ''}</span>
                </div>
            `;
        }).join('');
    },

    formatSetSummary(score, match) {
        const wins = this.getSetWinsFromScore(score, { preferExplicit: true, onlyCompleted: true });
        const p1Wins = Number.isFinite(Number(wins?.p1)) ? Number(wins.p1) : 0;
        const p2Wins = Number.isFinite(Number(wins?.p2)) ? Number(wins.p2) : 0;
        const hasAny = (p1Wins + p2Wins) > 0;
        if (!hasAny) return '';

        const winner = this.getWinnerFromScore(match, score);
        const p1Class = winner === 1 ? 'winner' : '';
        const p2Class = winner === 2 ? 'winner' : '';
        return `
            <span class="set-summary-value ${p1Class}">${p1Wins}</span>
            <span class="set-summary-dash">-</span>
            <span class="set-summary-value ${p2Class}">${p2Wins}</span>
        `;
    },

    /**
     * Close match statistics modal
     */
    closeMatchStats() {
        const modal = document.getElementById('matchStatsModal');
        modal.classList.remove('active');
        this.stopLiveModalAutoRefresh();
    }
};

// Export module
window.ScoresModule = ScoresModule;
