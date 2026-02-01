/**
 * Tennis Live Dashboard - Live Scores Module
 * Handles rendering and updating of live and recent match scores
 */

const ScoresModule = {
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
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                location: 'Melbourne, Australia',
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
                tournament: 'Dubai Championships',
                tournament_category: 'atp_500',
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
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
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
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
                round: 'QF',
                player1: { id: 2, name: 'Carlos Alcaraz', country: 'ESP', rank: 2 },
                player2: { id: 8, name: 'Stefanos Tsitsipas', country: 'GRE', rank: 8 },
                winner: 1,
                final_score: { sets: [{ p1: 7, p2: 6 }, { p1: 6, p2: 4 }, { p1: 6, p2: 2 }] },
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
                final_score: { sets: [{ p1: 4, p2: 6 }, { p1: 6, p2: 7 }] },
                status: 'finished'
            }
        ],
        wta: [
            {
                id: 'recent_wta_1',
                tour: 'WTA',
                tournament: 'Australian Open',
                tournament_category: 'grand_slam',
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
     * Render live scores
     */
    renderLiveScores() {
        const { AppState, Utils, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Get data (use demo if empty)
        let matches = AppState.liveScores[tour];
        if (!matches || matches.length === 0) {
            matches = this.demoLiveMatches[tour] || [];
        }

        if (matches.length === 0) {
            DOM.liveScoresWrapper.innerHTML = `
                <div class="no-matches-message">
                    <i class="fas fa-moon"></i>
                    <p>No live matches at the moment</p>
                </div>
            `;
            return;
        }

        DOM.liveScoresWrapper.innerHTML = matches.map(match => this.createMatchCard(match, true)).join('');
    },

    /**
     * Render recent matches
     */
    renderRecentMatches() {
        const { AppState, Utils, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Get data (use demo if empty)
        let matches = AppState.recentMatches[tour];
        if (!matches || matches.length === 0) {
            matches = this.demoRecentMatches[tour] || [];
        }

        if (matches.length === 0) {
            DOM.recentMatchesWrapper.innerHTML = `
                <div class="no-matches-message">
                    <p>No recent matches</p>
                </div>
            `;
            return;
        }

        DOM.recentMatchesWrapper.innerHTML = matches.map(match => this.createMatchCard(match, false)).join('');
    },

    /**
     * Create a match card HTML
     */
    createMatchCard(match, isLive) {
        const { Utils } = window.TennisApp;
        const categoryClass = Utils.getCategoryClass(match.tournament_category);
        
        const player1Score = this.formatPlayerScore(match, 1, isLive);
        const player2Score = this.formatPlayerScore(match, 2, isLive);
        
        const p1IsWinner = !isLive && match.winner === 1;
        const p2IsWinner = !isLive && match.winner === 2;
        const p1Serving = isLive && match.serving === 1;
        const p2Serving = isLive && match.serving === 2;

        return `
            <div class="match-card ${categoryClass}" data-match-id="${match.id}">
                <div class="match-header">
                    <div class="tournament-info">
                        <div class="tournament-name">${match.tournament}</div>
                        <div class="match-round">${match.round}</div>
                    </div>
                    ${isLive ? `
                        <div class="live-badge">
                            <span class="live-dot"></span>
                            LIVE
                        </div>
                    ` : `
                        <div class="finished-badge">Completed</div>
                    `}
                </div>
                <div class="match-players">
                    <div class="player-row ${p1IsWinner ? 'winner' : ''} ${p1Serving ? 'serving' : ''}">
                        <img class="player-img" src="${Utils.getPlayerImage(match.player1.id)}" alt="${match.player1.name}">
                        <div class="player-info">
                            <div class="player-name">
                                <span class="player-rank-badge">[${match.player1.rank}]</span>
                                <span class="country-flag">${Utils.getFlag(match.player1.country)}</span>
                                ${Utils.formatPlayerName(match.player1.name)}
                            </div>
                        </div>
                        <div class="player-score">${player1Score}</div>
                    </div>
                    <div class="player-row ${p2IsWinner ? 'winner' : ''} ${p2Serving ? 'serving' : ''}">
                        <img class="player-img" src="${Utils.getPlayerImage(match.player2.id)}" alt="${match.player2.name}">
                        <div class="player-info">
                            <div class="player-name">
                                <span class="player-rank-badge">[${match.player2.rank}]</span>
                                <span class="country-flag">${Utils.getFlag(match.player2.country)}</span>
                                ${Utils.formatPlayerName(match.player2.name)}
                            </div>
                        </div>
                        <div class="player-score">${player2Score}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Format player score display
     */
    formatPlayerScore(match, playerNum, isLive) {
        const score = isLive ? match.score : match.final_score;
        if (!score || !score.sets) return '';

        let html = '';
        
        // Set scores
        score.sets.forEach((set, idx) => {
            const games = playerNum === 1 ? set.p1 : set.p2;
            const opponentGames = playerNum === 1 ? set.p2 : set.p1;
            const isCurrentSet = isLive && idx === score.sets.length - 1;
            
            // Check for tiebreak (7-6 or 6-7)
            const isTiebreak = (games === 7 && opponentGames === 6) || (games === 6 && opponentGames === 7);
            
            if (isTiebreak && set.tiebreak) {
                const tiebreakScore = playerNum === 1 ? set.tiebreak.p1 : set.tiebreak.p2;
                html += `<span class="set-score ${isCurrentSet ? 'current' : ''}">${games}<sup>${tiebreakScore}</sup></span>`;
            } else {
                html += `<span class="set-score ${isCurrentSet ? 'current' : ''}">${games}</span>`;
            }
        });

        // Current game score (only for live matches)
        if (isLive && score.current_game) {
            const gameScore = playerNum === 1 ? score.current_game.p1 : score.current_game.p2;
            html += `<span class="game-score">${gameScore}</span>`;
        }

        return html;
    },

    /**
     * Update a single match score (for real-time updates)
     */
    updateMatchScore(matchId, newScore) {
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        if (!matchCard) return;

        // Update player scores
        const playerRows = matchCard.querySelectorAll('.player-row');
        if (playerRows.length >= 2) {
            playerRows[0].querySelector('.player-score').innerHTML = this.formatPlayerScore({ score: newScore }, 1, true);
            playerRows[1].querySelector('.player-score').innerHTML = this.formatPlayerScore({ score: newScore }, 2, true);
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
    showMatchStats(matchId) {
        const { AppState, Utils, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Find match in live or recent matches
        let match = AppState.liveScores[tour]?.find(m => m.id === matchId);
        if (!match) {
            match = AppState.recentMatches[tour]?.find(m => m.id === matchId);
        }
        
        // Also check demo data
        if (!match) {
            match = this.demoLiveMatches[tour]?.find(m => m.id === matchId) ||
                   this.demoRecentMatches[tour]?.find(m => m.id === matchId);
        }
        
        if (!match) return;
        
        // Generate match statistics (demo data)
        const stats = this.generateMatchStats(match);
        
        const modal = document.getElementById('matchStatsModal');
        const content = document.getElementById('matchStatsContent');
        
        const isLive = match.status === 'live';
        const score = isLive ? match.score : match.final_score;
        
        content.innerHTML = `
            <div class="match-stats-header">
                <div class="match-stats-player ${match.winner === 1 ? 'winner' : ''}">
                    <img src="${Utils.getPlayerImage(match.player1.id)}" alt="${match.player1.name}">
                    <div>
                        <div class="match-stats-player-name">${match.player1.name}</div>
                        <div class="match-stats-player-country">${Utils.getFlag(match.player1.country)} ${match.player1.country}</div>
                    </div>
                </div>
                <div class="match-stats-vs">
                    <div class="match-stats-score">
                        <div class="sets">${score.sets.map(s => s.p1).join(' - ')}</div>
                        ${stats.duration ? `<div class="duration">${stats.duration}</div>` : ''}
                    </div>
                </div>
                <div class="match-stats-player ${match.winner === 2 ? 'winner' : ''}">
                    <img src="${Utils.getPlayerImage(match.player2.id)}" alt="${match.player2.name}">
                    <div>
                        <div class="match-stats-player-name">${match.player2.name}</div>
                        <div class="match-stats-player-country">${Utils.getFlag(match.player2.country)} ${match.player2.country}</div>
                    </div>
                </div>
            </div>
            
            <div class="stats-grid">
                ${this.createStatRow('Aces', stats.aces.p1, stats.aces.p2)}
                ${this.createStatRow('Double Faults', stats.doubleFaults.p1, stats.doubleFaults.p2)}
                ${this.createStatRow('1st Serve %', stats.firstServe.p1 + '%', stats.firstServe.p2 + '%', stats.firstServe.p1, stats.firstServe.p2)}
                ${this.createStatRow('1st Serve Points Won', stats.firstServeWon.p1 + '%', stats.firstServeWon.p2 + '%', stats.firstServeWon.p1, stats.firstServeWon.p2)}
                ${this.createStatRow('2nd Serve Points Won', stats.secondServeWon.p1 + '%', stats.secondServeWon.p2 + '%', stats.secondServeWon.p1, stats.secondServeWon.p2)}
                ${this.createStatRow('Break Points Won', `${stats.breakPointsWon.p1}/${stats.breakPointsTotal.p1}`, `${stats.breakPointsWon.p2}/${stats.breakPointsTotal.p2}`)}
                ${this.createStatRow('Winners', stats.winners.p1, stats.winners.p2)}
                ${this.createStatRow('Unforced Errors', stats.unforcedErrors.p1, stats.unforcedErrors.p2)}
                ${this.createStatRow('Total Points Won', stats.totalPoints.p1, stats.totalPoints.p2, stats.totalPoints.p1, stats.totalPoints.p2)}
            </div>
        `;
        
        modal.classList.add('active');
    },

    /**
     * Create a statistics row
     */
    createStatRow(label, val1, val2, num1 = null, num2 = null) {
        // If num1 and num2 are provided, show bar graph
        if (num1 !== null && num2 !== null) {
            const total = num1 + num2;
            const percent1 = (num1 / total * 100).toFixed(1);
            const percent2 = (num2 / total * 100).toFixed(1);
            
            return `
                <div class="stat-row">
                    <div class="stat-value left">${val1}</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-value right">${val2}</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill left" style="width: ${percent1}%"></div>
                        <div class="stat-bar-fill right" style="width: ${percent2}%"></div>
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

    /**
     * Generate demo match statistics
     */
    generateMatchStats(match) {
        // Generate realistic demo statistics
        return {
            duration: '2h 34m',
            aces: { p1: Math.floor(Math.random() * 12) + 3, p2: Math.floor(Math.random() * 12) + 3 },
            doubleFaults: { p1: Math.floor(Math.random() * 5), p2: Math.floor(Math.random() * 5) },
            firstServe: { p1: Math.floor(Math.random() * 15) + 55, p2: Math.floor(Math.random() * 15) + 55 },
            firstServeWon: { p1: Math.floor(Math.random() * 15) + 65, p2: Math.floor(Math.random() * 15) + 65 },
            secondServeWon: { p1: Math.floor(Math.random() * 20) + 40, p2: Math.floor(Math.random() * 20) + 40 },
            breakPointsWon: { p1: Math.floor(Math.random() * 5) + 1, p2: Math.floor(Math.random() * 5) + 1 },
            breakPointsTotal: { p1: Math.floor(Math.random() * 8) + 4, p2: Math.floor(Math.random() * 8) + 4 },
            winners: { p1: Math.floor(Math.random() * 20) + 20, p2: Math.floor(Math.random() * 20) + 20 },
            unforcedErrors: { p1: Math.floor(Math.random() * 15) + 15, p2: Math.floor(Math.random() * 15) + 15 },
            totalPoints: { p1: Math.floor(Math.random() * 30) + 80, p2: Math.floor(Math.random() * 30) + 80 }
        };
    },

    /**
     * Close match statistics modal
     */
    closeMatchStats() {
        const modal = document.getElementById('matchStatsModal');
        modal.classList.remove('active');
    }
};

// Export module
window.ScoresModule = ScoresModule;
