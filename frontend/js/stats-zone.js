/**
 * Tennis Live Dashboard - Stat Zone Module
 * Supports both ATP and WTA leaderboard views.
 */

const StatZoneModule = {
    initialized: false,
    infoVisible: false,
    selectedBreakdown: null,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        const modal = document.getElementById('statsZoneModal');
        const breakdownModal = document.getElementById('statsZoneBreakdownModal');
        const infoBtn = document.getElementById('statsZoneInfoBtn');
        const refreshBtn = document.getElementById('statsZoneRefreshBtn');
        const content = document.getElementById('statsZoneContent');

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.close();
            });
        }
        if (breakdownModal) {
            breakdownModal.addEventListener('click', (e) => {
                if (e.target === breakdownModal) this.closeBreakdownModal();
            });
        }

        if (infoBtn) {
            infoBtn.addEventListener('click', () => {
                this.infoVisible = !this.infoVisible;
                this.render();
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const { AppState } = window.TennisApp;
                if (AppState.currentTour === 'wta') {
                    await window.TennisApp.refreshWtaStats();
                } else {
                    await window.TennisApp.refreshAtpStats();
                }
            });
        }

        if (content) {
            content.addEventListener('click', (e) => {
                const scoreBtn = e.target.closest('.stats-zone-score-btn[data-category][data-rank]');
                if (scoreBtn) {
                    const category = (scoreBtn.dataset.category || '').trim();
                    const rank = Number(scoreBtn.dataset.rank || 0);
                    if (!category || !rank) return;
                    this.selectedBreakdown = { category, rank };
                    this.openBreakdownModal();
                    return;
                }

                const playerBtn = e.target.closest('.stats-zone-player-name-btn[data-player-id]');
                if (playerBtn) {
                    const rawId = playerBtn.dataset.playerId || '';
                    const playerId = Number(rawId);
                    if (Number.isFinite(playerId) && playerId > 0 && window.PlayerModule) {
                        window.PlayerModule.showPlayerStats(playerId);
                    }
                }
            });
        }
    },

    formatRelativeTime(isoText) {
        if (!isoText) return 'Updated --';
        const then = new Date(isoText);
        if (Number.isNaN(then.getTime())) return 'Updated --';
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

    getTourConfig() {
        const { AppState } = window.TennisApp;
        const isWta = AppState.currentTour === 'wta';
        if (isWta) {
            return {
                key: 'wta',
                title: 'WTA Stat Zone',
                updatedBadge: '2 Categories • WTA Normalized Ratings',
                categoryOrder: ['serve', 'return'],
                categoryLabel: {
                    serve: 'Serving Leaders',
                    return: 'Returning Leaders'
                }
            };
        }

        return {
            key: 'atp',
            title: 'ATP Stat Zone',
            updatedBadge: '3 Categories • ATP Calculated Ratings',
            categoryOrder: ['serve', 'return', 'pressure'],
            categoryLabel: {
                serve: 'Serve Leaders',
                return: 'Return Leaders',
                pressure: 'Under Pressure'
            }
        };
    },

    getStatusState() {
        const { AppState } = window.TennisApp;
        return AppState.currentTour === 'wta' ? AppState.wtaStatsStatus : AppState.atpStatsStatus;
    },

    getDataState() {
        const { AppState } = window.TennisApp;
        return AppState.currentTour === 'wta' ? AppState.wtaStatsData : AppState.atpStatsData;
    },

    isRefreshing() {
        const { AppState } = window.TennisApp;
        return AppState.currentTour === 'wta' ? !!AppState.isUpdatingWtaStats : !!AppState.isUpdatingAtpStats;
    },

    syncHeaderState() {
        const { DOM } = window.TennisApp;
        const btn = DOM.statsZoneBtn;
        if (!btn) return;
        const cfg = this.getTourConfig();
        btn.disabled = false;
        btn.title = `Open ${cfg.title}`;
    },

    syncModalActions() {
        const refreshBtn = document.getElementById('statsZoneRefreshBtn');
        if (!refreshBtn) return;

        const refreshing = this.isRefreshing();
        refreshBtn.disabled = refreshing;
        refreshBtn.innerHTML = refreshing
            ? '<i class="fas fa-spinner fa-spin"></i>'
            : '<i class="fas fa-rotate-right"></i>';

        const cfg = this.getTourConfig();
        const label = refreshing ? `Updating ${cfg.key.toUpperCase()} stats` : `Update ${cfg.key.toUpperCase()} stats`;
        refreshBtn.setAttribute('title', label);
        refreshBtn.setAttribute('aria-label', label);
    },

    async open() {
        this.init();
        this.syncHeaderState();
        this.syncModalActions();

        const modal = document.getElementById('statsZoneModal');
        const title = document.getElementById('statsZoneTitle');
        if (!modal) return;

        const cfg = this.getTourConfig();
        if (title) title.textContent = cfg.title;

        modal.classList.add('active');
        await this.ensureDataLoaded();
        this.render();
    },

    close() {
        const modal = document.getElementById('statsZoneModal');
        if (modal) modal.classList.remove('active');
        this.closeBreakdownModal();
    },

    closeBreakdownModal() {
        const modal = document.getElementById('statsZoneBreakdownModal');
        if (modal) modal.classList.remove('active');
    },

    openBreakdownModal() {
        const modal = document.getElementById('statsZoneBreakdownModal');
        const body = document.getElementById('statsZoneBreakdownContent');
        const title = document.getElementById('statsZoneBreakdownTitle');
        if (!modal || !body) return;

        const data = this.getDataState() || {};
        const selected = this.getSelectedItem(data);
        const category = String(this.selectedBreakdown?.category || '').toUpperCase();
        if (title) {
            title.textContent = selected
                ? `${selected.player_name} • ${category} • #${selected.rank}`
                : 'Rating Breakdown';
        }
        body.innerHTML = this.renderBreakdown(data);
        modal.classList.add('active');
    },

    async ensureDataLoaded() {
        const { API, AppState } = window.TennisApp;
        const cfg = this.getTourConfig();
        const content = document.getElementById('statsZoneContent');
        if (content) {
            content.innerHTML = `<div class="stats-zone-empty">Loading ${cfg.key.toUpperCase()} stats...</div>`;
        }

        if (cfg.key === 'wta') {
            if (!AppState.wtaStatsStatus) {
                try {
                    AppState.wtaStatsStatus = await API.getWTAStatsStatus();
                } catch (error) {
                    console.error('Failed loading WTA stats status:', error);
                }
            }
            if (!AppState.wtaStatsData) {
                try {
                    AppState.wtaStatsData = await API.getWTAStatsLeaderboard();
                } catch (error) {
                    console.error('Failed loading WTA stats leaderboard:', error);
                }
            }
        } else {
            if (!AppState.atpStatsStatus) {
                try {
                    AppState.atpStatsStatus = await API.getATPStatsStatus();
                } catch (error) {
                    console.error('Failed loading ATP stats status:', error);
                }
            }
            if (!AppState.atpStatsData) {
                try {
                    AppState.atpStatsData = await API.getATPStatsLeaderboard();
                } catch (error) {
                    console.error('Failed loading ATP stats leaderboard:', error);
                }
            }
        }
    },

    getSelectedItem(data) {
        if (!this.selectedBreakdown || !data) return null;
        const rows = (((data.categories || {})[this.selectedBreakdown.category]) || []);
        return rows.find((row) => Number(row.rank) === Number(this.selectedBreakdown.rank)) || null;
    },

    renderTopCard(label, topItem, tourKey) {
        const img = window.TennisApp.Utils.getPlayerImage({
            id: topItem?.player_id || null,
            name: topItem?.player_name || 'Player',
            image_url: topItem?.image_url || ''
        }, tourKey);

        if (!topItem) {
            return `
                <div class="stats-zone-top-card">
                    <div class="stats-zone-top-label">${label}</div>
                    <div class="stats-zone-empty">No data</div>
                </div>
            `;
        }

        return `
            <div class="stats-zone-top-card">
                <div class="stats-zone-top-label">${label}</div>
                <div class="stats-zone-top-player">
                    <div class="stats-zone-top-avatar">
                        <img src="${img}" alt="${topItem.player_name}">
                    </div>
                    <div>
                        <div class="stats-zone-top-name">${topItem.player_name}</div>
                        <div class="stats-zone-top-score">${Number(topItem.rating || 0).toFixed(1)} rating</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderCategoryColumn(categoryKey, categoryLabel, rows, tourKey) {
        const items = (rows || []).map((row) => {
            const img = window.TennisApp.Utils.getPlayerImage({
                id: row.player_id || null,
                name: row.player_name || 'Player',
                image_url: row.image_url || ''
            }, tourKey);

            let profileOpen = `<span class="stats-zone-player-name">${row.player_name}</span>`;
            if (tourKey === 'wta') {
                const playerId = Number(row.player_id || 0);
                if (Number.isFinite(playerId) && playerId > 0) {
                    profileOpen = `<button type="button" class="stats-zone-player-name stats-zone-player-name-btn" data-player-id="${playerId}" title="Open player card">${row.player_name}</button>`;
                }
            } else if (row.profile_url) {
                profileOpen = `<a class="stats-zone-player-name" href="${row.profile_url}" target="_blank" rel="noopener noreferrer">${row.player_name}</a>`;
            }

            return `
                <div class="stats-zone-row">
                    <div class="stats-zone-rank">#${row.rank}</div>
                    <div class="stats-zone-player">
                        <div class="stats-zone-player-avatar"><img src="${img}" alt="${row.player_name}"></div>
                        ${profileOpen}
                    </div>
                    <button class="stats-zone-score-btn" data-category="${categoryKey}" data-rank="${row.rank}" title="Show breakdown">
                        ${Number(row.rating || 0).toFixed(1)}
                    </button>
                </div>
            `;
        }).join('');

        return `
            <section class="stats-zone-col">
                <div class="stats-zone-col-head">
                    <span>Rank</span>
                    <span>${categoryLabel}</span>
                    <span>Rating</span>
                </div>
                <div class="stats-zone-col-body">
                    ${items || '<div class="stats-zone-empty">No rows found.</div>'}
                </div>
            </section>
        `;
    },

    renderBreakdown(data) {
        const selected = this.getSelectedItem(data);
        if (!selected) {
            return '<div class="stats-zone-empty">Click any rating to see the exact calculation.</div>';
        }

        const details = selected.details || {};
        const metricDetails = Array.isArray(details.metrics) ? details.metrics : [];

        const metrics = metricDetails.length
            ? metricDetails.map((m) => {
                const minText = Number.isFinite(Number(m.min)) ? Number(m.min).toFixed(1) : '-';
                const maxText = Number.isFinite(Number(m.max)) ? Number(m.max).toFixed(1) : '-';
                const normText = Number.isFinite(Number(m.normalized)) ? Number(m.normalized).toFixed(1) : '-';
                const wText = Number.isFinite(Number(m.weight_pct)) ? Number(m.weight_pct).toFixed(1) : '-';
                return `
                    <div class="stats-zone-metric-item formula">
                        <span>${m.name}</span>
                        <strong>${m.raw_display || m.value || '-'}</strong>
                        <em>norm = ${normText}, w = ${wText}%</em>
                        <small>range [${minText}, ${maxText}]${m.lower_is_better ? ' • inverted' : ''}</small>
                    </div>
                `;
            }).join('')
            : (selected.metrics || []).map((m) => `
                <div class="stats-zone-metric-item">
                    <span>${m.name}</span>
                    <strong>${m.value}</strong>
                </div>
            `).join('');

        return `
            <div class="stats-zone-details">
                <h4>${selected.player_name} • ${String(this.selectedBreakdown.category || '').toUpperCase()} • #${selected.rank}</h4>
                <div class="stats-zone-metric-list">${metrics || '<div class="stats-zone-empty">No metric details available.</div>'}</div>
                <div class="stats-zone-equation">
                    <span>📐 Formula:</span>
                    <code>rating = Σ(norm(metric) × weight)</code>
                </div>
            </div>
        `;
    },

    renderInfoCards(formulas, categoryOrder, categoryLabel) {
        return categoryOrder.map((key) => {
            const text = (formulas || {})[key] || 'rating = Σ(norm(metric) × weight)';
            return `
                <div class="stats-zone-info-card">
                    <h5>${categoryLabel[key] || key}</h5>
                    <p>${text}</p>
                </div>
            `;
        }).join('');
    },

    render() {
        const content = document.getElementById('statsZoneContent');
        if (!content) return;

        const cfg = this.getTourConfig();
        const data = this.getDataState() || {};
        const status = this.getStatusState() || {};
        const categories = data.categories || {};
        const topPlayers = data.top_players || {};

        const updatedAt = status.updated_at || data.fetched_at || null;

        // Clear selected breakdown if current category/rank disappeared after refresh.
        if (this.selectedBreakdown) {
            const exists = ((categories[this.selectedBreakdown.category] || []).some((r) => Number(r.rank) === Number(this.selectedBreakdown.rank)));
            if (!exists) this.selectedBreakdown = null;
        }

        const formulaCards = this.renderInfoCards(data.formulas || {}, cfg.categoryOrder, cfg.categoryLabel);

        const topCards = cfg.categoryOrder.map((key) => {
            const label = cfg.categoryLabel[key] || key;
            return this.renderTopCard(label, topPlayers[key], cfg.key);
        }).join('');

        const columns = cfg.categoryOrder.map((key) => {
            return this.renderCategoryColumn(key, cfg.categoryLabel[key] || key, categories[key] || [], cfg.key);
        }).join('');

        const colClass = cfg.categoryOrder.length === 2 ? 'cols-2' : 'cols-3';

        content.innerHTML = `
            <div class="stats-zone-shell">
                <div class="stats-zone-meta">
                    <span class="stats-zone-updated">${this.formatRelativeTime(updatedAt)}</span>
                    <span class="stats-zone-badge">${cfg.updatedBadge}</span>
                </div>

                ${this.infoVisible ? `
                    <section class="stats-zone-info">
                        <h4>ℹ️ Rating Math (exact method)</h4>
                        <div class="stats-zone-info-grid ${colClass}">${formulaCards}</div>
                        <div class="stats-zone-equation-help">
                            <p>🧮 <code>norm(x) = (x - min) / (max - min) × 100</code></p>
                            <p>🔁 For lower-is-better metrics: <code>norm(x) = 100 - norm(x)</code></p>
                            <p>🏁 Final: <code>rating = Σ(norm(metric) × weight)</code></p>
                        </div>
                    </section>
                ` : ''}

                <section class="stats-zone-top-grid ${colClass}">
                    ${topCards}
                </section>

                <section class="stats-zone-grid ${colClass}">
                    ${columns}
                </section>
            </div>
        `;

        this.syncModalActions();
    }
};

window.StatZoneModule = StatZoneModule;
