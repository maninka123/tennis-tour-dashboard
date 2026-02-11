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
const HERO_SUBTITLE_BASE = `Player Explorer, Tournament Explorer, and Records Book powered by your local ${TOUR_NAME} CSV archive`;

const state = {
  loaded: false,
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
  },
  tournamentFilters: {
    search: '',
    category: 'all',
    surface: 'all',
    year: 'all',
  },
  recordCategory: 'all',
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
  playerRivalriesTable: document.getElementById('playerRivalriesTable'),
  rankingSummaryTiles: document.getElementById('rankingSummaryTiles'),
  rankingChart: document.getElementById('rankingChart'),
  rankingTimelineTable: document.getElementById('rankingTimelineTable'),

  playerYearFilter: document.getElementById('playerYearFilter'),
  playerSurfaceFilter: document.getElementById('playerSurfaceFilter'),
  playerCategoryFilter: document.getElementById('playerCategoryFilter'),
  playerResultFilter: document.getElementById('playerResultFilter'),
  playerMatchSearch: document.getElementById('playerMatchSearch'),
  rankingScaleFilter: document.getElementById('rankingScaleFilter'),
  rankingRangeFilter: document.getElementById('rankingRangeFilter'),
  rankingModeFilter: document.getElementById('rankingModeFilter'),

  tournamentSearch: document.getElementById('tournamentSearch'),
  tournamentCategoryFilter: document.getElementById('tournamentCategoryFilter'),
  tournamentSurfaceFilter: document.getElementById('tournamentSurfaceFilter'),
  tournamentYearFilter: document.getElementById('tournamentYearFilter'),
  tournamentTable: document.getElementById('tournamentTable'),
  tournamentDetail: document.getElementById('tournamentDetail'),

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

function renderPlayerHero() {
  const player = service.getPlayerByKey(state.activePlayerKey);
  if (!player) {
    dom.playerHero.innerHTML = '<div class="empty-placeholder">Pick a player from the search suggestions.</div>';
    return;
  }

  const rankText = Number.isFinite(player.currentRank) ? `Current Rank #${player.currentRank}` : 'Rank data unavailable';
  const bestRankText = Number.isFinite(player.bestRank) ? `Best Rank #${player.bestRank}` : 'Best rank unavailable';

  dom.playerHero.innerHTML = `
    <div class="player-hero-head">
      <img class="player-avatar" src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}" loading="lazy">
      <div>
        <div class="player-name-line">
          ${getFlagHtml(player.countryCode)}
          <h3>${escapeHtml(player.name)}</h3>
        </div>
        <div class="player-meta-line">
          <span>${rankText}</span>
          <span>•</span>
          <span>${bestRankText}</span>
          <span>•</span>
          <span>${formatNumber(player.matches)} matches</span>
          ${player.profileUrl ? `<span>•</span><a href="${escapeHtml(player.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(TOUR_NAME)} Profile</a>` : ''}
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
  `;
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
    return;
  }

  const rows = service.getPlayerMatches(state.activePlayerKey, state.playerFilters);
  if (!rows.length) {
    renderEmptyTable(dom.playerMatchesTable, 'No matches found for the selected filters.');
    return;
  }

  const shown = rows.slice(0, 350);
  const tableRows = shown.map((row) => {
    const opponent = service.getPlayerByKey(row.opponentKey);
    const opponentImg = opponent?.image || '';

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
            ${opponentImg ? `<img class="avatar-xs" src="${escapeHtml(opponentImg)}" alt="${escapeHtml(row.opponentName)}" loading="lazy">` : ''}
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

  const rows = rivalries.map((r) => {
    const rival = service.getPlayerByKey(r.key);
    const rivalImg = rival?.image || '';

    return `
      <tr>
        <td>
          <span class="person-main">
            ${rivalImg ? `<img class="avatar-xs" src="${escapeHtml(rivalImg)}" alt="${escapeHtml(r.name)}" loading="lazy">` : ''}
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

function renderPlayerRanking() {
  const timeline = service.getPlayerRankingTimeline(state.activePlayerKey);
  if (!timeline || !timeline.points.length) {
    renderEmptyTable(dom.rankingSummaryTiles, 'Ranking timeline is unavailable for this player.');
    renderEmptyTable(dom.rankingTimelineTable, 'No ranking events found.');
    if (window.Plotly && dom.rankingChart) {
      window.Plotly.purge(dom.rankingChart);
    } else if (dom.rankingChart) {
      dom.rankingChart.innerHTML = '<div class="empty-placeholder">Interactive chart requires Plotly.</div>';
    }
    return;
  }

  const rangeStart = getRangeStartDate(timeline.points, state.rankingFilters.range);
  const filtered = timeline.points.filter((row) => !rangeStart || row.dateSort >= rangeStart);

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

  const summaryTiles = [
    { label: '📌 Current Rank', value: current ? `#${current.rank}` : '-', note: current ? formatDate(current.dateIso) : '-' },
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
    const x = filtered.map((row) => row.dateIso);
    const y = filtered.map((row) => row.rank);
    const custom = filtered.map((row) => [
      row.tournament,
      row.round || '-',
      row.result || '-',
      row.rankPoints ?? '-',
      row.opponentName || '-',
      formatSignedDelta(row.deltaFromPrev || 0),
    ]);

    const trace = {
      x,
      y,
      mode: state.rankingFilters.mode,
      type: 'scatter',
      line: {
        shape: 'hv',
        color: '#2f71bc',
        width: 3,
      },
      marker: {
        size: state.rankingFilters.mode.includes('markers') ? 6 : 0,
        color: '#4db4e7',
        line: { color: '#1f4f86', width: 1 },
      },
      customdata: custom,
      hovertemplate:
        '<b>%{x}</b><br>' +
        'Rank: <b>#%{y}</b><br>' +
        'Points: %{customdata[3]}<br>' +
        'Tournament: %{customdata[0]}<br>' +
        'Round: %{customdata[1]} (%{customdata[2]})<br>' +
        'Opponent: %{customdata[4]}<br>' +
        'Change: %{customdata[5]}<extra></extra>',
    };

    const isLog = state.rankingFilters.scale === 'log';
    const layout = {
      margin: { l: 72, r: 24, t: 18, b: 76 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#f7fbff',
      font: { family: 'Manrope, sans-serif', color: '#223141' },
      hovermode: 'closest',
      xaxis: {
        title: { text: 'Date', standoff: 16 },
        automargin: true,
        gridcolor: '#dce7f3',
        zeroline: false,
      },
      yaxis: {
        title: { text: `${TOUR_NAME} Ranking (Lower is better)`, standoff: 12 },
        automargin: true,
        autorange: 'reversed',
        type: isLog ? 'log' : 'linear',
        gridcolor: '#dce7f3',
        zeroline: false,
        tickvals: isLog ? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000] : undefined,
      },
      showlegend: false,
    };

    window.Plotly.react(dom.rankingChart, [trace], layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
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
}

function renderPlayerPanel() {
  renderPlayerHero();
  renderPlayerOverview();
  renderPlayerMatches();
  renderPlayerRivalries();
  renderPlayerRanking();
}

function renderTournamentTable() {
  const rows = service.getTournamentRows(state.tournamentFilters);
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
    return `
      <tr class="clickable-row ${row.key === state.selectedTournamentKey ? 'active' : ''}" data-tournament-key="${escapeHtml(row.key)}">
        <td>${escapeHtml(row.name)}</td>
        <td><span class="category-badge ${row.category}">${escapeHtml(getCategoryLabel(row.category))}</span></td>
        <td><span class="surface-pill ${row.surfaceClass}">${escapeHtml(getSurfaceLabel(row.surfaceClass))}</span></td>
        <td>${row.firstYear}-${row.lastYear}</td>
        <td>${formatNumber(row.eventCount)}</td>
        <td>${formatNumber(row.matchCount)}</td>
        <td>${formatNumber(row.playerCount)}</td>
        <td>${champion ? `${getFlagHtml(champion.countryCode)} ${escapeHtml(champion.name)} (${champion.count})` : '-'}</td>
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
          <th>Top Champion</th>
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

  const championRows = detail.topChampions.slice(0, 8).map((row) => `
    <div class="person-row">
      <span class="person-main">${getFlagHtml(row.countryCode)} <span class="name">${escapeHtml(row.name)}</span></span>
      <strong>${row.count}</strong>
    </div>
  `).join('');

  const finalRows = detail.finals.slice(0, 10).map((row) => `
    <div class="final-row">
      <div class="final-main">
        <span class="small-note">${escapeHtml(formatDate(row.dateIso))}</span>
        <span>${getFlagHtml(row.winnerCountryCode)} <span class="name">${escapeHtml(row.winnerName)}</span></span>
        <span class="small-note">def.</span>
        <span>${getFlagHtml(row.loserCountryCode)} <span class="name">${escapeHtml(row.loserName)}</span></span>
      </div>
      <strong>${escapeHtml(row.score || '-')}</strong>
    </div>
  `).join('');

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
  `;
}

function renderHolderPills(holders) {
  if (!Array.isArray(holders) || holders.length === 0) return '-';
  return `<div class="holders">${holders.slice(0, 4).map((h) => `
    <span class="holder-pill">${getFlagHtml(h.countryCode)} <span class="name">${escapeHtml(h.name)}</span></span>
  `).join('')}</div>`;
}

function renderRecords() {
  const rows = service.getRecords(state.recordCategory);
  if (!rows.length) {
    renderEmptyTable(dom.recordsTable, 'No records available yet.');
    return;
  }

  const body = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.record)}</td>
      <td><strong>${escapeHtml(String(row.value))}</strong></td>
      <td>${renderHolderPills(row.holders)}</td>
      <td>${escapeHtml(row.goatPoints || '-')}</td>
    </tr>
  `).join('');

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

function setActivePlayer(playerKey, updateInput = true) {
  state.activePlayerKey = playerKey;
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

  if (!options.length) {
    dom.playerSuggestions.classList.remove('open');
    dom.playerSuggestions.innerHTML = '';
    return;
  }

  dom.playerSuggestions.innerHTML = options.map((player) => `
    <div class="suggestion-item" data-player-key="${escapeHtml(player.key)}">
      <img class="avatar-sm" src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}" loading="lazy">
      <div>
        <div class="name">${escapeHtml(player.name)}</div>
        <div class="meta">${getFlagHtml(player.countryCode)} ${formatNumber(player.matches)} matches • ${formatPercent(player.winPct)}</div>
      </div>
      <div class="meta">#${Number.isFinite(player.currentRank) ? player.currentRank : '-'}</div>
    </div>
  `).join('');

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

function bindEvents() {
  dom.mainTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('.tab-btn');
    if (!btn) return;
    state.activeTab = btn.dataset.tab;
    renderMainTab();
  });

  dom.playerSubtabs.addEventListener('click', (event) => {
    const btn = event.target.closest('.subtab-btn');
    if (!btn) return;
    state.playerSubtab = btn.dataset.subtab;
    renderPlayerSubtab();
    if (state.playerSubtab === 'ranking' && window.Plotly && dom.rankingChart) {
      window.requestAnimationFrame(() => window.Plotly.Plots.resize(dom.rankingChart));
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
    if (!event.target.closest('.player-search-wrap')) {
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

  dom.recordCategoryFilter.addEventListener('change', () => {
    state.recordCategory = dom.recordCategoryFilter.value;
    renderRecords();
  });

  dom.loadButton.addEventListener('click', async () => {
    dom.loadButton.disabled = true;
    setLoadStatus('Preparing historic data loader…');
    setLoadProgress(2);

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
      dom.loadButton.disabled = false;
      dom.loadButton.textContent = state.loaded ? '♻️ Reload Historic Dataset' : '⚡ Load Historic Dataset';
    }
  });
}

function init() {
  bindEvents();
  renderMainTab();
  renderPlayerSubtab();
  renderHeroSubtitle();
  renderEmptyTable(dom.playerOverview, 'Load data and select a player to see the profile dashboard.');
  renderEmptyTable(dom.playerMatchesTable, 'Load data and select a player to inspect match history.');
  renderEmptyTable(dom.playerRivalriesTable, 'Load data and select a player to inspect rivalries.');
  renderEmptyTable(dom.rankingSummaryTiles, 'Load data and select a player to view ranking timeline.');
  renderEmptyTable(dom.rankingTimelineTable, 'Load data and select a player to view ranking checkpoints.');
  renderEmptyTable(dom.tournamentTable, 'Load data to analyze tournaments.');
  renderEmptyTable(dom.recordsTable, 'Load data to generate records.');

  if (dom.rankingChart) {
    dom.rankingChart.innerHTML = '<div class="empty-placeholder">Ranking chart will appear here after loading data.</div>';
  }

  if (APP_CONFIG.enableLiveYearRefresh === false) {
    setLoadStatus(`Ready. Manifest expects ${APP_CONFIG.csvManifestPath} (static dataset).`);
  } else {
    setLoadStatus(`Ready. Manifest expects ${APP_CONFIG.csvManifestPath}; ${APP_CONFIG.liveYear}.csv will refresh online when you load.`);
  }
}

init();
