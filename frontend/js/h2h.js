/**
 * Tennis Live Dashboard - Head-to-Head Comparison Module
 * WTA H2H uses backend live data (search + details + charts).
 */

const H2HModule = {
    defaultYear: 2026,
    selectedPlayer1: null,
    selectedPlayer2: null,
    lastSearchResults: { 1: [], 2: [] },
    searchToken: { 1: 0, 2: 0 },
    initialized: false,
    plotlyLoadPromise: null,

    playerDatabase: {
        atp: [
            { id: 1, name: 'Novak Djokovic', country: 'SRB', rank: 1 },
            { id: 2, name: 'Carlos Alcaraz', country: 'ESP', rank: 2 },
            { id: 3, name: 'Jannik Sinner', country: 'ITA', rank: 3 },
            { id: 4, name: 'Daniil Medvedev', country: 'RUS', rank: 4 },
            { id: 5, name: 'Alexander Zverev', country: 'GER', rank: 5 },
            { id: 6, name: 'Holger Rune', country: 'DEN', rank: 6 },
            { id: 7, name: 'Stefanos Tsitsipas', country: 'GRE', rank: 7 },
            { id: 8, name: 'Hubert Hurkacz', country: 'POL', rank: 8 },
            { id: 9, name: 'Casper Ruud', country: 'NOR', rank: 9 },
            { id: 10, name: 'Taylor Fritz', country: 'USA', rank: 10 },
            { id: 11, name: 'Felix Auger-Aliassime', country: 'CAN', rank: 11 },
            { id: 12, name: 'Tommy Paul', country: 'USA', rank: 12 },
            { id: 13, name: 'Cameron Norrie', country: 'GBR', rank: 13 },
            { id: 14, name: 'Frances Tiafoe', country: 'USA', rank: 14 },
            { id: 15, name: 'Alex de Minaur', country: 'AUS', rank: 15 }
        ],
        wtaFallback: [
            { id: 101, name: 'Iga Swiatek', country: 'POL', rank: 1 },
            { id: 102, name: 'Aryna Sabalenka', country: 'BLR', rank: 2 },
            { id: 103, name: 'Coco Gauff', country: 'USA', rank: 3 },
            { id: 104, name: 'Elena Rybakina', country: 'KAZ', rank: 4 },
            { id: 105, name: 'Jessica Pegula', country: 'USA', rank: 5 },
            { id: 106, name: 'Ons Jabeur', country: 'TUN', rank: 6 }
        ]
    },

    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        const player1Input = document.getElementById('h2hPlayer1');
        const player2Input = document.getElementById('h2hPlayer2');
        const onInput1 = window.TennisApp.Utils.debounce((e) => this.handleSearchInput(e, 1), 180);
        const onInput2 = window.TennisApp.Utils.debounce((e) => this.handleSearchInput(e, 2), 180);

        if (player1Input) {
            player1Input.addEventListener('input', onInput1);
            player1Input.addEventListener('focus', onInput1);
        }
        if (player2Input) {
            player2Input.addEventListener('input', onInput2);
            player2Input.addEventListener('focus', onInput2);
        }

        this.attachDropdownSelection(1);
        this.attachDropdownSelection(2);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.player-search-box')) {
                this.hideDropdown(1);
                this.hideDropdown(2);
            }
        });
    },

    attachDropdownSelection(playerNum) {
        const resultsDiv = document.getElementById(`h2hPlayer${playerNum}Results`);
        if (!resultsDiv) {
            return;
        }
        resultsDiv.addEventListener('click', (event) => {
            const item = event.target.closest('.search-result-item[data-player-id]');
            if (!item) {
                return;
            }
            const playerId = String(item.dataset.playerId || '');
            this.selectPlayerById(playerNum, playerId);
        });
    },

    hideDropdown(playerNum) {
        const resultsDiv = document.getElementById(`h2hPlayer${playerNum}Results`);
        if (!resultsDiv) {
            return;
        }
        resultsDiv.style.display = 'none';
    },

    async handleSearchInput(event, playerNum) {
        const query = (event.target.value || '').trim();
        const { AppState } = window.TennisApp;
        const tour = AppState.currentTour;
        if (!query) {
            this.lastSearchResults[playerNum] = [];
            this.renderSearchResults(playerNum, []);
            return;
        }

        if (tour === 'wta') {
            await this.searchWTAPlayers(query, playerNum);
            return;
        }
        if (tour === 'atp') {
            await this.searchATPPlayers(query, playerNum);
            return;
        }

        const players = this.playerDatabase.atp;
        const q = query.toLowerCase();
        const filtered = players
            .map((player) => {
                const name = player.name.toLowerCase();
                const tokens = name.split(/\s+/);
                let score = 0;
                if (name === q) score += 100;
                if (name.startsWith(q)) score += 40;
                if (name.includes(q)) score += 25;
                if (tokens.some((token) => token.startsWith(q))) score += 20;
                return { ...player, _score: score };
            })
            .filter((player) => player._score > 0)
            .sort((a, b) => b._score - a._score || (a.rank || 999) - (b.rank || 999))
            .slice(0, 8);

        this.lastSearchResults[playerNum] = filtered;
        this.renderSearchResults(playerNum, filtered);
    },

    async searchATPPlayers(query, playerNum) {
        const { API } = window.TennisApp;
        const token = ++this.searchToken[playerNum];

        try {
            const results = await API.searchATPH2HPlayers(query, 10);
            if (token !== this.searchToken[playerNum]) {
                return;
            }
            this.lastSearchResults[playerNum] = results || [];
            this.renderSearchResults(playerNum, results || []);
        } catch (error) {
            if (token !== this.searchToken[playerNum]) {
                return;
            }
            console.error('ATP H2H search failed:', error);
            this.lastSearchResults[playerNum] = [];
            this.renderSearchResults(playerNum, []);
        }
    },

    async searchWTAPlayers(query, playerNum) {
        const { API } = window.TennisApp;
        const token = ++this.searchToken[playerNum];

        try {
            const results = await API.searchWTAH2HPlayers(query, 10);
            if (token !== this.searchToken[playerNum]) {
                return;
            }
            this.lastSearchResults[playerNum] = results || [];
            this.renderSearchResults(playerNum, results || []);
        } catch (error) {
            if (token !== this.searchToken[playerNum]) {
                return;
            }
            console.error('WTA H2H search failed:', error);
            const fallback = this.playerDatabase.wtaFallback.filter((player) => {
                const name = player.name.toLowerCase();
                const q = query.toLowerCase();
                return name.includes(q) || name.split(/\s+/).some((tokenPart) => tokenPart.startsWith(q));
            }).slice(0, 8);
            this.lastSearchResults[playerNum] = fallback;
            this.renderSearchResults(playerNum, fallback);
        }
    },

    renderSearchResults(playerNum, players) {
        const resultsDiv = document.getElementById(`h2hPlayer${playerNum}Results`);
        const { Utils, AppState } = window.TennisApp;
        const tourLabel = (AppState.currentTour || 'wta').toUpperCase();
        if (!resultsDiv) {
            return;
        }
        if (!players || players.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item is-empty">No players found</div>';
            resultsDiv.style.display = 'block';
            return;
        }

        resultsDiv.innerHTML = players.map((player) => `
            <div class="search-result-item" data-player-id="${player.id}">
                <img src="${Utils.getPlayerImage(player)}" alt="${player.name}">
                <div class="search-result-info">
                    <div class="search-result-name">${Utils.getFlag(player.country)} ${player.name}</div>
                    <div class="search-result-rank">${player.rank ? `Rank #${player.rank}` : `${tourLabel} Player`}</div>
                </div>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    },

    selectPlayerById(playerNum, playerId) {
        const player = (this.lastSearchResults[playerNum] || []).find((p) => String(p.id) === String(playerId));
        if (!player) {
            return;
        }

        if (playerNum === 1) {
            this.selectedPlayer1 = player;
            document.getElementById('h2hPlayer1').value = player.name;
        } else {
            this.selectedPlayer2 = player;
            document.getElementById('h2hPlayer2').value = player.name;
        }
        this.hideDropdown(playerNum);

        if (this.selectedPlayer1 && this.selectedPlayer2) {
            this.showComparison();
        }
    },

    async showComparison() {
        const { AppState, API, Utils } = window.TennisApp;
        const p1 = this.selectedPlayer1;
        const p2 = this.selectedPlayer2;
        const resultsDiv = document.getElementById('h2hResults');
        if (!resultsDiv || !p1 || !p2) {
            return;
        }

        resultsDiv.innerHTML = `
            <div class="h2h-loading">
                <div class="loading-spinner"></div>
                <span>Loading ${AppState.currentTour.toUpperCase()} head-to-head details...</span>
            </div>
        `;

        try {
            let payload;
            if (AppState.currentTour === 'atp') {
                const p1Code = p1.player_code || p1.id || '';
                const p2Code = p2.player_code || p2.id || '';
                payload = await API.getATPH2H(p1Code, p2Code, this.defaultYear, 5);
            } else {
                payload = await API.getWTAH2H(p1.id, p2.id, this.defaultYear, 5);
            }
            this.renderWTAComparison(payload, Utils);
            await this.renderRadarCharts(payload);
        } catch (error) {
            console.error('H2H fetch failed:', error);
            resultsDiv.innerHTML = `
                <div class="h2h-empty-state">
                    <h4>Unable to load H2H details</h4>
                    <p>Try selecting the players again or refresh the page.</p>
                </div>
            `;
        }
    },

    renderWTAComparison(payload, Utils) {
        const data = payload || {};
        const p1 = (data.players || {}).player1 || this.selectedPlayer1;
        const p2 = (data.players || {}).player2 || this.selectedPlayer2;
        const h2h = data.head_to_head || {};
        const careerSummary = data.career_summary || {};
        const p1Career = careerSummary.player1 || {};
        const p2Career = careerSummary.player2 || {};
        const surfaces = data.career_surface_records || {};
        const meetings = data.past_meetings || [];
        const seasonYear = ((data.season_stats || {}).year) || this.defaultYear;
        const tourCode = ((data.tour || window.TennisApp.AppState.currentTour || 'wta') + '').toLowerCase();
        const tourLabel = tourCode === 'atp' ? 'ATP' : 'WTA';
        const hasRadar = (
            ((data.season_stats || {}).serving || []).length > 0
            || ((data.season_stats || {}).returning || []).length > 0
        );

        const availableSurfaceKeys = Object.keys(surfaces).filter(
            (surfaceKey) => !`${surfaceKey}`.toLowerCase().includes('carpet')
        );
        const orderedSurfaces = availableSurfaceKeys.length > 0
            ? availableSurfaceKeys
            : (tourCode === 'wta' ? ['HARD', 'CLAY', 'GRASS'] : []);

        const surfaceRows = orderedSurfaces.map((surfaceKey) => {
            const record = surfaces[surfaceKey] || {};
            const p1Rec = record.player1 || {};
            const p2Rec = record.player2 || {};
            const p1Pct = Number.isFinite(p1Rec.winPercentage) ? Number(p1Rec.winPercentage) : 0;
            const p2Pct = Number.isFinite(p2Rec.winPercentage) ? Number(p2Rec.winPercentage) : 0;
            const label = `${surfaceKey.charAt(0)}${surfaceKey.slice(1).toLowerCase()} Court W/L`;
            return `
                <div class="h2h-surface-row">
                    <div class="h2h-surface-side left">
                        <div class="h2h-surface-record">${this.formatWinLoss(p1Rec.wins, p1Rec.losses)}</div>
                        <div class="h2h-surface-percent">${this.formatPercent(p1Rec.winPercentage)}</div>
                    </div>
                    <div class="h2h-surface-center">${label}</div>
                    <div class="h2h-surface-side right">
                        <div class="h2h-surface-record">${this.formatWinLoss(p2Rec.wins, p2Rec.losses)}</div>
                        <div class="h2h-surface-percent">${this.formatPercent(p2Rec.winPercentage)}</div>
                    </div>
                    <div class="h2h-surface-bars">
                        <div class="h2h-surface-track left">
                            <span class="h2h-surface-fill left" style="width: ${Math.max(0, Math.min(100, p1Pct))}%"></span>
                        </div>
                        <div class="h2h-surface-track right">
                            <span class="h2h-surface-fill right" style="width: ${Math.max(0, Math.min(100, p2Pct))}%"></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const meetingsHtml = meetings.length > 0
            ? meetings.map((match) => this.createMatchItem(match, p1, p2, Utils)).join('')
            : '<div class="h2h-empty-inline">No past meetings found.</div>';

        const careerRows = [
            {
                label: 'Singles Titles',
                p1: this.formatNullableNumber(p1Career.singles_titles),
                p2: this.formatNullableNumber(p2Career.singles_titles)
            },
            {
                label: 'Doubles Titles',
                p1: this.formatNullableNumber(p1Career.doubles_titles),
                p2: this.formatNullableNumber(p2Career.doubles_titles)
            },
            {
                label: 'Prize Money',
                p1: this.formatMoney(p1Career.prize_money),
                p2: this.formatMoney(p2Career.prize_money)
            },
            {
                label: 'W/L Singles',
                p1: this.formatWinLoss(p1Career.singles_wins, p1Career.singles_losses),
                p2: this.formatWinLoss(p2Career.singles_wins, p2Career.singles_losses)
            },
            {
                label: 'W/L Doubles',
                p1: this.formatWinLoss(p1Career.doubles_wins, p1Career.doubles_losses),
                p2: this.formatWinLoss(p2Career.doubles_wins, p2Career.doubles_losses)
            }
        ];
        const careerRowsHtml = careerRows.map((row) => `
            <div class="h2h-career-row">
                <div class="h2h-career-value left">${row.p1}</div>
                <div class="h2h-career-label">${row.label}</div>
                <div class="h2h-career-value right">${row.p2}</div>
            </div>
        `).join('');

        const radarSection = hasRadar ? `
            <section class="h2h-radar-section">
                <div class="h2h-section-title-row">
                    <h4>Season Match Profile</h4>
                    <span class="h2h-season-pill">${seasonYear}</span>
                </div>
                <div class="h2h-radar-grid">
                    <div class="h2h-radar-card">
                        <div class="h2h-radar-heading">Serving</div>
                        <div id="h2hServingRadar" class="h2h-radar-canvas"></div>
                    </div>
                    <div class="h2h-radar-card">
                        <div class="h2h-radar-heading">Returning</div>
                        <div id="h2hReturningRadar" class="h2h-radar-canvas"></div>
                    </div>
                </div>
            </section>
        ` : '';

        const surfacesSection = orderedSurfaces.length > 0 ? `
            <section class="h2h-surfaces-section">
                <h4>Career Surface Records</h4>
                <div class="h2h-surface-grid">
                    ${surfaceRows}
                </div>
            </section>
        ` : '';

        const resultsDiv = document.getElementById('h2hResults');
        resultsDiv.innerHTML = `
            <div class="h2h-hero">
                <div class="h2h-hero-card">
                    <div class="h2h-hero-avatar">
                        <img src="${Utils.getPlayerImage(p1)}" alt="${p1.name}">
                    </div>
                    <div class="h2h-hero-meta">
                        <div class="h2h-hero-name">${p1.name}</div>
                        <div class="h2h-hero-rank">${Utils.getFlag(p1.country)} ${p1.rank ? `Rank #${p1.rank}` : tourLabel}</div>
                    </div>
                </div>
                <div class="h2h-hero-center">
                    <div class="h2h-record-score">${h2h.player1_wins || 0} - ${h2h.player2_wins || 0}</div>
                    <div class="h2h-record-label">Career H2H</div>
                    <div class="h2h-record-sub">Last ${h2h.recent_last_n || 0}: ${h2h.recent_player1_wins || 0} - ${h2h.recent_player2_wins || 0}</div>
                </div>
                <div class="h2h-hero-card h2h-hero-card-right">
                    <div class="h2h-hero-avatar">
                        <img src="${Utils.getPlayerImage(p2)}" alt="${p2.name}">
                    </div>
                    <div class="h2h-hero-meta">
                        <div class="h2h-hero-name">${p2.name}</div>
                        <div class="h2h-hero-rank">${Utils.getFlag(p2.country)} ${p2.rank ? `Rank #${p2.rank}` : tourLabel}</div>
                    </div>
                </div>
            </div>

            <section class="h2h-career-section">
                <h4>Career Stats</h4>
                <div class="h2h-career-grid">
                    ${careerRowsHtml}
                </div>
            </section>

            ${radarSection}
            ${surfacesSection}

            <section class="h2h-matches-section">
                <h4>Past Meetings</h4>
                <div class="h2h-matches-list">${meetingsHtml}</div>
            </section>
        `;
    },

    createMatchItem(match, p1, p2, Utils) {
        const winnerId = Number(match.winner_id);
        const winnerCode = String(match.winner_code || '').trim().toUpperCase();
        const p1Code = String(p1.player_code || '').trim().toUpperCase();
        const p2Code = String(p2.player_code || '').trim().toUpperCase();
        const category = match.category || 'other';
        const categoryClass = Utils.getCategoryClass(category);
        const surfaceClass = this.surfaceClass(match.surface);
        const p1IsWinner = (winnerId === Number(p1.id)) || (winnerCode && winnerCode === p1Code);
        const p2IsWinner = (winnerId === Number(p2.id)) || (winnerCode && winnerCode === p2Code);
        const roundText = this.formatRoundLabel(match.round, match.tournament || '');
        const setScores = Array.isArray(match.set_scores) ? match.set_scores : [];
        const setBoxes = this.renderSetScoreBoxes(setScores, match.score || '-');
        return `
            <div class="h2h-match-item ${surfaceClass}">
                <div class="h2h-match-top">
                    <div class="h2h-match-date">${match.date || '-'}</div>
                    <div class="h2h-match-pills">
                        <span class="category-badge ${categoryClass} h2h-category-pill">${match.category_label || 'Tour'}</span>
                        <span class="h2h-surface-pill ${surfaceClass}">${match.surface || 'Surface'}</span>
                    </div>
                </div>
                <div class="h2h-match-meta">
                    <div class="h2h-match-event-box">
                        <div class="h2h-match-tournament">
                            ${match.tournament || 'Tournament'}${roundText ? ` <span class="h2h-round-inline">· ${roundText}</span>` : ''}
                        </div>
                    </div>
                    <div class="h2h-match-score-box">
                        <span class="h2h-player-name ${p1IsWinner ? 'winner' : ''}">
                            ${p1IsWinner ? `<span class="h2h-name-pill ${surfaceClass}">${p1.name}</span>` : p1.name}
                        </span>
                        ${setBoxes}
                        <span class="h2h-player-name ${p2IsWinner ? 'winner' : ''}">
                            ${p2IsWinner ? `<span class="h2h-name-pill ${surfaceClass}">${p2.name}</span>` : p2.name}
                        </span>
                    </div>
                </div>
            </div>
        `;
    },

    formatRoundLabel(round, tournamentName = '') {
        const raw = `${round || ''}`.trim();
        if (!raw) {
            return '';
        }
        const upper = raw.toUpperCase();
        const tournamentUpper = `${tournamentName || ''}`.toUpperCase();
        const extractQualifierRound = (text) => {
            const value = `${text || ''}`.trim().toUpperCase();
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

        if (upper === 'F') return 'Final';
        if (upper === 'SF' || upper === 'S') return 'Semi Final';
        if (upper === 'QF' || upper === 'Q') return 'Quarter Final';
        if (upper === 'RR') return 'Round Robin';
        if (upper === 'R1') {
            if (tournamentUpper.includes('FINALS')) {
                return 'Round Robin';
            }
            return 'Round 1';
        }
        if (upper === 'R2') return 'Round 2';
        if (upper === 'R3') return 'Round 3';
        if (upper === 'R4') return 'Round 4';
        if (upper === 'R5') return 'Round 5';

        const roundOfMatch = upper.match(/^R(16|32|64|128)$/);
        if (roundOfMatch) {
            return `Round of ${roundOfMatch[1]}`;
        }

        const reversedRoundOfMatch = upper.match(/^(16|32|64|128)R$/);
        if (reversedRoundOfMatch) {
            return `Round of ${reversedRoundOfMatch[1]}`;
        }

        const nRoundMatch = upper.match(/^R(\d+)$/);
        if (nRoundMatch) {
            return `Round ${nRoundMatch[1]}`;
        }

        return raw;
    },

    renderSetScoreBoxes(setScores, rawScore) {
        if (!setScores || setScores.length === 0) {
            return `<span class="score-detail">${rawScore}</span>`;
        }
        const boxes = setScores.map((setRow, index) => {
            const leftGames = Number.isFinite(Number(setRow.left_games)) ? Number(setRow.left_games) : 0;
            const rightGames = Number.isFinite(Number(setRow.right_games)) ? Number(setRow.right_games) : 0;
            const winnerClass = setRow.left_won === true
                ? 'left-win'
                : (setRow.left_won === false ? 'right-win' : '');
            return `
                <span class="h2h-set-box ${winnerClass}" title="Set ${index + 1}: ${setRow.display || `${leftGames}-${rightGames}`}">
                    <span class="set-left">${leftGames}</span>
                    <span class="set-sep">-</span>
                    <span class="set-right">${rightGames}</span>
                </span>
            `;
        }).join('');
        return `<span class="h2h-set-grid">${boxes}</span>`;
    },

    surfaceClass(surface) {
        const value = (surface || '').toLowerCase();
        if (value.includes('grass')) return 'surface-grass';
        if (value.includes('clay')) return 'surface-clay';
        if (value.includes('indoor')) return 'surface-indoor';
        return 'surface-hard';
    },

    formatWinLoss(wins, losses) {
        const w = Number.isFinite(Number(wins)) ? Number(wins) : '-';
        const l = Number.isFinite(Number(losses)) ? Number(losses) : '-';
        if (w === '-' && l === '-') {
            return '-';
        }
        return `${w}/${l}`;
    },

    formatPercent(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '-';
        }
        return `${numeric.toFixed(1)}%`;
    },

    formatNullableNumber(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '-';
        }
        return `${numeric}`;
    },

    formatMoney(value) {
        const text = `${value || ''}`.trim();
        if (!text) {
            return '-';
        }
        if (text.startsWith('$')) {
            return text;
        }
        const cleaned = text.replace(/[^\d.]/g, '');
        if (!cleaned) {
            return text;
        }
        const numeric = Number(cleaned);
        if (!Number.isFinite(numeric)) {
            return text;
        }
        return `$${numeric.toLocaleString()}`;
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

    async renderRadarCharts(payload) {
        const data = payload || {};
        const seasonStats = data.season_stats || {};
        const p1 = (data.players || {}).player1 || this.selectedPlayer1 || {};
        const p2 = (data.players || {}).player2 || this.selectedPlayer2 || {};

        try {
            const plotly = await this.ensurePlotly();
            this.renderRadarChart(
                plotly,
                'h2hServingRadar',
                seasonStats.serving || [],
                p1.name || 'Player 1',
                p2.name || 'Player 2'
            );
            this.renderRadarChart(
                plotly,
                'h2hReturningRadar',
                seasonStats.returning || [],
                p1.name || 'Player 1',
                p2.name || 'Player 2'
            );
        } catch (error) {
            console.error('Radar rendering failed:', error);
        }
    },

    renderRadarChart(plotly, containerId, rows, player1Name, player2Name) {
        const container = document.getElementById(containerId);
        if (!container || !rows || rows.length === 0) {
            return;
        }

        const labels = rows.map((row) => row.label || row.key || '');
        const labelsClosed = labels.concat(labels[0]);
        const p1Norm = rows.map((row) => Number(row.player1_norm) || 0);
        const p2Norm = rows.map((row) => Number(row.player2_norm) || 0);
        const avgNorm = rows.map((row) => Number(row.tour_avg_norm) || 0);
        const p1Display = rows.map((row) => row.player1_display || '-');
        const p2Display = rows.map((row) => row.player2_display || '-');
        const avgDisplay = rows.map((row) => row.tour_avg_display || '-');

        const traces = [
            {
                type: 'scatterpolar',
                r: p1Norm.concat(p1Norm[0]),
                theta: labelsClosed,
                name: player1Name,
                line: { color: '#10C77D', width: 3 },
                marker: { color: '#10C77D', size: 6 },
                fill: 'toself',
                fillcolor: 'rgba(16, 199, 125, 0.16)',
                customdata: p1Display.concat(p1Display[0]),
                hovertemplate: `%{theta}: %{customdata}<extra>${player1Name}</extra>`
            },
            {
                type: 'scatterpolar',
                r: p2Norm.concat(p2Norm[0]),
                theta: labelsClosed,
                name: player2Name,
                line: { color: '#3FA7D6', width: 3 },
                marker: { color: '#3FA7D6', size: 6 },
                fill: 'toself',
                fillcolor: 'rgba(63, 167, 214, 0.14)',
                customdata: p2Display.concat(p2Display[0]),
                hovertemplate: `%{theta}: %{customdata}<extra>${player2Name}</extra>`
            },
            {
                type: 'scatterpolar',
                r: avgNorm.concat(avgNorm[0]),
                theta: labelsClosed,
                name: 'Tour avg',
                line: { color: '#FAFAF5', width: 2.5 },
                marker: { color: '#FAFAF5', size: 5 },
                fill: 'toself',
                fillcolor: 'rgba(250, 250, 245, 0.09)',
                customdata: avgDisplay.concat(avgDisplay[0]),
                hovertemplate: `%{theta}: %{customdata}<extra>Tour avg</extra>`
            }
        ];

        const layout = {
            margin: { l: 30, r: 30, t: 18, b: 20 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            showlegend: true,
            legend: {
                orientation: 'h',
                yanchor: 'bottom',
                y: 1.14,
                xanchor: 'center',
                x: 0.5,
                font: { size: 12, color: '#DDE8ED' }
            },
            polar: {
                bgcolor: 'rgba(0,0,0,0)',
                radialaxis: {
                    visible: true,
                    range: [0, 100],
                    showticklabels: false,
                    gridcolor: '#3A5E6F',
                    gridwidth: 1
                },
                angularaxis: {
                    tickfont: { size: 11, color: '#EDF7FC' },
                    gridcolor: '#3A5E6F',
                    linecolor: '#3A5E6F'
                }
            }
        };

        const config = { responsive: true, displayModeBar: false };
        plotly.react(container, traces, layout, config);
    },

    reset() {
        this.selectedPlayer1 = null;
        this.selectedPlayer2 = null;
        this.lastSearchResults = { 1: [], 2: [] };
        this.searchToken = { 1: 0, 2: 0 };
        const input1 = document.getElementById('h2hPlayer1');
        const input2 = document.getElementById('h2hPlayer2');
        const results = document.getElementById('h2hResults');
        if (input1) input1.value = '';
        if (input2) input2.value = '';
        if (results) results.innerHTML = '';
        this.hideDropdown(1);
        this.hideDropdown(2);
    }
};

window.H2HModule = H2HModule;
