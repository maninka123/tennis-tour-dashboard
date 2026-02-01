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
     * Render upcoming matches
     */
    renderUpcomingMatches() {
        const { AppState, Utils } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Get data (use demo if empty)
        let matches = AppState.upcomingMatches[tour];
        if (!matches || matches.length === 0) {
            matches = this.demoUpcomingMatches[tour] || [];
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
            upcomingSection.innerHTML = `
                <div class="section-header">
                    <h2><i class="fas fa-calendar"></i> Upcoming Matches</h2>
                </div>
                <div class="no-matches-message">
                    <p>No upcoming matches in the next 2 days</p>
                </div>
            `;
            return;
        }

        const upcomingHTML = `
            <div class="section-header">
                <h2><i class="fas fa-calendar"></i> Upcoming Matches (Next 2 Days)</h2>
            </div>
            <div class="upcoming-matches-container">
                ${matches.map(match => this.createUpcomingMatchCard(match)).join('')}
            </div>
        `;

        upcomingSection.innerHTML = upcomingHTML;
        this.attachUpcomingInsights(matches);
    },

    attachUpcomingInsights(matches) {
        const cards = document.querySelectorAll('.upcoming-match-card');
        cards.forEach(card => {
            const matchId = card.dataset.matchId;
            const match = matches.find(m => m.id === matchId);
            if (!match) return;
            const edgeBar = card.querySelector('.edge-bar');
            if (!edgeBar) return;
            edgeBar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEdgeInsights(match);
            });
        });
    },

    showUpcomingInsights(matchId) {
        const { AppState } = window.TennisApp;
        const tour = AppState.currentTour;
        const match = AppState.upcomingMatches[tour]?.find(m => m.id === matchId)
            || this.demoUpcomingMatches[tour]?.find(m => m.id === matchId);
        if (!match) return;

        const winEdge = this.calculateWinEdge(match.player1, match.player2);
        const p1Fav = winEdge.p1 >= winEdge.p2;
        const favorite = p1Fav ? match.player1 : match.player2;
        const underdog = p1Fav ? match.player2 : match.player1;
        const favPct = p1Fav ? winEdge.p1 : winEdge.p2;
        const dogPct = 100 - favPct;
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const categoryClass = window.TennisApp.Utils.getCategoryClass(match.tournament_category);

        let modal = document.getElementById('upcomingInsightsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'upcomingInsightsModal';
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal-content edge-insights-modal">
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
                    ${match.round ? `<span class="match-stats-round-tag">${match.round}</span>` : ''}
                </div>
            </div>
            <div class="upcoming-preview-hero">
                <div class="upcoming-preview-scoreline">
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
                <div class="edge-names">
                    <span class="edge-name left">${window.TennisApp.Utils.formatPlayerName(match.player1.name)}</span>
                    <span class="edge-name right">${window.TennisApp.Utils.formatPlayerName(match.player2.name)}</span>
                </div>
            </div>
            <p><strong>Prediction:</strong> ${favorite.name} is favored (${favPct}%) over ${underdog.name} (${dogPct}%).</p>
            <ul class="edge-insights-list">
                <li>Current form: ${winEdge.formNote}</li>
                <li>H2H snapshot: ${winEdge.h2hText}</li>
                <li>Ranking edge: #${match.player1.rank} vs #${match.player2.rank}</li>
                <li>Momentum note: ${winEdge.reason}</li>
            </ul>
        `;

        modal.classList.add('active');
    },

    showEdgeInsights(match) {
        const winEdge = this.calculateWinEdge(match.player1, match.player2);
        let modal = document.getElementById('edgeInsightsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edgeInsightsModal';
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal-content edge-insights-modal">
                    <div class="modal-header">
                        <h3>Win Edge Insights</h3>
                        <button class="close-modal" id="edgeInsightsClose">&times;</button>
                    </div>
                    <div class="modal-body" id="edgeInsightsContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'edgeInsightsModal') {
                    modal.classList.remove('active');
                }
            });
            modal.querySelector('#edgeInsightsClose').addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        const content = document.getElementById('edgeInsightsContent');
        content.innerHTML = `
            <div class="edge-insights-hero">
                <div class="edge-player">
                    <img src="${window.TennisApp.Utils.getPlayerImage(match.player1)}" alt="${match.player1.name}">
                    <div>${match.player1.name}</div>
                    <div class="edge-pct">${winEdge.p1}%</div>
                </div>
                <div class="edge-vs">VS</div>
                <div class="edge-player">
                    <img src="${window.TennisApp.Utils.getPlayerImage(match.player2)}" alt="${match.player2.name}">
                    <div>${match.player2.name}</div>
                    <div class="edge-pct">${winEdge.p2}%</div>
                </div>
            </div>
            <ul class="edge-insights-list">
                <li>${winEdge.reason}</li>
                <li>H2H record: ${winEdge.h2hText}</li>
                <li>Recent form: ${winEdge.formNote}</li>
                <li>Rank edge: #${match.player1.rank} vs #${match.player2.rank}</li>
                <li>Surface trend: ${match.tournament_category?.replace('_',' ')} (demo)</li>
            </ul>
        `;

        modal.classList.add('active');
    },

    /**
     * Create an upcoming match card (simplified - only player names)
     */
    createUpcomingMatchCard(match) {
        const { Utils } = window.TennisApp;
        const categoryClass = Utils.getCategoryClass(match.tournament_category);
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const surfaceClass = this.getSurfaceClass(match);
        const scheduledTime = new Date(match.scheduled_time);
        const timeStr = scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = scheduledTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const winEdge = this.calculateWinEdge(match.player1, match.player2);

        return `
            <div class="upcoming-match-card ${categoryClass} ${surfaceClass}" data-match-id="${match.id}">
                <div class="match-header">
                    <div class="tournament-info">
                        <div class="tournament-name">
                            ${match.tournament}
                            <span class="category-badge">${categoryLabel}</span>
                        </div>
                        <div class="match-round">${match.round}</div>
                    </div>
                    <div class="scheduled-pill-group">
                        <span class="scheduled-pill">${dateStr}</span>
                        <span class="scheduled-connector"></span>
                        <span class="scheduled-pill">${timeStr}</span>
                    </div>
                </div>
                <div class="match-players">
                    <div class="player-row">
                        <img class="player-img" src="${Utils.getPlayerImage(match.player1)}" alt="${match.player1.name}">
                        <div class="player-info">
                            <div class="player-name">
                                <span class="player-rank-badge">[${match.player1.rank}]</span>
                                <span class="country-flag">${Utils.getFlag(match.player1.country)}</span>
                                ${Utils.formatPlayerName(match.player1.name)}
                            </div>
                        </div>
                    </div>
                    <div class="player-row">
                        <img class="player-img" src="${Utils.getPlayerImage(match.player2)}" alt="${match.player2.name}">
                        <div class="player-info">
                            <div class="player-name">
                                <span class="player-rank-badge">[${match.player2.rank}]</span>
                                <span class="country-flag">${Utils.getFlag(match.player2.country)}</span>
                                ${Utils.formatPlayerName(match.player2.name)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="edge-row" data-edge-id="${match.id}">
                    <div class="h2h-chip">H2H: ${winEdge.h2hText}</div>
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
    calculateWinEdge(p1, p2) {
        // Lower rank number is stronger; add tiny randomness
        const baseP1 = (p2.rank || 50) / (p1.rank || 50);
        const noise = 0.05 * (Math.random() - 0.5);
        let p1Prob = Math.min(0.85, Math.max(0.15, baseP1 + noise));
        // Convert to percentage and balance
        const p1Pct = Math.round((p1Prob / (p1Prob + 1)) * 100);
        const p2Pct = 100 - p1Pct;

        const reason = p1Pct > 55 ? 'Better recent form & rank' : p2Pct > 55 ? 'Edge on momentum' : 'Too close to call';
        const h2hText = `${Math.floor(Math.random() * 4) + 1}-${Math.floor(Math.random() * 3)}`;
        const formNote = p1Pct > 55 ? 'Won 4 of last 5' : p2Pct > 55 ? 'On 6-match streak' : 'Evenly matched';

        return {
            p1: p1Pct,
            p2: p2Pct,
            reason,
            h2hText,
            formNote
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
        
        const player1Score = this.formatPlayerScore(match, 1, isLive);
        const player2Score = this.formatPlayerScore(match, 2, isLive);
        const resolvedWinner = !isLive ? this.getWinnerFromScore(match, match.final_score || match.score) : null;
        
        const p1IsWinner = !isLive && resolvedWinner === 1;
        const p2IsWinner = !isLive && resolvedWinner === 2;
        const p1Serving = isLive && match.serving === 1;
        const p2Serving = isLive && match.serving === 2;

        return `
            <div class="match-card ${categoryClass} ${surfaceClass}" data-match-id="${match.id}">
                <div class="match-header">
                    <div class="tournament-info">
                        <div class="tournament-name">
                            ${match.tournament}
                            <span class="category-badge">${categoryLabel}</span>
                        </div>
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
     * Get tournament category label
     */
    getCategoryLabel(category) {
        const labels = {
            'grand_slam': 'Grand Slam',
            'masters_1000': '1000',
            'atp_500': '500',
            'atp_250': '250',
            'atp_125': '125',
            'finals': 'Finals',
            'other': 'Other'
        };
        return labels[category] || category;
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
                html += `<span class="set-score ${isCurrentSet ? 'current' : ''}">${games}<sup class="tb">(${tiebreakScore})</sup></span>`;
            } else if (isTiebreak) {
                const fallbackTb = games === 7 ? 7 : 6;
                html += `<span class="set-score ${isCurrentSet ? 'current' : ''}">${games}<sup class="tb">(${fallbackTb})</sup></span>`;
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
    showMatchStats(matchId, matchOverride = null, context = {}) {
        const { AppState, Utils } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Find match in live or recent matches, unless an override is provided
        let match = matchOverride;
        if (!match) {
            match = AppState.liveScores[tour]?.find(m => m.id === matchId);
            if (!match) {
                match = AppState.recentMatches[tour]?.find(m => m.id === matchId);
            }
            if (!match) {
                match = AppState.upcomingMatches[tour]?.find(m => m.id === matchId);
            }
            if (!match) {
                match = this.demoLiveMatches[tour]?.find(m => m.id === matchId) ||
                       this.demoRecentMatches[tour]?.find(m => m.id === matchId) ||
                       this.demoUpcomingMatches[tour]?.find(m => m.id === matchId);
            }
        }
        
        if (!match) return;
        
        // Generate match statistics (demo data)
        const stats = this.generateMatchStats(match);
        
        const modal = document.getElementById('matchStatsModal');
        const content = document.getElementById('matchStatsContent');
        
        const isLive = match.status === 'live';
        const score = isLive ? match.score : (match.final_score || match.score);
        const resolvedWinner = !isLive ? this.getWinnerFromScore(match, score) : null;
        const tournamentName = context.tournament || match.tournament || 'Match Statistics';
        const roundName = match.round || context.round || '';
        const categoryLabel = this.getCategoryLabel(match.tournament_category);
        const categoryClass = window.TennisApp.Utils.getCategoryClass(match.tournament_category);
        const setLines = this.formatSetLines(score);
        
        content.innerHTML = `
            <div class="match-stats-title">
                <div class="match-stats-tournament">
                    ${tournamentName}
                    ${categoryLabel ? `<span class="category-badge ${categoryClass}">${categoryLabel}</span>` : ''}
                    ${roundName ? `<span class="match-stats-round-tag">${roundName}</span>` : ''}
                </div>
            </div>
            <div class="match-stats-hero">
                <div class="match-stats-player-card ${resolvedWinner === 1 ? 'winner' : ''}">
                    <img class="player-hero-img" src="${Utils.getPlayerImage(match.player1.id)}" alt="${match.player1.name}">
                    <div class="player-hero-name">${match.player1.name}</div>
                    <div class="player-hero-meta">${Utils.getFlag(match.player1.country)} ${match.player1.country} • Rank ${match.player1.rank || '-'}</div>
                </div>
                <div class="match-stats-scoreboard">
                    <div class="set-lines">
                        ${setLines}
                    </div>
                    ${stats.duration ? `<div class="duration">${stats.duration}</div>` : ''}
                </div>
                <div class="match-stats-player-card ${resolvedWinner === 2 ? 'winner' : ''}">
                    <img class="player-hero-img" src="${Utils.getPlayerImage(match.player2.id)}" alt="${match.player2.name}">
                    <div class="player-hero-name">${match.player2.name}</div>
                    <div class="player-hero-meta">${Utils.getFlag(match.player2.country)} ${match.player2.country} • Rank ${match.player2.rank || '-'}</div>
                </div>
            </div>
            
            <div class="match-stats-section">
                <h4>Serve</h4>
                <div class="stats-grid">
                    ${this.createStatRow('Aces', stats.aces.p1, stats.aces.p2, stats.aces.p1, stats.aces.p2, 'higher')}
                    ${this.createStatRow('Double Faults', stats.doubleFaults.p1, stats.doubleFaults.p2, stats.doubleFaults.p1, stats.doubleFaults.p2, 'lower')}
                    ${this.createStatRow('1st Serve %', stats.firstServe.p1 + '%', stats.firstServe.p2 + '%', stats.firstServe.p1, stats.firstServe.p2, 'higher')}
                    ${this.createStatRow('1st Serve Points Won', stats.firstServeWon.p1 + '%', stats.firstServeWon.p2 + '%', stats.firstServeWon.p1, stats.firstServeWon.p2, 'higher')}
                    ${this.createStatRow('2nd Serve Points Won', stats.secondServeWon.p1 + '%', stats.secondServeWon.p2 + '%', stats.secondServeWon.p1, stats.secondServeWon.p2, 'higher')}
                </div>
            </div>

            <div class="match-stats-section">
                <h4>Return & Pressure</h4>
                <div class="stats-grid">
                    ${this.createStatRow('Break Points Converted', `${stats.breakPointsWon.p1}/${stats.breakPointsTotal.p1} (${stats.breakPointsRate.p1}%)`, `${stats.breakPointsWon.p2}/${stats.breakPointsTotal.p2} (${stats.breakPointsRate.p2}%)`, stats.breakPointsRate.p1, stats.breakPointsRate.p2, 'higher')}
                    ${this.createStatRow('Winners', stats.winners.p1, stats.winners.p2, stats.winners.p1, stats.winners.p2, 'higher')}
                    ${this.createStatRow('Unforced Errors', stats.unforcedErrors.p1, stats.unforcedErrors.p2, stats.unforcedErrors.p1, stats.unforcedErrors.p2, 'lower')}
                    ${this.createStatRow('Total Points Won', stats.totalPoints.p1, stats.totalPoints.p2, stats.totalPoints.p1, stats.totalPoints.p2, 'higher')}
                </div>
            </div>
        `;
        
        modal.classList.add('active');
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
                        <div class="stat-bar-left" style="width: ${percent1}%"></div>
                        <div class="stat-bar-right" style="width: ${percent2}%"></div>
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
        const breakP1Total = Math.floor(Math.random() * 8) + 4;
        const breakP2Total = Math.floor(Math.random() * 8) + 4;
        const breakP1Won = Math.floor(Math.random() * Math.max(2, breakP1Total - 1)) + 1;
        const breakP2Won = Math.floor(Math.random() * Math.max(2, breakP2Total - 1)) + 1;
        return {
            duration: '2h 34m',
            aces: { p1: Math.floor(Math.random() * 12) + 3, p2: Math.floor(Math.random() * 12) + 3 },
            doubleFaults: { p1: Math.floor(Math.random() * 5), p2: Math.floor(Math.random() * 5) },
            firstServe: { p1: Math.floor(Math.random() * 15) + 55, p2: Math.floor(Math.random() * 15) + 55 },
            firstServeWon: { p1: Math.floor(Math.random() * 15) + 65, p2: Math.floor(Math.random() * 15) + 65 },
            secondServeWon: { p1: Math.floor(Math.random() * 20) + 40, p2: Math.floor(Math.random() * 20) + 40 },
            breakPointsWon: { p1: breakP1Won, p2: breakP2Won },
            breakPointsTotal: { p1: breakP1Total, p2: breakP2Total },
            breakPointsRate: {
                p1: Math.round((breakP1Won / breakP1Total) * 100),
                p2: Math.round((breakP2Won / breakP2Total) * 100)
            },
            winners: { p1: Math.floor(Math.random() * 20) + 20, p2: Math.floor(Math.random() * 20) + 20 },
            unforcedErrors: { p1: Math.floor(Math.random() * 15) + 15, p2: Math.floor(Math.random() * 15) + 15 },
            totalPoints: { p1: Math.floor(Math.random() * 30) + 80, p2: Math.floor(Math.random() * 30) + 80 }
        };
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
