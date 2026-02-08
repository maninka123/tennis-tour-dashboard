/**
 * Tennis Live Dashboard - Player Stats Module
 * Handles displaying detailed player statistics in a modal.
 */

const PlayerModule = {
    currentPlayer: null,
    currentRecentMatches: null,
    /**
     * Initialize the module
     */
    init() {
        // Event listeners can be added here if needed, e.g., for year/career tabs
    },

    /**
     * Show player stats modal
     * @param {number} playerId - The ID of the player
     */
    async showPlayerStats(playerId) {
        const { API, DOM } = window.TennisApp;

        try {
            // Show loading state in modal if necessary
            this.renderLoading();

            let player = await API.getPlayer(playerId).catch(() => null);
            
            if (!player) {
                // Fallback to rankings data if API isn't available
                const { AppState } = window.TennisApp;
                const tour = AppState.currentTour;
                player = AppState.rankings[tour]?.find(p => String(p.id) === String(playerId));
                if (!player) {
                    this.renderError();
                    return;
                }
            }

            // For demo, we'll generate some stats. In a real app, this would be part of the API response.
            const stats = player?.stats_2026 && Object.keys(player.stats_2026).length
                ? this.buildStatsFromScraped(player.stats_2026)
                : this.generateDemoStats();
            const profile = this.generateDemoProfile(player, '2026', player?.stats_2026 || {});

            const isAtp = this.isAtpPlayer(player);
            let performance;
            if (isAtp && player.grandslam_performance) {
                performance = this.buildPerformanceFromScraped(player.grandslam_performance);
            } else {
                const yearlyRecords = player?.stats_2026?.records_tab?.yearly
                    || player?.stats_2026?.records
                    || player?.records
                    || [];
                performance = yearlyRecords.length
                    ? this.buildPerformanceFromRecords(yearlyRecords)
                    : this.generateDemoPerformance(player);
            }

            this.currentPlayer = player;
            const recentMatches = this.extractRecentMatches(player);
            this.currentRecentMatches = recentMatches;
            this.render(player, stats, profile, performance, recentMatches);

        } catch (error) {
            console.error('Error loading player stats:', error);
            this.renderError();
        }
    },

    /**
     * Render the player stats modal content
     * @param {object} player - Player's personal data
     * @param {object} stats - Player's statistics
     */
    render(player, stats, profile, performance, recentMatches) {
        const { Utils } = window.TennisApp;
        const modal = document.getElementById('playerStatsModal');
        if (!modal) return;

        const pointsDelta = typeof player.points_change === 'number' && player.points_change !== 0
            ? this.formatDeltaPill(player.points_change, 'PTS')
            : '';
        const rankDeltaValue = typeof player.rank_change === 'number'
            ? player.rank_change
            : (typeof player.movement === 'number' ? player.movement : 0);
        const rankDelta = rankDeltaValue
            ? this.formatDeltaPill(rankDeltaValue, 'POS')
            : '';

        const chClass = player.is_new_career_high ? 'ch-highlight nch' : (player.is_career_high ? 'ch-highlight' : '');
        const chText = player.career_high ? `CH #${player.career_high}` : 'CH -';
        const playingText = player.is_playing && player.previous ? `${player.previous}` : '';
        const rankBadge = player.rank ? `<div class="rank-badge">#${player.rank}</div>` : '';
        const parsePoints = (value) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const cleaned = String(value ?? '').replace(/[^\d]/g, '');
            if (!cleaned) return null;
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const pointsValue = parsePoints(player.points) ?? parsePoints(profile?.points);
        const pointsBadge = pointsValue !== null
            ? `<div class="points-badge">${pointsValue.toLocaleString()} PTS</div>`
            : '';

        const isAtp = this.isAtpPlayer(player);
        const seasonWonLostRaw = isAtp
            ? (player?.ytd_won_lost || player?.stats_2026?.ytd_won_lost || profile.ytdWonLost || profile.wonLost || '')
            : (player?.stats_2026?.won_lost || profile.wonLost || '');
        const wonLost = this.parseWonLost(seasonWonLostRaw);
        const winsValue = wonLost.wins ?? stats?.wins ?? 0;
        const lossesValue = wonLost.losses ?? stats?.losses ?? 0;
        const recentTournamentCount = Array.isArray(recentMatches?.tournaments) ? recentMatches.tournaments.length : 0;
        const recentMatchCount = Array.isArray(recentMatches?.tournaments)
            ? recentMatches.tournaments.reduce((acc, t) => acc + (Array.isArray(t.matches) ? t.matches.length : 0), 0)
            : 0;
        const recentButtonDisabled = recentMatchCount === 0;

        let html = `
            <div class="modal-content">
                <div class="modal-header">
                    ${isAtp ? `<h3 style="max-width: 65%">${player.name} — Performance Snapshot</h3>` : `<h3>${player.name} — Performance Snapshot</h3>`}
                    <button class="close-modal" onclick="PlayerModule.close()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="player-profile">
                        <div class="player-hero">
                            <img src="${Utils.getPlayerImage(player)}" alt="${player.name}">
                            <div class="player-info">
                                ${rankBadge}
                                ${pointsBadge}
                                <h4>
                                    ${player.name}
                                    ${pointsDelta}
                                    ${rankDelta}
                                </h4>
                                <div class="player-meta-row">
                                    <span>${Utils.getFlag(player.country)} ${player.country}</span>
                                    <span class="${chClass}">${chText}</span>
                                </div>
                                ${playingText ? `<div class="player-status playing-text">${playingText}</div>` : ''}
                            </div>
                        </div>
                        <div class="player-profile-actions">
                            <button class="recent-matches-launch ${recentButtonDisabled ? 'disabled' : ''}"
                                ${recentButtonDisabled ? 'disabled' : ''}
                                onclick="PlayerModule.openRecentMatchesModal()">
                                <i class="fas fa-table-list"></i>
                                <span>Recent Matches</span>
                            </button>
                            <div class="recent-matches-subtitle">
                                ${recentButtonDisabled
                                    ? 'No match history available'
                                    : `${recentMatchCount} matches • ${recentTournamentCount} tournaments`}
                            </div>
                        </div>
                    </div>
                    <div class="season-summary">
                        <div class="season-label">2026 Season</div>
                        <div class="season-record">
                            <div class="record-card wins">
                                <span class="record-label">Wins</span>
                                <span class="record-value">${winsValue}</span>
                            </div>
                            <div class="record-card losses">
                                <span class="record-label">Losses</span>
                                <span class="record-value">${lossesValue}</span>
                            </div>
                        </div>
                    </div>
                    <div class="player-info-cards">
                        ${this.getInfoCardsHTML(profile, player)}
                    </div>
                    <div class="player-bars">
                        <h4>Service & Return Efficiency</h4>
                        ${this.getBarStatsHTML(stats)}
                    </div>
                    <div class="stats-container two-col">
                        ${this.getStatsHTML(stats)}
                    </div>
                    <div class="player-performance">
                        <h4>Major Events Performance (${isAtp ? '2020–2026' : '2020–2025'})</h4>
                        ${this.getPerformanceTableHTML(performance, isAtp)}
                    </div>
                    ${this.getRecentMatchesModalHTML(player, recentMatches, Utils)}
                </div>
            </div>
        `;

        modal.innerHTML = html;
        modal.classList.add('active');
        // No toggle for season/career (2026 only)
    },

    /**
     * Generate HTML for the statistics grid
     */
    getStatsHTML(stats) {
        return `
            <div class="stats-grid">
                <div class="stats-column">
                    <h4>Service</h4>
                    ${this.statRow('Aces', stats.service.aces)}
                    ${this.statRow('Double Faults', stats.service.double_faults)}
                    ${this.statRow('1st Serve %', `${stats.service.first_serve_pct}%`)}
                    ${this.statRow('1st Serve Won', `${stats.service.first_serve_won}%`)}
                    ${this.statRow('2nd Serve Won', `${stats.service.second_serve_won}%`)}
                    ${this.statRow('Break Points Saved', `${stats.service.bp_saved}%`)}
                    ${this.statRow('Service Points Won %', `${stats.service.service_pts_won_pct}%`)}
                    ${this.statRow('Service Games Won', `${stats.service.service_games_won}%`)}
                    ${this.statRow('Service Games Played', stats.service.service_games_played)}
                </div>
                <div class="stats-column">
                    <h4>Return</h4>
                    ${this.statRow('Return Points Won', `${stats.return.return_pts_won}%`)}
                    ${this.statRow('1st Return Points Won %', `${stats.return.first_return_pts_won_pct}%`)}
                    ${this.statRow('2nd Return Points Won %', `${stats.return.second_return_pts_won_pct}%`)}
                    ${this.statRow('Break Points Converted', `${stats.return.bp_converted}%`)}
                    ${this.statRow('Return Games Won', `${stats.return.return_games_won}%`)}
                    ${this.statRow('Return Games Played', stats.return.return_games_played)}
                </div>
            </div>
        `;
    },

    statRow(label, value) {
        return `<div class="stat-item"><span>${label}</span><span>${value}</span></div>`;
    },

    getInfoCardsHTML(profile, player = null) {
        const isAtp = this.isAtpPlayer(player);
        const pointsCard = profile.points !== null && profile.points !== undefined
            ? `
            <div class="info-card points-card">
                <span class="label">Points</span>
                <span class="value">${profile.points.toLocaleString()}</span>
            </div>
        ` : '';
        const prizeCard = profile.prizeMoney
            ? `
            <div class="info-card money-card">
                <span class="label">Prize Money</span>
                <span class="value">${this.formatMoneyK(profile.prizeMoney)}</span>
            </div>
        ` : '';
        const atpPrizeCards = `
            <div class="info-card money-card">
                <span class="label">YTD Prize Money</span>
                <span class="value">${profile.prizeMoneyYtd ? this.formatMoneyK(profile.prizeMoneyYtd) : '-'}</span>
            </div>
        `;
        const playingCard = profile.playing ? `<div class="subtext playing-text">${profile.playing}</div>` : '';

        return `
            <div class="info-card age-card">
                <span class="label">Age</span>
                <span class="value">${profile.age}</span>
                ${playingCard}
            </div>
            <div class="info-card height-card">
                <span class="label">Height</span>
                <span class="value">${profile.height}</span>
            </div>
            <div class="info-card plays-card">
                <span class="label">Plays</span>
                <span class="value">${profile.hand}</span>
            </div>
            ${pointsCard}
            <div class="info-card titles-card">
                <span class="label">Titles</span>
                <span class="value">${profile.titles}</span>
            </div>
            ${isAtp ? atpPrizeCards : prizeCard}
        `;
    },

    getBarStatsHTML(stats) {
        const makeBar = (label, value) => `
            <div class="bar-row">
                <div class="bar-label">${label}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${value}%"></div>
                </div>
                <div class="bar-value">${value}%</div>
            </div>
        `;
        return `
            ${makeBar('1st Serve %', stats.service.first_serve_pct)}
            ${makeBar('1st Serve Won', stats.service.first_serve_won)}
            ${makeBar('2nd Serve Won', stats.service.second_serve_won)}
            ${makeBar('Return Points Won', stats.return.return_pts_won)}
            ${makeBar('Break Points Converted', stats.return.bp_converted)}
        `;
    },

    getPerformanceTableHTML(performance, isAtp = false) {
        const years = isAtp
            ? ['2020','2021','2022','2023','2024','2025','2026']
            : ['2020','2021','2022','2023','2024','2025'];
        const gridStyle = isAtp ? 'style="grid-template-columns: 1.6fr repeat(7, 1fr)"' : '';
        return `
            <div class="performance-table-grid" ${gridStyle}>
                <div class="perf-head event">Event</div>
                ${years.map(y => `<div class="perf-head year">${y}</div>`).join('')}
                ${performance.map(row => `
                    <div class="perf-row surface-${row.surface}">
                        <div class="event">
                            <div class="event-name">${row.event}</div>
                        </div>
                        ${years.map(y => {
                            const val = row.results[y] || '-';
                            const winnerClass = val === 'W' ? ' winner' : '';
                            return `<div class="perf-cell${winnerClass}">${val}</div>`;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render a loading state
     */
    renderLoading() {
        const modal = document.getElementById('playerStatsModal');
        if (!modal) return;
        modal.innerHTML = `
            <div class="modal-content">
                <div class="loading-placeholder">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading player stats...</span>
                </div>
            </div>
        `;
        modal.classList.add('active');
    },

    /**
     * Render an error state
     */
    renderError() {
        const modal = document.getElementById('playerStatsModal');
        if (!modal) return;
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Error</h3>
                    <button class="close-modal" onclick="PlayerModule.close()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Could not load player statistics. Please try again later.</p>
                </div>
            </div>
        `;
        modal.classList.add('active');
    },

    /**
     * Close the modal
     */
    close() {
        const modal = document.getElementById('playerStatsModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentRecentMatches = null;
    },

    extractRecentMatches(player) {
        const raw = player?.stats_2026?.recent_matches_tab || player?.stats_2026?.recent_matches;
        if (!raw || !Array.isArray(raw.tournaments)) {
            return { year: 2026, tournaments: [], updated_at: null };
        }
        return raw;
    },

    openRecentMatchesModal() {
        const overlay = document.getElementById('playerRecentMatchesOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
    },

    closeRecentMatchesModal(event) {
        const overlay = document.getElementById('playerRecentMatchesOverlay');
        if (!overlay) return;
        if (event && event.target && event.target.id !== 'playerRecentMatchesOverlay') {
            return;
        }
        overlay.classList.remove('active');
    },

    getRecentMatchesModalHTML(player, recentMatches, Utils) {
        const tournaments = Array.isArray(recentMatches?.tournaments) ? recentMatches.tournaments : [];
        if (!tournaments.length) {
            return `
                <div class="player-recent-overlay" id="playerRecentMatchesOverlay" onclick="PlayerModule.closeRecentMatchesModal(event)">
                    <div class="player-recent-modal">
                        <div class="player-recent-header">
                            <h3>${player.name} — Recent Matches</h3>
                            <button class="close-modal" onclick="PlayerModule.closeRecentMatchesModal()">&times;</button>
                        </div>
                        <div class="player-recent-body">
                            <div class="player-recent-empty">No recent match history available for this player.</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const isAtp = this.isAtpPlayer(player);
        const tournamentCards = tournaments.map((event) => this.renderRecentTournamentCard(event, Utils, isAtp)).join('');
        const yearText = recentMatches?.year ? `Season ${recentMatches.year}` : 'Recent results';
        return `
            <div class="player-recent-overlay" id="playerRecentMatchesOverlay" onclick="PlayerModule.closeRecentMatchesModal(event)">
                <div class="player-recent-modal">
                    <div class="player-recent-header">
                        <div>
                            <h3>${player.name} — Recent Matches</h3>
                            <div class="player-recent-header-sub">${yearText}</div>
                        </div>
                        <button class="close-modal" onclick="PlayerModule.closeRecentMatchesModal()">&times;</button>
                    </div>
                    <div class="player-recent-body">
                        ${tournamentCards}
                    </div>
                </div>
            </div>
        `;
    },

    renderRecentTournamentCard(event, Utils, isAtp = false) {
        const category = event?.category || 'other';
        const categoryClass = Utils.getCategoryClass(category);
        const surfaceClass = this.surfaceClassFromKey(event?.surface_key || event?.surface || '');
        const surfaceLabel = event?.surface || 'HARD';
        const rows = Array.isArray(event?.matches) ? event.matches : [];
        const rowsHtml = rows.map((row) => this.renderRecentMatchRow(row, Utils, isAtp)).join('');
        const summary = event?.summary || {};

        const metaChips = isAtp
            ? [
                this.renderMetaChip('Rank', this.safeDisplay(summary.rank)),
                this.renderMetaChip('ATP Points Gain', this.safeDisplay(summary.atp_points_gain || summary.points)),
                this.renderMetaChip('Prize Money Won', this.safeDisplay(summary.prize_money_won))
            ].join('')
            : [
                this.renderMetaChip('Rank', this.safeDisplay(summary.rank)),
                this.renderMetaChip('Seed', this.safeDisplay(summary.seed)),
                this.renderMetaChip('WTA Points Gain', this.safeDisplay(summary.wta_points_gain)),
                this.renderMetaChip('Prize Money Won', this.safeDisplay(summary.prize_money_won)),
                this.renderMetaChip('Draw', this.safeDisplay(summary.draw))
            ].join('');

        return `
            <section class="recent-tournament-card category-${categoryClass} ${surfaceClass}">
                <div class="recent-tournament-header">
                    <div class="recent-tournament-title-wrap">
                        <h4>${event?.tournament || 'Tournament'}</h4>
                        <div class="recent-tournament-sub">${[event?.location || '', event?.date_range || ''].filter(Boolean).join(', ')}</div>
                    </div>
                    <div class="recent-tournament-badges">
                        <span class="category-badge ${categoryClass}">${event?.category_label || 'Tour'}</span>
                        <span class="recent-surface-badge ${surfaceClass}">${surfaceLabel}</span>
                    </div>
                </div>
                <div class="recent-tournament-table-wrap">
                    <table class="recent-tournament-table">
                        <thead>
                            <tr>
                                <th>Round</th>
                                <th>W-L</th>
                                <th>Opponent</th>
                                <th>Match Score</th>
                                ${isAtp ? '' : '<th>Opponent Rank</th>'}
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="recent-tournament-meta">${metaChips}</div>
            </section>
        `;
    },

    renderRecentMatchRow(row, Utils, isAtp = false) {
        const result = this.resolveRecentResult(row, isAtp);
        const resultClass = result === 'W' ? 'win' : (result === 'L' ? 'loss' : 'other');
        const opponentName = row?.opponent_name || '-';
        const opponentFlag = row?.opponent_country ? Utils.getFlag(row.opponent_country) : '';
        const extras = [];
        if (row?.opponent_seed) extras.push(`(${row.opponent_seed})`);
        if (row?.opponent_entry) extras.push(`(${row.opponent_entry})`);
        const extrasText = extras.length ? ` <span class="recent-opponent-meta">${extras.join(' ')}</span>` : '';
        const roundLabel = this.formatRecentRoundLabel(row?.round);

        return `
            <tr>
                <td>${roundLabel}</td>
                <td><span class="recent-result-pill ${resultClass}">${result}</span></td>
                <td>${opponentFlag} ${opponentName}${extrasText}</td>
                <td class="recent-score-cell">${row?.score || '-'}</td>
                ${isAtp ? '' : `<td>${this.safeDisplay(row?.opponent_rank)}</td>`}
            </tr>
        `;
    },

    resolveRecentResult(row, isAtp = false) {
        const explicit = String(row?.result || '').trim().toUpperCase();
        if (explicit === 'W' || explicit === 'L') {
            return explicit;
        }
        if (!isAtp) {
            return explicit || '-';
        }

        const sets = this.parseScoreSets(row?.score || row?.score_raw || '');
        if (!sets.length) return '-';
        let p1Sets = 0;
        let p2Sets = 0;
        sets.forEach(([p1, p2]) => {
            if (p1 > p2) p1Sets += 1;
            else if (p2 > p1) p2Sets += 1;
        });
        if (p1Sets > p2Sets) return 'W';
        if (p2Sets > p1Sets) return 'L';
        return '-';
    },

    parseScoreSets(scoreText) {
        const text = String(scoreText || '');
        const pairs = [];
        const hyphenPattern = /(\d+)\s*-\s*(\d+)/g;
        let match;
        while ((match = hyphenPattern.exec(text)) !== null) {
            pairs.push([parseInt(match[1], 10), parseInt(match[2], 10)]);
        }
        if (pairs.length) {
            return pairs;
        }

        const tokens = (text.match(/\d+/g) || []).map((x) => parseInt(x, 10));
        let i = 0;
        while (i + 1 < tokens.length) {
            const p1 = tokens[i];
            const p2 = tokens[i + 1];
            i += 2;
            if (((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)) && i < tokens.length) {
                const tb = tokens[i];
                if (Number.isFinite(tb) && tb >= 0 && tb <= 20) {
                    i += 1;
                }
            }
            pairs.push([p1, p2]);
        }
        return pairs;
    },

    formatRecentRoundLabel(round) {
        const raw = `${round || ''}`.trim();
        if (!raw) return '-';
        const upper = raw.toUpperCase();
        if (upper === 'Q') return raw;

        const patterns = [
            /^Q\s*([1-9])$/,
            /^QUALIF(?:YING|IER)\s+R\s*([1-9])$/,
            /^QUALIF(?:YING|IER)\s+ROUND\s*([1-9])$/,
            /^([1-9])(?:ST|ND|RD|TH)\s+ROUND\s+QUALIF(?:YING|IER)$/,
            /^ROUND\s*([1-9])\s+QUALIF(?:YING|IER)$/
        ];
        for (const pattern of patterns) {
            const match = upper.match(pattern);
            if (match) {
                return `Qualifier R${Number(match[1])}`;
            }
        }
        return raw;
    },

    renderMetaChip(label, value) {
        return `<span class="recent-meta-chip"><strong>${label}:</strong> ${value}</span>`;
    },

    safeDisplay(value) {
        if (value === null || value === undefined || value === '') return '-';
        return value;
    },

    surfaceClassFromKey(surface) {
        const value = String(surface || '').toLowerCase();
        if (value.includes('clay')) return 'surface-clay';
        if (value.includes('grass')) return 'surface-grass';
        if (value.includes('indoor')) return 'surface-indoor';
        return 'surface-hard';
    },

    /**
     * Add listeners for the stats toggle buttons
     */
    addToggleListeners() {},

    /**
     * Generate demo stats
     * @param {string} period - '2026' or 'career'
     */
    generateDemoStats(period = '2026') {
        const base = (period === 'career') ? 1.15 : 1;
        return {
            service: {
                aces: Math.floor(17 * base),
                double_faults: Math.floor(8 * base),
                first_serve_pct: 64.9,
                first_serve_won: 61.1,
                second_serve_won: 50.4,
                bp_saved: 50.0,
                service_pts_won_pct: 57.4,
                service_games_won: 62.7,
                service_games_played: Math.floor(51 * base),
            },
            return: {
                return_pts_won: 46.6,
                first_return_pts_won_pct: 38.6,
                second_return_pts_won_pct: 62.9,
                bp_converted: 46.8,
                return_games_won: 44.0,
                return_games_played: Math.floor(50 * base),
            }
        };
    },

    generateDemoProfile(player, period = '2026', statsData = {}) {
        const pointsValue = typeof player?.points === 'number' ? player.points : null;
        const rankChangeValue = typeof player?.rank_change === 'number'
            ? player.rank_change
            : (typeof player?.movement === 'number' ? player.movement : null);
        const playingValue = player?.is_playing && player?.previous ? player.previous : null;
        const prizeMoney = player?.prize_money || statsData?.prize_money || null;
        const prizeMoneyCareer = player?.prize_money_career || statsData?.career_prize_money || prizeMoney || null;
        const prizeMoneyYtd = player?.prize_money_ytd || statsData?.ytd_prize_money || null;
        const titlesValue = player?.titles || statsData?.singles_titles || (period === 'career' ? 52 : 4);
        const wonLostValue = statsData?.won_lost || '';
        const ytdWonLostValue = player?.ytd_won_lost || statsData?.ytd_won_lost || '';
        return {
            age: player?.age || (period === 'career' ? 29 : 27),
            height: player?.height || '188 cm',
            hand: player?.plays || 'Right-Handed',
            titles: titlesValue,
            prizeMoney,
            prizeMoneyCareer,
            prizeMoneyYtd,
            careerHigh: player?.career_high || 1,
            points: pointsValue,
            rankChange: rankChangeValue,
            playing: playingValue,
            wonLost: wonLostValue,
            ytdWonLost: ytdWonLostValue
        };
    },

    buildStatsFromScraped(statsData) {
        const num = (value) => {
            const parsed = parseFloat(String(value || '').replace('%', ''));
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const intVal = (value) => {
            const parsed = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const service = statsData?.singles_serving_stats || {};
        const ret = statsData?.singles_return_stats || {};
        return {
            service: {
                aces: intVal(service.aces || statsData.aces),
                double_faults: intVal(service.double_faults),
                first_serve_pct: num(service.first_serve_pct),
                first_serve_won: num(service.first_serve_won),
                second_serve_won: num(service.second_serve_won),
                bp_saved: num(service.break_points_saved),
                service_pts_won_pct: num(service.service_points_won_pct),
                service_games_won: num(service.service_games_won),
                service_games_played: intVal(service.service_games_played),
            },
            return: {
                return_pts_won: num(ret.return_points_won),
                first_return_pts_won_pct: num(ret.first_return_points_won_pct),
                second_return_pts_won_pct: num(ret.second_return_points_won_pct),
                bp_converted: num(ret.break_points_converted),
                return_games_won: num(ret.return_games_won),
                return_games_played: intVal(ret.return_games_played),
            }
        };
    },

    buildPerformanceFromScraped(gsData) {
        const buildResults = (eventName) => {
            const row = gsData[eventName] || {};
            // If the structure is { year: result }, we return it directly, 
            // but we might need to normalize keys if they are numbers.
            // The scraper returns { "2019": "Q1", "2020": "...", ... }
            return row;
        };
        
        // Map scraped names to display names if needed
        return [
            { event: 'Australian Open', surface: 'hard', results: buildResults('Australian Open') },
            { event: 'Roland Garros', surface: 'clay', results: buildResults('French Open') },
            { event: 'Wimbledon', surface: 'grass', results: buildResults('Wimbledon') },
            { event: 'US Open', surface: 'hard', results: buildResults('US Open') }
        ];
    },

    buildPerformanceFromRecords(records) {
        const years = ['2020','2021','2022','2023','2024','2025'];
        const byYear = {};
        records.forEach(row => {
            if (row && row.year) {
                byYear[String(row.year)] = row;
            }
        });
        const buildResults = (key, fallbackKey = '') => {
            const results = {};
            years.forEach(year => {
                const row = byYear[year] || {};
                results[year] = row[key] || (fallbackKey ? row[fallbackKey] : '') || '-';
            });
            return results;
        };
        return [
            { event: 'Australian Open', surface: 'hard', results: buildResults('australian_open') },
            { event: 'Roland Garros', surface: 'clay', results: buildResults('roland_garros', 'french_open') },
            { event: 'Wimbledon', surface: 'grass', results: buildResults('wimbledon') },
            { event: 'US Open', surface: 'hard', results: buildResults('us_open') }
        ];
    },

    formatMoneyK(value) {
        if (!value) return '-';
        const raw = String(value);
        const digits = raw.replace(/[^\d]/g, '');
        if (!digits) return raw;
        const number = parseInt(digits, 10);
        if (!Number.isFinite(number)) return raw;
        const k = Math.round(number / 1000);
        return `${k.toLocaleString()}K`;
    },

    parseWonLost(value) {
        if (!value) return { wins: 0, losses: 0 };
        const match = String(value).match(/(\d+)\s*[-/]\s*(\d+)/);
        if (!match) return { wins: 0, losses: 0 };
        return { wins: parseInt(match[1], 10), losses: parseInt(match[2], 10) };
    },

    formatDeltaPill(value, label) {
        const cls = value > 0 ? 'up' : 'down';
        const sign = value > 0 ? '+' : '';
        return `<span class="snapshot-pill ${cls}">${sign}${value} ${label}</span>`;
    },

    isAtpPlayer(player = null) {
        const explicit = String(player?.tour || '').toUpperCase();
        if (explicit === 'ATP') return true;
        if (explicit === 'WTA') return false;
        const currentTour = String(window.TennisApp?.AppState?.currentTour || '').toLowerCase();
        return currentTour === 'atp';
    },

    generateDemoPerformance(player, period = '2026') {
        const sample = (vals) => ({
            '2020': vals[0],
            '2021': vals[1],
            '2022': vals[2],
            '2023': vals[3],
            '2024': vals[4],
            '2025': vals[5]
        });
        return [
            { event: 'Australian Open', surface: 'hard', results: sample(['R16','QF','SF','SF','F','W']) },
            { event: 'Roland Garros', surface: 'clay', results: sample(['R32','R16','QF','F','W','SF']) },
            { event: 'Wimbledon', surface: 'grass', results: sample(['R32','R16','QF','SF','QF','F']) },
            { event: 'US Open', surface: 'hard', results: sample(['R16','QF','SF','W','SF','W']) }
        ];
    }
};

window.PlayerModule = PlayerModule;
