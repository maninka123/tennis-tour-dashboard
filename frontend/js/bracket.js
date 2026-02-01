/**
 * Tennis Live Dashboard - Tournament Bracket Module
 * Handles rendering of tournament draws/brackets with match details
 */

const BracketModule = {
    /**
     * Current bracket data
     */
    currentBracket: null,

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
                    winner = Math.random() > 0.3 
                        ? (p1 && p2 && p1.rank < p2.rank ? p1 : p2) 
                        : (p1 && p2 && p1.rank >= p2.rank ? p1 : p2);
                    score = this.generateScore();
                } else if (roundIdx === displayRounds.length - 2) {
                    // Some in progress
                    if (Math.random() > 0.5) {
                        status = 'finished';
                        winner = Math.random() > 0.5 ? p1 : p2;
                        score = this.generateScore();
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
     * Generate random score
     */
    generateScore() {
        const sets = [];
        const maxSets = Math.random() > 0.5 ? 3 : 2;
        
        for (let i = 0; i < maxSets; i++) {
            const winner = Math.random() > 0.5;
            if (winner) {
                sets.push({ p1: 6, p2: Math.floor(Math.random() * 5) });
            } else {
                sets.push({ p1: Math.floor(Math.random() * 5), p2: 6 });
            }
        }
        
        return { sets };
    },

    /**
     * Load and render bracket
     */
    async loadAndRender(tournamentId, category) {
        const { DOM, API } = window.TennisApp;
        
        // Show loading
        DOM.tournamentBracket.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading tournament draw...</span>
            </div>
        `;

        try {
            // Try to fetch from API
            let bracket = await API.getTournamentBracket(tournamentId).catch(() => null);
            
            // Fall back to demo data
            if (!bracket) {
                bracket = this.generateDemoBracket(tournamentId, category);
            }

            this.currentBracket = bracket;
            this.render();
        } catch (error) {
            console.error('Error loading bracket:', error);
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
        
        // Check if tournament is completed (has a champion)
        const finalMatch = bracket.matches[bracket.matches.length - 1]?.matches[0];
        const hasChampion = finalMatch && finalMatch.winner;
        
        let html = `
            <div class="bracket-info">
                <h3>${bracket.tournament_name || 'Tournament Draw'}</h3>
                <span class="bracket-draw-size">${bracket.draw_size} Players</span>
                ${hasChampion ? `
                    <button class="champion-btn" onclick="window.TennisApp.BracketModule.showChampionCelebration(
                        '${bracket.tournament_name}',
                        ${JSON.stringify(finalMatch.winner).replace(/"/g, '&quot;')},
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

        html += '<div class="bracket-container">';

        // Render each round
        bracket.matches.forEach((roundData, roundIdx) => {
            const roundPoints = this.getPointsForRound(roundData.round, category);
            const prizeMoney = this.getPrizeMoneyForRound(roundData.round, category);
            html += `
                <div class="bracket-round" data-round="${roundData.round}">
                    <div class="round-header">
                        ${this.getRoundDisplayName(roundData.round)}
                        ${roundPoints > 0 ? `<span class="round-points">${roundPoints} pts</span>` : ''}
                        ${prizeMoney ? `<span class="round-prize-money">${prizeMoney}</span>` : ''}
                    </div>
                    <div class="round-matches">
            `;

            roundData.matches.forEach(match => {
                html += this.createMatchHTML(match, roundIdx, category);
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';

        DOM.tournamentBracket.innerHTML = html;
        
        // Add event listeners for match click
        this.attachMatchListeners();
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

    /**
     * Create match HTML for bracket
     */
    createMatchHTML(match, roundIdx, category) {
        const { Utils } = window.TennisApp;
        
        const p1 = match.player1;
        const p2 = match.player2;
        const isP1Winner = match.winner && p1 && match.winner.id === p1.id;
        const isP2Winner = match.winner && p2 && match.winner.id === p2.id;

        // Format score
        let scoreHTML = '';
        if (match.score && match.score.sets) {
            scoreHTML = match.score.sets.map(s => `${s.p1}-${s.p2}`).join(' ');
        }

        return `
            <div class="bracket-match clickable ${match.status}" data-match-id="${match.id}" data-points="${match.points || this.getPointsForRound(match.round, category)}">
                <div class="bracket-player ${isP1Winner ? 'winner' : ''}">
                    ${p1 ? `
                        <img class="bracket-player-img" src="${Utils.getPlayerImage(p1.id)}" alt="">
                        ${p1.seed ? `<span class="bracket-seed">[${p1.seed}]</span>` : ''}
                        <span class="bracket-player-name">${p1.name}</span>
                        <span class="bracket-player-rank">${p1.rank}</span>
                    ` : '<span class="bracket-player-name tbd">TBD</span>'}
                    ${isP1Winner ? `<span class="bracket-score">${scoreHTML}</span>` : ''}
                </div>
                <div class="bracket-player ${isP2Winner ? 'winner' : ''}">
                    ${p2 ? `
                        <img class="bracket-player-img" src="${Utils.getPlayerImage(p2.id)}" alt="">
                        ${p2.seed ? `<span class="bracket-seed">[${p2.seed}]</span>` : ''}
                        <span class="bracket-player-name">${p2.name}</span>
                        <span class="bracket-player-rank">${p2.rank}</span>
                    ` : '<span class="bracket-player-name tbd">TBD</span>'}
                    ${isP2Winner ? `<span class="bracket-score">${scoreHTML}</span>` : ''}
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
    attachMatchListeners() {
        const matches = document.querySelectorAll('.bracket-match.clickable');
        
        matches.forEach(matchEl => {
            matchEl.addEventListener('click', (e) => {
                const matchId = matchEl.dataset.matchId;
                const points = matchEl.dataset.points;
                const match = this.findMatch(matchId);
                
                if (match && match.player1 && match.player2) {
                    this.showMatchModal(match, points);
                }
            });
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
        const modal = document.getElementById('matchModal');
        
        const p1 = match.player1;
        const p2 = match.player2;
        const isP1Winner = match.winner && p1 && match.winner.id === p1.id;
        const isP2Winner = match.winner && p2 && match.winner.id === p2.id;
        
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
