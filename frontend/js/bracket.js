/**
 * Tennis Live Dashboard - Tournament Bracket Module
 * Handles rendering of tournament draws/brackets with match details
 */

const BracketModule = {
    /**
     * Current bracket data
     */
    currentBracket: null,
    resizeHandler: null,
    loadToken: 0,

    /**
     * Points by round for different tournament categories
     */
    pointsByRound: {
        grand_slam: {
            'R128': 10, 'R64': 45, 'R32': 90, 'R16': 180, 'QF': 360, 'SF': 720, 'F': 1200, 'W': 2000
        },
        masters_1000: {
            'R64': 10, 'R32': 45, 'R16': 90, 'QF': 180, 'SF': 360, 'F': 600, 'W': 1000
        },
        atp_500: {
            'R32': 0, 'R16': 25, 'QF': 50, 'SF': 100, 'F': 200, 'W': 500
        },
        atp_250: {
            'R32': 0, 'R16': 13, 'QF': 25, 'SF': 50, 'F': 100, 'W': 250
        },
        finals: {
            'RR': 200, 'SF': 400, 'F': 500, 'W': 1500
        }
    },

    /**
     * Prize money by round (in USD)
     */
    prizeMoneyByRound: {
        grand_slam: {
            'R128': '$100K', 'R64': '$180K', 'R32': '$300K', 'R16': '$530K', 
            'QF': '$925K', 'SF': '$1.7M', 'F': '$3M', 'W': '$3.5M'
        },
        masters_1000: {
            'R64': '$25K', 'R32': '$52K', 'R16': '$105K', 'QF': '$215K', 
            'SF': '$440K', 'F': '$880K', 'W': '$1.4M'
        },
        atp_500: {
            'R32': '$12K', 'R16': '$25K', 'QF': '$52K', 'SF': '$110K', 
            'F': '$225K', 'W': '$450K'
        },
        atp_250: {
            'R32': '$7K', 'R16': '$14K', 'QF': '$28K', 'SF': '$57K', 
            'F': '$115K', 'W': '$230K'
        },
        finals: {
            'RR': '$350K', 'SF': '$1.2M', 'F': '$2.5M', 'W': '$5M'
        }
    },

    /**
     * Demo bracket data generator
     */
    generateDemoBracket(tournamentId, category) {
        const { AppState } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Find tournament info
        let tournament = null;
        const tournaments = tour === 'atp' 
            ? TournamentsModule.demoTournaments.atp 
            : TournamentsModule.demoTournaments.wta;
        
        tournament = tournaments.find(t => t.id == tournamentId);
        const tournamentCategory = category || tournament?.category || 'atp_250';
        
        // Generate players for bracket
        const players = tour === 'atp' 
            ? this.generateATPPlayers() 
            : this.generateWTAPlayers();

        // Special handling for Finals
        if (tournamentCategory === 'finals') {
            return this.generateFinalsBracket(tournament, players, tour);
        }

        // Determine draw size based on category
        let drawSize = 32;
        if (tournamentCategory === 'grand_slam') {
            drawSize = 128;
        } else if (tournamentCategory === 'masters_1000') {
            drawSize = 64;
        }

        const rounds = this.getRounds(drawSize);
        const matches = this.generateBracketMatches(players, rounds, drawSize, tournamentCategory);

        return {
            tournament_id: tournamentId,
            tournament_name: tournament?.name || 'Tournament',
            tournament_category: tournamentCategory,
            draw_size: drawSize,
            rounds: rounds,
            matches: matches,
            is_finals: false
        };
    },

    /**
     * Generate Finals bracket with group stage
     */
    generateFinalsBracket(tournament, players, tour) {
        const topPlayers = players.slice(0, 8);
        
        // Create groups
        const groups = [
            { name: 'Green Group', players: topPlayers.slice(0, 4) },
            { name: 'Red Group', players: topPlayers.slice(4, 8) }
        ];

        // Semi-finals (top 2 from each group)
        const semiFinals = [
            {
                id: 101,
                round: 'SF',
                match_number: 1,
                player1: groups[0].players[0],
                player2: groups[1].players[1],
                winner: groups[0].players[0],
                score: { sets: [{ p1: 6, p2: 4 }, { p1: 6, p2: 3 }] },
                status: 'finished'
            },
            {
                id: 102,
                round: 'SF',
                match_number: 2,
                player1: groups[1].players[0],
                player2: groups[0].players[1],
                winner: groups[1].players[0],
                score: { sets: [{ p1: 7, p2: 6 }, { p1: 6, p2: 4 }] },
                status: 'finished'
            }
        ];

        // Final
        const final = {
            id: 103,
            round: 'F',
            match_number: 1,
            player1: groups[0].players[0],
            player2: groups[1].players[0],
            winner: groups[0].players[0],
            score: { sets: [{ p1: 6, p2: 3 }, { p1: 7, p2: 5 }] },
            status: 'finished'
        };

        return {
            tournament_id: tournament?.id,
            tournament_name: tournament?.name || (tour === 'atp' ? 'ATP Finals' : 'WTA Finals'),
            tournament_category: 'finals',
            draw_size: 8,
            rounds: ['RR', 'SF', 'F'],
            groups: groups,
            matches: [
                { round: 'SF', matches: semiFinals },
                { round: 'F', matches: [final] }
            ],
            is_finals: true
        };
    },

    /**
     * Generate ATP players for bracket
     */
    generateATPPlayers() {
        const topPlayers = [
            { id: 1, name: 'N. Djokovic', country: 'SRB', rank: 1, seed: 1 },
            { id: 2, name: 'C. Alcaraz', country: 'ESP', rank: 2, seed: 2 },
            { id: 3, name: 'J. Sinner', country: 'ITA', rank: 3, seed: 3 },
            { id: 4, name: 'D. Medvedev', country: 'RUS', rank: 4, seed: 4 },
            { id: 5, name: 'A. Rublev', country: 'RUS', rank: 5, seed: 5 },
            { id: 6, name: 'A. Zverev', country: 'GER', rank: 6, seed: 6 },
            { id: 7, name: 'H. Rune', country: 'DEN', rank: 7, seed: 7 },
            { id: 8, name: 'S. Tsitsipas', country: 'GRE', rank: 8, seed: 8 },
            { id: 9, name: 'H. Hurkacz', country: 'POL', rank: 9, seed: 9 },
            { id: 10, name: 'C. Ruud', country: 'NOR', rank: 10, seed: 10 },
            { id: 11, name: 'T. Fritz', country: 'USA', rank: 11, seed: 11 },
            { id: 12, name: 'T. Paul', country: 'USA', rank: 12, seed: 12 },
            { id: 13, name: 'B. Shelton', country: 'USA', rank: 13, seed: 13 },
            { id: 14, name: 'G. Dimitrov', country: 'BUL', rank: 14, seed: 14 },
            { id: 15, name: 'F. Auger-Aliassime', country: 'CAN', rank: 15, seed: 15 },
            { id: 16, name: 'K. Khachanov', country: 'RUS', rank: 16, seed: 16 },
            { id: 17, name: 'F. Tiafoe', country: 'USA', rank: 17, seed: 17 },
            { id: 18, name: 'U. Humbert', country: 'FRA', rank: 18, seed: 18 },
            { id: 19, name: 'S. Korda', country: 'USA', rank: 19, seed: 19 },
            { id: 20, name: 'N. Jarry', country: 'CHI', rank: 20, seed: 20 },
            { id: 21, name: 'A. de Minaur', country: 'AUS', rank: 21, seed: 21 },
            { id: 22, name: 'L. Musetti', country: 'ITA', rank: 22, seed: 22 },
            { id: 23, name: 'J. Draper', country: 'GBR', rank: 23, seed: 23 },
            { id: 24, name: 'A. Bublik', country: 'KAZ', rank: 24, seed: 24 },
            { id: 25, name: 'T. Etcheverry', country: 'ARG', rank: 25, seed: 25 },
            { id: 26, name: 'A. Fils', country: 'FRA', rank: 26, seed: 26 },
            { id: 27, name: 'C. Norrie', country: 'GBR', rank: 27, seed: 27 },
            { id: 28, name: 'F. Cerundolo', country: 'ARG', rank: 28, seed: 28 },
            { id: 29, name: 'M. Arnaldi', country: 'ITA', rank: 29, seed: 29 },
            { id: 30, name: 'J. Lehecka', country: 'CZE', rank: 30, seed: 30 },
            { id: 31, name: 'Z. Bergs', country: 'BEL', rank: 31, seed: 31 },
            { id: 32, name: 'A. Popyrin', country: 'AUS', rank: 32, seed: 32 }
        ];

        // Add unseeded players
        const countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'ARG', 'AUS', 'GBR', 'JPN'];
        const firstNames = ['A.', 'M.', 'P.', 'J.', 'D.', 'L.', 'K.', 'N.', 'S.', 'T.'];
        const lastNames = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones'];

        for (let i = 33; i <= 128; i++) {
            topPlayers.push({
                id: i,
                name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                country: countries[Math.floor(Math.random() * countries.length)],
                rank: i,
                seed: null
            });
        }

        return topPlayers;
    },

    /**
     * Generate WTA players for bracket
     */
    generateWTAPlayers() {
        const topPlayers = [
            { id: 101, name: 'I. Swiatek', country: 'POL', rank: 1, seed: 1 },
            { id: 102, name: 'A. Sabalenka', country: 'BLR', rank: 2, seed: 2 },
            { id: 103, name: 'C. Gauff', country: 'USA', rank: 3, seed: 3 },
            { id: 104, name: 'E. Rybakina', country: 'KAZ', rank: 4, seed: 4 },
            { id: 105, name: 'J. Pegula', country: 'USA', rank: 5, seed: 5 },
            { id: 106, name: 'O. Jabeur', country: 'TUN', rank: 6, seed: 6 },
            { id: 107, name: 'M. Vondrousova', country: 'CZE', rank: 7, seed: 7 },
            { id: 108, name: 'Q. Zheng', country: 'CHN', rank: 8, seed: 8 },
            { id: 109, name: 'M. Sakkari', country: 'GRE', rank: 9, seed: 9 },
            { id: 110, name: 'J. Ostapenko', country: 'LAT', rank: 10, seed: 10 },
            { id: 111, name: 'D. Kasatkina', country: 'RUS', rank: 11, seed: 11 },
            { id: 112, name: 'M. Keys', country: 'USA', rank: 12, seed: 12 },
            { id: 113, name: 'L. Samsonova', country: 'RUS', rank: 13, seed: 13 },
            { id: 114, name: 'B. Haddad Maia', country: 'BRA', rank: 14, seed: 14 },
            { id: 115, name: 'K. Muchova', country: 'CZE', rank: 15, seed: 15 },
            { id: 116, name: 'E. Alexandrova', country: 'RUS', rank: 16, seed: 16 },
            { id: 117, name: 'C. Garcia', country: 'FRA', rank: 17, seed: 17 },
            { id: 118, name: 'V. Kudermetova', country: 'RUS', rank: 18, seed: 18 },
            { id: 119, name: 'B. Krejcikova', country: 'CZE', rank: 19, seed: 19 },
            { id: 120, name: 'E. Navarro', country: 'USA', rank: 20, seed: 20 },
            { id: 121, name: 'J. Paolini', country: 'ITA', rank: 21, seed: 21 },
            { id: 122, name: 'A. Kalinskaya', country: 'RUS', rank: 22, seed: 22 },
            { id: 123, name: 'D. Collins', country: 'USA', rank: 23, seed: 23 },
            { id: 124, name: 'A. Anisimova', country: 'USA', rank: 24, seed: 24 },
            { id: 125, name: 'L. Fernandez', country: 'CAN', rank: 25, seed: 25 },
            { id: 126, name: 'S. Stephens', country: 'USA', rank: 26, seed: 26 },
            { id: 127, name: 'E. Svitolina', country: 'UKR', rank: 27, seed: 27 },
            { id: 128, name: 'P. Kvitova', country: 'CZE', rank: 28, seed: 28 },
            { id: 129, name: 'M. Kostyuk', country: 'UKR', rank: 29, seed: 29 },
            { id: 130, name: 'Y. Putintseva', country: 'KAZ', rank: 30, seed: 30 },
            { id: 131, name: 'M. Linette', country: 'POL', rank: 31, seed: 31 },
            { id: 132, name: 'L. Tsurenko', country: 'UKR', rank: 32, seed: 32 }
        ];

        // Add unseeded players
        const countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'RUS', 'AUS', 'GBR', 'JPN', 'CHN'];
        const firstNames = ['A.', 'M.', 'S.', 'E.', 'V.', 'L.', 'K.', 'N.', 'T.', 'J.'];
        const lastNames = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones'];

        for (let i = 133; i <= 228; i++) {
            topPlayers.push({
                id: i,
                name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                country: countries[Math.floor(Math.random() * countries.length)],
                rank: i - 100,
                seed: null
            });
        }

        return topPlayers;
    },

    /**
     * Get rounds based on draw size
     */
    getRounds(drawSize) {
        const roundNames = {
            128: ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],
            64: ['R64', 'R32', 'R16', 'QF', 'SF', 'F'],
            32: ['R32', 'R16', 'QF', 'SF', 'F'],
            16: ['R16', 'QF', 'SF', 'F']
        };
        return roundNames[drawSize] || roundNames[32];
    },

    /**
     * Generate bracket matches
     */
    generateBracketMatches(players, rounds, drawSize, category) {
        const matches = [];
        let matchId = 1;
        const bestOf = this.getBestOfForCategory(category);
        
        // Only generate first few rounds for display (limit complexity)
        const displayRounds = rounds.slice(-5); // Show last 5 rounds max
        const startRoundIdx = Math.max(0, rounds.indexOf(displayRounds[0]));
        
        let matchesInRound = Math.min(16, drawSize / 2); // Start with R16 or less
        
        displayRounds.forEach((round, roundIdx) => {
            const roundMatches = [];
            
            for (let i = 0; i < matchesInRound; i++) {
                const isFirstRound = roundIdx === 0;
                
                // Get players for first round from seedings
                let p1 = null, p2 = null;
                
                if (isFirstRound) {
                    // Simplified seeding positions
                    const p1Idx = i * 2;
                    const p2Idx = i * 2 + 1;
                    p1 = players[p1Idx] || null;
                    p2 = players[p2Idx] || null;
                }

                // Determine winner (for completed matches)
                let winner = null;
                let score = null;
                let status = 'scheduled';

                // First rounds are mostly completed
                if (roundIdx < displayRounds.length - 2) {
                    status = 'finished';
                    if (p1 && p2) {
                        score = this.generateScore(bestOf);
                        winner = this.getWinnerFromScore(score, p1, p2, category);
                    }
                } else if (roundIdx === displayRounds.length - 2) {
                    // Some in progress
                    if (Math.random() > 0.5) {
                        status = 'finished';
                        if (p1 && p2) {
                            score = this.generateScore(bestOf);
                            winner = this.getWinnerFromScore(score, p1, p2, category);
                        }
                    }
                }

                roundMatches.push({
                    id: matchId++,
                    round: round,
                    match_number: i + 1,
                    player1: p1,
                    player2: p2,
                    winner: winner,
                    score: score,
                    status: status,
                    points: this.getPointsForRound(round, category)
                });
            }

            matches.push({
                round: round,
                matches: roundMatches
            });

            matchesInRound = Math.max(1, matchesInRound / 2);
        });

        return matches;
    },

    /**
     * Get points for a round
     */
    getPointsForRound(round, category) {
        const cat = category || 'atp_250';
        const roundPoints = this.pointsByRound[cat] || this.pointsByRound.atp_250;
        return roundPoints[round] || 0;
    },

    /**
     * Best-of format by category/tour
     */
    getBestOfForCategory(category) {
        const tour = (window.TennisApp?.AppState?.currentTour || 'atp').toLowerCase();
        if (category === 'grand_slam' && tour === 'atp') {
            return 5;
        }
        return 3;
    },

    /**
     * Determine winner from score (if possible)
     */
    getWinnerFromScore(score, p1, p2, category) {
        if (!score || !Array.isArray(score.sets) || !p1 || !p2) {
            return null;
        }
        const bestOf = this.getBestOfForCategory(category);
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

        if (p1Sets >= winSets && p1Sets > p2Sets) return p1;
        if (p2Sets >= winSets && p2Sets > p1Sets) return p2;
        return null;
    },

    resolveMatchWinner(match, category) {
        if (!match) return null;
        const score = match.score || match.final_score;
        const computed = this.getWinnerFromScore(score, match.player1, match.player2, category);
        return computed || match.winner || null;
    },

    /**
     * Generate random score
     */
    generateScore(bestOf = 3) {
        const sets = [];
        const winSets = Math.floor(bestOf / 2) + 1;
        let p1Sets = 0;
        let p2Sets = 0;

        while (p1Sets < winSets && p2Sets < winSets) {
            const p1Wins = Math.random() > 0.5;
            const tbChance = Math.random() > 0.7;
            let set;

            if (p1Wins) {
                const oppGames = tbChance ? 6 : Math.floor(Math.random() * 5);
                const p1Games = tbChance ? 7 : 6;
                set = { p1: p1Games, p2: oppGames };
                p1Sets += 1;
            } else {
                const oppGames = tbChance ? 6 : Math.floor(Math.random() * 5);
                const p2Games = tbChance ? 7 : 6;
                set = { p1: oppGames, p2: p2Games };
                p2Sets += 1;
            }

            if (tbChance) {
                const isDecider = p1Sets === winSets || p2Sets === winSets;
                if (p1Wins) {
                    set.tiebreak = isDecider
                        ? { p1: 10, p2: Math.random() > 0.5 ? 8 : 9 }
                        : { p1: 7, p2: Math.max(5, Math.floor(Math.random() * 6)) };
                } else {
                    set.tiebreak = isDecider
                        ? { p1: Math.random() > 0.5 ? 8 : 9, p2: 10 }
                        : { p1: Math.max(5, Math.floor(Math.random() * 6)), p2: 7 };
                }
            }

            sets.push(set);
        }

        return { sets, p1_sets: p1Sets, p2_sets: p2Sets };
    },

    /**
     * Load and render bracket
     */
    async loadAndRender(tournamentId, category, tournamentName = null, tournamentSurface = null) {
        const { DOM, API, AppState } = window.TennisApp;
        const requestToken = ++this.loadToken;
        const selectedId = `${tournamentId}`;
        
        // Show loading
        DOM.tournamentBracket.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading tournament draw...</span>
            </div>
        `;

        try {
            // Try to fetch from API
            let bracket = await API.getTournamentBracket(tournamentId, AppState.currentTour).catch(() => null);

            // Ignore stale responses
            if (requestToken !== this.loadToken || `${AppState.selectedTournament}` !== selectedId) {
                return;
            }

            if (bracket) {
                bracket = this.normalizeBracketData(bracket, category, tournamentName, tournamentId);
            }
            
            // Fall back to demo data
            if (!bracket || !Array.isArray(bracket.matches) || bracket.matches.length === 0) {
                bracket = this.generateDemoBracket(tournamentId, category);
            } else {
                bracket.tournament_name = tournamentName || bracket.tournament_name || `Tournament ${tournamentId}`;
                bracket.tournament_surface = tournamentSurface || bracket.tournament_surface || '';
                if (!bracket.tournament_category) {
                    bracket.tournament_category = category || 'atp_250';
                }
            }

            this.currentBracket = bracket;
            this.render();
        } catch (error) {
            console.error('Error loading bracket:', error);
            if (requestToken !== this.loadToken || `${AppState.selectedTournament}` !== selectedId) {
                return;
            }
            // Use demo data on error
            this.currentBracket = this.generateDemoBracket(tournamentId, category);
            this.render();
        }
    },

    /**
     * Render the bracket
     */
    render() {
        const { DOM, Utils } = window.TennisApp;
        
        if (!this.currentBracket || !this.currentBracket.matches) {
            DOM.tournamentBracket.innerHTML = `
                <div class="placeholder-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No bracket data available</p>
                </div>
            `;
            return;
        }

        const bracket = this.currentBracket;
        const category = bracket.tournament_category || 'atp_250';
        const titleEl = document.getElementById('bracketTitle');
        if (titleEl) {
            titleEl.textContent = 'Tournament Draw';
        }
        
        // Check if tournament is completed (has a champion)
        const finalMatch = bracket.matches[bracket.matches.length - 1]?.matches[0];
        const finalWinner = finalMatch ? this.resolveMatchWinner(finalMatch, category) : null;
        const hasChampion = !!finalWinner;
        
        const categoryNames = {
            'grand_slam': 'Grand Slam',
            'masters_1000': 'Masters 1000',
            'atp_500': 'ATP 500',
            'atp_250': 'ATP 250',
            'finals': 'Finals'
        };

        const badgeClass = category.replace(/_/g, '-');
        const drawMeta = this.getDrawMeta(bracket.draw_size);
        const surfaceClass = this.getSurfaceClass(bracket.tournament_surface || '');
        let html = `
            <div class="bracket-info">
                <div class="bracket-title-row">
                    <h3 class="bracket-title">
                        ${bracket.tournament_name || 'Tournament Draw'}
                        <span class="tournament-category-badge ${badgeClass}">${categoryNames[category] || category}</span>
                        ${bracket.tournament_surface ? `<span class="tournament-surface-tag ${surfaceClass}">${bracket.tournament_surface}</span>` : ''}
                    </h3>
                    <button class="bracket-expand-btn" type="button" aria-label="Open bracket in large view">
                        <i class="fas fa-up-right-and-down-left-from-center"></i>
                        Expand
                    </button>
                </div>
                <div class="bracket-subtitle">
                    ${bracket.draw_size} Players
                    <span class="bracket-meta">(${drawMeta.seeds} seeds, ${drawMeta.qualifiers} Q, ${drawMeta.wildcards} WC)</span>
                </div>
                ${hasChampion ? `
                    <button class="champion-btn" onclick="window.TennisApp.BracketModule.showChampionCelebration(
                        '${bracket.tournament_name}',
                        ${JSON.stringify(finalWinner).replace(/"/g, '&quot;')},
                        '${category}',
                        ${this.getPointsForRound('W', category)}
                    )">
                        <i class="fas fa-trophy"></i> View Champion
                    </button>
                ` : ''}
            </div>
        `;

        // If Finals, show group stage first
        if (bracket.is_finals && bracket.groups) {
            html += this.renderFinalsGroups(bracket.groups);
        }

        html += this.renderColumnBracket(bracket);

        DOM.tournamentBracket.innerHTML = html;

        this.ensureFullscreenModal();
        const expandBtn = document.querySelector('.bracket-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.openFullscreenViewer());
        }

        this.attachMatchListeners(DOM.tournamentBracket);
        this.bindConnectorResize();
        setTimeout(() => this.drawConnectors(DOM.tournamentBracket), 80);
    },

    renderWithViewer(bracket, containerId = 'bracketsViewerContainer', instanceKey = 'viewerInstance') {
        if (!window.bracketsViewer && !window.BracketsViewer) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = this.renderColumnBracket(bracket);
                this.attachMatchListeners();
            }
            return;
        }

        const participantsMap = new Map();
        let placeholderId = -1;
        bracket.matches.forEach(roundData => {
            roundData.matches.forEach(match => {
                if (match.player1 && !participantsMap.has(match.player1.id)) {
                    participantsMap.set(match.player1.id, { id: match.player1.id, name: match.player1.name });
                }
                if (match.player2 && !participantsMap.has(match.player2.id)) {
                    participantsMap.set(match.player2.id, { id: match.player2.id, name: match.player2.name });
                }
            });
        });

        const participants = Array.from(participantsMap.values());
        if (participants.length === 0) {
            participants.push({ id: -1, name: 'TBD' });
        }

        const stageId = 0;
        const stages = [{
            id: stageId,
            tournament_id: bracket.tournament_id || 0,
            name: bracket.tournament_name || 'Tournament',
            type: 'single_elimination',
            number: 1,
            settings: {
                size: bracket.draw_size || 32,
                seedOrdering: ['natural'],
                grandFinal: 'simple'
            }
        }];

        const groups = [{
            id: 0,
            stage_id: stageId,
            number: 1
        }];

        const rounds = bracket.matches.map((roundData, idx) => ({
            id: idx,
            stage_id: stageId,
            group_id: 0,
            number: idx + 1
        }));

        const matches = [];
        bracket.matches.forEach((roundData, roundIdx) => {
            roundData.matches.forEach((match, matchIdx) => {
                const score = match.score?.sets || [];
                const p1Sets = score.filter(s => s.p1 > s.p2).length;
                const p2Sets = score.filter(s => s.p2 > s.p1).length;
                const resolvedWinner = this.resolveMatchWinner(match, bracket.tournament_category);
                const p1Win = resolvedWinner && match.player1 && resolvedWinner.id === match.player1.id;
                const p2Win = resolvedWinner && match.player2 && resolvedWinner.id === match.player2.id;
                const matchNumber = match.match_number || matchIdx + 1;
                const slotPositions = this.getSlotPositions(roundIdx, matchNumber, bracket.draw_size || 32);
                const p1Id = match.player1?.id ?? placeholderId--;
                const p2Id = match.player2?.id ?? placeholderId--;

                if (!participantsMap.has(p1Id)) {
                    participantsMap.set(p1Id, { id: p1Id, name: 'TBD' });
                }
                if (!participantsMap.has(p2Id)) {
                    participantsMap.set(p2Id, { id: p2Id, name: 'TBD' });
                }

                const status = match.status === 'finished' ? 4 : match.status === 'live' ? 3 : 0;
                matches.push({
                    id: match.id,
                    stage_id: stageId,
                    group_id: 0,
                    round_id: roundIdx,
                    number: matchNumber,
                    status,
                    opponent1: {
                        id: p1Id,
                        position: match.player1?.seed || match.player1?.rank || slotPositions.p1,
                        score: p1Sets || 0,
                        result: p1Win ? 'win' : p2Win ? 'loss' : null
                    },
                    opponent2: {
                        id: p2Id,
                        position: match.player2?.seed || match.player2?.rank || slotPositions.p2,
                        score: p2Sets || 0,
                        result: p2Win ? 'win' : p1Win ? 'loss' : null
                    }
                });
            });
        });

        const data = {
            stages,
            groups,
            rounds,
            participants,
            matches,
            matchGames: []
        };

        const ViewerCtor = window.bracketsViewer?.BracketsViewer || window.BracketsViewer;
        const onMatchClick = (match) => {
            const originalMatch = this.findMatch(match.id);
            if (originalMatch && window.TennisApp?.Scores?.showMatchStats) {
                window.TennisApp.Scores.showMatchStats(null, originalMatch, {
                    tournament: bracket.tournament_name,
                    round: this.getRoundDisplayName(originalMatch.round)
                });
            }
        };
        try {
            if (ViewerCtor) {
                if (!this[instanceKey]) {
                    this[instanceKey] = new ViewerCtor();
                }
                this[instanceKey].onMatchClicked = onMatchClick;
                this[instanceKey].render(data, {
                    selector: `#${containerId}`,
                    clear: true,
                    onMatchClick
                });
            } else if (window.bracketsViewer.render) {
                window.bracketsViewer.render(data, {
                    selector: `#${containerId}`,
                    clear: true,
                    onMatchClick
                });
            }
            const container = document.getElementById(containerId);
            if (container && container.children.length === 0) {
                container.innerHTML = this.renderColumnBracket(bracket);
                this.attachMatchListeners();
            } else {
                setTimeout(() => {
                    this.decorateViewerMatches(containerId);
                    this.attachViewerMatchClicks(containerId);
                }, 60);
            }
        } catch (error) {
            console.error('Bracket viewer render failed:', error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = this.renderColumnBracket(bracket);
                this.attachMatchListeners();
            }
        }
    },

    formatViewerSetBoxes(sets, playerKey) {
        return sets.map((set) => {
            const winner = set.p1 > set.p2 ? 'p1' : set.p2 > set.p1 ? 'p2' : null;
            const isWinner = winner === playerKey;
            const games = set[playerKey];
            const tbScore = set.tiebreak && typeof set.tiebreak[playerKey] !== 'undefined'
                ? `(${set.tiebreak[playerKey]})`
                : '';
            const tbHtml = tbScore ? `<sup class="tb">${tbScore}</sup>` : '';
            return `<span class="set-box ${isWinner ? 'win' : ''}">${games}${tbHtml}</span>`;
        }).join('');
    },

    decorateViewerMatches(containerId = 'bracketsViewerContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const matchEls = container.querySelectorAll('.match[data-match-id]');
        matchEls.forEach((matchEl) => {
            const matchId = matchEl.getAttribute('data-match-id');
            const match = this.findMatch(matchId);
            if (!match || !match.score || !Array.isArray(match.score.sets) || match.score.sets.length === 0) {
                return;
            }

            const participants = matchEl.querySelectorAll('.participant');
            if (participants.length < 2) return;

            const p1Result = participants[0].querySelector('.result');
            const p2Result = participants[1].querySelector('.result');
            const p1Html = this.formatViewerSetBoxes(match.score.sets, 'p1');
            const p2Html = this.formatViewerSetBoxes(match.score.sets, 'p2');

            if (p1Result) {
                p1Result.innerHTML = p1Html;
                p1Result.title = match.score.sets.map((set) => {
                    const tb = set.tiebreak ? `(${set.tiebreak.p1})` : '';
                    return `${set.p1}${tb}`;
                }).join(' ');
            }
            if (p2Result) {
                p2Result.innerHTML = p2Html;
                p2Result.title = match.score.sets.map((set) => {
                    const tb = set.tiebreak ? `(${set.tiebreak.p2})` : '';
                    return `${set.p2}${tb}`;
                }).join(' ');
            }
        });
    },

    attachViewerMatchClicks(containerId = 'bracketsViewerContainer') {
        const container = document.getElementById(containerId);
        if (!container || container.dataset.matchClickBound) return;
        container.dataset.matchClickBound = 'true';
        container.addEventListener('click', (event) => {
            const matchEl = event.target.closest('.match[data-match-id]');
            if (!matchEl) return;
            const matchId = matchEl.getAttribute('data-match-id');
            const match = this.findMatch(matchId);
            if (match && window.TennisApp?.Scores?.showMatchStats) {
                window.TennisApp.Scores.showMatchStats(null, match, {
                    tournament: this.currentBracket?.tournament_name,
                    round: this.getRoundDisplayName(match.round)
                });
            }
        });
    },

    getSlotPositions(roundIdx, matchNumber, drawSize) {
        const span = Math.pow(2, roundIdx + 1);
        const base = (matchNumber - 1) * span;
        const p1 = base + 1;
        const p2 = base + Math.max(1, span / 2);
        return { p1: Math.min(p1, drawSize), p2: Math.min(p2, drawSize) };
    },

    ensureFullscreenModal() {
        if (document.getElementById('bracketFullscreenModal')) return;
        const modal = document.createElement('div');
        modal.id = 'bracketFullscreenModal';
        modal.className = 'bracket-fullscreen-modal';
        modal.innerHTML = `
            <div class="bracket-fullscreen-panel">
                <div class="bracket-fullscreen-header">
                    <h3>Bracket Viewer</h3>
                    <div class="bracket-fullscreen-actions">
                        <button class="fullscreen-btn" type="button" aria-label="Enter fullscreen">
                            <i class="fas fa-expand"></i>
                        </button>
                        <button class="close-btn" type="button" aria-label="Close bracket viewer">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="bracket-fullscreen-body">
                    <div class="bracket-fullscreen-wrapper" id="bracketsViewerFullscreen"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close-btn')?.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        modal.querySelector('.fullscreen-btn')?.addEventListener('click', () => {
            const panel = modal.querySelector('.bracket-fullscreen-panel');
            if (panel?.requestFullscreen) {
                panel.requestFullscreen().catch(() => {});
            }
        });
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    },

    openFullscreenViewer() {
        const modal = document.getElementById('bracketFullscreenModal');
        if (!modal) return;
        modal.classList.add('active');
        if (this.currentBracket) {
            const wrapper = modal.querySelector('#bracketsViewerFullscreen');
            if (wrapper) {
                wrapper.innerHTML = this.renderColumnBracket(this.currentBracket);
                this.attachMatchListeners(wrapper);
                setTimeout(() => this.drawConnectors(wrapper), 80);
            }
        }
    },

    /**
     * Column-style bracket rendering (no external viewer)
     */
    renderColumnBracket(bracket) {
        const category = bracket.tournament_category || 'atp_250';
        const categoryClass = window.TennisApp?.Utils?.getCategoryClass
            ? window.TennisApp.Utils.getCategoryClass(category)
            : category.replace(/_/g, '-');
        const rounds = bracket.matches || [];
        if (!rounds.length) {
            return `<div class="placeholder-message"><i class="fas fa-exclamation-circle"></i><p>No bracket data available.</p></div>`;
        }

        const matchHeight = 80;
        const baseGap = 24;
        let prevGap = baseGap;
        let offset = 0;
        const roundLayouts = rounds.map((_, idx) => {
            if (idx === 0) {
                return { gap: baseGap, offset: 0 };
            }
            offset = offset + (matchHeight + prevGap) / 2;
            const gap = prevGap * 2 + matchHeight;
            prevGap = gap;
            return { gap, offset };
        });

        let html = `<div class="bracket-container ${categoryClass}"><div class="bracket-graph">`;
        html += `<svg class="bracket-connectors"></svg>`;
        
        // Calculate spacing based on number of matches in current and next round
        rounds.forEach((roundData, roundIdx) => {
            const nextRound = rounds[roundIdx + 1];
            const matchesInRound = roundData.matches ? roundData.matches.length : 0;
            const matchesInNext = nextRound && nextRound.matches ? nextRound.matches.length : 0;
            
            const layout = roundLayouts[roundIdx] || { gap: baseGap, offset: 0 };
            const roundName = this.getRoundDisplayName(roundData.round);
            const points = this.getPointsForRound(roundData.round, category);
            const prize = this.getPrizeMoneyForRound(roundData.round, category);
            
            html += `
                <div class="bracket-round">
                    <div class="round-header">
                        ${roundName}
                        ${points ? `<span class="round-points">${points} pts</span>` : ''}
                        ${prize ? `<span class="round-prize-money">${prize}</span>` : ''}
                    </div>
                    <div class="round-matches" style="gap:${layout.gap}px; padding-top:${layout.offset}px;">
            `;

            roundData.matches.forEach(match => {
                html += this.createMatchHTML(match, roundIdx, category);
            });

            html += '</div></div>';
        });
        
        html += '</div></div>';
        return html;
    },

    /**
     * Normalize API bracket shape to the UI format
     */
    normalizeBracketData(bracket, category, tournamentName, tournamentId) {
        const normalized = { ...bracket };

        // Ensure tournament metadata
        normalized.tournament_id = normalized.tournament_id || tournamentId;
        normalized.tournament_name = tournamentName || normalized.tournament_name || `Tournament ${tournamentId}`;
        normalized.tournament_category = normalized.tournament_category || category || 'atp_250';

        // If matches is already in round-grouped format, keep it
        if (Array.isArray(normalized.matches) && normalized.matches.length > 0 && normalized.matches[0]?.matches) {
            return normalized;
        }

        // If matches is a flat list, group by round
        if (Array.isArray(normalized.matches) && normalized.matches.length > 0) {
            const roundsOrder = Array.isArray(normalized.rounds) && normalized.rounds.length > 0
                ? normalized.rounds
                : Array.from(new Set(normalized.matches.map(m => m.round))).filter(Boolean);

            const grouped = roundsOrder.map(roundName => {
                const roundMatches = normalized.matches
                    .filter(m => m.round === roundName)
                    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));
                return { round: roundName, matches: roundMatches };
            });

            normalized.matches = grouped;
            return normalized;
        }

        return normalized;
    },

    /**
     * Fallback bracket rendering (simple list view)
     */
    renderFallbackBracket(bracket) {
        const rounds = bracket.matches || [];
        if (!rounds.length) {
            return `<div class="placeholder-message"><i class="fas fa-exclamation-circle"></i><p>No bracket data available.</p></div>`;
        }

        let html = '<div class="fallback-bracket">';
        rounds.forEach(roundData => {
            html += `
                <div class="fallback-round">
                    <h4>${this.getRoundDisplayName(roundData.round)}</h4>
                    <div class="fallback-matches">
            `;
            roundData.matches.forEach(match => {
                const p1 = match.player1?.name || 'TBD';
                const p2 = match.player2?.name || 'TBD';
                const score = match.score?.sets ? match.score.sets.map(s => `${s.p1}-${s.p2}`).join(' ') : '';
                html += `
                    <div class="fallback-match">
                        <span class="fallback-player">${p1}</span>
                        <span class="fallback-vs">vs</span>
                        <span class="fallback-player">${p2}</span>
                        ${score ? `<span class="fallback-score">${score}</span>` : ''}
                    </div>
                `;
            });
            html += '</div></div>';
        });
        html += '</div>';
        return html;
    },

    /**
     * Render Finals group stage
     */
    renderFinalsGroups(groups) {
        const { Utils } = window.TennisApp;
        
        let html = '<div class="finals-groups"><h4>Group Stage (200 pts per win)</h4><div class="groups-container">';
        
        groups.forEach((group, idx) => {
            html += `
                <div class="group-card">
                    <div class="group-name">${group.name}</div>
            `;
            
            group.players.forEach((player, playerIdx) => {
                const qualified = playerIdx < 2;
                html += `
                    <div class="group-player ${qualified ? 'qualified' : ''}">
                        <img src="${Utils.getPlayerImage(player.id)}" alt="">
                        ${Utils.getFlag(player.country)} ${player.name}
                        ${qualified ? '<i class="fas fa-check" style="margin-left:auto; color: var(--accent-success);"></i>' : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        html += '</div></div>';
        return html;
    },

    /**
     * Get display name for round
     */
    getRoundDisplayName(round) {
        const displayNames = {
            'R128': 'Round of 128',
            'R64': 'Round of 64',
            'R32': 'Round of 32',
            'R16': 'Round of 16',
            'QF': 'Quarter Finals',
            'SF': 'Semi Finals',
            'F': 'Final',
            'RR': 'Round Robin'
        };
        return displayNames[round] || round;
    },

    getDrawMeta(drawSize = 32) {
        const seeds = drawSize >= 128 ? 32 : drawSize >= 64 ? 16 : 8;
        const qualifiers = Math.max(2, Math.round(drawSize * 0.125));
        const wildcards = Math.max(2, Math.round(drawSize * 0.03125));
        return { seeds, qualifiers, wildcards };
    },

    getSurfaceClass(surface) {
        const lower = surface.toLowerCase();
        if (lower.includes('clay')) return 'surface-clay';
        if (lower.includes('grass')) return 'surface-grass';
        if (lower.includes('indoor')) return 'surface-indoor';
        return 'surface-hard';
    },

    /**
     * Create match HTML for bracket
     */
    createMatchHTML(match, roundIdx, category) {
        const p1 = match.player1;
        const p2 = match.player2;
        const resolvedWinner = this.resolveMatchWinner(match, category);
        const isP1Winner = resolvedWinner && p1 && resolvedWinner.id === p1.id;
        const isP2Winner = resolvedWinner && p2 && resolvedWinner.id === p2.id;

        // Build set score boxes
        let p1SetScores = [];
        let p2SetScores = [];
        let tooltipSets = '';
        
        if (match.score && match.score.sets) {
            match.score.sets.forEach((set, idx) => {
                const p1Wins = set.p1 > set.p2;
                const p2Wins = set.p2 > set.p1;
                let p1Box = `<span class="set-box ${p1Wins ? 'bold' : ''}">${set.p1}${set.tiebreak ? `<sup class="tb">(${set.tiebreak.p1})</sup>` : ''}</span>`;
                let p2Box = `<span class="set-box ${p2Wins ? 'bold' : ''}">${set.p2}${set.tiebreak ? `<sup class="tb">(${set.tiebreak.p2})</sup>` : ''}</span>`;
                p1SetScores.push(p1Box);
                p2SetScores.push(p2Box);
                tooltipSets += `Set ${idx + 1}: ${set.p1}-${set.p2}${set.tiebreak ? ` (tb ${set.tiebreak.p1}-${set.tiebreak.p2})` : ''}\n`;
            });
        }

        const tooltipText = p1 && p2
            ? `${p1.name} vs ${p2.name}${tooltipSets ? `\n${tooltipSets.trim()}` : ''}`
            : '';

        const setsHTML = p1SetScores.length > 0
            ? `<div class="bracket-sets">${p1SetScores.join('')}</div><div class="bracket-sets">${p2SetScores.join('')}</div>`
            : '';

        const p1DisplayName = p1 ? `${p1.seed ? `[${p1.seed}] ` : ''}${p1.name}` : 'TBD';
        const p2DisplayName = p2 ? `${p2.seed ? `[${p2.seed}] ` : ''}${p2.name}` : 'TBD';

        return `
            <div class="bracket-match clickable ${match.status}" data-match-id="${match.id}" data-round="${match.round}" data-match-number="${match.match_number}" data-points="${match.points || this.getPointsForRound(match.round, category)}">
                <div class="match-content">
                    <div class="player-row ${isP1Winner ? 'winner' : ''}">
                        <span class="player-name">${p1DisplayName}</span>
                        ${setsHTML ? `<div class="sets-group">${p1SetScores.join('')}</div>` : ''}
                    </div>
                    <div class="player-row ${isP2Winner ? 'winner' : ''}">
                        <span class="player-name">${p2DisplayName}</span>
                        ${setsHTML ? `<div class="sets-group">${p2SetScores.join('')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get prize money for a round
     */
    getPrizeMoneyForRound(round, category) {
        const prizes = this.prizeMoneyByRound[category];
        return prizes ? prizes[round] || '' : '';
    },

    /**
     * Attach click listeners for match modal
     */
    attachMatchListeners(root = document) {
        const container = root.querySelector('.bracket-graph');
        if (!container || container.dataset.matchClickBound) return;
        container.dataset.matchClickBound = 'true';
        container.addEventListener('click', (event) => {
            const matchEl = event.target.closest('.bracket-match[data-match-id]');
            if (!matchEl) return;
            const matchId = matchEl.dataset.matchId;
            const points = matchEl.dataset.points;
            const match = this.findMatch(matchId);
            if (match && match.player1 && match.player2) {
                this.showMatchModal(match, points);
            }
        });
    },

    /**
     * Draw connector lines to show knockout flow
     */
    drawConnectors(root = document) {
        const container = root.querySelector('.bracket-graph');
        const svg = container?.querySelector('.bracket-connectors');
        if (!container || !svg || !this.currentBracket) return;

        const containerRect = container.getBoundingClientRect();
        svg.setAttribute('width', container.scrollWidth);
        svg.setAttribute('height', container.scrollHeight);
        svg.innerHTML = '';

        const rounds = this.currentBracket.matches;

        rounds.forEach((roundData, roundIdx) => {
            const nextRound = rounds[roundIdx + 1];
            if (!nextRound) return;

            roundData.matches.forEach((match, idx) => {
                const fromEl = container.querySelector(`.bracket-match[data-match-id="${match.id}"]`);
                const targetIdx = Math.floor(idx / 2);
                const nextMatch = nextRound.matches[targetIdx];
                const toEl = nextMatch ? container.querySelector(`.bracket-match[data-match-id="${nextMatch.id}"]`) : null;
                
                if (!fromEl || !toEl) return;

                const fromBox = fromEl.getBoundingClientRect();
                const toBox = toEl.getBoundingClientRect();

                const startX = fromBox.right - containerRect.left;
                const startY = fromBox.top + fromBox.height / 2 - containerRect.top;
                const endX = toBox.left - containerRect.left;
                const endY = toBox.top + toBox.height / 2 - containerRect.top;
                const midX = (startX + endX) / 2;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M${startX} ${startY} L${midX} ${startY} L${midX} ${endY} L${endX} ${endY}`);
                path.setAttribute('class', 'connector-path');
                svg.appendChild(path);
            });
        });
    },

    bindConnectorResize() {
        if (this.connectorResizeBound) return;
        this.connectorResizeBound = true;
        window.addEventListener('resize', () => {
            clearTimeout(this.connectorResizeTimer);
            this.connectorResizeTimer = setTimeout(() => {
                const mainRoot = document.getElementById('tournamentBracket');
                if (mainRoot) {
                    this.drawConnectors(mainRoot);
                }
                const modal = document.getElementById('bracketFullscreenModal');
                if (modal && modal.classList.contains('active')) {
                    this.drawConnectors(modal);
                }
            }, 120);
        });
    },

    /**
     * Find match by ID
     */
    findMatch(matchId) {
        if (!this.currentBracket) return null;
        
        for (const roundData of this.currentBracket.matches) {
            const match = roundData.matches.find(m => m.id == matchId);
            if (match) return match;
        }
        return null;
    },

    /**
     * Show match modal
     */
    showMatchModal(match, points) {
        const { Utils } = window.TennisApp;

        // Use the detailed match stats modal for bracket matches
        if (window.TennisApp?.Scores?.showMatchStats) {
            window.TennisApp.Scores.showMatchStats(null, match, {
                tournament: this.currentBracket?.tournament_name,
                round: this.getRoundDisplayName(match.round)
            });
            return;
        }

        const modal = document.getElementById('matchModal');
        
        const p1 = match.player1;
        const p2 = match.player2;
        const resolvedWinner = this.resolveMatchWinner(match, this.currentBracket?.tournament_category);
        const isP1Winner = resolvedWinner && p1 && resolvedWinner.id === p1.id;
        const isP2Winner = resolvedWinner && p2 && resolvedWinner.id === p2.id;
        
        // Format score
        let scoreText = 'Not started';
        if (match.score && match.score.sets) {
            scoreText = match.score.sets.map(s => `${s.p1}-${s.p2}`).join('  ');
        }

        // Update modal content
        modal.querySelector('.modal-tournament').textContent = this.currentBracket.tournament_name;
        modal.querySelector('.modal-round').textContent = this.getRoundDisplayName(match.round);
        modal.querySelector('.modal-round-points').textContent = points > 0 ? `Winner: ${points} pts` : '';
        
        // Player 1
        const p1El = modal.querySelector('#modalPlayer1');
        p1El.className = `modal-player ${isP1Winner ? 'winner' : ''}`;
        p1El.querySelector('.modal-player-img').src = Utils.getPlayerImage(p1.id);
        p1El.querySelector('.modal-player-name').innerHTML = `${Utils.getFlag(p1.country)} ${p1.name}`;
        p1El.querySelector('.modal-player-details').textContent = `Rank: ${p1.rank}${p1.seed ? ` [${p1.seed}]` : ''}`;
        
        // Player 2
        const p2El = modal.querySelector('#modalPlayer2');
        p2El.className = `modal-player ${isP2Winner ? 'winner' : ''}`;
        p2El.querySelector('.modal-player-img').src = Utils.getPlayerImage(p2.id);
        p2El.querySelector('.modal-player-name').innerHTML = `${Utils.getFlag(p2.country)} ${p2.name}`;
        p2El.querySelector('.modal-player-details').textContent = `Rank: ${p2.rank}${p2.seed ? ` [${p2.seed}]` : ''}`;
        
        // Score
        modal.querySelector('.modal-score').textContent = scoreText;

        // Show modal
        modal.classList.add('visible');

        // Close button handler
        const closeBtn = modal.querySelector('#modalClose');
        const closeHandler = () => {
            modal.classList.remove('visible');
            closeBtn.removeEventListener('click', closeHandler);
        };
        closeBtn.addEventListener('click', closeHandler);

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
            }
        });
    },

    /**
     * Show champion celebration modal
     */
    showChampionCelebration(tournamentName, winner, category, points) {
        const { Utils } = window.TennisApp;
        const modal = document.getElementById('championModal');
        const content = document.getElementById('championContent');

        const prizeMoney = this.getPrizeMoneyForRound('W', category);

        content.innerHTML = `
            <div class="champion-trophy">
                <i class="fas fa-trophy"></i>
            </div>
            <div class="champion-title">🎉 CHAMPION! 🎉</div>
            <div class="champion-tournament">${tournamentName}</div>
            <div class="champion-player">
                <img src="${Utils.getPlayerImage(winner.id)}" alt="${winner.name}">
                <div class="champion-player-name">${Utils.getFlag(winner.country)} ${winner.name}</div>
                <div class="champion-player-rank">World #${winner.rank}</div>
            </div>
            <div class="champion-prizes">
                <div class="champion-prize-item">
                    <i class="fas fa-medal"></i>
                    <span>${points} Points</span>
                </div>
                <div class="champion-prize-item">
                    <i class="fas fa-dollar-sign"></i>
                    <span>${prizeMoney}</span>
                </div>
            </div>
            <div class="champion-confetti">
                ${'<div class="confetti"></div>'.repeat(50)}
            </div>
        `;

        modal.classList.add('active');
    },

    /**
     * Close champion modal
     */
    closeChampionModal() {
        const modal = document.getElementById('championModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
};

// Export module
window.BracketModule = BracketModule;
