import { APP_CONFIG } from './config.js';
import { DataService } from './data-service.js';
import {
  cappedText,
  escapeHtml,
  formatDate,
  formatNumber,
  formatPercent,
  getCategoryLabel,
  getFlagHtml,
  getSurfaceLabel,
} from './utils.js';

const service = new DataService();
const TOUR_NAME = APP_CONFIG.tourName || 'WTA';
const TOUR_LABEL = TOUR_NAME;
const HERO_SUBTITLE_BASE = `Player Explorer, Tournament Explorer, and Records Book powered by your local ${TOUR_NAME} CSV archive`;

const state = {
  loaded: false,
  loading: false,
  activeTab: 'players',
  activePlayerKey: '',
  playerSubtab: 'overview',
  selectedTournamentKey: '',
  playerFilters: {
    year: 'all',
    surface: 'all',
    category: 'all',
    result: 'all',
    query: '',
  },
  rankingFilters: {
    scale: 'log',
    range: 'all',
    mode: 'lines+markers',
    series: 'overlay',
  },
  tournamentDetailCollapsed: false,
  matchesInsightCollapsed: false,
  tournamentFilters: {
    search: '',
    category: 'all',
    surface: 'all',
    year: 'all',
  },
  recordCategory: 'all',
  selectedRecordKey: '',
  styleClusterModel: null,
  dnaTournamentKey: '',
  dnaTournamentPlayerKey: '',
};

const dom = {
  loadButton: document.getElementById('loadDataBtn'),
  loadStatus: document.getElementById('loadStatus'),
  loadProgress: document.getElementById('loadProgress'),
  heroSubtitle: document.getElementById('heroSubtitle'),
  mainTabs: document.getElementById('mainTabs'),

  panels: {
    players: document.getElementById('playersPanel'),
    tournaments: document.getElementById('tournamentsPanel'),
    records: document.getElementById('recordsPanel'),
  },

  playerSearch: document.getElementById('playerSearch'),
  playerSuggestions: document.getElementById('playerSuggestions'),
  playerHero: document.getElementById('playerHero'),
  playerSubtabs: document.getElementById('playerSubtabs'),
  playerOverview: document.getElementById('playerOverview'),
  playerMatches: document.getElementById('playerMatches'),
  playerRivalries: document.getElementById('playerRivalries'),
  playerRanking: document.getElementById('playerRanking'),
  playerMatchesTable: document.getElementById('playerMatchesTable'),
  playerMatchesInsights: document.getElementById('playerMatchesInsights'),
  playerRivalriesTable: document.getElementById('playerRivalriesTable'),
  rankingSummaryTiles: document.getElementById('rankingSummaryTiles'),
  rankingChart: document.getElementById('rankingChart'),
  rankingTimelineTable: document.getElementById('rankingTimelineTable'),
  rankingAdvancedPlots: document.getElementById('rankingAdvancedPlots'),

  playerYearFilter: document.getElementById('playerYearFilter'),
  playerSurfaceFilter: document.getElementById('playerSurfaceFilter'),
  playerCategoryFilter: document.getElementById('playerCategoryFilter'),
  playerResultFilter: document.getElementById('playerResultFilter'),
  playerMatchSearch: document.getElementById('playerMatchSearch'),
  rankingScaleFilter: document.getElementById('rankingScaleFilter'),
  rankingRangeFilter: document.getElementById('rankingRangeFilter'),
  rankingModeFilter: document.getElementById('rankingModeFilter'),
  rankingSeriesFilter: document.getElementById('rankingSeriesFilter'),

  tournamentSearch: document.getElementById('tournamentSearch'),
  tournamentCategoryFilter: document.getElementById('tournamentCategoryFilter'),
  tournamentSurfaceFilter: document.getElementById('tournamentSurfaceFilter'),
  tournamentYearFilter: document.getElementById('tournamentYearFilter'),
  tournamentSplitLayout: document.getElementById('tournamentSplitLayout'),
  tournamentDetailToggle: document.getElementById('tournamentDetailToggle'),
  tournamentTable: document.getElementById('tournamentTable'),
  tournamentDetail: document.getElementById('tournamentDetail'),
  tournamentModal: document.getElementById('tournamentModal'),
  tournamentModalTitle: document.getElementById('tournamentModalTitle'),
  tournamentModalMeta: document.getElementById('tournamentModalMeta'),
  tournamentModalBody: document.getElementById('tournamentModalBody'),
  tournamentModalClose: document.getElementById('tournamentModalClose'),

  recordCategoryFilter: document.getElementById('recordCategoryFilter'),
  recordsTable: document.getElementById('recordsTable'),
};

function setLoadStatus(message) {
  dom.loadStatus.textContent = message;
}

function setLoadProgress(percent) {
  dom.loadProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function renderHeroSubtitle() {
  if (!dom.heroSubtitle) return;

  const coverage = service.getCoverageSummary();
  const minYear = Number.isFinite(coverage?.minYear) ? coverage.minYear : 1968;
  const maxYear = Number.isFinite(coverage?.maxYear) ? coverage.maxYear : 2024;
  const liveRefreshEnabled = APP_CONFIG.enableLiveYearRefresh !== false;
  if (!liveRefreshEnabled) {
    dom.heroSubtitle.textContent = `${HERO_SUBTITLE_BASE} (${minYear}-${maxYear}, static dataset).`;
    return;
  }

  const liveYearSync = coverage?.liveYearSync || {};
  const liveYear = Number.isFinite(liveYearSync.year) ? liveYearSync.year : APP_CONFIG.liveYear;
  const latestLabel = liveYearSync.latestMatchDateIso ? formatDate(liveYearSync.latestMatchDateIso) : `Feb ${liveYear}`;

  if (!state.loaded) {
    dom.heroSubtitle.textContent = `${HERO_SUBTITLE_BASE} (${minYear}-${maxYear}, currently through Feb ${liveYear}; ${liveYear}.csv refreshes from internet on each load).`;
    return;
  }

  if (liveYearSync.sourceType === 'online') {
    dom.heroSubtitle.textContent = `${HERO_SUBTITLE_BASE} (${minYear}-${maxYear}, ${liveYear}.csv refreshed from internet on this load, now up to ${latestLabel}).`;
    return;
  }

  if (liveYearSync.sourceType === 'missing') {
    dom.heroSubtitle.textContent = `${HERO_SUBTITLE_BASE} (${minYear}-${maxYear}, ${liveYear}.csv could not be loaded from internet or local sources on this load).`;
    return;
  }

  dom.heroSubtitle.textContent = `${HERO_SUBTITLE_BASE} (${minYear}-${maxYear}, internet refresh for ${liveYear}.csv was unavailable on this load, using local fallback, now up to ${latestLabel}).`;
}

function renderMainTab() {
  const buttons = dom.mainTabs.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
  });

  Object.entries(dom.panels).forEach(([key, panel]) => {
    panel.classList.toggle('active', key === state.activeTab);
  });
}

function renderPlayerSubtab() {
  const buttons = dom.playerSubtabs.querySelectorAll('.subtab-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.subtab === state.playerSubtab);
  });

  dom.playerOverview.classList.toggle('active', state.playerSubtab === 'overview');
  dom.playerMatches.classList.toggle('active', state.playerSubtab === 'matches');
  dom.playerRivalries.classList.toggle('active', state.playerSubtab === 'rivalries');
  dom.playerRanking.classList.toggle('active', state.playerSubtab === 'ranking');
}

function renderEmptyTable(container, text) {
  container.innerHTML = `<div class="empty-placeholder">${escapeHtml(text)}</div>`;
}

function getPlayerImageCandidates(player) {
  if (Array.isArray(player?.imageCandidates) && player.imageCandidates.length) {
    return player.imageCandidates.filter((src) => String(src || '').trim());
  }
  if (String(player?.image || '').trim()) return [String(player.image).trim()];
  return [];
}

function renderAvatarImage(
  player,
  {
    className = 'avatar-xs',
    alt = '',
    inactive = false,
    zoomable = true,
    withActiveRing = true,
  } = {},
) {
  const sources = getPlayerImageCandidates(player);
  if (!sources.length) return '';

  const classList = [className];
  if (withActiveRing && !inactive) classList.push('active-player-ring');
  if (zoomable) classList.push('js-avatar-zoom');

  const encodedSources = encodeURIComponent(JSON.stringify(sources));
  return `<img class="${classList.join(' ')}" src="${escapeHtml(sources[0])}" alt="${escapeHtml(alt || player?.name || 'Player')}" loading="lazy" data-fallback-sources="${escapeHtml(encodedSources)}" data-fallback-index="0" data-player-active="${inactive ? '0' : '1'}">`;
}

function ensureImageViewer() {
  if (dom.imageViewer) return;
  const shell = document.createElement('div');
  shell.className = 'image-viewer-shell';
  shell.setAttribute('aria-hidden', 'true');
  shell.innerHTML = `
    <div class="image-viewer-backdrop" data-image-viewer-close></div>
    <div class="image-viewer-stage" role="dialog" aria-modal="true" aria-label="Player image preview">
      <button class="image-viewer-close" type="button" aria-label="Close image preview" data-image-viewer-close>&times;</button>
      <img class="image-viewer-img" src="" alt="Player image">
      <div class="image-viewer-caption"></div>
    </div>
  `;
  document.body.appendChild(shell);
  dom.imageViewer = shell;
  dom.imageViewerImg = shell.querySelector('.image-viewer-img');
  dom.imageViewerCaption = shell.querySelector('.image-viewer-caption');
}

function openImageViewerFromElement(imageEl) {
  const src = String(imageEl?.currentSrc || imageEl?.getAttribute('src') || '').trim();
  if (!src) return;
  ensureImageViewer();
  if (!dom.imageViewer || !dom.imageViewerImg) return;

  dom.imageViewerImg.src = src;
  dom.imageViewerImg.alt = imageEl.alt || 'Player image';
  if (dom.imageViewerCaption) {
    dom.imageViewerCaption.textContent = imageEl.alt || '';
  }

  const isActive = imageEl.dataset.playerActive === '1';
  dom.imageViewerImg.classList.toggle('active-player-ring', isActive);
  dom.imageViewer.classList.add('open');
  dom.imageViewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeImageViewer() {
  if (!dom.imageViewer?.classList.contains('open')) return;
  dom.imageViewer.classList.remove('open');
  dom.imageViewer.setAttribute('aria-hidden', 'true');
  if (dom.imageViewerImg) {
    dom.imageViewerImg.src = '';
  }
  if (!dom.tournamentModal?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
}

function handleAvatarImageError(imageEl) {
  const raw = String(imageEl?.dataset?.fallbackSources || '');
  if (!raw) return;

  let sources = [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(parsed)) sources = parsed.filter((src) => String(src || '').trim());
  } catch (error) {
    return;
  }
  if (!sources.length) return;

  const currentIndex = Number.parseInt(imageEl.dataset.fallbackIndex || '0', 10);
  const index = Number.isFinite(currentIndex) ? currentIndex : 0;
  const nextIndex = index + 1;
  if (nextIndex >= sources.length) {
    imageEl.removeAttribute('data-fallback-sources');
    return;
  }

  imageEl.dataset.fallbackIndex = String(nextIndex);
  imageEl.src = sources[nextIndex];
}

function renderPlayerHero() {
  const player = service.getPlayerByKey(state.activePlayerKey);
  if (!player) {
    dom.playerHero.innerHTML = '<div class="empty-placeholder">Pick a player from the search suggestions.</div>';
    return;
  }

  const latestDatasetYear = getDatasetLatestYear();
  const inactive = isLikelyInactivePlayer(player, latestDatasetYear);
  const rankText = Number.isFinite(player.currentRank) ? `Current Rank #${player.currentRank}` : 'Rank data unavailable';
  const bestRankText = Number.isFinite(player.bestRank) ? `Best Rank #${player.bestRank}` : 'Best rank unavailable';
  const statusBadge = inactive ? '<span class="status-badge inactive">Inactive</span>' : '';
  const heroImage = renderAvatarImage(player, {
    className: 'player-avatar',
    alt: player.name,
    inactive,
  });
  const metaParts = [
    !inactive ? `<span>${escapeHtml(rankText)}</span>` : '',
    `<span>${escapeHtml(bestRankText)}</span>`,
    `<span>${formatNumber(player.matches)} matches</span>`,
    player.profileUrl
      ? `<a href="${escapeHtml(player.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(TOUR_NAME)} Profile</a>`
      : '',
  ].filter(Boolean);

  dom.playerHero.innerHTML = `
    <div class="player-hero-head">
      ${heroImage}
      <div>
        <div class="player-name-line">
          ${getFlagHtml(player.countryCode)}
          <h3>${escapeHtml(player.name)}</h3>
          ${statusBadge}
        </div>
        <div class="player-meta-line">
          ${metaParts.join('<span>&bull;</span>')}
        </div>
      </div>
    </div>
  `;
}

function renderPlayerOverview() {
  const data = service.getPlayerOverview(state.activePlayerKey);
  if (!data) {
    renderEmptyTable(dom.playerOverview, 'No player selected.');
    return;
  }

  const { player, surfaces, categories, topTournaments } = data;

  const tiles = [
    { label: '📊 Matches', value: formatNumber(player.matches) },
    { label: '✅ Wins', value: formatNumber(player.wins) },
    { label: '❌ Losses', value: formatNumber(player.losses) },
    { label: '🔥 Win Rate', value: formatPercent(player.winPct) },
    { label: '🏆 Titles', value: formatNumber(player.titles) },
    { label: '🎯 Finals', value: formatNumber(player.finals) },
    { label: '⏱️ Avg Match Min', value: Number.isFinite(player.avgMinutes) ? `${player.avgMinutes.toFixed(0)} min` : '-' },
    { label: '📈 Best Rank', value: Number.isFinite(player.bestRank) ? `#${player.bestRank}` : '-' },
  ];

  const surfaceRows = surfaces.map((row) => `
    <div class="metric-row">
      <span>${getSurfaceLabel(row.surfaceClass)}</span>
      <div class="track"><div class="fill ${row.surfaceClass}" style="width:${Math.max(4, row.winPct)}%"></div></div>
      <span>${formatPercent(row.winPct)} (${row.wins}-${row.losses})</span>
    </div>
  `).join('');

  const categoryRows = categories.map((row) => `
    <tr>
      <td><span class="category-badge ${row.category}">${escapeHtml(row.label)}</span></td>
      <td>${formatNumber(row.wins)}</td>
      <td>${formatNumber(row.losses)}</td>
      <td>${formatPercent(row.winPct)}</td>
    </tr>
  `).join('');

  const topTournamentRows = topTournaments.map((row) => {
    const pct = row.matches > 0 ? (row.wins / row.matches) * 100 : 0;
    return `
      <tr>
        <td>${escapeHtml(cappedText(row.name, 28))}</td>
        <td><span class="category-badge ${row.category}">${escapeHtml(getCategoryLabel(row.category))}</span></td>
        <td><span class="surface-pill ${row.surfaceClass}">${escapeHtml(getSurfaceLabel(row.surfaceClass))}</span></td>
        <td>${row.wins}-${row.losses}</td>
        <td>${formatPercent(pct)}</td>
        <td>${escapeHtml(row.bestRound || '-')}</td>
        <td>${formatNumber(row.titles)}</td>
      </tr>
    `;
  }).join('');

  dom.playerOverview.innerHTML = `
    <div class="tiles-grid">
      ${tiles.map((tile) => `<article class="stat-tile"><p class="label">${tile.label}</p><div class="value">${tile.value}</div></article>`).join('')}
    </div>

    <section class="section-block">
      <h4>Surface Performance</h4>
      <div class="metric-bars">${surfaceRows || '<div class="small-note">No surface data available.</div>'}</div>
    </section>

    <section class="section-block">
      <h4>Tournament Type Performance</h4>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Type</th><th>Wins</th><th>Losses</th><th>Win %</th></tr></thead>
          <tbody>${categoryRows || '<tr><td colspan="4">No category data.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="section-block">
      <h4>Top Tournament Performance</h4>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tournament</th><th>Type</th><th>Surface</th><th>W-L</th><th>Win %</th><th>Best Round</th><th>Titles</th></tr></thead>
          <tbody>${topTournamentRows || '<tr><td colspan="7">No tournament summary yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="section-block analytics-block">
      <h4>Interactive Performance Intelligence</h4>
      <div class="analytics-grid">
        ${createAnalyticsCard('Surface Strength Matrix', 'Surface x tournament level win profile with titles/finals context', 'overviewSurfaceStrengthChart')}
        ${createAnalyticsCard('Elo Trajectory', 'Overall and surface-sensitive Elo movement', 'overviewEloTrajectoryChart')}
        ${createAnalyticsCard('Tournament DNA', 'Player context for tournament volatility and identity', 'overviewTournamentDNAChart')}
        ${createAnalyticsCard('Calendar Heatmap', 'Month-by-month win-rate trend by year', 'overviewCalendarHeatmapChart')}
        ${createAnalyticsCard('Serve-Return Archetype Map', 'Interpretable peer map with style quadrants and cluster context', 'overviewStyleClusterChart', 'analytics-card-wide', 'insight-plot-wide')}
      </div>
    </section>
  `;

  renderOverviewInsightCharts(player, topTournaments);
}

function refreshPlayerYearFilter() {
  const allRows = service.getPlayerMatches(state.activePlayerKey, {
    year: 'all', surface: 'all', category: 'all', result: 'all', query: ''
  });
  const years = [...new Set(allRows.map((row) => row.year))].sort((a, b) => b - a);

  const current = state.playerFilters.year;
  dom.playerYearFilter.innerHTML = '<option value="all">All years</option>'
    + years.map((y) => `<option value="${y}">${y}</option>`).join('');

  if (current !== 'all' && years.includes(Number(current))) {
    dom.playerYearFilter.value = current;
  } else {
    state.playerFilters.year = 'all';
    dom.playerYearFilter.value = 'all';
  }
}

function renderPlayerMatches() {
  const player = service.getPlayerByKey(state.activePlayerKey);
  if (!player) {
    renderEmptyTable(dom.playerMatchesTable, 'Pick a player first.');
    if (dom.playerMatchesInsights) renderEmptyTable(dom.playerMatchesInsights, 'Pick a player to unlock match intelligence plots.');
    return;
  }

  const rows = service.getPlayerMatches(state.activePlayerKey, state.playerFilters);
  if (!rows.length) {
    renderEmptyTable(dom.playerMatchesTable, 'No matches found for the selected filters.');
    if (dom.playerMatchesInsights) renderEmptyTable(dom.playerMatchesInsights, 'No match samples available for the current filters.');
    return;
  }

  const shown = rows.slice(0, 350);
  const latestDatasetYear = getDatasetLatestYear();
  const tableRows = shown.map((row) => {
    const opponent = service.getPlayerByKey(row.opponentKey);
    const opponentInactive = isLikelyInactivePlayer(opponent, latestDatasetYear);
    const opponentAvatar = renderAvatarImage(opponent, {
      className: 'avatar-xs',
      alt: row.opponentName,
      inactive: opponentInactive,
    });

    return `
      <tr>
        <td>${escapeHtml(formatDate(row.dateIso))}</td>
        <td>${escapeHtml(cappedText(row.tournament, 28))}</td>
        <td><span class="category-badge ${row.category}">${escapeHtml(row.categoryLabel)}</span></td>
        <td><span class="surface-pill ${row.surfaceClass}">${escapeHtml(getSurfaceLabel(row.surfaceClass))}</span></td>
        <td>${escapeHtml(row.round || '-')}</td>
        <td><span class="result-pill ${row.result}">${row.result}</span></td>
        <td>
          <span class="person-main">
            ${opponentAvatar}
            ${getFlagHtml(row.opponentCountryCode)}
            <span class="name">${escapeHtml(row.opponentName)}</span>
          </span>
        </td>
        <td>${escapeHtml(row.score || '-')}</td>
        <td>${Number.isFinite(row.playerRank) ? `#${row.playerRank}` : '-'}</td>
        <td>${Number.isFinite(row.opponentRank) ? `#${row.opponentRank}` : '-'}</td>
      </tr>
    `;
  }).join('');

  dom.playerMatchesTable.innerHTML = `
    <div class="small-note" style="padding:0.55rem 0.65rem;">Showing ${shown.length} of ${rows.length} matches</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Tournament</th>
          <th>Type</th>
          <th>Surface</th>
          <th>Round</th>
          <th>W/L</th>
          <th>Opponent</th>
          <th>Score</th>
          <th>Rank</th>
          <th>Opp Rank</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  renderMatchesInsightCharts();
}

function renderPlayerRivalries() {
  const player = service.getPlayerByKey(state.activePlayerKey);
  if (!player) {
    renderEmptyTable(dom.playerRivalriesTable, 'Pick a player first.');
    return;
  }

  const rivalries = service.getPlayerRivalries(state.activePlayerKey, 120);
  if (!rivalries.length) {
    renderEmptyTable(dom.playerRivalriesTable, 'No rivalry data available.');
    return;
  }

  const latestDatasetYear = getDatasetLatestYear();
  const rows = rivalries.map((r) => {
    const rival = service.getPlayerByKey(r.key);
    const rivalInactive = isLikelyInactivePlayer(rival, latestDatasetYear);
    const rivalAvatar = renderAvatarImage(rival, {
      className: 'avatar-xs',
      alt: r.name,
      inactive: rivalInactive,
    });

    return `
      <tr>
        <td>
          <span class="person-main">
            ${rivalAvatar}
            ${getFlagHtml(r.countryCode)}
            <span class="name">${escapeHtml(r.name)}</span>
          </span>
        </td>
        <td>${formatNumber(r.matches)}</td>
        <td>${formatNumber(r.wins)}</td>
        <td>${formatNumber(r.losses)}</td>
        <td>${formatPercent(r.winPct)}</td>
        <td><span class="result-pill ${r.lastResult}">${escapeHtml(r.lastResult || '-')}</span></td>
        <td>${escapeHtml(formatDate(r.lastDateIso))}</td>
        <td>${escapeHtml(cappedText(r.lastTournament, 22))}</td>
      </tr>
    `;
  }).join('');

  dom.playerRivalriesTable.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Opponent</th>
          <th>Matches</th>
          <th>Wins</th>
          <th>Losses</th>
          <th>Win %</th>
          <th>Last Result</th>
          <th>Last Match</th>
          <th>Last Tournament</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatSignedDelta(value) {
  if (!Number.isFinite(value) || value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

function getRangeStartDate(points, rangeKey) {
  if (!Array.isArray(points) || !points.length || rangeKey === 'all') return null;
  const latest = points[points.length - 1];
  if (!latest?.dateSort) return null;
  const latestDate = String(latest.dateSort);
  if (!/^\d{8}$/.test(latestDate)) return null;

  const year = Number(latestDate.slice(0, 4));
  const month = latestDate.slice(4, 6);
  const day = latestDate.slice(6, 8);
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);

  const yearsBack = {
    '10y': 10,
    '5y': 5,
    '3y': 3,
    '1y': 1,
  }[rangeKey];

  if (!yearsBack) return null;
  date.setUTCFullYear(date.getUTCFullYear() - yearsBack);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return Number(`${y}${m}${d}`);
}

function getRankingChartHeightPx() {
  if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) {
    return 442;
  }
  return 560;
}

const SURFACE_CLASS_ORDER = ['surface-hard', 'surface-clay', 'surface-grass', 'surface-indoor', 'surface-carpet'];
const CATEGORY_KEY_ORDER = ['grand-slam', 'masters-1000', 'finals', 'atp-500', 'atp-250', 'atp-125', 'other'];
const OPPONENT_BUCKETS = [
  { label: 'Top 5', max: 5 },
  { label: 'Top 10', max: 10 },
  { label: 'Top 20', max: 20 },
  { label: 'Top 50', max: 50 },
  { label: 'Top 100', max: 100 },
  { label: 'Top 200', max: 200 },
  { label: 'Top 500', max: 500 },
  { label: '500+', max: Number.POSITIVE_INFINITY },
];
const ALL_PLAYER_FILTERS = { year: 'all', surface: 'all', category: 'all', result: 'all', query: '' };

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function toSafeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function toSafePct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function scoreHasTiebreak(score) {
  const text = String(score || '');
  return /7-6|6-7/.test(text);
}

function getPlayerRowsAll() {
  return service.getPlayerMatches(state.activePlayerKey, ALL_PLAYER_FILTERS);
}

function sortRowsByDateAsc(rows) {
  return rows.slice().sort((a, b) => (a.dateSort || 0) - (b.dateSort || 0));
}

function analyticsPlotConfig(filename) {
  return {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
    doubleClick: 'reset',
    toImageButtonOptions: {
      filename,
      format: 'png',
    },
  };
}

function renderChartPlaceholder(container, text) {
  if (!container) return;
  if (window.Plotly) {
    window.Plotly.purge(container);
  }
  container.innerHTML = `<div class="empty-placeholder">${escapeHtml(text)}</div>`;
}

function analyticsBaseLayout() {
  return {
    margin: { l: 62, r: 28, t: 34, b: 58 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#f8fbff',
    font: { family: 'Manrope, sans-serif', color: '#223141' },
    hoverlabel: {
      bgcolor: '#ffffff',
      bordercolor: '#96abc2',
      font: { family: 'Manrope, sans-serif', size: 12, color: '#223141' },
      align: 'left',
    },
  };
}

function dotProduct(left, right) {
  let total = 0;
  for (let i = 0; i < left.length; i += 1) total += left[i] * right[i];
  return total;
}

function vectorNorm(vector) {
  return Math.sqrt(dotProduct(vector, vector));
}

function normalizeVector(vector) {
  const norm = vectorNorm(vector);
  if (norm === 0) return vector.map(() => 0);
  return vector.map((value) => value / norm);
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => dotProduct(row, vector));
}

function buildCovarianceMatrix(matrix) {
  if (!matrix.length) return [];
  const cols = matrix[0].length;
  const cov = Array.from({ length: cols }, () => Array.from({ length: cols }, () => 0));
  const scale = 1 / Math.max(1, matrix.length - 1);
  for (const row of matrix) {
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        cov[i][j] += row[i] * row[j];
      }
    }
  }
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      cov[i][j] *= scale;
    }
  }
  return cov;
}

function powerIteration(matrix, iterations = 80) {
  if (!matrix.length) return { vector: [], eigenvalue: 0 };
  const size = matrix.length;
  let vector = Array.from({ length: size }, (_, idx) => (idx + 1) / size);
  vector = normalizeVector(vector);
  for (let i = 0; i < iterations; i += 1) {
    vector = normalizeVector(multiplyMatrixVector(matrix, vector));
  }
  const mv = multiplyMatrixVector(matrix, vector);
  const eigenvalue = dotProduct(vector, mv);
  return { vector, eigenvalue };
}

function deflateMatrix(matrix, eigenvector, eigenvalue) {
  const size = matrix.length;
  const next = matrix.map((row) => row.slice());
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      next[i][j] -= eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }
  return next;
}

function nearestCentroidIndex(point, centroids) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < centroids.length; i += 1) {
    const dx = point[0] - centroids[i][0];
    const dy = point[1] - centroids[i][1];
    const distance = (dx * dx) + (dy * dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function runKMeans(points, clusterCount = 5, maxIterations = 24) {
  if (!points.length) return { labels: [], centroids: [] };
  const k = Math.max(2, Math.min(clusterCount, points.length));
  const stride = Math.max(1, Math.floor(points.length / k));
  const centroids = [];
  for (let i = 0; i < k; i += 1) {
    const idx = Math.min(points.length - 1, i * stride);
    centroids.push(points[idx].slice());
  }

  let labels = Array.from({ length: points.length }, () => 0);
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;
    for (let i = 0; i < points.length; i += 1) {
      const next = nearestCentroidIndex(points[i], centroids);
      if (labels[i] !== next) {
        labels[i] = next;
        changed = true;
      }
    }

    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    for (let i = 0; i < points.length; i += 1) {
      const label = labels[i];
      sums[label][0] += points[i][0];
      sums[label][1] += points[i][1];
      sums[label][2] += 1;
    }

    for (let i = 0; i < k; i += 1) {
      if (sums[i][2] > 0) {
        centroids[i][0] = sums[i][0] / sums[i][2];
        centroids[i][1] = sums[i][1] / sums[i][2];
      }
    }
    if (!changed) break;
  }
  return { labels, centroids };
}

function createAnalyticsCard(title, subtitle, plotId, cardClass = '', plotClass = '') {
  const articleClass = ['analytics-card', cardClass].filter(Boolean).join(' ');
  const chartClass = ['insight-plot', plotClass].filter(Boolean).join(' ');
  return `
    <article class="${articleClass}">
      <div class="analytics-card-head">
        <h5>${escapeHtml(title)}</h5>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div id="${escapeHtml(plotId)}" class="${chartClass}"></div>
    </article>
  `;
}

function setStyleMapInsightNote(container, html) {
  const card = container?.closest('.analytics-card');
  if (!card) return;
  let note = card.querySelector('.insight-note');
  const text = String(html || '').trim();
  if (!text) {
    if (note) note.remove();
    return;
  }
  if (!note) {
    note = document.createElement('p');
    note.className = 'insight-note';
    card.appendChild(note);
  }
  note.innerHTML = text;
}

function setAnalyticsCardDetail(container, text) {
  const card = container?.closest('.analytics-card');
  const head = card?.querySelector('.analytics-card-head');
  if (!head) return;

  let detail = head.querySelector('.analytics-card-detail');
  const value = String(text || '').trim();
  if (!value) {
    if (detail) detail.remove();
    return;
  }

  if (!detail) {
    detail = document.createElement('p');
    detail.className = 'analytics-card-detail';
    head.appendChild(detail);
  }
  detail.textContent = value;
}

function setAnalyticsCardDetailHtml(container, html, extraClass = '') {
  const card = container?.closest('.analytics-card');
  const head = card?.querySelector('.analytics-card-head');
  if (!head) return;

  let detail = head.querySelector('.analytics-card-detail');
  const value = String(html || '').trim();
  if (!value) {
    if (detail) detail.remove();
    return;
  }

  if (!detail) {
    detail = document.createElement('p');
    head.appendChild(detail);
  }

  detail.className = ['analytics-card-detail', extraClass].filter(Boolean).join(' ');
  detail.innerHTML = value;
}

function getRankedGrandSlamTournaments(player) {
  if (!player?.tournaments || typeof player.tournaments.values !== 'function') return [];
  return Array.from(player.tournaments.values())
    .filter((tournament) => tournament?.category === 'grand-slam' && tournament.matches > 0)
    .sort((a, b) => b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name))
    .slice(0, 4);
}

function shiftTournamentDnaGrandSlam(step = 1) {
  const overview = service.getPlayerOverview(state.activePlayerKey);
  const player = overview?.player;
  if (!player) return;

  const ranking = getRankedGrandSlamTournaments(player);
  if (ranking.length <= 1) return;

  const currentIndexRaw = ranking.findIndex((row) => row.key === state.dnaTournamentKey);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;
  const nextIndex = (currentIndex + step + ranking.length) % ranking.length;

  state.dnaTournamentKey = ranking[nextIndex].key;
  state.dnaTournamentPlayerKey = player.key;
  renderOverviewInsightCharts(player, overview.topTournaments);
}

function summarizeServeReturn(rows) {
  let totalServicePoints = 0;
  let totalAces = 0;
  let totalDfs = 0;
  let totalFirstIn = 0;
  let totalFirstWon = 0;
  let totalSecondWon = 0;
  let totalBpSaved = 0;
  let totalBpFaced = 0;
  let totalOppServicePoints = 0;
  let totalOppFirstWon = 0;
  let totalOppSecondWon = 0;
  let totalOppBpSaved = 0;
  let totalOppBpFaced = 0;
  let statRows = 0;

  for (const row of rows) {
    const servicePoints = toSafeNumber(row.servicePoints, NaN);
    if (!Number.isFinite(servicePoints) || servicePoints <= 0) continue;

    totalServicePoints += servicePoints;
    totalAces += toSafeNumber(row.aces);
    totalDfs += toSafeNumber(row.doubleFaults);
    totalFirstIn += toSafeNumber(row.firstIn);
    totalFirstWon += toSafeNumber(row.firstWon);
    totalSecondWon += toSafeNumber(row.secondWon);
    totalBpSaved += toSafeNumber(row.breakPointsSaved);
    totalBpFaced += toSafeNumber(row.breakPointsFaced);
    totalOppServicePoints += toSafeNumber(row.opponentServicePoints);
    totalOppFirstWon += toSafeNumber(row.opponentFirstWon);
    totalOppSecondWon += toSafeNumber(row.opponentSecondWon);
    totalOppBpSaved += toSafeNumber(row.opponentBreakPointsSaved);
    totalOppBpFaced += toSafeNumber(row.opponentBreakPointsFaced);
    statRows += 1;
  }

  if (statRows < 12 || totalServicePoints <= 0 || totalOppServicePoints <= 0) return null;

  const aceRate = totalAces / totalServicePoints;
  const dfRate = totalDfs / totalServicePoints;
  const firstServeWonPct = toSafePct(totalFirstWon, totalFirstIn);
  const secondServeWonPct = toSafePct(totalSecondWon, totalServicePoints - totalFirstIn);
  const returnPtsWonPct = toSafePct(totalOppServicePoints - totalOppFirstWon - totalOppSecondWon, totalOppServicePoints);
  const bpWonPct = toSafePct(totalOppBpFaced - totalOppBpSaved, totalOppBpFaced);
  const bpSavedPct = toSafePct(totalBpSaved, totalBpFaced);

  if (
    !isFiniteNumber(firstServeWonPct) ||
    !isFiniteNumber(secondServeWonPct) ||
    !isFiniteNumber(returnPtsWonPct) ||
    !isFiniteNumber(bpWonPct)
  ) return null;

  const aggressiveServeIndex = (aceRate * 100) - (dfRate * 100) + (0.35 * firstServeWonPct);
  const returnEfficiencyIndex = returnPtsWonPct + (0.25 * bpWonPct);

  return {
    statRows,
    aceRate,
    dfRate,
    firstServeWonPct,
    secondServeWonPct,
    returnPtsWonPct,
    bpWonPct,
    bpSavedPct,
    aggressiveServeIndex,
    returnEfficiencyIndex,
  };
}

function ensureStyleClusterModel() {
  if (state.styleClusterModel) return state.styleClusterModel;
  const players = service.getTopPlayers(240).filter((player) => player.matches >= 35);
  const active = service.getPlayerByKey(state.activePlayerKey);
  if (active && !players.some((player) => player.key === active.key)) {
    players.push(active);
  }

  const summaries = [];
  for (const player of players) {
    const rows = service.getPlayerMatches(player.key, ALL_PLAYER_FILTERS);
    const metrics = summarizeServeReturn(rows);
    if (!metrics) continue;
    summaries.push({
      key: player.key,
      name: player.name,
      matches: rows.length,
      winPct: player.winPct,
      features: [
        metrics.aceRate * 100,
        100 - (metrics.dfRate * 100),
        metrics.firstServeWonPct,
        metrics.secondServeWonPct,
        metrics.returnPtsWonPct,
        metrics.bpWonPct,
      ],
      aggressiveServeIndex: metrics.aggressiveServeIndex,
      returnEfficiencyIndex: metrics.returnEfficiencyIndex,
    });
  }

  if (summaries.length < 10) return null;
  const featureCount = summaries[0].features.length;
  const means = Array.from({ length: featureCount }, () => 0);
  const stds = Array.from({ length: featureCount }, () => 0);

  for (const row of summaries) {
    row.features.forEach((value, idx) => {
      means[idx] += value;
    });
  }
  for (let i = 0; i < featureCount; i += 1) means[i] /= summaries.length;

  for (const row of summaries) {
    row.features.forEach((value, idx) => {
      stds[idx] += (value - means[idx]) ** 2;
    });
  }
  for (let i = 0; i < featureCount; i += 1) {
    stds[i] = Math.sqrt(stds[i] / Math.max(1, summaries.length - 1));
    if (!Number.isFinite(stds[i]) || stds[i] < 1e-9) stds[i] = 1;
  }

  const normalized = summaries.map((row) => row.features.map((value, idx) => (value - means[idx]) / stds[idx]));
  const covariance = buildCovarianceMatrix(normalized);
  const first = powerIteration(covariance);
  const deflated = deflateMatrix(covariance, first.vector, first.eigenvalue);
  const second = powerIteration(deflated);

  const coords = normalized.map((row) => [
    dotProduct(row, first.vector),
    dotProduct(row, second.vector),
  ]);
  const kMeans = runKMeans(coords, 5, 30);

  const points = summaries.map((row, idx) => ({
    ...row,
    pc1: coords[idx][0],
    pc2: coords[idx][1],
    cluster: kMeans.labels[idx] ?? 0,
  }));

  state.styleClusterModel = {
    points,
    means,
    stds,
    components: [first.vector, second.vector],
    centroids: kMeans.centroids,
  };
  return state.styleClusterModel;
}

function classifyServeReturnArchetype(serveIndex, returnIndex, serveMean, returnMean) {
  const serveDelta = serveIndex - serveMean;
  const returnDelta = returnIndex - returnMean;
  if (serveDelta >= 0 && returnDelta >= 0) return 'Strong Serve + Return';
  if (serveDelta >= 0 && returnDelta < 0) return 'Serve-Driven';
  if (serveDelta < 0 && returnDelta >= 0) return 'Return-Driven';
  return 'Build Both Areas';
}

function renderSurfaceStrengthMatrixChart(container, rows) {
  if (!container) return;
  setAnalyticsCardDetail(container, `${TOUR_LABEL} level x surface win profile`);
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const categoryKeys = CATEGORY_KEY_ORDER.filter((key) => rows.some((row) => row.category === key));
  const surfaceKeys = SURFACE_CLASS_ORDER.filter((key) => rows.some((row) => row.surfaceClass === key));
  if (!categoryKeys.length || !surfaceKeys.length) {
    renderChartPlaceholder(container, 'Not enough data for surface strength matrix.');
    return;
  }

  const z = [];
  const text = [];
  const custom = [];
  const categoryLabels = categoryKeys.map((key) => getCategoryLabel(key));
  const surfaceLabels = surfaceKeys.map((key) => getSurfaceLabel(key));
  for (const surface of surfaceKeys) {
    const zRow = [];
    const tRow = [];
    const cRow = [];
    for (const category of categoryKeys) {
      const subset = rows.filter((row) => row.surfaceClass === surface && row.category === category);
      const matches = subset.length;
      const wins = subset.filter((row) => row.result === 'W').length;
      const losses = matches - wins;
      const finals = subset.filter((row) => String(row.round || '').toUpperCase() === 'F').length;
      const titles = subset.filter((row) => String(row.round || '').toUpperCase() === 'F' && row.result === 'W').length;
      const pct = toSafePct(wins, matches);
      zRow.push(pct);
      tRow.push(isFiniteNumber(pct) ? `${pct.toFixed(1)}%` : '');
      cRow.push([wins, losses, matches, titles, finals]);
    }
    z.push(zRow);
    text.push(tRow);
    custom.push(cRow);
  }

  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 76, r: 34, t: 36, b: 68 },
    xaxis: {
      type: 'category',
      categoryorder: 'array',
      categoryarray: categoryLabels,
      tickmode: 'array',
      tickvals: categoryLabels,
      ticktext: categoryLabels,
      tickson: 'boundaries',
      tickangle: -24,
      automargin: true,
    },
    yaxis: {
      type: 'category',
      categoryorder: 'array',
      categoryarray: surfaceLabels,
      tickmode: 'array',
      tickvals: surfaceLabels,
      ticktext: surfaceLabels,
      tickson: 'boundaries',
      automargin: true,
    },
  };

  window.Plotly.react(container, [{
    type: 'heatmap',
    x: categoryLabels,
    y: surfaceLabels,
    z,
    text,
    texttemplate: '%{text}',
    textfont: { color: '#10233b', size: 12, family: 'Space Grotesk, sans-serif' },
    customdata: custom,
    colorscale: [
      [0, '#7a1f1f'],
      [0.25, '#b53a3a'],
      [0.5, '#d96a6a'],
      [0.5001, '#9ec5fe'],
      [0.75, '#4f8fe8'],
      [1, '#1e4ea8'],
    ],
    zmin: 0,
    zmax: 100,
    xgap: 1,
    ygap: 1,
    hovertemplate:
      '<b>%{y}</b> • %{x}<br>' +
      'Win %: <b>%{z:.1f}%</b><br>' +
      'W-L: %{customdata[0]}-%{customdata[1]}<br>' +
      'Matches: %{customdata[2]}<br>' +
      'Titles / Finals: %{customdata[3]} / %{customdata[4]}' +
      '<extra></extra>',
    colorbar: { title: 'Win %' },
  }], layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_surface_strength_matrix`));
}

function renderStyleClusteringChart(container, playerRows) {
  if (!container) return;
  setAnalyticsCardDetail(container, 'Right = stronger serve pressure, up = stronger return control');
  if (!window.Plotly) {
    setStyleMapInsightNote(container, '');
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const model = ensureStyleClusterModel();
  if (!model || !Array.isArray(model.points) || !model.points.length) {
    setStyleMapInsightNote(container, '');
    renderChartPlaceholder(container, 'Not enough serve/return stats to build style clusters.');
    return;
  }

  const palette = ['#4f7fd1', '#2ea66f', '#c7736a', '#8c8f99', '#41b7c4'];
  const markerColors = model.points.map((point) => palette[point.cluster % palette.length]);
  const markerSizes = model.points.map((point) => Math.max(8, Math.min(17, 7 + Math.log10(Math.max(10, point.matches)) * 4)));
  const selected = service.getPlayerByKey(state.activePlayerKey);
  let selectedPoint = model.points.find((point) => point.key === selected?.key) || null;

  if (!selectedPoint && selected && model.components?.length === 2) {
    const summary = summarizeServeReturn(playerRows);
    if (summary) {
      const featureVector = [
        summary.aceRate * 100,
        100 - (summary.dfRate * 100),
        summary.firstServeWonPct,
        summary.secondServeWonPct,
        summary.returnPtsWonPct,
        summary.bpWonPct,
      ];
      const normalized = featureVector.map((value, idx) => (value - model.means[idx]) / model.stds[idx]);
      const point = [dotProduct(normalized, model.components[0]), dotProduct(normalized, model.components[1])];
      const cluster = model.centroids?.length ? nearestCentroidIndex(point, model.centroids) : 0;
      selectedPoint = {
        key: selected.key,
        name: selected.name,
        matches: playerRows.length,
        winPct: selected.winPct,
        aggressiveServeIndex: summary.aggressiveServeIndex,
        returnEfficiencyIndex: summary.returnEfficiencyIndex,
        pc1: point[0],
        pc2: point[1],
        cluster,
      };
    }
  }

  const peerXValues = model.points.map((point) => point.aggressiveServeIndex);
  const peerYValues = model.points.map((point) => point.returnEfficiencyIndex);
  const allXValues = selectedPoint
    ? [...peerXValues, selectedPoint.aggressiveServeIndex]
    : peerXValues.slice();
  const allYValues = selectedPoint
    ? [...peerYValues, selectedPoint.returnEfficiencyIndex]
    : peerYValues.slice();
  const xMean = peerXValues.reduce((sum, value) => sum + value, 0) / peerXValues.length;
  const yMean = peerYValues.reduce((sum, value) => sum + value, 0) / peerYValues.length;
  const xMin = Math.min(...allXValues);
  const xMax = Math.max(...allXValues);
  const yMin = Math.min(...allYValues);
  const yMax = Math.max(...allYValues);
  const xSpan = Math.max(0.01, xMax - xMin);
  const ySpan = Math.max(0.01, yMax - yMin);
  const xPad = Math.max(0.6, xSpan * 0.14);
  const yPad = Math.max(0.6, ySpan * 0.14);
  const xRange = [xMin - xPad, xMax + xPad];
  const yRange = [yMin - yPad, yMax + yPad];
  const selectedArchetype = classifyServeReturnArchetype(
    selectedPoint?.aggressiveServeIndex ?? xMean,
    selectedPoint?.returnEfficiencyIndex ?? yMean,
    xMean,
    yMean,
  );

  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 56, r: 16, t: 78, b: 60 },
    xaxis: { title: 'Serve Pressure Index', gridcolor: '#dce7f3', zeroline: false, range: xRange },
    yaxis: { title: 'Return Control Index', gridcolor: '#dce7f3', zeroline: false, range: yRange },
    shapes: [
      {
        type: 'line',
        x0: xMean,
        x1: xMean,
        y0: yRange[0],
        y1: yRange[1],
        line: { color: '#41566e', width: 1.4, dash: 'dash' },
      },
      {
        type: 'line',
        y0: yMean,
        y1: yMean,
        x0: xRange[0],
        x1: xRange[1],
        line: { color: '#41566e', width: 1.4, dash: 'dash' },
      },
    ],
    annotations: [
      {
        x: xRange[0] + ((xRange[1] - xRange[0]) * 0.1),
        y: yRange[1] - ((yRange[1] - yRange[0]) * 0.08),
        text: 'Return-Driven',
        showarrow: false,
        font: { size: 11, color: '#385a7d' },
      },
      {
        x: xRange[1] - ((xRange[1] - xRange[0]) * 0.1),
        y: yRange[1] - ((yRange[1] - yRange[0]) * 0.08),
        text: 'Strong Serve + Return',
        showarrow: false,
        xanchor: 'right',
        font: { size: 11, color: '#2c6a49' },
      },
      {
        x: xRange[0] + ((xRange[1] - xRange[0]) * 0.1),
        y: yRange[0] + ((yRange[1] - yRange[0]) * 0.08),
        text: 'Build Both Areas',
        showarrow: false,
        yanchor: 'bottom',
        font: { size: 11, color: '#7a5151' },
      },
      {
        x: xRange[1] - ((xRange[1] - xRange[0]) * 0.1),
        y: yRange[0] + ((yRange[1] - yRange[0]) * 0.08),
        text: 'Serve-Driven',
        showarrow: false,
        xanchor: 'right',
        yanchor: 'bottom',
        font: { size: 11, color: '#7b5b2e' },
      },
    ],
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 1,
      xanchor: 'right',
      y: 1.12,
      yanchor: 'top',
      font: { size: 11, color: '#24374d' },
      bgcolor: 'rgba(255,255,255,0.86)',
      bordercolor: '#d9e4f0',
      borderwidth: 1,
    },
  };

  const traces = [{
    type: 'scatter',
    mode: 'markers',
    name: 'Peers',
    x: peerXValues,
    y: peerYValues,
    marker: {
      color: markerColors,
      size: markerSizes,
      line: { color: '#ffffff', width: 0.8 },
      opacity: 0.88,
    },
    customdata: model.points.map((point) => [
      point.name,
      point.cluster + 1,
      point.matches,
      point.winPct,
      point.aggressiveServeIndex,
      point.returnEfficiencyIndex,
      classifyServeReturnArchetype(point.aggressiveServeIndex, point.returnEfficiencyIndex, xMean, yMean),
    ]),
    hovertemplate:
      '<b>%{customdata[0]}</b><br>' +
      'Cluster: %{customdata[1]}<br>' +
      'Matches: %{customdata[2]}<br>' +
      'Win %: %{customdata[3]:.1f}%<br>' +
      'Aggressive Serve Index: %{customdata[4]:.2f}<br>' +
      'Return Efficiency Index: %{customdata[5]:.2f}<br>' +
      'Archetype: %{customdata[6]}' +
      '<extra></extra>',
  }];

  traces.push({
    type: 'scatter',
    mode: 'markers+text',
    name: 'Peer Avg',
    x: [xMean],
    y: [yMean],
    text: ['Peer mean'],
    textposition: 'bottom right',
    textfont: { size: 11, color: '#31465f', family: 'Space Grotesk, sans-serif' },
    marker: {
      symbol: 'x',
      size: 13,
      color: '#1e3148',
      line: { color: '#ffffff', width: 1 },
    },
    hovertemplate:
      '<b>Peer mean</b><br>' +
      'Serve Pressure Index: %{x:.2f}<br>' +
      'Return Control Index: %{y:.2f}' +
      '<extra></extra>',
  });

  if (selectedPoint) {
    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      name: 'Selected',
      x: [selectedPoint.aggressiveServeIndex],
      y: [selectedPoint.returnEfficiencyIndex],
      text: [selectedPoint.name],
      textposition: 'top right',
      textfont: { size: 12, color: '#1f2d40', family: 'Space Grotesk, sans-serif' },
      marker: {
        symbol: 'star',
        size: 20,
        color: '#0f172a',
        line: { color: '#ffffff', width: 1.4 },
      },
      hovertemplate:
        '<b>%{text}</b><br>' +
        `Cluster: ${selectedPoint.cluster + 1}<br>` +
        `Matches: ${formatNumber(selectedPoint.matches)}<br>` +
        `Aggressive Serve Index: ${selectedPoint.aggressiveServeIndex.toFixed(2)}<br>` +
        `Return Efficiency Index: ${selectedPoint.returnEfficiencyIndex.toFixed(2)}<br>` +
        `Archetype: ${selectedArchetype}` +
        '<extra></extra>',
    });
  }

  const selectedServeDelta = selectedPoint
    ? selectedPoint.aggressiveServeIndex - xMean
    : null;
  const selectedReturnDelta = selectedPoint
    ? selectedPoint.returnEfficiencyIndex - yMean
    : null;
  const selectedInsight = selectedPoint
    ? `${escapeHtml(selectedPoint.name)} sits in <strong>${escapeHtml(selectedArchetype)}</strong> (vs peer mean: Serve ${selectedServeDelta >= 0 ? '+' : ''}${selectedServeDelta.toFixed(2)}, Return ${selectedReturnDelta >= 0 ? '+' : ''}${selectedReturnDelta.toFixed(2)}).`
    : 'Select a player to see zone-specific insight.';
  const zoneGuide = 'Zone guide: <strong>Strong Serve + Return</strong> (top-right), <strong>Return-Driven</strong> (top-left), <strong>Serve-Driven</strong> (bottom-right), <strong>Build Both Areas</strong> (bottom-left).';
  setStyleMapInsightNote(
    container,
    `<span class="insight-note-line">${selectedInsight}</span><span class="insight-note-line">${zoneGuide}</span>`,
  );

  window.Plotly.react(container, traces, layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_style_clustering`));
}

function renderTournamentDNAChart(container, rows, topTournaments, player = null) {
  if (!container) return;
  setAnalyticsCardDetailHtml(container, '');
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const activePlayer = player || service.getPlayerByKey(state.activePlayerKey);
  const grandSlamRanking = getRankedGrandSlamTournaments(activePlayer);
  if (activePlayer?.key && state.dnaTournamentPlayerKey !== activePlayer.key) {
    state.dnaTournamentKey = '';
    state.dnaTournamentPlayerKey = activePlayer.key;
  }

  let selectedGrandSlam = null;
  if (grandSlamRanking.length) {
    selectedGrandSlam = grandSlamRanking.find((row) => row.key === state.dnaTournamentKey) || grandSlamRanking[0];
    state.dnaTournamentKey = selectedGrandSlam.key;
    state.dnaTournamentPlayerKey = activePlayer?.key || '';
  }

  const fallbackName = selectedGrandSlam?.name || topTournaments?.[0]?.name || rows[0]?.tournament || '';
  if (!fallbackName) {
    renderChartPlaceholder(container, 'No tournament sample available.');
    return;
  }

  const targetRows = rows.filter((row) => row.tournament === fallbackName);
  if (!targetRows.length) {
    renderChartPlaceholder(container, 'No tournament sample available.');
    return;
  }

  const wins = targetRows.filter((row) => row.result === 'W').length;
  const playerWinPct = toSafePct(wins, targetRows.length) || 0;
  const tiebreakFreq = toSafePct(targetRows.filter((row) => scoreHasTiebreak(row.score)).length, targetRows.length) || 0;
  const validTargetMinutes = targetRows
    .map((row) => toSafeNumber(row.minutes, NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgMinutes = validTargetMinutes.length
    ? validTargetMinutes.reduce((sum, value) => sum + value, 0) / validTargetMinutes.length
    : 0;

  const rankKnownRows = targetRows.filter((row) => isFiniteNumber(row.playerRank) && isFiniteNumber(row.opponentRank) && row.playerRank > 0 && row.opponentRank > 0);
  const favoredRows = rankKnownRows.filter((row) => row.playerRank < row.opponentRank);
  const upsetLosses = favoredRows.filter((row) => row.result === 'L').length;
  const upsetLossRate = toSafePct(upsetLosses, favoredRows.length) || 0;

  const bpRows = targetRows.filter((row) => isFiniteNumber(row.breakPointsFaced) && row.breakPointsFaced > 0);
  const bpSaved = bpRows.reduce((sum, row) => sum + toSafeNumber(row.breakPointsSaved, 0), 0);
  const bpFaced = bpRows.reduce((sum, row) => sum + toSafeNumber(row.breakPointsFaced, 0), 0);
  const bpSavePct = toSafePct(bpSaved, bpFaced) || 0;

  const searchRows = service.getTournamentRows({ search: fallbackName, category: 'all', surface: 'all', year: 'all' });
  const selectedTournament = searchRows.find((row) => row.name === fallbackName) || searchRows[0] || null;

  const selectedRankIndex = selectedGrandSlam
    ? grandSlamRanking.findIndex((row) => row.key === selectedGrandSlam.key)
    : -1;
  const rankText = selectedRankIndex >= 0
    ? `${selectedRankIndex === 0 ? 'Best ' : ''}#${selectedRankIndex + 1}/${grandSlamRanking.length}`
    : '';
  const surfaceClass = selectedGrandSlam?.surfaceClass || selectedTournament?.surfaceClass || targetRows[0]?.surfaceClass || 'surface-hard';

  const tournamentMinutes = service.matches
    .filter((match) => match.tournament === fallbackName)
    .map((match) => toSafeNumber(match.minutes, NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  const tournamentAvgMinutes = tournamentMinutes.length
    ? tournamentMinutes.reduce((sum, value) => sum + value, 0) / tournamentMinutes.length
    : avgMinutes;
  const deltaMinutes = avgMinutes - tournamentAvgMinutes;
  const deltaClass = deltaMinutes > 0.25 ? 'delta-up' : (deltaMinutes < -0.25 ? 'delta-down' : 'delta-flat');
  const deltaIcon = deltaMinutes > 0.25 ? '&uarr;' : (deltaMinutes < -0.25 ? '&darr;' : '&rarr;');
  const deltaText = `${deltaMinutes >= 0 ? '+' : ''}${deltaMinutes.toFixed(1)} min vs tournament avg`;

  const navDisabled = grandSlamRanking.length <= 1;
  const navButtons = `
    <span class="dna-nav-group">
      <button type="button" class="dna-nav-btn" data-dna-nav="prev" aria-label="Previous Grand Slam" ${navDisabled ? 'disabled' : ''}>&lsaquo;</button>
      <button type="button" class="dna-nav-btn" data-dna-nav="next" aria-label="Next Grand Slam" ${navDisabled ? 'disabled' : ''}>&rsaquo;</button>
    </span>
  `;
  const rankBadge = rankText ? `<span class="dna-rank-pill">${escapeHtml(rankText)}</span>` : '';
  const tournamentPill = `<span class="surface-pill ${escapeHtml(surfaceClass)}">${escapeHtml(fallbackName)}</span>`;
  setAnalyticsCardDetailHtml(
    container,
    `${rankBadge}${tournamentPill}<span class="dna-meta-sep">&bull;</span><span class="dna-meta-duration">Avg match duration ${avgMinutes.toFixed(1)} min</span><span class="delta-pill ${deltaClass}">${deltaIcon} ${escapeHtml(deltaText)}</span>${navButtons}`,
    'dna-card-detail',
  );

  const activePlayerName = service.getPlayerByKey(state.activePlayerKey)?.name || 'Player';
  const labels = [`${activePlayerName} Win %`, 'Break-Point Save %', 'Tiebreak Match %', 'Upset Loss %'];
  const values = [playerWinPct, bpSavePct, tiebreakFreq, upsetLossRate];
  const metricHelp = [
    `How often ${activePlayerName} wins at ${fallbackName}.`,
    `How often ${activePlayerName} saves break points at ${fallbackName}.`,
    `How often ${activePlayerName}'s matches at ${fallbackName} include a tiebreak set.`,
    `How often ${activePlayerName} loses to a lower-ranked opponent at ${fallbackName}.`,
  ];
  const custom = [
    [`${wins}-${targetRows.length - wins}`, targetRows.length, metricHelp[0]],
    [`${Math.round(bpSaved)} / ${Math.round(bpFaced)} break points saved`, bpRows.length, metricHelp[1]],
    [`${targetRows.filter((row) => scoreHasTiebreak(row.score)).length} / ${targetRows.length}`, targetRows.length, metricHelp[2]],
    [`${upsetLosses} / ${favoredRows.length}`, favoredRows.length, metricHelp[3]],
  ];

  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 136, r: 24, t: 36, b: 48 },
    xaxis: { range: [0, 100], title: '%' },
    yaxis: { automargin: true },
  };

  window.Plotly.react(container, [{
    type: 'bar',
    orientation: 'h',
    y: labels,
    x: values,
    customdata: custom,
    marker: {
      color: ['#7d66e2', '#f2a427', '#32b98e', '#4f84dc'],
      line: { color: '#ffffff', width: 0.9 },
    },
    hovertemplate:
      '<b>%{y} → %{x:.1f}%</b><br>' +
      '<span style="color:#5a2d82;"><i>%{customdata[2]}</i></span><br>' +
      'Sample: %{customdata[0]}' +
      '<extra></extra>',
  }], layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_tournament_dna`));
}
function resolveOpponentBucket(rank) {
  const n = toSafeNumber(rank, NaN);
  if (!Number.isFinite(n) || n <= 0) return '500+';
  const found = OPPONENT_BUCKETS.find((bucket) => n <= bucket.max);
  return found?.label || '500+';
}

function renderOpponentQualityChart(container, rows) {
  if (!container) return;
  setAnalyticsCardDetail(container, 'Win % and sample size by opponent rank bucket');
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const map = new Map(OPPONENT_BUCKETS.map((bucket) => [bucket.label, { wins: 0, matches: 0 }]));
  for (const row of rows) {
    const bucket = resolveOpponentBucket(row.opponentRank);
    const stats = map.get(bucket);
    stats.matches += 1;
    if (row.result === 'W') stats.wins += 1;
  }

  const x = OPPONENT_BUCKETS.map((bucket) => bucket.label);
  const matches = x.map((label) => map.get(label)?.matches || 0);
  const winPct = x.map((label) => toSafePct(map.get(label)?.wins || 0, map.get(label)?.matches || 0) || 0);
  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 56, r: 58, t: 34, b: 78 },
    xaxis: { tickangle: -22 },
    yaxis: { range: [0, 100], title: 'Win %', gridcolor: '#dce7f3' },
    yaxis2: { title: 'Matches', overlaying: 'y', side: 'right', showgrid: false, rangemode: 'tozero' },
    legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.1 },
  };

  window.Plotly.react(container, [
    {
      type: 'bar',
      x,
      y: winPct,
      name: 'Win %',
      marker: {
        color: '#5e8edd',
        line: { color: '#ffffff', width: 0.8 },
      },
      customdata: matches,
      hovertemplate: '<b>%{x}</b><br>Win %: %{y:.1f}%<br>Matches: %{customdata}<extra></extra>',
    },
    {
      type: 'scatter',
      x,
      y: matches,
      name: 'Matches',
      yaxis: 'y2',
      mode: 'lines+markers',
      line: { color: '#111f31', width: 2.4 },
      marker: { size: 7, color: '#111f31' },
      hovertemplate: '<b>%{x}</b><br>Matches: %{y}<extra></extra>',
    },
  ], layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_opponent_quality`));
}

function renderRoundFunnelChart(container, rows) {
  if (!container) return;
  setAnalyticsCardDetail(container, 'Conversion rates from one round to the next');
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const roundOrder = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
  const appearanceCount = new Map(roundOrder.map((round) => [round, 0]));
  for (const row of rows) {
    const round = String(row.round || '').toUpperCase();
    if (appearanceCount.has(round)) {
      appearanceCount.set(round, appearanceCount.get(round) + 1);
    }
  }
  const titles = rows.filter((row) => String(row.round || '').toUpperCase() === 'F' && row.result === 'W').length;

  const labels = [];
  const values = [];
  const custom = [];
  for (let idx = 0; idx < roundOrder.length - 1; idx += 1) {
    const from = roundOrder[idx];
    const to = roundOrder[idx + 1];
    const fromCount = appearanceCount.get(from) || 0;
    const toCount = appearanceCount.get(to) || 0;
    labels.push(`${from} → ${to}`);
    values.push(toSafePct(toCount, fromCount) || 0);
    custom.push([toCount, fromCount]);
  }
  const finalsCount = appearanceCount.get('F') || 0;
  labels.push('F → Title');
  values.push(toSafePct(titles, finalsCount) || 0);
  custom.push([titles, finalsCount]);

  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 90, r: 24, t: 34, b: 56 },
    xaxis: { range: [0, 100], title: 'Conversion %', gridcolor: '#dce7f3' },
    yaxis: { automargin: true },
  };

  window.Plotly.react(container, [{
    type: 'bar',
    orientation: 'h',
    y: labels,
    x: values,
    marker: {
      color: '#3cab67',
      line: { color: '#ffffff', width: 0.8 },
    },
    customdata: custom,
    hovertemplate:
      '<b>%{y}</b><br>' +
      'Conversion: %{x:.1f}%<br>' +
      'Events: %{customdata[0]} / %{customdata[1]}' +
      '<extra></extra>',
  }], layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_round_funnel`));
}

function renderCalendarHeatmapChart(container, rows) {
  if (!container) return;
  setAnalyticsCardDetail(container, 'Monthly win-rate trend across seasons');
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const yearMonth = new Map();
  for (const row of rows) {
    const year = toSafeNumber(row.year, NaN);
    const month = Number(String(row.dateIso || '').slice(5, 7));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;
    const key = `${year}-${month}`;
    const current = yearMonth.get(key) || { year, month, matches: 0, wins: 0 };
    current.matches += 1;
    if (row.result === 'W') current.wins += 1;
    yearMonth.set(key, current);
  }
  const points = [...yearMonth.values()];
  if (!points.length) {
    renderChartPlaceholder(container, 'Not enough date rows for calendar heatmap.');
    return;
  }

  const years = [...new Set(points.map((point) => point.year))].sort((a, b) => a - b);
  const yearLabels = years.map((year) => String(year));
  const months = Array.from({ length: 12 }, (_, idx) => idx + 1);
  const monthLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const z = [];
  const custom = [];
  for (const year of years) {
    const zRow = [];
    const cRow = [];
    for (const month of months) {
      const key = `${year}-${month}`;
      const value = yearMonth.get(key);
      const pct = value ? toSafePct(value.wins, value.matches) : null;
      zRow.push(pct);
      cRow.push([value?.wins || 0, value?.matches || 0]);
    }
    z.push(zRow);
    custom.push(cRow);
  }

  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 60, r: 26, t: 34, b: 56 },
    xaxis: {
      type: 'category',
      categoryorder: 'array',
      categoryarray: monthLabel,
      tickmode: 'array',
      tickvals: monthLabel,
      ticktext: monthLabel,
      tickson: 'boundaries',
      showgrid: false,
      zeroline: false,
    },
    yaxis: {
      type: 'category',
      automargin: true,
      categoryorder: 'array',
      categoryarray: yearLabels,
      tickmode: 'array',
      tickvals: yearLabels,
      ticktext: yearLabels,
      tickson: 'boundaries',
      showgrid: false,
      zeroline: false,
    },
  };

  window.Plotly.react(container, [{
    type: 'heatmap',
    x: monthLabel,
    y: yearLabels,
    z,
    customdata: custom,
    colorscale: [
      [0, '#edf7ee'],
      [0.3, '#a7d7ab'],
      [0.6, '#4fa76a'],
      [1, '#1f6d3e'],
    ],
    zmin: 0,
    zmax: 100,
    hoverongaps: false,
    xgap: 1,
    ygap: 1,
    hovertemplate:
      '<b>%{y} • %{x}</b><br>' +
      'Win %: %{z:.1f}%<br>' +
      'W-L sample: %{customdata[0]} / %{customdata[1]}' +
      '<extra></extra>',
    colorbar: { title: 'Win %' },
  }], layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_calendar_heatmap`));
}

function computeEloRows(rows, kFactor = 24) {
  const ordered = sortRowsByDateAsc(rows);
  let overallElo = 1500;
  const opponentElos = new Map();
  const surfaceElos = new Map();
  const out = [];
  for (const row of ordered) {
    const opponentKey = row.opponentKey || row.opponentName || 'unknown';
    const opponentElo = opponentElos.get(opponentKey) ?? 1500;
    const expected = 1 / (1 + (10 ** ((opponentElo - overallElo) / 400)));
    const actual = row.result === 'W' ? 1 : 0;
    overallElo += kFactor * (actual - expected);
    opponentElos.set(opponentKey, opponentElo + (kFactor * ((1 - actual) - (1 - expected))));

    const surface = row.surfaceClass || 'surface-hard';
    const currentSurfaceElo = surfaceElos.get(surface) ?? 1500;
    const surfaceExpected = 1 / (1 + (10 ** ((opponentElo - currentSurfaceElo) / 400)));
    const nextSurfaceElo = currentSurfaceElo + (kFactor * (actual - surfaceExpected));
    surfaceElos.set(surface, nextSurfaceElo);

    out.push({
      dateIso: row.dateIso,
      tournament: row.tournament,
      overallElo,
      surface,
      surfaceElo: nextSurfaceElo,
    });
  }
  return out;
}

function renderEloTrajectoryChart(container, rows) {
  if (!container) return;
  setAnalyticsCardDetail(container, 'Overall + surface Elo over time');
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }
  if (!rows.length) {
    renderChartPlaceholder(container, 'Not enough rows for Elo trajectory.');
    return;
  }

  const eloRows = computeEloRows(rows);
  const x = eloRows.map((row) => row.dateIso);
  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 62, r: 24, t: 34, b: 56 },
    xaxis: { title: 'Date', gridcolor: '#dce7f3' },
    yaxis: { title: 'Elo', gridcolor: '#dce7f3' },
    legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.1 },
  };

  const traces = [{
    type: 'scatter',
    mode: 'lines',
    x,
    y: eloRows.map((row) => row.overallElo),
    name: 'Overall Elo',
    line: { color: '#d64545', width: 4 },
    hovertemplate: '<b>%{x}</b><br>Overall Elo: %{y:.1f}<extra></extra>',
  }];

  const surfaceColors = {
    'surface-hard': '#4d8fd5',
    'surface-clay': '#f08a24',
    'surface-grass': '#3aa35c',
  };
  for (const [surfaceClass, color] of Object.entries(surfaceColors)) {
    const subset = eloRows.filter((row) => row.surface === surfaceClass);
    if (!subset.length) continue;
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: subset.map((row) => row.dateIso),
      y: subset.map((row) => row.surfaceElo),
      name: `${getSurfaceLabel(surfaceClass)} Elo`,
      line: { color, width: 2.2 },
      hovertemplate: `<b>%{x}</b><br>${getSurfaceLabel(surfaceClass)} Elo: %{y:.1f}<extra></extra>`,
    });
  }

  window.Plotly.react(container, traces, layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_elo_trajectory`));
}

function renderQuadrantChart(container, rows) {
  if (!container) return;
  setAnalyticsCardDetail(container, 'Aggressive serve index vs return efficiency by year');
  if (!window.Plotly) {
    renderChartPlaceholder(container, 'Interactive plot requires Plotly.');
    return;
  }

  const yearMap = new Map();
  for (const row of rows) {
    const year = toSafeNumber(row.year, NaN);
    if (!Number.isFinite(year)) continue;
    const list = yearMap.get(year) || [];
    list.push(row);
    yearMap.set(year, list);
  }

  const yearly = [...yearMap.entries()]
    .map(([year, yearRows]) => {
      const metrics = summarizeServeReturn(yearRows);
      if (!metrics) return null;
      return {
        year,
        matches: yearRows.length,
        x: metrics.aggressiveServeIndex,
        y: metrics.returnEfficiencyIndex,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.year - b.year);

  if (!yearly.length) {
    renderChartPlaceholder(container, 'Not enough serve/return stats for yearly quadrant chart.');
    return;
  }

  const xMean = yearly.reduce((sum, row) => sum + row.x, 0) / yearly.length;
  const yMean = yearly.reduce((sum, row) => sum + row.y, 0) / yearly.length;

  const layout = {
    ...analyticsBaseLayout(),
    margin: { l: 62, r: 24, t: 34, b: 56 },
    xaxis: { title: 'Aggressive Serve Index', gridcolor: '#dce7f3' },
    yaxis: { title: 'Return Efficiency Index', gridcolor: '#dce7f3' },
    shapes: [
      {
        type: 'line',
        x0: xMean,
        x1: xMean,
        y0: Math.min(...yearly.map((row) => row.y)) - 0.7,
        y1: Math.max(...yearly.map((row) => row.y)) + 0.7,
        line: { color: '#405468', width: 1.4, dash: 'dash' },
      },
      {
        type: 'line',
        y0: yMean,
        y1: yMean,
        x0: Math.min(...yearly.map((row) => row.x)) - 0.7,
        x1: Math.max(...yearly.map((row) => row.x)) + 0.7,
        line: { color: '#405468', width: 1.4, dash: 'dash' },
      },
    ],
  };

  window.Plotly.react(container, [{
    type: 'scatter',
    mode: 'markers+text',
    x: yearly.map((row) => row.x),
    y: yearly.map((row) => row.y),
    text: yearly.map((row) => String(row.year)),
    textposition: 'top right',
    marker: {
      size: yearly.map((row) => Math.max(12, Math.min(22, 8 + Math.sqrt(row.matches) * 0.7))),
      color: yearly.map((row) => row.year),
      colorscale: [
        [0, '#6aa1ea'],
        [1, '#0b74d1'],
      ],
      line: { color: '#ffffff', width: 1 },
      showscale: false,
    },
    customdata: yearly.map((row) => [row.matches]),
    hovertemplate:
      '<b>%{text}</b><br>' +
      'Aggressive Serve Index: %{x:.2f}<br>' +
      'Return Efficiency Index: %{y:.2f}<br>' +
      'Matches: %{customdata[0]}' +
      '<extra></extra>',
  }], layout, analyticsPlotConfig(`${TOUR_LABEL.toLowerCase()}_serve_return_quadrants`));
}

function renderOverviewInsightCharts(player, topTournaments) {
  const rows = getPlayerRowsAll();
  const surfaceEl = dom.playerOverview.querySelector('#overviewSurfaceStrengthChart');
  const eloEl = dom.playerOverview.querySelector('#overviewEloTrajectoryChart');
  const dnaEl = dom.playerOverview.querySelector('#overviewTournamentDNAChart');
  const calendarEl = dom.playerOverview.querySelector('#overviewCalendarHeatmapChart');
  const styleEl = dom.playerOverview.querySelector('#overviewStyleClusterChart');
  renderSurfaceStrengthMatrixChart(surfaceEl, rows);
  renderEloTrajectoryChart(eloEl, rows);
  renderTournamentDNAChart(dnaEl, rows, topTournaments, player);
  renderCalendarHeatmapChart(calendarEl, rows);
  renderStyleClusteringChart(styleEl, rows);
  window.requestAnimationFrame(() => {
    resizePlotIfVisible(surfaceEl);
    resizePlotIfVisible(eloEl);
    resizePlotIfVisible(dnaEl);
    resizePlotIfVisible(calendarEl);
    resizePlotIfVisible(styleEl);
  });
}

function renderMatchesInsightCharts() {
  if (!dom.playerMatchesInsights) return;
  const rows = getPlayerRowsAll();
  dom.playerMatchesInsights.innerHTML = `
    <section class="section-block analytics-block matches-insight-block${state.matchesInsightCollapsed ? ' collapsed' : ''}">
      <div class="matches-insight-head">
        <h4>Interactive Match Intelligence</h4>
        <button type="button" class="matches-insight-toggle" data-matches-insight-toggle aria-expanded="${state.matchesInsightCollapsed ? 'false' : 'true'}" aria-label="${state.matchesInsightCollapsed ? 'Show Interactive Match Intelligence charts' : 'Hide Interactive Match Intelligence charts'}">
          <span class="matches-insight-toggle-text">${state.matchesInsightCollapsed ? 'Show' : 'Hide'}</span>
          <span class="matches-insight-toggle-icon" aria-hidden="true">${state.matchesInsightCollapsed ? '&#9660;' : '&#9650;'}</span>
        </button>
      </div>
      <div class="analytics-grid two-col matches-insight-content">
        ${createAnalyticsCard('Opponent Quality Plot', 'Win % vs opponent rank buckets with sample size', 'matchesOpponentQualityChart')}
        ${createAnalyticsCard('Round Performance Funnel', 'Round-to-round conversion profile', 'matchesRoundFunnelChart')}
      </div>
    </section>
  `;
  const sectionEl = dom.playerMatchesInsights.querySelector('.matches-insight-block');
  const toggleEl = sectionEl?.querySelector('[data-matches-insight-toggle]');
  const opponentEl = dom.playerMatchesInsights.querySelector('#matchesOpponentQualityChart');
  const funnelEl = dom.playerMatchesInsights.querySelector('#matchesRoundFunnelChart');
  if (toggleEl && sectionEl) {
    toggleEl.addEventListener('click', () => {
      state.matchesInsightCollapsed = !state.matchesInsightCollapsed;
      applyMatchesInsightCollapseState(sectionEl, true);
    });
  }
  applyMatchesInsightCollapseState(sectionEl, false);
  renderOpponentQualityChart(opponentEl, rows);
  renderRoundFunnelChart(funnelEl, rows);
  window.requestAnimationFrame(() => {
    resizePlotIfVisible(opponentEl);
    resizePlotIfVisible(funnelEl);
  });
}

function applyMatchesInsightCollapseState(sectionEl, resizeCharts = false) {
  if (!sectionEl) return;
  const collapsed = !!state.matchesInsightCollapsed;
  sectionEl.classList.toggle('collapsed', collapsed);

  const toggleEl = sectionEl.querySelector('[data-matches-insight-toggle]');
  if (!toggleEl) return;
  toggleEl.setAttribute('aria-expanded', String(!collapsed));
  toggleEl.setAttribute(
    'aria-label',
    collapsed ? 'Show Interactive Match Intelligence charts' : 'Hide Interactive Match Intelligence charts',
  );
  const textEl = toggleEl.querySelector('.matches-insight-toggle-text');
  if (textEl) {
    textEl.textContent = collapsed ? 'Show' : 'Hide';
  }
  const iconEl = toggleEl.querySelector('.matches-insight-toggle-icon');
  if (iconEl) {
    iconEl.innerHTML = collapsed ? '&#9660;' : '&#9650;';
  }

  if (!collapsed && resizeCharts) {
    const opponentEl = sectionEl.querySelector('#matchesOpponentQualityChart');
    const funnelEl = sectionEl.querySelector('#matchesRoundFunnelChart');
    window.requestAnimationFrame(() => {
      resizePlotIfVisible(opponentEl);
      resizePlotIfVisible(funnelEl);
    });
  }
}

function renderRankingInsightCharts() {
  if (!dom.rankingAdvancedPlots) return;
  dom.rankingAdvancedPlots.innerHTML = '';
}


function renderPlayerRanking() {
  const player = service.getPlayerByKey(state.activePlayerKey);
  const latestDatasetYear = getDatasetLatestYear();
  const inactive = isLikelyInactivePlayer(player, latestDatasetYear);
  const lastYear = getYearFromDateSort(player?.lastDateSort);
  const timeline = service.getPlayerRankingTimeline(state.activePlayerKey);
  if (!timeline || !timeline.points.length) {
    renderEmptyTable(dom.rankingSummaryTiles, 'Ranking timeline is unavailable for this player.');
    renderEmptyTable(dom.rankingTimelineTable, 'No ranking events found.');
    if (window.Plotly && dom.rankingChart) {
      window.Plotly.purge(dom.rankingChart);
    } else if (dom.rankingChart) {
      dom.rankingChart.innerHTML = '<div class="empty-placeholder">Interactive chart requires Plotly.</div>';
    }
    if (dom.rankingAdvancedPlots) {
      dom.rankingAdvancedPlots.innerHTML = '';
    }
    return;
  }

  const rangeStart = getRangeStartDate(timeline.points, state.rankingFilters.range);
  const filtered = timeline.points.filter((row) => !rangeStart || row.dateSort >= rangeStart);
  if (!filtered.length) {
    renderEmptyTable(dom.rankingSummaryTiles, 'No ranking events found in this range.');
    renderEmptyTable(dom.rankingTimelineTable, 'No ranking checkpoints in this range.');
    if (window.Plotly && dom.rankingChart) {
      window.Plotly.purge(dom.rankingChart);
      dom.rankingChart.innerHTML = '<div class="empty-placeholder">No ranking chart points available for the selected range.</div>';
    }
    if (dom.rankingAdvancedPlots) {
      dom.rankingAdvancedPlots.innerHTML = '';
    }
    return;
  }

  const best = filtered.reduce((acc, row) => (!acc || row.rank < acc.rank ? row : acc), null);
  const worst = filtered.reduce((acc, row) => (!acc || row.rank > acc.rank ? row : acc), null);
  const current = filtered[filtered.length - 1] || timeline.current;
  const biggestRise = filtered.reduce((acc, row) => {
    if (!Number.isFinite(row.deltaFromPrev) || row.deltaFromPrev <= 0) return acc;
    if (!acc || row.deltaFromPrev > acc.deltaFromPrev) return row;
    return acc;
  }, null);
  const biggestDrop = filtered.reduce((acc, row) => {
    if (!Number.isFinite(row.deltaFromPrev) || row.deltaFromPrev >= 0) return acc;
    if (!acc || row.deltaFromPrev < acc.deltaFromPrev) return row;
    return acc;
  }, null);

  const currentPoints = Number.isFinite(current?.rankPoints) ? current.rankPoints : null;
  const leadSummaryTile = inactive
    ? {
      label: 'Status',
      value: 'Inactive',
      note: Number.isFinite(lastYear) ? `Last active ${lastYear}` : 'No recent ranking updates',
    }
    : {
      label: '📌 Current Rank',
      value: current ? `#${current.rank}` : '-',
      note: current ? formatDate(current.dateIso) : '-',
    };
  const summaryTiles = [
    leadSummaryTile,
    { label: '💠 Current Points', value: Number.isFinite(currentPoints) ? formatNumber(currentPoints) : '-', note: current ? cappedText(current.tournament || '-', 24) : '-' },
    { label: '🚀 Best Rank', value: best ? `#${best.rank}` : '-', note: best ? `${formatDate(best.dateIso)} • ${best.tournament}` : '-' },
    { label: '🧭 Worst Rank', value: worst ? `#${worst.rank}` : '-', note: worst ? `${formatDate(worst.dateIso)} • ${worst.tournament}` : '-' },
    { label: '📉 Biggest Rise', value: biggestRise ? formatSignedDelta(biggestRise.deltaFromPrev) : '-', note: biggestRise ? `${formatDate(biggestRise.dateIso)} • #${biggestRise.rank}` : '-' },
    { label: '📈 Biggest Drop', value: biggestDrop ? formatSignedDelta(biggestDrop.deltaFromPrev) : '-', note: biggestDrop ? `${formatDate(biggestDrop.dateIso)} • #${biggestDrop.rank}` : '-' },
    { label: '🧪 Samples', value: formatNumber(filtered.length), note: state.rankingFilters.range === 'all' ? 'Career range' : `Range: ${state.rankingFilters.range}` },
  ];

  dom.rankingSummaryTiles.innerHTML = summaryTiles.map((tile) => `
    <article class="stat-tile">
      <p class="label">${tile.label}</p>
      <div class="value">${escapeHtml(tile.value)}</div>
      <div class="small-note">${escapeHtml(tile.note)}</div>
    </article>
  `).join('');

  if (window.Plotly && dom.rankingChart) {
    const showRank = state.rankingFilters.series !== 'points';
    const showPoints = state.rankingFilters.series !== 'rank';
    const includeMarkers = state.rankingFilters.mode.includes('markers');
    const x = filtered.map((row) => row.dateIso);
    const rankY = filtered.map((row) => row.rank);
    const pointsY = filtered.map((row) => (Number.isFinite(row.rankPoints) && row.rankPoints > 0 ? row.rankPoints : null));
    const custom = filtered.map((row) => [
      row.tournament,
      row.round || '-',
      row.result || '-',
      row.rankPoints ?? '-',
      row.opponentName || '-',
      formatSignedDelta(row.deltaFromPrev || 0),
      row.rank,
    ]);

    const traces = [];
    if (showRank) {
      traces.push({
        x,
        y: rankY,
        name: 'Rank',
        mode: state.rankingFilters.mode,
        type: 'scatter',
        yaxis: 'y',
        line: {
          shape: 'hv',
          color: '#2f71bc',
          width: 3,
        },
        marker: {
          size: includeMarkers ? 7 : 0,
          color: '#f8fbff',
          line: { color: '#2f71bc', width: 2 },
        },
        customdata: custom,
        hovertemplate:
          '<b>%{x}</b><br>' +
          'Rank: <b>#%{y}</b><br>' +
          'Points: %{customdata[3]}<br>' +
          'Tournament: %{customdata[0]}<br>' +
          'Round: %{customdata[1]} (%{customdata[2]})<br>' +
          'Opponent: %{customdata[4]}<br>' +
          'Change: %{customdata[5]}<extra>Rank</extra>',
      });
    }
    if (showPoints) {
      traces.push({
        x,
        y: pointsY,
        name: 'Ranking Points',
        mode: state.rankingFilters.mode,
        type: 'scatter',
        yaxis: 'y2',
        line: {
          shape: 'hv',
          color: '#cf8a2b',
          width: 2.5,
          dash: 'solid',
        },
        marker: {
          size: includeMarkers ? 7 : 0,
          color: '#fff9ef',
          line: { color: '#cf8a2b', width: 2 },
        },
        customdata: custom,
        hovertemplate:
          '<b>%{x}</b><br>' +
          'Points: <b>%{y}</b><br>' +
          `Rank: #%{customdata[6]}<br>` +
          'Tournament: %{customdata[0]}<br>' +
          'Round: %{customdata[1]} (%{customdata[2]})<br>' +
          'Opponent: %{customdata[4]}<br>' +
          'Change: %{customdata[5]}<extra>Points</extra>',
      });
    }

    const isLog = state.rankingFilters.scale === 'log';
    const chartHeight = getRankingChartHeightPx();
    const layout = {
      autosize: false,
      height: chartHeight,
      margin: { l: showRank ? 78 : 18, r: showPoints ? 78 : 22, t: 18, b: 92 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#f7fbff',
      font: { family: 'Manrope, sans-serif', color: '#223141' },
      hovermode: 'closest',
      hoverlabel: {
        bgcolor: '#ffffff',
        bordercolor: '#8fa9c5',
        font: { family: 'Manrope, sans-serif', size: 13, color: '#223141' },
        align: 'left',
      },
      xaxis: {
        title: { text: 'Date', standoff: 16 },
        automargin: true,
        gridcolor: '#dce7f3',
        showspikes: true,
        spikemode: 'across',
        spikecolor: '#b6cbe1',
        spikethickness: 1,
        zeroline: false,
      },
      yaxis: {
        title: { text: `${TOUR_NAME} Ranking (Lower is better)`, standoff: 12 },
        visible: showRank,
        automargin: true,
        autorange: 'reversed',
        type: isLog ? 'log' : 'linear',
        gridcolor: '#dce7f3',
        zeroline: false,
        tickvals: showRank && isLog ? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000] : undefined,
      },
      yaxis2: {
        title: { text: 'Ranking Points', standoff: 10, font: { color: '#9c640e' } },
        visible: showPoints,
        overlaying: 'y',
        side: 'right',
        automargin: true,
        rangemode: 'tozero',
        showgrid: false,
        zeroline: false,
        tickformat: ',d',
        tickfont: { color: '#9c640e' },
      },
      showlegend: showRank && showPoints,
      legend: {
        orientation: 'h',
        x: 1,
        xanchor: 'right',
        y: 1.14,
        bgcolor: 'rgba(255,255,255,0.86)',
        bordercolor: '#d9e4f0',
        borderwidth: 1,
      },
    };

    window.Plotly.react(dom.rankingChart, traces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      doubleClick: 'reset',
      toImageButtonOptions: {
        filename: `${timeline.player.name.replace(/\s+/g, '_')}_ranking_timeline`,
        format: 'png',
      },
    });
  } else if (dom.rankingChart) {
    dom.rankingChart.innerHTML = '<div class="empty-placeholder">Interactive chart requires Plotly.</div>';
  }

  const changedRows = filtered
    .filter((row, index) => index === 0 || row.deltaFromPrev !== 0)
    .slice()
    .reverse()
    .slice(0, 180);

  const tableRows = changedRows.map((row) => {
    const delta = row.deltaFromPrev || 0;
    const deltaClass = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';
    const deltaText = delta > 0 ? `↑ ${delta}` : delta < 0 ? `↓ ${Math.abs(delta)}` : '—';
    return `
      <tr>
        <td>${escapeHtml(formatDate(row.dateIso))}</td>
        <td><strong>#${row.rank}</strong></td>
        <td><span class="delta-pill ${deltaClass}">${deltaText}</span></td>
        <td>${row.rankPoints ?? '-'}</td>
        <td>${escapeHtml(cappedText(row.tournament, 28))}</td>
        <td><span class="category-badge ${row.category}">${escapeHtml(row.categoryLabel)}</span></td>
        <td><span class="surface-pill ${row.surfaceClass}">${escapeHtml(getSurfaceLabel(row.surfaceClass))}</span></td>
        <td>${escapeHtml(row.round || '-')}</td>
        <td><span class="result-pill ${row.result}">${escapeHtml(row.result || '-')}</span></td>
      </tr>
    `;
  }).join('');

  dom.rankingTimelineTable.innerHTML = `
    <div class="small-note" style="padding:0.55rem 0.65rem;">Showing ${changedRows.length} ranking checkpoints (latest first)</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Rank</th>
          <th>Δ from previous</th>
          <th>Rank Points</th>
          <th>Tournament</th>
          <th>Type</th>
          <th>Surface</th>
          <th>Round</th>
          <th>W/L</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  renderRankingInsightCharts();
}

function renderPlayerPanel() {
  renderPlayerHero();
  renderPlayerOverview();
  renderPlayerMatches();
  renderPlayerRivalries();
  renderPlayerRanking();
}

function syncTournamentDetailVisibility() {
  if (!dom.tournamentSplitLayout || !dom.tournamentDetailToggle) return;
  const collapsed = !!state.tournamentDetailCollapsed;

  dom.tournamentSplitLayout.classList.toggle('collapsed', collapsed);
  dom.tournamentDetailToggle.classList.toggle('collapsed', collapsed);
  dom.tournamentDetailToggle.setAttribute('aria-expanded', String(!collapsed));

  const labelEl = dom.tournamentDetailToggle.querySelector('.detail-toggle-label');
  if (labelEl) {
    labelEl.textContent = collapsed ? 'Show details' : 'Hide details';
  }

  const arrowEl = dom.tournamentDetailToggle.querySelector('.detail-toggle-arrow');
  if (arrowEl) {
    arrowEl.textContent = collapsed ? '▶' : '◀';
  }
}

function renderTournamentTable() {
  const rows = service.getTournamentRows(state.tournamentFilters);
  const showTopChampionColumn = !!state.tournamentDetailCollapsed;
  const latestDatasetYear = getDatasetLatestYear();
  syncTournamentDetailVisibility();
  if (!rows.length) {
    renderEmptyTable(dom.tournamentTable, 'No tournaments match these filters.');
    dom.tournamentDetail.innerHTML = '<div class="empty-placeholder">Select a tournament row to see details.</div>';
    return;
  }

  if (!rows.some((r) => r.key === state.selectedTournamentKey)) {
    state.selectedTournamentKey = rows[0].key;
  }

  const body = rows.slice(0, 260).map((row) => {
    const champion = row.topChampion;
    const championPlayer = champion?.key ? service.getPlayerByKey(champion.key) : null;
    const championInactive = isLikelyInactivePlayer(championPlayer, latestDatasetYear);
    const championAvatar = championPlayer
      ? renderAvatarImage(championPlayer, {
        className: 'avatar-xs',
        alt: champion.name,
        inactive: championInactive,
      })
      : '';
    const championCell = champion
      ? `<span class="person-main">${championAvatar}${getFlagHtml(champion.countryCode)} <span class="name">${escapeHtml(champion.name)}</span> (${champion.count})</span>`
      : '-';
    return `
      <tr class="clickable-row ${row.key === state.selectedTournamentKey ? 'active' : ''}" data-tournament-key="${escapeHtml(row.key)}">
        <td>${escapeHtml(row.name)}</td>
        <td><span class="category-badge ${row.category}">${escapeHtml(getCategoryLabel(row.category))}</span></td>
        <td><span class="surface-pill ${row.surfaceClass}">${escapeHtml(getSurfaceLabel(row.surfaceClass))}</span></td>
        <td>${row.firstYear}-${row.lastYear}</td>
        <td>${formatNumber(row.eventCount)}</td>
        <td>${formatNumber(row.matchCount)}</td>
        <td>${formatNumber(row.playerCount)}</td>
        ${showTopChampionColumn ? `<td>${championCell}</td>` : ''}
      </tr>
    `;
  }).join('');

  dom.tournamentTable.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tournament</th>
          <th>Type</th>
          <th>Surface</th>
          <th>Years</th>
          <th>Events</th>
          <th>Matches</th>
          <th>Players</th>
          ${showTopChampionColumn ? '<th>Top Champion</th>' : ''}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;

  renderTournamentDetail();
}

function renderTournamentDetail() {
  const detail = service.getTournamentDetails(state.selectedTournamentKey);
  if (!detail) {
    dom.tournamentDetail.innerHTML = '<div class="empty-placeholder">Select a tournament row to see details.</div>';
    return;
  }

  const latestDatasetYear = getDatasetLatestYear();
  const championRows = detail.topChampions.slice(0, 8).map((row) => {
    const championPlayer = row.key ? service.getPlayerByKey(row.key) : null;
    const championInactive = isLikelyInactivePlayer(championPlayer, latestDatasetYear);
    const championAvatar = championPlayer
      ? renderAvatarImage(championPlayer, {
        className: 'avatar-xs',
        alt: row.name,
        inactive: championInactive,
      })
      : '';
    return `
      <div class="person-row">
        <span class="person-main">
          ${championAvatar}
          ${getFlagHtml(row.countryCode)}
          <span class="name">${escapeHtml(row.name)}</span>
        </span>
        <strong>${row.count}</strong>
      </div>
    `;
  }).join('');

  const finalRows = detail.finals.slice(0, 10).map((row) => {
    const winner = row.winnerKey ? service.getPlayerByKey(row.winnerKey) : null;
    const loser = row.loserKey ? service.getPlayerByKey(row.loserKey) : null;
    const winnerInactive = isLikelyInactivePlayer(winner, latestDatasetYear);
    const loserInactive = isLikelyInactivePlayer(loser, latestDatasetYear);
    const winnerAvatar = renderAvatarImage(winner, {
      className: 'avatar-xs',
      alt: row.winnerName,
      inactive: winnerInactive,
    });
    const loserAvatar = renderAvatarImage(loser, {
      className: 'avatar-xs',
      alt: row.loserName,
      inactive: loserInactive,
    });
    return `
      <div class="final-row">
        <div class="final-main">
          <span class="small-note">${escapeHtml(formatDate(row.dateIso))}</span>
          <span>${winnerAvatar}${getFlagHtml(row.winnerCountryCode)} <span class="name">${escapeHtml(row.winnerName)}</span></span>
          <span class="small-note">def.</span>
          <span>${loserAvatar}${getFlagHtml(row.loserCountryCode)} <span class="name">${escapeHtml(row.loserName)}</span></span>
        </div>
        <strong>${escapeHtml(row.score || '-')}</strong>
      </div>
    `;
  }).join('');

  dom.tournamentDetail.innerHTML = `
    <div class="detail-title">
      <h3>${escapeHtml(detail.name)}</h3>
      <span class="category-badge ${detail.primaryCategory}">${escapeHtml(getCategoryLabel(detail.primaryCategory))}</span>
      <span class="surface-pill ${detail.primarySurface}">${escapeHtml(getSurfaceLabel(detail.primarySurface))}</span>
    </div>

    <div class="detail-grid">
      <div class="mini"><div class="k">Events</div><div class="v">${formatNumber(detail.eventCount)}</div></div>
      <div class="mini"><div class="k">Matches</div><div class="v">${formatNumber(detail.matchCount)}</div></div>
      <div class="mini"><div class="k">Players</div><div class="v">${formatNumber(detail.playerCount)}</div></div>
      <div class="mini"><div class="k">Season Span</div><div class="v">${detail.years[0]}-${detail.years[detail.years.length - 1]}</div></div>
    </div>

    <div>
      <h4 style="margin:0 0 .45rem;">Top Champions 🏅</h4>
      <div class="champion-list">${championRows || '<div class="small-note">No final data yet.</div>'}</div>
    </div>

    <div>
      <h4 style="margin:0 0 .45rem;">Recent Finals</h4>
      <div class="final-list">${finalRows || '<div class="small-note">No final rows available.</div>'}</div>
    </div>

    <button id="openTournamentModalBtn" class="detail-action-btn" type="button">Open Full Results</button>
  `;
}

function getDatasetLatestYear() {
  const years = service.getAllYears();
  return years.length ? years[0] : new Date().getFullYear();
}

function getYearFromDateSort(dateSort) {
  const date = String(dateSort || '');
  if (!/^\d{8}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function isLikelyInactivePlayer(player, latestDatasetYear) {
  if (!player || !Number.isFinite(latestDatasetYear)) return false;
  const lastYear = getYearFromDateSort(player.lastDateSort);
  if (!Number.isFinite(lastYear)) return false;
  return lastYear <= latestDatasetYear - 2;
}

function renderTournamentPlayerCell(playerKey, fallbackName, fallbackCountryCode, latestDatasetYear) {
  const player = playerKey ? service.getPlayerByKey(playerKey) : null;
  const name = player?.name || fallbackName || 'Unknown player';
  const countryCode = player?.countryCode || fallbackCountryCode || '';
  const inactive = isLikelyInactivePlayer(player, latestDatasetYear);
  const lastYear = getYearFromDateSort(player?.lastDateSort);
  const inactiveHint = inactive && Number.isFinite(lastYear) ? `Last active ${lastYear}` : '';
  const avatarImage = player
    ? renderAvatarImage(player, {
      className: 'modal-avatar',
      alt: name,
      inactive,
      withActiveRing: false,
    })
    : '';

  return `
    <span class="modal-player-cell">
      <span class="modal-avatar-wrap ${inactive ? 'inactive' : 'active-player-ring'}">
        ${avatarImage || '<span class="modal-avatar placeholder">?</span>'}
      </span>
      <span class="modal-player-meta">
        <span class="name-line">${getFlagHtml(countryCode)} <span class="name">${escapeHtml(name)}</span></span>
        ${inactiveHint ? `<span class="small-note">${escapeHtml(inactiveHint)}</span>` : ''}
      </span>
    </span>
  `;
}

function renderTournamentModal() {
  const detail = service.getTournamentDetails(state.selectedTournamentKey);
  if (!detail || !dom.tournamentModalBody) return;

  const latestDatasetYear = getDatasetLatestYear();
  const yearsText = detail.years.length ? `${detail.years[0]}-${detail.years[detail.years.length - 1]}` : '-';

  if (dom.tournamentModalTitle) {
    dom.tournamentModalTitle.textContent = detail.name;
  }
  if (dom.tournamentModalMeta) {
    dom.tournamentModalMeta.textContent = `${yearsText} • ${formatNumber(detail.matchCount)} matches • ${formatNumber(detail.eventCount)} events`;
  }

  const championsRows = detail.topChampions.map((row, index) => {
    const yearSpan = Number.isFinite(row.firstYear) && Number.isFinite(row.lastYear)
      ? row.firstYear === row.lastYear ? `${row.firstYear}` : `${row.firstYear}-${row.lastYear}`
      : '-';
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${renderTournamentPlayerCell(row.key, row.name, row.countryCode, latestDatasetYear)}</td>
        <td><strong>${formatNumber(row.count)}</strong></td>
        <td>${escapeHtml(yearSpan)}</td>
      </tr>
    `;
  }).join('');

  const finalsRows = detail.finals.map((row) => `
    <tr>
      <td>${row.year || '-'}</td>
      <td>${escapeHtml(formatDate(row.dateIso))}</td>
      <td>${renderTournamentPlayerCell(row.winnerKey, row.winnerName, row.winnerCountryCode, latestDatasetYear)}</td>
      <td>${renderTournamentPlayerCell(row.loserKey, row.loserName, row.loserCountryCode, latestDatasetYear)}</td>
      <td><strong>${escapeHtml(row.score || '-')}</strong></td>
      <td><span class="category-badge ${row.category}">${escapeHtml(getCategoryLabel(row.category))}</span></td>
      <td><span class="surface-pill ${row.surfaceClass}">${escapeHtml(getSurfaceLabel(row.surfaceClass))}</span></td>
    </tr>
  `).join('');

  dom.tournamentModalBody.innerHTML = `
    <section class="section-block" style="margin-top:0;">
      <h4>Top Champions</h4>
      <div class="table-wrap modal-table-wrap">
        <table class="data-table modal-data-table">
          <thead>
            <tr><th>#</th><th>Champion</th><th>Titles</th><th>Years</th></tr>
          </thead>
          <tbody>${championsRows || '<tr><td colspan="4">No champions found.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="section-block">
      <h4>Recent Finals</h4>
      <div class="table-wrap modal-table-wrap">
        <table class="data-table modal-data-table">
          <thead>
            <tr><th>Year</th><th>Date</th><th>Champion</th><th>Finalist</th><th>Score</th><th>Type</th><th>Surface</th></tr>
          </thead>
          <tbody>${finalsRows || '<tr><td colspan="7">No finals rows available.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function openTournamentModal() {
  if (!dom.tournamentModal) return;
  renderTournamentModal();
  dom.tournamentModal.classList.add('open');
  dom.tournamentModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeTournamentModal() {
  if (!dom.tournamentModal) return;
  dom.tournamentModal.classList.remove('open');
  dom.tournamentModal.setAttribute('aria-hidden', 'true');
  if (!dom.imageViewer?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
}

function renderHolderPills(holders) {
  if (!Array.isArray(holders) || holders.length === 0) return '-';
  const latestDatasetYear = getDatasetLatestYear();
  const holderPills = holders.slice(0, 4).map((h) => {
    const holderPlayer = h?.key ? service.getPlayerByKey(h.key) : h;
    const holderInactive = isLikelyInactivePlayer(holderPlayer, latestDatasetYear);
    const holderAvatar = renderAvatarImage(holderPlayer, {
      className: 'avatar-xs',
      alt: h.name,
      inactive: holderInactive,
    });
    return `<span class="holder-pill">${holderAvatar}${getFlagHtml(h.countryCode)} <span class="name">${escapeHtml(h.name)}</span></span>`;
  }).join('');
  return `<div class="holders">${holderPills}</div>`;
}

function getRecordKey(row) {
  return `${row.group || 'all'}:${row.record || ''}`;
}

function getRecordSurfaceClass(recordName) {
  const label = String(recordName || '').toLowerCase();
  if (label.includes('hard-court')) return 'surface-hard';
  if (label.includes('clay-court')) return 'surface-clay';
  if (label.includes('grass-court')) return 'surface-grass';
  if (label.includes('indoor')) return 'surface-indoor';
  if (label.includes('carpet')) return 'surface-carpet';
  return '';
}

function buildRecordMetrics(row, holder) {
  const label = String(row?.record || '').toLowerCase();
  const wins = Number(holder?.wins || 0);
  const losses = Number(holder?.losses || 0);
  const matches = Number(holder?.matches || (wins + losses));
  const winPct = Number.isFinite(holder?.winPct) ? holder.winPct : (wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0);
  const metrics = [];

  if (label.includes('highest win %')) {
    metrics.push(`Win %: ${formatPercent(winPct)}`);
    metrics.push(`Record: ${formatNumber(wins)}-${formatNumber(losses)}`);
    metrics.push(`Matches: ${formatNumber(matches)}`);
    return metrics;
  }

  if (label.includes('most matches played')) {
    metrics.push(`Matches: ${formatNumber(matches)}`);
    metrics.push(`Record: ${formatNumber(wins)}-${formatNumber(losses)}`);
    metrics.push(`Win %: ${formatPercent(winPct)}`);
    return metrics;
  }

  if (label.includes('most match wins')) {
    metrics.push(`Wins: ${formatNumber(wins)}`);
    metrics.push(`Record: ${formatNumber(wins)}-${formatNumber(losses)}`);
    metrics.push(`Win %: ${formatPercent(winPct)}`);
    return metrics;
  }

  if (label.includes('most grand slam titles')) {
    metrics.push(`Grand Slam titles: ${formatNumber(holder?.grandSlamTitles || 0)}`);
    metrics.push(`Total titles: ${formatNumber(holder?.titles || 0)}`);
    metrics.push(`Finals reached: ${formatNumber(holder?.finals || 0)}`);
    return metrics;
  }

  if (label.includes('1000 titles')) {
    metrics.push(`WTA 1000 titles: ${formatNumber(holder?.mastersTitles || 0)}`);
    metrics.push(`Total titles: ${formatNumber(holder?.titles || 0)}`);
    metrics.push(`Finals reached: ${formatNumber(holder?.finals || 0)}`);
    return metrics;
  }

  if (label.includes('500 titles')) {
    metrics.push(`WTA 500 titles: ${formatNumber(holder?.atp500Titles || 0)}`);
    metrics.push(`Total titles: ${formatNumber(holder?.titles || 0)}`);
    metrics.push(`Finals reached: ${formatNumber(holder?.finals || 0)}`);
    return metrics;
  }

  if (label.includes('250 titles')) {
    metrics.push(`WTA 250 titles: ${formatNumber(holder?.atp250Titles || 0)}`);
    metrics.push(`Total titles: ${formatNumber(holder?.titles || 0)}`);
    metrics.push(`Finals reached: ${formatNumber(holder?.finals || 0)}`);
    return metrics;
  }

  if (label.includes('most titles')) {
    metrics.push(`Titles: ${formatNumber(holder?.titles || 0)}`);
    metrics.push(`Finals reached: ${formatNumber(holder?.finals || 0)}`);
    metrics.push(`Record: ${formatNumber(wins)}-${formatNumber(losses)}`);
    return metrics;
  }

  if (label.includes('most finals reached')) {
    metrics.push(`Finals reached: ${formatNumber(holder?.finals || 0)}`);
    metrics.push(`Titles won: ${formatNumber(holder?.titles || 0)}`);
    metrics.push(`Record: ${formatNumber(wins)}-${formatNumber(losses)}`);
    return metrics;
  }

  const surfaceClass = getRecordSurfaceClass(label);
  if (surfaceClass) {
    const surfaceWins = Number(holder?.surface?.[surfaceClass]?.wins || 0);
    const surfaceLosses = Number(holder?.surface?.[surfaceClass]?.losses || 0);
    const totalSurfaceMatches = surfaceWins + surfaceLosses;
    const surfacePct = totalSurfaceMatches > 0 ? (surfaceWins / totalSurfaceMatches) * 100 : 0;
    metrics.push(`Surface record: ${formatNumber(surfaceWins)}-${formatNumber(surfaceLosses)}`);
    metrics.push(`Surface win %: ${formatPercent(surfacePct)}`);
    metrics.push(`Career record: ${formatNumber(wins)}-${formatNumber(losses)}`);
    return metrics;
  }

  return metrics;
}

function renderRecordDetail(row) {
  if (!Array.isArray(row?.holders) || row.holders.length === 0) return '';
  const latestDatasetYear = getDatasetLatestYear();

  const detailRows = row.holders.map((holder) => {
    const metrics = buildRecordMetrics(row, holder);
    if (!metrics.length) return '';
    const holderPlayer = holder?.key ? service.getPlayerByKey(holder.key) : holder;
    const holderInactive = isLikelyInactivePlayer(holderPlayer, latestDatasetYear);
    const holderAvatar = renderAvatarImage(holderPlayer, {
      className: 'avatar-xs',
      alt: holder.name || 'Unknown',
      inactive: holderInactive,
    });
    return `
      <div class="record-holder-detail">
        <div class="record-holder-name">${holderAvatar}${getFlagHtml(holder.countryCode)} <span class="name">${escapeHtml(holder.name || 'Unknown')}</span></div>
        <div class="record-metrics">
          ${metrics.map((metric) => `<span class="record-metric-pill">${escapeHtml(metric)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  if (!detailRows) return '';
  const tieText = row.holders.length > 1 ? `Joint holders (${row.holders.length})` : 'Record holder';

  return `
    <div class="record-detail-panel">
      <div class="small-note">${escapeHtml(tieText)} • ${escapeHtml(row.record || '')}</div>
      <div class="record-holder-grid">${detailRows}</div>
    </div>
  `;
}

function renderRecords() {
  const rows = service.getRecords(state.recordCategory);
  if (!rows.length) {
    state.selectedRecordKey = '';
    renderEmptyTable(dom.recordsTable, 'No records available yet.');
    return;
  }

  const tableRows = rows.map((row) => {
    const recordKey = getRecordKey(row);
    const detailHtml = renderRecordDetail(row);
    const expandable = Boolean(detailHtml);
    return {
      row,
      recordKey,
      detailHtml,
      expandable,
    };
  });

  if (!tableRows.some((entry) => entry.expandable && entry.recordKey === state.selectedRecordKey)) {
    state.selectedRecordKey = '';
  }

  const body = tableRows.map(({ row, recordKey, detailHtml, expandable }) => {
    const open = expandable && recordKey === state.selectedRecordKey;
    return `
      <tr class="${expandable ? 'record-row-expandable clickable-row' : ''} ${open ? 'active record-row-open' : ''}" ${expandable ? `data-record-key="${escapeHtml(recordKey)}" tabindex="0" role="button" aria-expanded="${open}" aria-selected="${open}"` : ''}>
        <td>
          <div class="record-cell-main">
            <span class="record-main-label">${escapeHtml(row.record)}</span>
            ${expandable ? `<span class="record-expand-hint">${open ? 'Hide details' : 'Show details'}</span>` : ''}
          </div>
        </td>
        <td><strong>${escapeHtml(String(row.value))}</strong></td>
        <td>${renderHolderPills(row.holders)}</td>
        <td>${escapeHtml(row.goatPoints || '-')}</td>
      </tr>
      ${open ? `<tr class="record-detail-row record-detail-open"><td colspan="4">${detailHtml}</td></tr>` : ''}
    `;
  }).join('');

  dom.recordsTable.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Record</th>
          <th>Result</th>
          <th>Record Holder(s)</th>
          <th>GOAT Points</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderAll() {
  renderMainTab();
  renderPlayerSubtab();
  renderPlayerPanel();
  renderTournamentTable();
  renderRecords();
}

function resizePlotIfVisible(element) {
  if (!window.Plotly || !element) return;
  window.Plotly.Plots.resize(element);
}

function resizePlayerSubtabPlots() {
  if (!window.Plotly) return;
  window.requestAnimationFrame(() => {
    if (state.playerSubtab === 'overview') {
      resizePlotIfVisible(dom.playerOverview.querySelector('#overviewSurfaceStrengthChart'));
      resizePlotIfVisible(dom.playerOverview.querySelector('#overviewStyleClusterChart'));
      resizePlotIfVisible(dom.playerOverview.querySelector('#overviewTournamentDNAChart'));
      resizePlotIfVisible(dom.playerOverview.querySelector('#overviewCalendarHeatmapChart'));
      resizePlotIfVisible(dom.playerOverview.querySelector('#overviewEloTrajectoryChart'));
      return;
    }

    if (state.playerSubtab === 'matches') {
      resizePlotIfVisible(dom.playerMatchesInsights?.querySelector('#matchesOpponentQualityChart'));
      resizePlotIfVisible(dom.playerMatchesInsights?.querySelector('#matchesRoundFunnelChart'));
      return;
    }

    if (state.playerSubtab === 'ranking') {
      resizePlotIfVisible(dom.rankingChart);
    }
  });
}

function setActivePlayer(playerKey, updateInput = true) {
  state.activePlayerKey = playerKey;
  state.dnaTournamentKey = '';
  state.dnaTournamentPlayerKey = '';
  const player = service.getPlayerByKey(playerKey);
  if (player && updateInput) {
    dom.playerSearch.value = player.name;
  }
  dom.playerSuggestions.classList.remove('open');
  refreshPlayerYearFilter();
  renderPlayerPanel();
}

function renderSuggestions(queryText) {
  if (!state.loaded) return;
  const query = String(queryText || '').trim();
  const options = service.getPlayerOptions(query, APP_CONFIG.defaultPlayerSearchLimit);
  const latestDatasetYear = getDatasetLatestYear();

  if (!options.length) {
    dom.playerSuggestions.classList.remove('open');
    dom.playerSuggestions.innerHTML = '';
    return;
  }

  dom.playerSuggestions.innerHTML = options.map((player) => {
    const inactive = isLikelyInactivePlayer(player, latestDatasetYear);
    const rankCell = inactive
      ? '<span class="status-badge inactive compact">Inactive</span>'
      : `#${Number.isFinite(player.currentRank) ? player.currentRank : '-'}`;
    const avatar = renderAvatarImage(player, {
      className: 'avatar-sm',
      alt: player.name,
      inactive,
    });
    return `
    <div class="suggestion-item" data-player-key="${escapeHtml(player.key)}">
      ${avatar}
      <div>
        <div class="name">${escapeHtml(player.name)}</div>
        <div class="meta">${getFlagHtml(player.countryCode)} ${formatNumber(player.matches)} matches • ${formatPercent(player.winPct)}</div>
      </div>
      <div class="meta">${rankCell}</div>
    </div>
  `;
  }).join('');

  dom.playerSuggestions.classList.add('open');
}

function populateGlobalYearFilters() {
  const years = service.getAllYears();
  const options = '<option value="all">All years</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');
  dom.tournamentYearFilter.innerHTML = options;
}

function resolveInitialPlayerKey() {
  const preferredName = String(APP_CONFIG.defaultInitialPlayerName || '').trim().toLowerCase();
  if (preferredName) {
    const all = service.getPlayerOptions('', 5000);
    const exact = all.find((player) => String(player?.name || '').trim().toLowerCase() === preferredName);
    if (exact?.key) return exact.key;

    const suggestion = service.getPlayerOptions(preferredName, 1)[0];
    if (suggestion?.key) return suggestion.key;
  }

  return service.getTopPlayers(1)[0]?.key || '';
}

async function loadDataset() {
  if (state.loading) return;

  state.loading = true;
  dom.loadButton.disabled = true;
  setLoadStatus('Preparing historic data loader…');
  setLoadProgress(2);
  state.styleClusterModel = null;

  try {
    await service.loadAll((progress) => {
      if (progress.phase === 'meta') {
        setLoadStatus(progress.message || 'Loading metadata…');
        setLoadProgress(6);
        return;
      }

      if (progress.phase === 'loading') {
        const p = progress.totalFiles > 0
          ? ((progress.fileIndex / progress.totalFiles) * 100)
          : 10;
        setLoadProgress(p);
        setLoadStatus(`${progress.message} • ${formatNumber(progress.totalRows || 0)} rows`);
        return;
      }

      if (progress.phase === 'done') {
        const liveRefreshEnabled = APP_CONFIG.enableLiveYearRefresh !== false;
        if (!liveRefreshEnabled) {
          setLoadProgress(100);
          setLoadStatus(
            `Loaded ${formatNumber(progress.totalRows)} matches, ${formatNumber(progress.totalPlayers)} players, ${formatNumber(progress.totalTournaments)} tournaments from static ${TOUR_NAME} archive.`
          );
          return;
        }

        const liveYearSync = progress.liveYearSync || {};
        const liveYear = Number.isFinite(liveYearSync.year) ? liveYearSync.year : APP_CONFIG.liveYear;
        const liveSource = liveYearSync.sourceType === 'online'
          ? 'internet'
          : liveYearSync.sourceType === 'missing'
            ? 'unavailable'
            : 'local fallback';
        const liveLatest = liveYearSync.latestMatchDateIso
          ? formatDate(liveYearSync.latestMatchDateIso)
          : `Feb ${liveYear}`;

        setLoadProgress(100);
        setLoadStatus(
          `Loaded ${formatNumber(progress.totalRows)} matches, ${formatNumber(progress.totalPlayers)} players, ${formatNumber(progress.totalTournaments)} tournaments. ${liveYear}.csv source: ${liveSource} (up to ${liveLatest}).`
        );
      }
    });

    state.loaded = true;
    const initialPlayerKey = resolveInitialPlayerKey();
    if (initialPlayerKey) setActivePlayer(initialPlayerKey, true);

    populateGlobalYearFilters();
    renderAll();
    renderHeroSubtitle();
  } catch (error) {
    console.error(error);
    setLoadStatus(`Failed to load data: ${error.message || error}`);
    setLoadProgress(0);
    renderHeroSubtitle();
  } finally {
    state.loading = false;
    dom.loadButton.disabled = false;
    dom.loadButton.textContent = state.loaded ? '♻️ Reload Historic Dataset' : '⚡ Load Historic Dataset';
  }
}

function bindEvents() {
  document.addEventListener('error', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (!target.dataset.fallbackSources) return;
    handleAvatarImageError(target);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const image = target.closest('img.js-avatar-zoom');
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    openImageViewerFromElement(image);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!dom.imageViewer?.classList.contains('open')) return;
    if (target.closest('[data-image-viewer-close]')) {
      closeImageViewer();
    }
  });

  dom.mainTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('.tab-btn');
    if (!btn) return;
    state.activeTab = btn.dataset.tab;
    renderMainTab();
    if (state.activeTab === 'players') {
      resizePlayerSubtabPlots();
    }
  });

  dom.playerSubtabs.addEventListener('click', (event) => {
    const btn = event.target.closest('.subtab-btn');
    if (!btn) return;
    state.playerSubtab = btn.dataset.subtab;
    renderPlayerSubtab();
    resizePlayerSubtabPlots();
  });

  dom.playerOverview?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const navButton = target.closest('[data-dna-nav]');
    if (!navButton) return;
    const direction = navButton.getAttribute('data-dna-nav');
    if (direction === 'prev') {
      shiftTournamentDnaGrandSlam(-1);
      return;
    }
    if (direction === 'next') {
      shiftTournamentDnaGrandSlam(1);
    }
  });

  dom.playerSearch.addEventListener('input', () => {
    renderSuggestions(dom.playerSearch.value);
  });

  dom.playerSearch.addEventListener('focus', () => {
    renderSuggestions(dom.playerSearch.value);
  });

  dom.playerSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = dom.playerSuggestions.querySelector('.suggestion-item');
    if (first?.dataset.playerKey) {
      setActivePlayer(first.dataset.playerKey);
      event.preventDefault();
    }
  });

  dom.playerSuggestions.addEventListener('click', (event) => {
    const item = event.target.closest('.suggestion-item');
    if (!item?.dataset.playerKey) return;
    setActivePlayer(item.dataset.playerKey);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.player-search-wrap')) {
      dom.playerSuggestions.classList.remove('open');
    }
  });

  dom.playerYearFilter.addEventListener('change', () => {
    state.playerFilters.year = dom.playerYearFilter.value;
    renderPlayerMatches();
  });

  dom.playerSurfaceFilter.addEventListener('change', () => {
    state.playerFilters.surface = dom.playerSurfaceFilter.value;
    renderPlayerMatches();
  });

  dom.playerCategoryFilter.addEventListener('change', () => {
    state.playerFilters.category = dom.playerCategoryFilter.value;
    renderPlayerMatches();
  });

  dom.playerResultFilter.addEventListener('change', () => {
    state.playerFilters.result = dom.playerResultFilter.value;
    renderPlayerMatches();
  });

  dom.playerMatchSearch.addEventListener('input', () => {
    state.playerFilters.query = dom.playerMatchSearch.value;
    renderPlayerMatches();
  });

  dom.rankingScaleFilter.addEventListener('change', () => {
    state.rankingFilters.scale = dom.rankingScaleFilter.value;
    renderPlayerRanking();
  });

  dom.rankingRangeFilter.addEventListener('change', () => {
    state.rankingFilters.range = dom.rankingRangeFilter.value;
    renderPlayerRanking();
  });

  dom.rankingModeFilter.addEventListener('change', () => {
    state.rankingFilters.mode = dom.rankingModeFilter.value;
    renderPlayerRanking();
  });

  if (dom.rankingSeriesFilter) {
    dom.rankingSeriesFilter.addEventListener('change', () => {
      state.rankingFilters.series = dom.rankingSeriesFilter.value;
      renderPlayerRanking();
    });
  }

  dom.tournamentSearch.addEventListener('input', () => {
    state.tournamentFilters.search = dom.tournamentSearch.value;
    renderTournamentTable();
  });

  dom.tournamentCategoryFilter.addEventListener('change', () => {
    state.tournamentFilters.category = dom.tournamentCategoryFilter.value;
    renderTournamentTable();
  });

  dom.tournamentSurfaceFilter.addEventListener('change', () => {
    state.tournamentFilters.surface = dom.tournamentSurfaceFilter.value;
    renderTournamentTable();
  });

  dom.tournamentYearFilter.addEventListener('change', () => {
    state.tournamentFilters.year = dom.tournamentYearFilter.value;
    renderTournamentTable();
  });

  dom.tournamentTable.addEventListener('click', (event) => {
    const row = event.target.closest('[data-tournament-key]');
    if (!row?.dataset.tournamentKey) return;
    state.selectedTournamentKey = row.dataset.tournamentKey;
    renderTournamentTable();
  });

  dom.tournamentDetail.addEventListener('click', (event) => {
    if (!event.target.closest('#openTournamentModalBtn')) return;
    openTournamentModal();
  });

  if (dom.tournamentDetailToggle) {
    dom.tournamentDetailToggle.addEventListener('click', () => {
      state.tournamentDetailCollapsed = !state.tournamentDetailCollapsed;
      syncTournamentDetailVisibility();
    });
  }

  if (dom.tournamentModalClose) {
    dom.tournamentModalClose.addEventListener('click', closeTournamentModal);
  }
  if (dom.tournamentModal) {
    dom.tournamentModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-modal-close]')) {
        closeTournamentModal();
      }
    });
  }

  dom.recordCategoryFilter.addEventListener('change', () => {
    state.recordCategory = dom.recordCategoryFilter.value;
    state.selectedRecordKey = '';
    renderRecords();
  });

  dom.recordsTable.addEventListener('click', (event) => {
    const row = event.target.closest('[data-record-key]');
    if (!row?.dataset.recordKey) return;
    state.selectedRecordKey = state.selectedRecordKey === row.dataset.recordKey ? '' : row.dataset.recordKey;
    renderRecords();
  });

  dom.recordsTable.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-record-key]');
    if (!row?.dataset.recordKey) return;
    event.preventDefault();
    state.selectedRecordKey = state.selectedRecordKey === row.dataset.recordKey ? '' : row.dataset.recordKey;
    renderRecords();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (dom.imageViewer?.classList.contains('open')) {
      closeImageViewer();
      return;
    }
    if (dom.tournamentModal?.classList.contains('open')) {
      closeTournamentModal();
    }
  });

  dom.loadButton.addEventListener('click', () => {
    loadDataset();
  });
}

function init() {
  ensureImageViewer();
  bindEvents();
  if (dom.rankingSeriesFilter) {
    dom.rankingSeriesFilter.value = state.rankingFilters.series;
  }
  syncTournamentDetailVisibility();
  renderMainTab();
  renderPlayerSubtab();
  renderHeroSubtitle();
  renderEmptyTable(dom.playerOverview, 'Load data and select a player to see the profile dashboard.');
  renderEmptyTable(dom.playerMatchesTable, 'Load data and select a player to inspect match history.');
  if (dom.playerMatchesInsights) {
    renderEmptyTable(dom.playerMatchesInsights, 'Interactive match intelligence charts will appear after player data is loaded.');
  }
  renderEmptyTable(dom.playerRivalriesTable, 'Load data and select a player to inspect rivalries.');
  renderEmptyTable(dom.rankingSummaryTiles, 'Load data and select a player to view ranking timeline.');
  renderEmptyTable(dom.rankingTimelineTable, 'Load data and select a player to view ranking checkpoints.');
  if (dom.rankingAdvancedPlots) {
    dom.rankingAdvancedPlots.innerHTML = '';
  }
  renderEmptyTable(dom.tournamentTable, 'Load data to analyze tournaments.');
  renderEmptyTable(dom.recordsTable, 'Load data to generate records.');

  if (dom.rankingChart) {
    dom.rankingChart.innerHTML = '';
  }

  if (APP_CONFIG.enableLiveYearRefresh === false) {
    setLoadStatus(`Ready. Manifest expects ${APP_CONFIG.csvManifestPath} (static dataset).`);
  } else {
    setLoadStatus(`Ready. Manifest expects ${APP_CONFIG.csvManifestPath}; ${APP_CONFIG.liveYear}.csv will refresh online when you load.`);
  }
  window.requestAnimationFrame(() => {
    loadDataset();
  });
}

init();
