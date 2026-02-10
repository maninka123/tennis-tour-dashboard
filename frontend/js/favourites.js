/**
 * Favourites Module — Manage favourite players per tour (ATP / WTA)
 * Stores in localStorage, supports search-to-add, live-match glow,
 * and click-to-open player card.
 */
const FavouritesModule = {

    STORAGE_KEY: 'rallycourt_favourites',

    /** { atp: [ {id, name, rank, country, image_url} ], wta: [...] } */
    data: { atp: [], wta: [] },

    /** Search state */
    searchToken: 0,
    lastSearchResults: [],

    /* ────────────────────────── Bootstrap ────────────────────────── */

    init() {
        this.load();
        this.attachEvents();
    },

    /* ──────────────────────── Persistence ─────────────────────── */

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data.atp = Array.isArray(parsed.atp) ? parsed.atp : [];
                this.data.wta = Array.isArray(parsed.wta) ? parsed.wta : [];
            }
        } catch { /* ignore */ }
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    },

    /* ─────────────────────── Helpers ──────────────────────────── */

    currentTour() {
        return window.TennisApp?.AppState?.currentTour || 'atp';
    },

    list(tour) {
        return this.data[tour || this.currentTour()] || [];
    },

    has(tour, playerId) {
        return this.list(tour).some(p => String(p.id) === String(playerId));
    },

    add(tour, player) {
        if (this.has(tour, player.id)) return;
        this.data[tour].push({
            id: player.id,
            name: player.name,
            rank: player.rank || null,
            country: player.country || '',
            image_url: player.image_url || '',
            player_code: player.player_code || ''
        });
        this.save();
    },

    remove(tour, playerId) {
        this.data[tour] = this.data[tour].filter(p => String(p.id) !== String(playerId));
        this.save();
    },

    /* ─────────── Live-match presence check ─────────── */

    /** Returns Set of lowercase player names currently in live matches for the tour */
    getLivePlayers(tour) {
        const matches = window.TennisApp?.AppState?.liveScores?.[tour] || [];
        const names = new Set();
        matches.forEach(m => {
            if (m.player1?.name) names.add(m.player1.name.toLowerCase());
            if (m.player2?.name) names.add(m.player2.name.toLowerCase());
        });
        return names;
    },

    getLiveMatchMap(tour) {
        const matches = window.TennisApp?.AppState?.liveScores?.[tour] || [];
        const byName = new Map();
        matches.forEach((m) => {
            const p1 = String(m?.player1?.name || '').trim().toLowerCase();
            const p2 = String(m?.player2?.name || '').trim().toLowerCase();
            if (p1 && !byName.has(p1)) byName.set(p1, m);
            if (p2 && !byName.has(p2)) byName.set(p2, m);
        });
        return byName;
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatLiveScoreLine(match, playerName = '') {
        const me = String(playerName || '').trim().toLowerCase();
        const p1Name = String(match?.player1?.name || '').trim().toLowerCase();
        const p2Name = String(match?.player2?.name || '').trim().toLowerCase();
        const iAmP1 = me && me === p1Name;
        const iAmP2 = me && me === p2Name;
        const shouldSwap = iAmP2 && !iAmP1;

        const score = match?.score || match?.final_score || {};
        const sets = Array.isArray(score?.sets) ? score.sets : [];
        const setLine = sets
            .map((set) => {
                const a = set?.p1 ?? '';
                const b = set?.p2 ?? '';
                if (a === '' && b === '') return '';
                const mine = shouldSwap ? b : a;
                const opp = shouldSwap ? a : b;
                return `${mine}-${opp}`;
            })
            .filter(Boolean)
            .join(' | ');
        const game = score?.current_game;
        let gameLine = '';
        if (game && (game.p1 || game.p2)) {
            const a = game.p1 || '0';
            const b = game.p2 || '0';
            const mine = shouldSwap ? b : a;
            const opp = shouldSwap ? a : b;
            gameLine = `(${mine}-${opp})`;
        }
        return [setLine, gameLine].filter(Boolean).join(' ');
    },

    getLiveMomentum(match, playerName) {
        const me = String(playerName || '').trim().toLowerCase();
        const p1Name = String(match?.player1?.name || '').trim().toLowerCase();
        const iAmP1 = me === p1Name;
        const score = match?.score || match?.final_score || {};
        const sets = Array.isArray(score?.sets) ? score.sets : [];

        const isCompletedSet = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
            const hi = Math.max(x, y);
            const lo = Math.min(x, y);
            if (hi >= 7 && lo <= 5) return true;
            if (hi === 7 && lo === 6) return true;
            if (hi >= 6 && (hi - lo) >= 2) return true;
            return false;
        };

        let myCompletedSets = 0;
        let oppCompletedSets = 0;
        let myCurrentSetGames = 0;
        let oppCurrentSetGames = 0;
        let foundCurrentSet = false;

        sets.forEach((set) => {
            const a = Number(set?.p1 ?? 0);
            const b = Number(set?.p2 ?? 0);
            const mine = iAmP1 ? a : b;
            const opp = iAmP1 ? b : a;
            if (!foundCurrentSet && !isCompletedSet(mine, opp)) {
                myCurrentSetGames = mine;
                oppCurrentSetGames = opp;
                foundCurrentSet = true;
                return;
            }
            if (mine > opp) myCompletedSets += 1;
            if (opp > mine) oppCompletedSets += 1;
        });

        const setDiff = myCompletedSets - oppCompletedSets;
        const currentSetGap = myCurrentSetGames - oppCurrentSetGames;
        const weightedEdge = (setDiff * 2) + currentSetGap;

        if (weightedEdge > 0) return { label: 'Winning', cls: 'winning' };
        if (weightedEdge < 0) return { label: 'Losing', cls: 'losing' };

        const pointToNumber = (value) => {
            const raw = String(value ?? '').toUpperCase().trim();
            if (!raw) return 0;
            if (raw === '0') return 0;
            if (raw === '15') return 1;
            if (raw === '30') return 2;
            if (raw === '40') return 3;
            if (raw === 'AD' || raw === 'AV' || raw === 'A') return 4;
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const game = score?.current_game || {};
        const minePts = pointToNumber(iAmP1 ? game.p1 : game.p2);
        const oppPts = pointToNumber(iAmP1 ? game.p2 : game.p1);
        const pointGap = minePts - oppPts;
        if (pointGap > 1) return { label: 'Winning', cls: 'winning' };
        if (pointGap < -1) return { label: 'Losing', cls: 'losing' };

        return { label: 'Balanced', cls: 'balanced' };
    },

    normalizeName(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z\s.-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    resolveOpponentProfile(opponentName, tour) {
        const target = this.normalizeName(opponentName);
        if (!target) return null;
        const rankings = window.TennisApp?.AppState?.rankings?.[tour] || [];
        if (!Array.isArray(rankings) || !rankings.length) return null;

        const targetParts = target.split(' ').filter(Boolean);
        const targetLast = targetParts[targetParts.length - 1] || '';
        const targetFirstInitial = (targetParts[0] || '')[0] || '';

        let best = null;
        let bestScore = -1;
        rankings.forEach((p) => {
            const name = this.normalizeName(p?.name || '');
            if (!name) return;
            const parts = name.split(' ').filter(Boolean);
            const last = parts[parts.length - 1] || '';
            const firstInitial = (parts[0] || '')[0] || '';
            let score = 0;
            if (name === target) score += 12;
            if (targetLast && (last === targetLast || last.startsWith(targetLast) || targetLast.startsWith(last))) score += 8;
            if (targetFirstInitial && firstInitial && targetFirstInitial === firstInitial) score += 3;
            if (target.includes(last) || name.includes(targetLast)) score += 2;
            if (score > bestScore) {
                bestScore = score;
                best = p;
            }
        });

        if (!best || bestScore < 8) return null;
        const apiBase = window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api';
        return {
            name: best.name,
            country: best.country || '',
            rank: best.rank || null,
            image: `${apiBase}/player/${tour}/${best.id}/image`
        };
    },

    buildLiveTooltip(match, playerName) {
        if (!match) return '';
        const me = String(playerName || '').trim().toLowerCase();
        const p1 = String(match?.player1?.name || '').trim();
        const p2 = String(match?.player2?.name || '').trim();
        const opponent = me === p1.toLowerCase() ? p2 : p1;
        const scoreLine = this.formatLiveScoreLine(match, playerName);
        const momentum = this.getLiveMomentum(match, playerName);
        const tournament = this.escapeHtml(match?.tournament || 'Live Match');
        const round = this.escapeHtml(match?.round || '');
        const opponentSafe = this.escapeHtml(opponent || 'TBD');
        const scoreSafe = this.escapeHtml(scoreLine || 'Score loading...');
        return `
            <span class="fav-live-tooltip" role="tooltip">
                <span class="fav-live-tooltip-title">${tournament}${round ? ` • ${round}` : ''}</span>
                <span class="fav-live-tooltip-row">
                    <span class="fav-live-state ${momentum.cls}">${momentum.label}</span>
                </span>
                <span class="fav-live-tooltip-row">vs ${opponentSafe}</span>
                <span class="fav-live-tooltip-row score">${scoreSafe}</span>
            </span>
        `;
    },

    openScheduleModal(player, tour) {
        const existing = document.getElementById('favScheduleOverlay');
        if (existing) existing.remove();
        document.body.classList.add('fav-schedule-open');
        const flag = window.TennisApp?.Utils?.getFlag ? window.TennisApp.Utils.getFlag(player?.country) : '';
        const overlay = document.createElement('div');
        overlay.id = 'favScheduleOverlay';
        overlay.className = 'fav-schedule-overlay active';
        overlay.innerHTML = `
            <div class="fav-schedule-modal">
                <div class="fav-schedule-head">
                    <div class="fav-schedule-title">
                        <i class="fas fa-calendar-check"></i>
                        <span>Next Match</span>
                    </div>
                    <button class="fav-schedule-close" type="button" aria-label="Close schedule">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="fav-schedule-player">${flag} ${this.escapeHtml(player?.name || 'Player')} • ${String(tour || '').toUpperCase()}</div>
                <div class="fav-schedule-body" id="favScheduleBody">
                    <div class="fav-schedule-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Fetching schedule...</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    closeScheduleModal() {
        const overlay = document.getElementById('favScheduleOverlay');
        if (overlay) overlay.remove();
        document.body.classList.remove('fav-schedule-open');
    },

    formatScheduleWhen(startTimestamp, fallback = '-') {
        if (!startTimestamp) return String(fallback || '-');
        const tsNum = Number(startTimestamp);
        if (!Number.isFinite(tsNum)) return String(fallback || '-');
        const dt = new Date(tsNum * 1000);
        if (Number.isNaN(dt.getTime())) return String(fallback || '-');

        const now = new Date();
        const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const targetKey = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
        const dayDiff = Math.round((targetKey - todayKey) / (24 * 60 * 60 * 1000));

        const timeText = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (dayDiff === 0) return `Today, ${timeText}`;
        if (dayDiff === 1) return `Tomorrow, ${timeText}`;
        const dateText = dt.toLocaleDateString([], { day: '2-digit', month: 'short' });
        return `${dateText}, ${timeText}`;
    },

    renderScheduleModalResult(payload) {
        const body = document.getElementById('favScheduleBody');
        if (!body) return;
        const isScheduled = payload && payload.scheduled === true;
        const isFinished = payload && payload.finished === true;
        const doublesOnly = payload && payload.doubles_only === true;

        if (!payload || (!isScheduled && !isFinished && !doublesOnly)) {
            const message = this.escapeHtml(payload?.message || 'No scheduled match available right now.');
            body.innerHTML = `
                <div class="fav-schedule-empty">
                    <i class="fas fa-calendar-xmark"></i>
                    <div class="fav-schedule-empty-title">No Scheduled Singles Match</div>
                    <div class="fav-schedule-empty-text">${message}</div>
                </div>
            `;
            return;
        }

        const currentTour = String(payload?.tour || this.currentTour() || '').toLowerCase() || this.currentTour();
        const tournament = this.escapeHtml(payload.tournament || (isFinished ? 'Latest Match' : 'Tournament'));
        const stageRaw = String(payload.stage || '-');
        const stage = this.escapeHtml(stageRaw);
        const isDoubles = doublesOnly || /DOUBLES/i.test(stageRaw) || payload?.is_doubles === true;
        const whenRaw = this.formatScheduleWhen(payload.start_timestamp, isFinished ? (payload.finished_time || '-') : (payload.scheduled_time || '-'));
        const when = this.escapeHtml(whenRaw);
        const competitionText = this.escapeHtml(payload.competition || [payload.tournament, payload.stage].filter(Boolean).join(' • '));
        const venueText = this.escapeHtml(payload.venue || '-');
        const locationText = this.escapeHtml(payload.location || '-');
        const groundText = this.escapeHtml(payload.ground_type || '-');
        const opponentRaw = String(payload.opponent || 'TBD');
        const opponent = this.escapeHtml(opponentRaw);
        const opponentProfile = (!isDoubles && opponentRaw && opponentRaw !== 'TBD')
            ? this.resolveOpponentProfile(opponentRaw, currentTour)
            : null;
        const sourceUrl = this.escapeHtml(payload.source_url || '');
        const matchUrl = this.escapeHtml(payload.match_url || '');
        const statusText = this.escapeHtml(
            payload.message || (
                isFinished
                    ? 'Finished. Waiting for next fixture updates.'
                    : (isDoubles ? 'No scheduled singles match. Next listed match is doubles.' : 'Scheduled singles match.')
            )
        );
        const outcome = String(payload.outcome || '').toUpperCase();
        const statusClass = doublesOnly
            ? 'neutral'
            : (isFinished
            ? (outcome === 'W' ? 'won' : outcome === 'L' ? 'lost' : 'neutral')
            : 'scheduled');
        const statusLabel = doublesOnly
            ? 'No Singles Scheduled'
            : (isFinished
            ? (outcome === 'W' ? 'Finished • Won' : outcome === 'L' ? 'Finished • Lost' : 'Finished')
            : (isDoubles ? 'Upcoming • Doubles' : 'Upcoming • Singles'));

        const opponentBlock = isDoubles
            ? `<div class="fav-schedule-note">Doubles event detected. Opponent card is hidden for team format.</div>`
            : (opponentProfile
                ? `
                <div class="fav-schedule-opponent">
                    <img src="${opponentProfile.image}" alt="${this.escapeHtml(opponentProfile.name)}" onerror="this.style.display='none'">
                    <div class="fav-schedule-opponent-text">
                        <div class="name">${this.escapeHtml(opponentProfile.name)}</div>
                        <div class="meta">${window.TennisApp?.Utils?.getFlag ? window.TennisApp.Utils.getFlag(opponentProfile.country) : ''} ${this.escapeHtml(opponentProfile.country || '')}${opponentProfile.rank ? ` • #${opponentProfile.rank}` : ''}</div>
                    </div>
                </div>`
                : `<div class="fav-schedule-row"><span class="label">Opponent</span><span class="value">${opponent}</span></div>`);

        body.innerHTML = `
            <div class="fav-schedule-card">
                <div class="fav-schedule-status ${statusClass}">${statusLabel}</div>
                <div class="fav-schedule-when"><i class="fas fa-clock"></i> ${when}</div>
                <div class="fav-schedule-row">
                    <span class="label">Competition</span>
                    <span class="value">${competitionText}</span>
                </div>
                <div class="fav-schedule-row">
                    <span class="label">Venue</span>
                    <span class="value">${venueText}</span>
                </div>
                <div class="fav-schedule-row">
                    <span class="label">Location</span>
                    <span class="value">${locationText}</span>
                </div>
                <div class="fav-schedule-row">
                    <span class="label">Ground</span>
                    <span class="value">${groundText}</span>
                </div>
                ${opponentBlock}
                <div class="fav-schedule-note">${statusText}</div>
                <div class="fav-schedule-links">
                    ${matchUrl ? `<a href="${matchUrl}" target="_blank" rel="noopener noreferrer">Match details</a>` : ''}
                    ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Player page</a>` : ''}
                </div>
            </div>
        `;
    },

    /** Check if ANY favourite in the given tour is live */
    hasAnyLive(tour) {
        const live = this.getLivePlayers(tour);
        return this.list(tour).some(p => live.has(p.name.toLowerCase()));
    },

    /* ───────────────────── UI — Icon Glow ───────────────────── */

    updateIconGlow() {
        const btn = document.getElementById('favouritesBtn');
        if (!btn) return;
        const tour = this.currentTour();
        const anyLive = this.hasAnyLive(tour);
        btn.classList.toggle('fav-glow', anyLive);
    },

    /* ───────────────────── UI — Panel ─────────────────────── */

    open() {
        const panel = document.getElementById('favouritesPanel');
        if (!panel) return;
        panel.classList.add('active');
        this.render();
        // Focus search input
        setTimeout(() => {
            const input = document.getElementById('favSearchInput');
            if (input) input.focus();
        }, 80);
    },

    close() {
        const panel = document.getElementById('favouritesPanel');
        if (panel) panel.classList.remove('active');
        this.clearSearch();
    },

    toggle() {
        const panel = document.getElementById('favouritesPanel');
        if (panel?.classList.contains('active')) this.close();
        else this.open();
    },

    /* ────────────────── Render favourite list ───────────────── */

    render() {
        const container = document.getElementById('favListContainer');
        if (!container) return;

        const tour = this.currentTour();
        const favs = this.list(tour);
        const live = this.getLivePlayers(tour);
        const liveMatchMap = this.getLiveMatchMap(tour);
        const Utils = window.TennisApp?.Utils || {};

        if (favs.length === 0) {
            container.innerHTML = `
                <div class="fav-empty">
                    <i class="fas fa-star"></i>
                    <p>No favourite players yet</p>
                    <span>Use the search above to add players</span>
                </div>`;
            return;
        }

        const apiBase = window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api';
        const rankings = window.TennisApp?.AppState?.rankings?.[tour] || [];

        container.innerHTML = favs.map(player => {
            const playerKey = String(player.name || '').toLowerCase();
            const isLive = live.has(playerKey);
            const liveMatch = isLive ? liveMatchMap.get(playerKey) : null;
            const flag = typeof Utils.getFlag === 'function' ? Utils.getFlag(player.country) : '';
            // Use backend local image API — ATP uses player_code, WTA uses numeric id
            // Look up player_code from rankings if not stored on the favourite
            let pCode = player.player_code;
            if (tour === 'atp' && !pCode) {
                const match = rankings.find(r => String(r.id) === String(player.id));
                if (match?.player_code) {
                    pCode = match.player_code;
                    player.player_code = pCode; // cache for next render
                    this.save();
                }
            }
            const imageId = (tour === 'atp' && pCode) ? pCode : player.id;
            const imgSrc = `${apiBase}/player/${tour}/${imageId}/image`;

            // Build initials fallback
            const initials = player.name.split(' ').map(n => (n[0] || '')).join('').substring(0, 2).toUpperCase();

            return `
                <div class="fav-player-row ${isLive ? 'fav-live' : ''}" data-player-id="${player.id}">
                    <div class="fav-player-info">
                        <div class="fav-player-img-wrap">
                            <img src="${imgSrc}" alt="${player.name}"
                                 onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><rect width=%2232%22 height=%2232%22 rx=%2216%22 fill=%22%234A90E2%22/><text x=%2216%22 y=%2218%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22 font-size=%2212%22 font-weight=%22700%22>${initials}</text></svg>'">
                        </div>
                        <div class="fav-player-text">
                            <span class="fav-player-name">${flag} ${player.name}</span>
                            <span class="fav-player-rank">${player.rank ? '#' + player.rank : ''} ${isLive ? `<span class="fav-live-status" aria-label="Player live now"><span class="fav-live-dot"></span><span class="fav-live-badge">LIVE</span></span>` : ''}</span>
                        </div>
                    </div>
                    ${isLive ? this.buildLiveTooltip(liveMatch, player.name) : ''}
                    <div class="fav-player-actions">
                        <button class="fav-schedule-btn" title="View upcoming schedule" data-id="${player.id}">
                            <i class="fas fa-calendar-day"></i>
                        </button>
                        <button class="fav-remove-btn" title="Remove from favourites" data-id="${player.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');
    },

    /* ──────────────────── Search / Add ──────────────────────── */

    clearSearch() {
        const input = document.getElementById('favSearchInput');
        const dropdown = document.getElementById('favSearchResults');
        if (input) input.value = '';
        if (dropdown) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; }
        this.lastSearchResults = [];
    },

    async handleSearch(query) {
        const { API, AppState } = window.TennisApp;
        const tour = this.currentTour();

        if (!query || query.length < 2) {
            this.renderSearchResults([]);
            return;
        }

        const token = ++this.searchToken;

        try {
            let results = [];
            if (tour === 'wta') {
                results = await API.searchWTAH2HPlayers(query, 10);
            } else {
                results = await API.searchATPH2HPlayers(query, 10);
            }
            if (token !== this.searchToken) return;
            this.lastSearchResults = results || [];
            this.renderSearchResults(results || []);
        } catch {
            if (token !== this.searchToken) return;
            // Fallback: search rankings locally
            const rankings = AppState.rankings[tour] || [];
            const q = query.toLowerCase();
            const filtered = rankings
                .filter(p => p.name?.toLowerCase().includes(q))
                .slice(0, 10);
            this.lastSearchResults = filtered;
            this.renderSearchResults(filtered);
        }
    },

    renderSearchResults(players) {
        const dropdown = document.getElementById('favSearchResults');
        if (!dropdown) return;
        const Utils = window.TennisApp?.Utils || {};
        const tour = this.currentTour();

        if (!players || players.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.innerHTML = players.map(player => {
            const already = this.has(tour, player.id);
            const flag = typeof Utils.getFlag === 'function' ? Utils.getFlag(player.country) : '';
            return `
                <div class="fav-search-item ${already ? 'fav-already-added' : ''}" data-player-id="${player.id}">
                    <div class="fav-search-info">
                        <span class="fav-search-name">${flag} ${player.name}</span>
                        <span class="fav-search-rank">${player.rank ? 'Rank #' + player.rank : ''}</span>
                    </div>
                    ${already
                        ? '<span class="fav-search-check"><i class="fas fa-check"></i></span>'
                        : '<button class="fav-search-add"><i class="fas fa-plus"></i></button>'}
                </div>`;
        }).join('');
        dropdown.style.display = 'block';
    },

    /* ─────────────────────── Events ─────────────────────────── */

    attachEvents() {
        // Toggle panel
        document.addEventListener('click', (e) => {
            if (e.target.closest('#favouritesBtn')) {
                this.toggle();
                return;
            }
            if (e.target.closest('#favCloseBtn')) {
                this.close();
                return;
            }
            // Click outside panel closes it
            const panel = document.getElementById('favouritesPanel');
            if (panel?.classList.contains('active')
                && !e.target.closest('#favouritesPanel')
                && !e.target.closest('#favouritesBtn')) {
                this.close();
            }
        });

        // Search input
        document.addEventListener('input', (e) => {
            if (e.target.id === 'favSearchInput') {
                const q = e.target.value.trim();
                if (this._searchDebounce) clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => this.handleSearch(q), 200);
            }
        });

        // Add from search results
        document.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.fav-search-add');
            if (addBtn) {
                const item = addBtn.closest('.fav-search-item');
                const playerId = item?.dataset?.playerId;
                if (!playerId) return;
                const player = this.lastSearchResults.find(p => String(p.id) === String(playerId));
                if (player) {
                    this.add(this.currentTour(), player);
                    this.render();
                    this.clearSearch();
                    this.updateIconGlow();
                }
                return;
            }

            // Remove favourite
            const removeBtn = e.target.closest('.fav-remove-btn');
            if (removeBtn) {
                const id = removeBtn.dataset.id;
                if (id) {
                    this.remove(this.currentTour(), id);
                    this.render();
                    this.updateIconGlow();
                }
                return;
            }

            // Click on favourite player row → open stats card
            const playerRow = e.target.closest('.fav-player-info');
            if (playerRow) {
                const row = playerRow.closest('.fav-player-row');
                const playerId = row?.dataset?.playerId;
                if (playerId && window.PlayerModule) {
                    this.close();
                    window.PlayerModule.showPlayerStats(playerId);
                }
                return;
            }

            // Schedule button
            const schedBtn = e.target.closest('.fav-schedule-btn');
            if (schedBtn) {
                const id = schedBtn.dataset.id;
                if (!id) return;
                const tour = this.currentTour();
                const player = this.list(tour).find((p) => String(p.id) === String(id));
                if (!player) return;
                this.openScheduleModal(player, tour);
                (async () => {
                    try {
                        const api = window.TennisApp?.API;
                        const payload = api?.getPlayerSchedule
                            ? await api.getPlayerSchedule(player.name, tour)
                            : null;
                        this.renderScheduleModalResult(payload || { scheduled: false, message: 'Schedule API unavailable.' });
                    } catch (error) {
                        this.renderScheduleModalResult({ scheduled: false, message: 'Could not fetch schedule right now.' });
                    }
                })();
                return;
            }

            // Close schedule modal
            if (e.target.closest('.fav-schedule-close')) {
                this.closeScheduleModal();
                return;
            }

            // Click outside modal card closes it
            const overlay = e.target.closest('#favScheduleOverlay');
            if (overlay && e.target === overlay) {
                this.closeScheduleModal();
                return;
            }
        });
    }
};

window.FavouritesModule = FavouritesModule;
