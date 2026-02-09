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
            const isLive = live.has(player.name.toLowerCase());
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
                    <div class="fav-player-info" title="View player card">
                        <div class="fav-player-img-wrap">
                            <img src="${imgSrc}" alt="${player.name}"
                                 onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><rect width=%2232%22 height=%2232%22 rx=%2216%22 fill=%22%234A90E2%22/><text x=%2216%22 y=%2218%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22 font-size=%2212%22 font-weight=%22700%22>${initials}</text></svg>'">
                        </div>
                        <div class="fav-player-text">
                            <span class="fav-player-name">${flag} ${player.name}</span>
                            <span class="fav-player-rank">${player.rank ? '#' + player.rank : ''} ${isLive ? '<span class="fav-live-badge">LIVE</span>' : ''}</span>
                        </div>
                    </div>
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
                // For now placeholder — will be wired up later
                console.log('Schedule requested for player:', id);
                return;
            }
        });
    }
};

window.FavouritesModule = FavouritesModule;
