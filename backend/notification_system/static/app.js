const state = {
  rules: [],
  history: [],
  options: {
    categories: [],
    players: [],
    tournaments: [],
    tour: 'both',
  },
  openDropdown: null,
  editingRuleEnabled: true,
  builderStep: 1,
  scopeLinkOps: ['all', 'all'],
};

const COUNTRY_ALPHA3_TO_ALPHA2 = {
  AUS: 'AU', AUT: 'AT', BEL: 'BE', BGR: 'BG', BLR: 'BY', BRA: 'BR', CAN: 'CA', CHE: 'CH',
  CHN: 'CN', CZE: 'CZ', DEU: 'DE', DEN: 'DK', ESP: 'ES', EST: 'EE', FIN: 'FI', FRA: 'FR',
  GBR: 'GB', GEO: 'GE', GRC: 'GR', HRV: 'HR', HUN: 'HU', IRL: 'IE', ITA: 'IT', JPN: 'JP',
  KAZ: 'KZ', LVA: 'LV', NLD: 'NL', NOR: 'NO', POL: 'PL', PRT: 'PT', ROU: 'RO', RUS: 'RU',
  SRB: 'RS', SVK: 'SK', SVN: 'SI', SWE: 'SE', TUR: 'TR', UKR: 'UA', USA: 'US',
};

const EVENT_TYPE_META = {
  upcoming_match: {
    hint: 'Alert for scheduled matches that satisfy your filters.',
    scopes: ['categories', 'tournaments', 'players', 'round_filters'],
    params: [],
  },
  live_match_starts: {
    hint: 'Alert once when a selected match becomes live.',
    scopes: ['categories', 'tournaments', 'players'],
    params: [],
  },
  set_completed: {
    hint: 'Alert when selected match completes a set threshold.',
    scopes: ['categories', 'tournaments', 'players', 'round_filters'],
    params: ['set_number'],
  },
  match_result: {
    hint: 'Alert when a completed result matches your filters.',
    scopes: ['categories', 'tournaments', 'players', 'round_filters', 'extra_conditions'],
    params: [],
  },
  upset_alert: {
    hint: 'Alert for result upsets where lower-ranked player beats higher-ranked player.',
    scopes: ['categories', 'tournaments', 'players'],
    params: ['upset_min_rank_gap'],
  },
  close_match_deciding_set: {
    hint: 'Alert for deciding-set or tie-break heavy close matches.',
    scopes: ['categories', 'tournaments', 'players', 'extra_conditions'],
    params: ['deciding_mode'],
  },
  player_reaches_round: {
    hint: 'Track when a specific player reaches selected round or above.',
    scopes: ['categories', 'tournaments', 'players', 'tracked_player', 'round_filters', 'extra_conditions'],
    params: [],
    requiresTracked: true,
  },
  tournament_stage_reminder: {
    hint: 'Alert for QF/SF/F upcoming or live matches in selected events.',
    scopes: ['categories', 'tournaments', 'players', 'extra_conditions'],
    params: ['stage_rounds'],
  },
  surface_specific_result: {
    hint: 'Alert only for match results on selected surface.',
    scopes: ['categories', 'tournaments', 'players', 'extra_conditions'],
    params: ['surface_value'],
  },
  time_window_schedule_alert: {
    hint: 'Alert for upcoming matches in the next N hours.',
    scopes: ['categories', 'tournaments', 'players', 'extra_conditions'],
    params: ['window_hours'],
  },
  ranking_milestone: {
    hint: 'Track ranking milestones (Top 100/50/20/10 or career high).',
    scopes: ['players', 'tracked_player'],
    params: ['ranking_milestone', 'emit_on_first_seen'],
    requiresPlayerSelection: true,
  },
  title_milestone: {
    hint: 'Track title count milestones for selected players.',
    scopes: ['players', 'tracked_player'],
    params: ['title_target', 'emit_on_first_seen'],
    requiresPlayerSelection: true,
  },
  head_to_head_breaker: {
    hint: 'Alert when tracked player breaks a losing streak against rival.',
    scopes: ['tracked_player', 'categories', 'tournaments', 'extra_conditions'],
    params: ['rival_player', 'h2h_min_losses'],
    requiresTracked: true,
  },
  tournament_completed: {
    hint: 'Alert when tournament finals are completed.',
    scopes: ['categories', 'tournaments', 'players', 'extra_conditions'],
    params: [],
  },
};

const CONDITION_OPTIONS = {
  tournament_name: { operators: ['contains', 'equals'], suggestions: [], placeholder: 'Tournament name' },
  player_name: { operators: ['contains', 'equals'], suggestions: [], placeholder: 'Player name' },
  category: { operators: ['contains', 'equals'], suggestions: [], placeholder: 'Category code' },
  surface: { operators: ['contains', 'equals'], suggestions: ['Hard', 'Clay', 'Grass', 'Indoor'], placeholder: 'Surface' },
  round_rank: { operators: ['equals', 'gte', 'lte'], suggestions: ['1', '2', '3', '4', '5', '6', '7'], placeholder: 'Numeric rank' },
};

const el = {
  smtpStatusPill: document.getElementById('smtpStatusPill'),
  schedulerPill: document.getElementById('schedulerPill'),
  emailInput: document.getElementById('emailInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  runNowBtn: document.getElementById('runNowBtn'),
  testEmailBtn: document.getElementById('testEmailBtn'),
  settingsMessage: document.getElementById('settingsMessage'),
  taskProgressInline: document.getElementById('taskProgressInline'),
  taskProgressBar: document.getElementById('taskProgressBar'),
  taskProgressText: document.getElementById('taskProgressText'),

  ruleForm: document.getElementById('ruleForm'),
  ruleIdInput: document.getElementById('ruleIdInput'),
  ruleNameInput: document.getElementById('ruleNameInput'),
  eventTypeInput: document.getElementById('eventTypeInput'),
  eventTypeHint: document.getElementById('eventTypeHint'),
  tourInput: document.getElementById('tourInput'),
  roundModeInput: document.getElementById('roundModeInput'),
  roundValueInput: document.getElementById('roundValueInput'),
  conditionGroupInput: document.getElementById('conditionGroupInput'),
  stepChip1: document.getElementById('stepChip1'),
  stepChip2: document.getElementById('stepChip2'),
  stepChip3: document.getElementById('stepChip3'),
  builderProgressHint: document.getElementById('builderProgressHint'),
  layerCore: document.getElementById('layerCore'),
  layerScope: document.getElementById('layerScope'),
  layerDelivery: document.getElementById('layerDelivery'),
  scopeLogicSection: document.getElementById('scopeLogicSection'),
  scopeFiltersSection: document.getElementById('scopeFiltersSection'),
  eventParamsSection: document.getElementById('eventParamsSection'),
  step1ConfirmBtn: document.getElementById('step1ConfirmBtn'),
  step2NextBtn: document.getElementById('step2NextBtn'),
  step2SkipBtn: document.getElementById('step2SkipBtn'),
  categoriesInput: document.getElementById('categoriesInput'),
  tournamentsInput: document.getElementById('tournamentsInput'),
  playersInput: document.getElementById('playersInput'),
  trackedPlayerInput: document.getElementById('trackedPlayerInput'),
  trackedPlayerField: document.getElementById('trackedPlayerField'),
  conditionsList: document.getElementById('conditionsList'),
  addConditionBtn: document.getElementById('addConditionBtn'),
  resetFormBtn: document.getElementById('resetFormBtn'),
  saveActions: document.getElementById('saveActions'),
  saveRuleBtn: document.getElementById('saveRuleBtn'),
  ruleRequiredHint: document.getElementById('ruleRequiredHint'),
  ruleMessage: document.getElementById('ruleMessage'),

  severityInput: document.getElementById('severityInput'),
  cooldownInput: document.getElementById('cooldownInput'),
  channelEmail: document.getElementById('channelEmail'),
  channelTelegram: document.getElementById('channelTelegram'),
  channelDiscord: document.getElementById('channelDiscord'),
  channelWebPush: document.getElementById('channelWebPush'),
  quietHoursEnabledInput: document.getElementById('quietHoursEnabledInput'),
  quietStartHourInput: document.getElementById('quietStartHourInput'),
  quietEndHourInput: document.getElementById('quietEndHourInput'),
  timezoneOffsetInput: document.getElementById('timezoneOffsetInput'),

  paramSetNumber: document.getElementById('paramSetNumber'),
  paramSetThresholdRow: document.getElementById('paramSetThresholdRow'),
  paramSetThresholdButtons: [...document.querySelectorAll('.set-threshold-btn')],
  paramUpsetGap: document.getElementById('paramUpsetGap'),
  paramDecidingMode: document.getElementById('paramDecidingMode'),
  paramRankingMilestone: document.getElementById('paramRankingMilestone'),
  paramTitleTarget: document.getElementById('paramTitleTarget'),
  paramRivalPlayerInput: document.getElementById('paramRivalPlayerInput'),
  paramH2HLosses: document.getElementById('paramH2HLosses'),
  paramSurfaceValue: document.getElementById('paramSurfaceValue'),
  paramWindowHours: document.getElementById('paramWindowHours'),
  paramStageQF: document.getElementById('paramStageQF'),
  paramStageSF: document.getElementById('paramStageSF'),
  paramStageF: document.getElementById('paramStageF'),
  paramEmitFirstSeen: document.getElementById('paramEmitFirstSeen'),

  rulesContainer: document.getElementById('rulesContainer'),
  ruleCount: document.getElementById('ruleCount'),
  historyContainer: document.getElementById('historyContainer'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  conditionValueSuggestions: document.getElementById('conditionValueSuggestions'),
  confirmDialog: document.getElementById('confirmDialog'),
  confirmDialogTitle: document.getElementById('confirmDialogTitle'),
  confirmDialogBody: document.getElementById('confirmDialogBody'),
  confirmCancelBtn: document.getElementById('confirmCancelBtn'),
  confirmOkBtn: document.getElementById('confirmOkBtn'),
  resultDialog: document.getElementById('resultDialog'),
  resultDialogTitle: document.getElementById('resultDialogTitle'),
  resultDialogBody: document.getElementById('resultDialogBody'),
  resultSummaryList: document.getElementById('resultSummaryList'),
  resultDialogTimer: document.getElementById('resultDialogTimer'),
  resultCloseBtn: document.getElementById('resultCloseBtn'),

  categoriesDropdownBtn: document.getElementById('categoriesDropdownBtn'),
  categoriesDropdown: document.getElementById('categoriesDropdown'),
  tournamentsDropdownBtn: document.getElementById('tournamentsDropdownBtn'),
  tournamentsDropdown: document.getElementById('tournamentsDropdown'),
  playersDropdownBtn: document.getElementById('playersDropdownBtn'),
  playersDropdown: document.getElementById('playersDropdown'),
  trackedPlayerDropdownBtn: document.getElementById('trackedPlayerDropdownBtn'),
  trackedPlayerDropdown: document.getElementById('trackedPlayerDropdown'),
  paramRivalPlayerDropdownBtn: document.getElementById('paramRivalPlayerDropdownBtn'),
  paramRivalPlayerDropdown: document.getElementById('paramRivalPlayerDropdown'),
};

let confirmDialogResolver = null;
let resultDialogAutoCloseTimer = null;
let resultDialogCountdownTimer = null;
let taskProgressTicker = null;
let taskProgressValue = 0;

function splitCsv(text) {
  return String(text || '').split(',').map((x) => x.trim()).filter(Boolean);
}

function iso2ToFlagEmoji(iso2) {
  const value = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return '';
  return String.fromCodePoint(value.charCodeAt(0) + 127397, value.charCodeAt(1) + 127397);
}

function stripLeadingFlagEmoji(text) {
  return String(text || '').replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '').trim();
}

function parseTournamentLabel(rawName, rawCountryCode = '') {
  let name = String(rawName || '').trim();
  if (!name) return { label: '', flagIso2: '', countryCode: '' };

  let countryCode = String(rawCountryCode || '').trim().toUpperCase();
  let flagIso2 = countryToIso2(countryCode);

  const prefixedMatch = name.match(/^([A-Za-z]{2,3})\s*,\s*(.+)$/);
  if (prefixedMatch) {
    const maybeCountry = prefixedMatch[1].toUpperCase();
    const maybeIso2 = countryToIso2(maybeCountry);
    if (maybeIso2) {
      countryCode = maybeCountry;
      flagIso2 = maybeIso2;
      name = prefixedMatch[2].trim();
    }
  }

  return { label: name, flagIso2, countryCode };
}

function normalizeTournamentToken(token) {
  let value = stripLeadingFlagEmoji(token);
  value = String(value || '').trim();
  if (!value) return '';

  const prefixedMatch = value.match(/^([A-Za-z]{2,3})\s*,\s*(.+)$/);
  if (prefixedMatch && countryToIso2(prefixedMatch[1])) {
    value = prefixedMatch[2].trim();
  }
  return value;
}

function normalizePlayerToken(token) {
  let value = stripLeadingFlagEmoji(token);
  value = String(value || '').trim();
  if (!value) return '';
  const prefixedMatch = value.match(/^([A-Za-z]{2,3})\s*,\s*(.+)$/);
  if (prefixedMatch) {
    value = prefixedMatch[2].trim();
  }
  return value;
}

function getBestPlayerMetaByName(name) {
  const key = normalizeLookup(name);
  if (!key) return null;
  let best = null;
  (state.options.players || []).forEach((item) => {
    if (normalizeLookup(item.name) !== key) return;
    if (!best) {
      best = item;
      return;
    }
    const bestRank = Number.isFinite(best.rank) ? best.rank : 10_000;
    const nextRank = Number.isFinite(item.rank) ? item.rank : 10_000;
    const bestHasImage = best.image_url ? 1 : 0;
    const nextHasImage = item.image_url ? 1 : 0;
    if (nextRank < bestRank || (nextRank === bestRank && nextHasImage > bestHasImage)) {
      best = item;
    }
  });
  return best;
}

function formatPlayerDisplayToken(token) {
  const cleanName = normalizePlayerToken(token);
  if (!cleanName) return '';
  const meta = getBestPlayerMetaByName(cleanName);
  const flagIso2 = countryToIso2(meta?.country || '');
  const flag = iso2ToFlagEmoji(flagIso2);
  return flag ? `${flag} ${cleanName}` : cleanName;
}

function canonicalizeToken(value, kind = '') {
  if (kind === 'tournaments') return normalizeLookup(normalizeTournamentToken(value));
  if (kind === 'players') return normalizeLookup(normalizePlayerToken(value));
  return normalizeLookup(value);
}

function uniqueCsvTokens(values, kind = '') {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const token = String(value || '').trim();
    if (!token) return;
    const canonical = canonicalizeToken(token, kind);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    out.push(token);
  });
  return out;
}

function normalizeTournamentInputDisplay() {
  if (!el.tournamentsInput) return;
  const rawTokens = splitCsv(el.tournamentsInput.value);
  const normalized = [];

  for (let i = 0; i < rawTokens.length; i += 1) {
    const token = rawTokens[i];
    const cleanToken = normalizeTournamentToken(token);
    if (!cleanToken) continue;

    if (/^[A-Za-z]{2,3}$/.test(cleanToken) && i + 1 < rawTokens.length) {
      const iso2 = countryToIso2(cleanToken);
      const nextName = normalizeTournamentToken(rawTokens[i + 1]);
      if (iso2 && nextName) {
        const flag = iso2ToFlagEmoji(iso2);
        normalized.push(flag ? `${flag} ${nextName}` : nextName);
        i += 1;
        continue;
      }
    }

    normalized.push(cleanToken);
  }

  const deduped = uniqueCsvTokens(normalized, 'tournaments');
  const nextValue = deduped.join(', ');
  if (nextValue !== el.tournamentsInput.value) {
    el.tournamentsInput.value = nextValue;
  }
}

function normalizePlayersInputDisplay() {
  if (!el.playersInput) return;
  const rawTokens = splitCsv(el.playersInput.value);
  const normalized = [];

  for (let i = 0; i < rawTokens.length; i += 1) {
    const token = rawTokens[i];
    const cleanToken = normalizePlayerToken(token);
    if (!cleanToken) continue;

    if (cleanToken.length <= 3 && i + 1 < rawTokens.length) {
      const nextName = normalizePlayerToken(rawTokens[i + 1]);
      const shortKey = normalizeLookup(cleanToken).replace(/\s+/g, '');
      const nextKey = normalizeLookup(nextName).replace(/\s+/g, '');
      if (shortKey && nextKey && nextKey.startsWith(shortKey) && nextName.length > cleanToken.length) {
        normalized.push(formatPlayerDisplayToken(nextName));
        i += 1;
        continue;
      }
    }

    normalized.push(formatPlayerDisplayToken(cleanToken));
  }

  const deduped = uniqueCsvTokens(normalized, 'players');
  const nextValue = deduped.join(', ');
  if (nextValue !== el.playersInput.value) {
    el.playersInput.value = nextValue;
  }
}

function parseIntSafe(value, fallback = 0) {
  const out = Number.parseInt(value, 10);
  return Number.isFinite(out) ? out : fallback;
}

function appendCsvValue(input, value, kind = '') {
  if (!value) return;
  const candidate = String(value).trim();
  if (!candidate) return;

  const raw = String(input.value || '');
  const cursor = typeof input.selectionStart === 'number' ? input.selectionStart : raw.length;
  const left = raw.slice(0, cursor);
  const right = raw.slice(cursor);
  const start = left.lastIndexOf(',') + 1;
  const nextComma = right.indexOf(',');
  const end = nextComma === -1 ? raw.length : cursor + nextComma;

  const before = splitCsv(raw.slice(0, start));
  const after = splitCsv(raw.slice(end));
  const merged = uniqueCsvTokens([...before, candidate, ...after], kind);

  input.value = merged.join(', ');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function countryToIso2(countryCode) {
  const raw = String(countryCode || '').trim().toUpperCase();
  if (!raw) return '';
  const code = raw.length === 3 ? COUNTRY_ALPHA3_TO_ALPHA2[raw] || '' : raw;
  if (code.length !== 2) return '';
  return code.toLowerCase();
}

function normalizeLookup(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function setMessage(target, text, isError = false) {
  target.textContent = text || '';
  target.style.color = isError ? '#b9404f' : '#365a7b';
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function syncModalBodyLock() {
  const confirmOpen = !!(el.confirmDialog && !el.confirmDialog.classList.contains('is-hidden'));
  const resultOpen = !!(el.resultDialog && !el.resultDialog.classList.contains('is-hidden'));
  document.body.classList.toggle('confirm-open', confirmOpen || resultOpen);
}

function setTaskProgress(value = 0, text = '') {
  if (!el.taskProgressInline || !el.taskProgressBar || !el.taskProgressText) return;
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  el.taskProgressBar.style.width = `${bounded}%`;
  el.taskProgressText.textContent = text || el.taskProgressText.textContent || 'Working...';
}

function startTaskProgress(text = 'Working...') {
  if (!el.taskProgressInline) return;
  if (taskProgressTicker) {
    clearInterval(taskProgressTicker);
    taskProgressTicker = null;
  }
  taskProgressValue = 8;
  el.taskProgressInline.classList.remove('is-hidden', 'is-success', 'is-error');
  setTaskProgress(taskProgressValue, text);
  taskProgressTicker = setInterval(() => {
    taskProgressValue = Math.min(90, taskProgressValue + (Math.random() * 7 + 2));
    setTaskProgress(taskProgressValue);
  }, 220);
}

function finishTaskProgress(text = 'Completed', { error = false } = {}) {
  if (!el.taskProgressInline) return;
  if (taskProgressTicker) {
    clearInterval(taskProgressTicker);
    taskProgressTicker = null;
  }
  taskProgressValue = 100;
  el.taskProgressInline.classList.toggle('is-error', !!error);
  el.taskProgressInline.classList.toggle('is-success', !error);
  setTaskProgress(taskProgressValue, text);
  setTimeout(() => {
    if (!el.taskProgressInline) return;
    el.taskProgressInline.classList.add('is-hidden');
    el.taskProgressInline.classList.remove('is-success', 'is-error');
    setTaskProgress(0, 'Working...');
  }, 1400);
}

function setActionButtonsBusy(isBusy) {
  if (el.runNowBtn) el.runNowBtn.disabled = !!isBusy;
  if (el.testEmailBtn) el.testEmailBtn.disabled = !!isBusy;
}

function statusLabel(status = '') {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'sent') return 'Sent';
  if (key === 'error') return 'Error';
  if (key === 'skipped') return 'Skipped';
  if (key === 'deduped') return 'Already Sent';
  if (key === 'no_match') return 'No Match';
  return key ? key : 'Info';
}

function renderResultSummaryRows(items = []) {
  if (!el.resultSummaryList) return;
  if (!items.length) {
    el.resultSummaryList.innerHTML = `
      <div class="result-item">
        <div class="result-item-meta">No rule-level details were returned.</div>
      </div>
    `;
    return;
  }
  el.resultSummaryList.innerHTML = items
    .map((item) => `
      <div class="result-item status-${escapeHtml(item.status || '')}">
        <div class="result-item-title">${escapeHtml(item.title || 'Summary')}</div>
        <div class="result-item-meta">${escapeHtml(item.meta || '')}</div>
      </div>
    `)
    .join('');
}

function closeResultDialog() {
  if (!el.resultDialog) return;
  if (resultDialogAutoCloseTimer) {
    clearTimeout(resultDialogAutoCloseTimer);
    resultDialogAutoCloseTimer = null;
  }
  if (resultDialogCountdownTimer) {
    clearInterval(resultDialogCountdownTimer);
    resultDialogCountdownTimer = null;
  }
  el.resultDialog.classList.add('is-hidden');
  if (el.resultDialogTimer) el.resultDialogTimer.textContent = '';
  syncModalBodyLock();
}

function openResultDialog({ title = 'Completed', body = '', items = [], autoCloseSeconds = 20 } = {}) {
  if (!el.resultDialog) return;
  if (resultDialogAutoCloseTimer) {
    clearTimeout(resultDialogAutoCloseTimer);
    resultDialogAutoCloseTimer = null;
  }
  if (resultDialogCountdownTimer) {
    clearInterval(resultDialogCountdownTimer);
    resultDialogCountdownTimer = null;
  }
  if (el.resultDialogTitle) el.resultDialogTitle.textContent = title;
  if (el.resultDialogBody) el.resultDialogBody.textContent = body;
  renderResultSummaryRows(items);

  let remaining = Math.max(1, parseIntSafe(autoCloseSeconds, 20));
  if (el.resultDialogTimer) {
    el.resultDialogTimer.textContent = `Auto-close in ${remaining}s`;
  }
  resultDialogCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      if (el.resultDialogTimer) el.resultDialogTimer.textContent = '';
      clearInterval(resultDialogCountdownTimer);
      resultDialogCountdownTimer = null;
      return;
    }
    if (el.resultDialogTimer) el.resultDialogTimer.textContent = `Auto-close in ${remaining}s`;
  }, 1000);
  resultDialogAutoCloseTimer = setTimeout(() => {
    closeResultDialog();
  }, remaining * 1000);

  el.resultDialog.classList.remove('is-hidden');
  syncModalBodyLock();
  if (el.resultCloseBtn) el.resultCloseBtn.focus();
}

function buildRunNowSummaryItems(data = {}) {
  const rows = Array.isArray(data.rules) ? data.rules : [];
  const sentRules = rows.filter((row) => String(row.status) === 'sent').length;
  const errorRules = rows.filter((row) => String(row.status) === 'error').length;
  const base = [{
    status: errorRules ? 'error' : 'sent',
    title: 'Run Totals',
    meta: `Enabled rules: ${rows.length} | Sent alerts: ${parseIntSafe(data.sent, 0)} | Matched alerts: ${parseIntSafe(data.matched, 0)} | Rules fired: ${sentRules}`,
  }];
  const perRule = rows.slice(0, 14).map((row) => {
    const status = String(row.status || '').toLowerCase();
    const metaParts = [
      `Status: ${statusLabel(status)}`,
      `Matched: ${parseIntSafe(row.matched, 0)}`,
      `New: ${parseIntSafe(row.new_events, 0)}`,
      `Sent: ${parseIntSafe(row.sent_events, 0)}`,
    ];
    if (Array.isArray(row.channels) && row.channels.length) {
      metaParts.push(`Channels: ${row.channels.join(', ')}`);
    }
    if (row.reason) metaParts.push(`Reason: ${row.reason}`);
    return {
      status,
      title: row.rule_name || row.rule_id || 'Rule',
      meta: metaParts.join(' | '),
    };
  });
  return [...base, ...perRule];
}

function closeConfirmDialog(confirmed = false) {
  if (!el.confirmDialog || !confirmDialogResolver) return;
  el.confirmDialog.classList.add('is-hidden');
  syncModalBodyLock();
  const resolve = confirmDialogResolver;
  confirmDialogResolver = null;
  resolve(!!confirmed);
}

function openDeleteRuleConfirm(ruleName = '') {
  if (!el.confirmDialog) return Promise.resolve(false);
  if (confirmDialogResolver) {
    const resolvePrevious = confirmDialogResolver;
    confirmDialogResolver = null;
    resolvePrevious(false);
  }
  const safeName = String(ruleName || '').trim() || 'Untitled rule';
  el.confirmDialogTitle.textContent = `Delete "${safeName}"?`;
  el.confirmDialogBody.textContent = 'This permanently removes the rule and cannot be undone.';
  el.confirmDialog.classList.remove('is-hidden');
  syncModalBodyLock();
  el.confirmCancelBtn.focus();
  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let payload = {};
  let rawText = '';
  try {
    payload = await response.json();
  } catch (_error) {
    try {
      rawText = await response.text();
    } catch (_readError) {
      rawText = '';
    }
  }
  if (!response.ok || payload.success === false) {
    const nestedMessage = payload?.data?.message;
    const textMessage = String(rawText || '').trim();
    const message =
      payload.error ||
      payload.message ||
      nestedMessage ||
      (textMessage ? `Request failed: ${response.status} - ${textMessage}` : `Request failed: ${response.status}`);
    throw new Error(message);
  }
  return payload;
}

function debounce(fn, wait = 220) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function getTokenForInput(inputEl) {
  const raw = String(inputEl?.value || '');
  const cursor = typeof inputEl?.selectionStart === 'number' ? inputEl.selectionStart : raw.length;
  const left = raw.slice(0, cursor);
  const right = raw.slice(cursor);
  const start = left.lastIndexOf(',') + 1;
  const nextComma = right.indexOf(',');
  const end = nextComma === -1 ? raw.length : cursor + nextComma;
  return raw.slice(start, end).trim().toLowerCase();
}

function setConditionSuggestionList(values = []) {
  el.conditionValueSuggestions.innerHTML = values
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join('');
}

function refreshConditionOptionSources() {
  CONDITION_OPTIONS.category.suggestions = state.options.categories.slice(0, 20);
  CONDITION_OPTIONS.player_name.suggestions = state.options.players.slice(0, 30).map((p) => p.name);
  CONDITION_OPTIONS.tournament_name.suggestions = state.options.tournaments.slice(0, 30).map((t) => t.name);
}

function updateConditionRowOptions(row) {
  const fieldEl = row.querySelector('.condition-field');
  const opEl = row.querySelector('.condition-operator');
  const valueEl = row.querySelector('.condition-value');
  const config = CONDITION_OPTIONS[fieldEl.value] || CONDITION_OPTIONS.tournament_name;
  const currentOperator = opEl.value;
  opEl.innerHTML = config.operators.map((operator) => `<option value="${operator}">${operator}</option>`).join('');
  opEl.value = config.operators.includes(currentOperator) ? currentOperator : config.operators[0];
  valueEl.placeholder = config.placeholder;
  setConditionSuggestionList(config.suggestions);
}

function createConditionRow(condition = {}) {
  const row = document.createElement('div');
  row.className = 'condition-row';
  row.innerHTML = `
    <select class="condition-field">
      <option value="tournament_name">🏟 Tournament Name</option>
      <option value="player_name">👤 Player Name</option>
      <option value="category">🏆 Category</option>
      <option value="surface">🌱 Surface</option>
      <option value="round_rank">🎯 Round Rank</option>
    </select>
    <select class="condition-operator"></select>
    <input class="condition-value" type="text" list="conditionValueSuggestions" placeholder="value">
    <button type="button" class="condition-remove">Remove</button>
  `;
  const fieldEl = row.querySelector('.condition-field');
  const opEl = row.querySelector('.condition-operator');
  const valueEl = row.querySelector('.condition-value');
  fieldEl.value = condition.field || 'tournament_name';
  updateConditionRowOptions(row);
  opEl.value = condition.operator || opEl.value;
  valueEl.value = condition.value || '';
  fieldEl.addEventListener('change', () => updateConditionRowOptions(row));
  valueEl.addEventListener('focus', () => {
    const config = CONDITION_OPTIONS[fieldEl.value] || CONDITION_OPTIONS.tournament_name;
    setConditionSuggestionList(config.suggestions);
  });
  row.querySelector('.condition-remove').addEventListener('click', () => {
    row.remove();
    refreshConditionButtonState();
  });
  return row;
}

function refreshConditionButtonState() {
  const count = el.conditionsList.querySelectorAll('.condition-row').length;
  el.addConditionBtn.disabled = count >= 3;
}

function serializeConditions() {
  const rows = [...el.conditionsList.querySelectorAll('.condition-row')];
  return rows
    .map((row) => ({
      field: row.querySelector('.condition-field').value,
      operator: row.querySelector('.condition-operator').value,
      value: row.querySelector('.condition-value').value.trim(),
    }))
    .filter((item) => item.field && item.operator && item.value);
}

function classifyTag(text) {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('grand_slam') || value.includes('grand slam')) return 'tag-slam';
  if (value.includes('1000')) return 'tag-1000';
  if (value.includes('500')) return 'tag-500';
  if (value.includes('250')) return 'tag-250';
  if (value.includes('hard')) return 'tag-hard';
  if (value.includes('clay')) return 'tag-clay';
  if (value.includes('grass')) return 'tag-grass';
  if (value.includes('indoor')) return 'tag-indoor';
  return '';
}

function renderTag(text) {
  const cls = classifyTag(text);
  return `<span class="tag ${cls}">${escapeHtml(text)}</span>`;
}

function toggleGroup(node, enabled) {
  if (!node) return;
  node.classList.toggle('disabled', !enabled);
  node.querySelectorAll('input, select, textarea, button').forEach((ctrl) => {
    ctrl.disabled = !enabled;
  });
}

function setHidden(node, hidden) {
  if (!node) return;
  node.classList.toggle('is-hidden', !!hidden);
}

function setStepChipState(node, { active = false, completed = false } = {}) {
  if (!node) return;
  node.classList.toggle('active', !!active);
  node.classList.toggle('completed', !!completed);
}

function setLayerState(node, state = 'pending') {
  if (!node) return;
  node.classList.toggle('is-current', state === 'current');
  node.classList.toggle('is-completed', state === 'completed');
}

function syncScopeLinkUi({ notify = true } = {}) {
  const toggles = [...document.querySelectorAll('.scope-link-toggle')];
  toggles.forEach((toggleEl, index) => {
    const op = state.scopeLinkOps[index] === 'any' ? 'any' : 'all';
    toggleEl.querySelectorAll('.scope-link-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === op);
    });
  });
  const merged = state.scopeLinkOps.includes('any') ? 'any' : 'all';
  if (el.conditionGroupInput) {
    el.conditionGroupInput.value = merged;
    if (notify) el.conditionGroupInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function resetScopeLinkOps(mode = 'all', { notify = true } = {}) {
  const normalized = mode === 'any' ? 'any' : 'all';
  state.scopeLinkOps = [normalized, normalized];
  syncScopeLinkUi({ notify });
}

function summarizeMissing(values) {
  const unique = [...new Set(values.filter(Boolean))];
  if (!unique.length) return '';
  if (unique.length <= 3) return unique.join(', ');
  return `${unique.slice(0, 3).join(', ')} +${unique.length - 3} more`;
}

function normalizeBuilderStep(value) {
  const step = parseIntSafe(value, 1);
  if (step < 1) return 1;
  if (step > 3) return 3;
  return step;
}

function scrollToBuilderStep(step) {
  const map = {
    1: el.layerCore,
    2: el.layerScope,
    3: el.layerDelivery,
  };
  const node = map[normalizeBuilderStep(step)];
  if (!node || node.classList.contains('is-hidden')) return;
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setBuilderStep(nextStep, { scroll = false } = {}) {
  state.builderStep = normalizeBuilderStep(nextStep);
  updateGuidedFlowUi();
  if (scroll) scrollToBuilderStep(state.builderStep);
}

function updateRoundUi() {
  const mode = el.roundModeInput.value;
  const anyMode = mode === 'any';
  const roundValueRow = el.roundValueInput.closest('.field-row');
  if (anyMode) el.roundValueInput.value = '';
  el.roundValueInput.disabled = anyMode;
  el.roundValueInput.classList.toggle('soft-disabled', anyMode);
  if (roundValueRow) roundValueRow.classList.toggle('soft-disabled-row', anyMode);
  updateGuidedFlowUi();
}

function updateSetThresholdUi() {
  const selected = parseIntSafe(el.paramSetNumber?.value, 1);
  (el.paramSetThresholdButtons || []).forEach((btn) => {
    const value = parseIntSafe(btn.dataset.setValue, 0);
    btn.classList.toggle('active', value > 0 && value <= selected);
    btn.setAttribute('aria-pressed', value > 0 && value <= selected ? 'true' : 'false');
  });
}

function setSetThreshold(value, { notify = true } = {}) {
  const threshold = Math.min(5, Math.max(1, parseIntSafe(value, 1)));
  if (el.paramSetNumber) {
    el.paramSetNumber.value = String(threshold);
  }
  updateSetThresholdUi();
  if (notify) updateGuidedFlowUi();
}

function updateQuietHoursUi() {
  const enabled = !!el.quietHoursEnabledInput.checked;
  document.querySelectorAll('.quiet-hours-group').forEach((node) => toggleGroup(node, enabled));
}

function hasEnabledChildren(rootNode, selector) {
  if (!rootNode) return false;
  return [...rootNode.querySelectorAll(selector)].some((node) => !node.classList.contains('disabled'));
}

function updateScopeSectionVisibility() {
  setHidden(el.scopeFiltersSection, !hasEnabledChildren(el.scopeFiltersSection, '.scope-group'));
  setHidden(el.eventParamsSection, !hasEnabledChildren(el.eventParamsSection, '.param-group'));
}

function updateScopeLinkVisibility() {
  const link0 = document.querySelector('.scope-link-toggle[data-link-index="0"]')?.closest('.scope-link-box');
  const link1 = document.querySelector('.scope-link-toggle[data-link-index="1"]')?.closest('.scope-link-box');
  const catRow = el.categoriesInput?.closest('.field-row');
  const tourRow = el.tournamentsInput?.closest('.field-row');
  const playerRow = el.playersInput?.closest('.field-row');
  const catOn = !!catRow && !catRow.classList.contains('disabled');
  const tourOn = !!tourRow && !tourRow.classList.contains('disabled');
  const playerOn = !!playerRow && !playerRow.classList.contains('disabled');
  setHidden(link0, !(catOn && tourOn));
  setHidden(link1, !(tourOn && playerOn));
}

function getRuleBuilderRequiredStatus() {
  const payload = getRuleFormPayload();
  const eventType = payload.event_type;
  const coreMissing = [];
  const focusMissing = [];
  const deliveryMissing = [];

  if (!payload.name) coreMissing.push('Rule Name');
  if (!payload.event_type) coreMissing.push('Event Type');
  if (!payload.tour) coreMissing.push('Tour');

  if (payload.round_mode === 'min' || payload.round_mode === 'exact') {
    if (!payload.round_value) focusMissing.push('Round Value');
  }

  if (eventType === 'player_reaches_round' && !(payload.tracked_player || (payload.players || []).length)) {
    focusMissing.push('Tracked Player or Players');
  }
  if ((eventType === 'ranking_milestone' || eventType === 'title_milestone') && !(payload.tracked_player || (payload.players || []).length)) {
    focusMissing.push('Player Selection');
  }
  if (eventType === 'head_to_head_breaker') {
    if (!payload.tracked_player) focusMissing.push('Tracked Player');
    if (!payload.params.rival_player) focusMissing.push('Rival Player');
  }
  if (eventType === 'surface_specific_result' && !payload.params.surface_value) {
    focusMissing.push('Surface');
  }
  if (eventType === 'tournament_stage_reminder' && !(payload.params.stage_rounds || []).length) {
    focusMissing.push('Tournament Stages');
  }

  if (!(payload.channels || []).length) {
    deliveryMissing.push('At least one Channel');
  }

  const coreReady = coreMissing.length === 0;
  const focusReady = focusMissing.length === 0;
  const deliveryReady = deliveryMissing.length === 0;

  return {
    coreMissing,
    focusMissing,
    deliveryMissing,
    coreReady,
    focusReady,
    deliveryReady,
    saveReady: coreReady && focusReady && deliveryReady,
  };
}

function updateGuidedFlowUi() {
  const status = getRuleBuilderRequiredStatus();
  const step = normalizeBuilderStep(state.builderStep);

  setHidden(el.layerScope, step < 2);
  setHidden(el.layerDelivery, step < 3);
  setHidden(el.saveActions, step < 3);

  if (el.saveRuleBtn) el.saveRuleBtn.disabled = !status.saveReady;
  if (el.step1ConfirmBtn) el.step1ConfirmBtn.disabled = !status.coreReady;
  if (el.step2NextBtn) el.step2NextBtn.disabled = !status.focusReady;

  setStepChipState(el.stepChip1, {
    active: step === 1,
    completed: step > 1,
  });
  setStepChipState(el.stepChip2, {
    active: step === 2,
    completed: step > 2,
  });
  setStepChipState(el.stepChip3, {
    active: step === 3,
    completed: step === 3 && status.saveReady,
  });

  if (step === 1) {
    setLayerState(el.layerCore, 'current');
    setLayerState(el.layerScope, 'pending');
    setLayerState(el.layerDelivery, 'pending');
  } else if (step === 2) {
    setLayerState(el.layerCore, 'completed');
    setLayerState(el.layerScope, 'current');
    setLayerState(el.layerDelivery, 'pending');
  } else {
    setLayerState(el.layerCore, 'completed');
    setLayerState(el.layerScope, 'completed');
    setLayerState(el.layerDelivery, 'current');
  }

  if (el.builderProgressHint) {
    if (step === 1) {
      el.builderProgressHint.textContent = status.coreReady
        ? 'Step 1 ready. Click "Confirm Step 1" to continue.'
        : `Step 1: complete required trigger fields (${summarizeMissing(status.coreMissing)}).`;
    } else if (step === 2) {
      el.builderProgressHint.textContent = status.focusReady
        ? 'Step 2 ready. Click "Confirm Step 2" to continue, or skip.'
        : `Step 2: finish required event settings (${summarizeMissing(status.focusMissing)}), then confirm or skip.`;
    } else if (!status.deliveryReady) {
      el.builderProgressHint.textContent = `Step 3: pick at least one delivery channel (${summarizeMissing(status.deliveryMissing)}).`;
    } else {
      el.builderProgressHint.textContent = 'All required fields are complete. You can save the rule now.';
    }
  }

  if (el.ruleRequiredHint) {
    const missingAll = step === 1
      ? status.coreMissing
      : step === 2
        ? status.focusMissing
        : [...status.coreMissing, ...status.focusMissing, ...status.deliveryMissing];
    el.ruleRequiredHint.textContent = missingAll.length
      ? `Required now: ${summarizeMissing(missingAll)}.`
      : 'Required fields complete.';
  }
}

function confirmStep1() {
  const status = getRuleBuilderRequiredStatus();
  if (!status.coreReady) {
    setMessage(el.ruleMessage, `Complete required fields first: ${summarizeMissing(status.coreMissing)}.`, true);
    updateGuidedFlowUi();
    return;
  }
  setMessage(el.ruleMessage, '');
  setBuilderStep(2, { scroll: true });
}

function confirmStep2() {
  const status = getRuleBuilderRequiredStatus();
  if (!status.focusReady) {
    setMessage(el.ruleMessage, `Step 2 still has required fields: ${summarizeMissing(status.focusMissing)}.`, true);
    updateGuidedFlowUi();
    return;
  }
  setMessage(el.ruleMessage, '');
  setBuilderStep(3, { scroll: true });
}

function skipStep2() {
  setMessage(el.ruleMessage, 'Step 2 skipped. You can still adjust filters later before saving.', false);
  setBuilderStep(3, { scroll: true });
}

function updateEventUi() {
  const eventType = el.eventTypeInput.value;
  const meta = EVENT_TYPE_META[eventType] || EVENT_TYPE_META.upcoming_match;
  const activeScopes = new Set(meta.scopes || []);
  const activeParams = new Set(meta.params || []);

  if (el.eventTypeHint) el.eventTypeHint.textContent = meta.hint || 'Choose what should trigger this rule.';

  document.querySelectorAll('.scope-group').forEach((node) => {
    const scope = node.getAttribute('data-scope');
    toggleGroup(node, activeScopes.has(scope));
  });

  document.querySelectorAll('.param-group').forEach((node) => {
    const param = node.getAttribute('data-param');
    toggleGroup(node, activeParams.has(param));
  });

  el.trackedPlayerInput.required = !!meta.requiresTracked;
  if (!activeScopes.has('tracked_player')) {
    el.trackedPlayerInput.value = '';
  }
  if (!activeScopes.has('round_filters')) {
    el.roundModeInput.value = 'any';
    el.roundValueInput.value = '';
  }
  updateScopeLinkVisibility();
  updateScopeSectionVisibility();
  updateRoundUi();
}

function getSelectedChannels() {
  const channels = [];
  if (el.channelEmail.checked) channels.push('email');
  if (el.channelTelegram.checked) channels.push('telegram');
  if (el.channelDiscord.checked) channels.push('discord');
  if (el.channelWebPush.checked) channels.push('web_push');
  return channels;
}

function getStageRounds() {
  const rounds = [];
  if (el.paramStageQF.checked) rounds.push('QF');
  if (el.paramStageSF.checked) rounds.push('SF');
  if (el.paramStageF.checked) rounds.push('F');
  return rounds;
}

function getRuleParams() {
  return {
    set_number: parseIntSafe(el.paramSetNumber.value, 1),
    upset_min_rank_gap: parseIntSafe(el.paramUpsetGap.value, 20),
    deciding_mode: el.paramDecidingMode.value,
    ranking_milestone: el.paramRankingMilestone.value,
    title_target: parseIntSafe(el.paramTitleTarget.value, 1),
    rival_player: normalizePlayerToken(el.paramRivalPlayerInput.value),
    h2h_min_losses: parseIntSafe(el.paramH2HLosses.value, 2),
    surface_value: String(el.paramSurfaceValue.value || '').trim(),
    window_hours: parseIntSafe(el.paramWindowHours.value, 24),
    stage_rounds: getStageRounds(),
    emit_on_first_seen: !!el.paramEmitFirstSeen.checked,
  };
}

function getRuleFormPayload() {
  const eventType = el.eventTypeInput.value;
  const meta = EVENT_TYPE_META[eventType] || EVENT_TYPE_META.upcoming_match;
  const activeScopes = new Set(meta.scopes || []);
  const activeParams = new Set(meta.params || []);
  const params = getRuleParams();
  Object.keys(params).forEach((key) => {
    if (!activeParams.has(key)) delete params[key];
  });

  return {
    id: el.ruleIdInput.value.trim() || undefined,
    name: el.ruleNameInput.value.trim(),
    event_type: eventType,
    tour: el.tourInput.value,
    round_mode: activeScopes.has('round_filters') ? el.roundModeInput.value : 'any',
    round_value: activeScopes.has('round_filters') ? el.roundValueInput.value : '',
    condition_group: el.conditionGroupInput.value,
    enabled: el.ruleIdInput.value.trim() ? state.editingRuleEnabled : true,
    categories: activeScopes.has('categories') ? splitCsv(el.categoriesInput.value) : [],
    tournaments: activeScopes.has('tournaments')
      ? uniqueCsvTokens(splitCsv(el.tournamentsInput.value).map((token) => normalizeTournamentToken(token)), 'tournaments')
      : [],
    players: activeScopes.has('players')
      ? uniqueCsvTokens(splitCsv(el.playersInput.value).map((token) => normalizePlayerToken(token)), 'players')
      : [],
    tracked_player: activeScopes.has('tracked_player') ? normalizePlayerToken(el.trackedPlayerInput.value) : '',
    conditions: activeScopes.has('extra_conditions') ? serializeConditions() : [],
    severity: el.severityInput.value,
    cooldown_minutes: parseIntSafe(el.cooldownInput.value, 0),
    channels: getSelectedChannels(),
    quiet_hours_enabled: !!el.quietHoursEnabledInput.checked,
    quiet_start_hour: parseIntSafe(el.quietStartHourInput.value, 23),
    quiet_end_hour: parseIntSafe(el.quietEndHourInput.value, 7),
    timezone_offset: el.timezoneOffsetInput.value,
    params,
  };
}

function resetRuleForm() {
  el.ruleForm.reset();
  el.ruleIdInput.value = '';
  state.editingRuleEnabled = true;
  state.builderStep = 1;
  setSetThreshold(1, { notify: false });
  el.channelEmail.checked = true;
  el.conditionsList.innerHTML = '';
  refreshConditionButtonState();
  closeAllDropdowns();
  setMessage(el.ruleMessage, '');
  resetScopeLinkOps('all', { notify: false });
  updateQuietHoursUi();
  updateEventUi();
  updateGuidedFlowUi();
}

function populateRuleForm(rule) {
  el.ruleIdInput.value = rule.id || '';
  el.ruleNameInput.value = rule.name || '';
  el.eventTypeInput.value = rule.event_type || 'upcoming_match';
  el.tourInput.value = rule.tour || 'both';
  el.roundModeInput.value = rule.round_mode || 'any';
  el.roundValueInput.value = rule.round_value || '';
  resetScopeLinkOps(rule.condition_group || 'all', { notify: false });
  state.editingRuleEnabled = !!rule.enabled;
  state.builderStep = 3;
  el.categoriesInput.value = (rule.categories || []).join(', ');
  el.tournamentsInput.value = (rule.tournaments || []).join(', ');
  el.playersInput.value = (rule.players || []).join(', ');
  el.trackedPlayerInput.value = rule.tracked_player || '';
  normalizeTournamentInputDisplay();
  normalizePlayersInputDisplay();
  el.trackedPlayerInput.value = formatPlayerDisplayToken(el.trackedPlayerInput.value);

  el.severityInput.value = rule.severity || 'normal';
  el.cooldownInput.value = rule.cooldown_minutes || 0;
  const channels = new Set((rule.channels || ['email']).map((x) => String(x).toLowerCase()));
  el.channelEmail.checked = channels.has('email');
  el.channelTelegram.checked = channels.has('telegram');
  el.channelDiscord.checked = channels.has('discord');
  el.channelWebPush.checked = channels.has('web_push');
  el.quietHoursEnabledInput.checked = !!rule.quiet_hours_enabled;
  el.quietStartHourInput.value = String(rule.quiet_start_hour ?? 23);
  el.quietEndHourInput.value = String(rule.quiet_end_hour ?? 7);
  el.timezoneOffsetInput.value = rule.timezone_offset || '+00:00';

  const params = rule.params || {};
  el.paramSetNumber.value = String(params.set_number ?? 1);
  setSetThreshold(el.paramSetNumber.value, { notify: false });
  el.paramUpsetGap.value = String(params.upset_min_rank_gap ?? 20);
  el.paramDecidingMode.value = params.deciding_mode || 'deciding_set';
  el.paramRankingMilestone.value = params.ranking_milestone || 'top_100';
  el.paramTitleTarget.value = String(params.title_target ?? 1);
  el.paramRivalPlayerInput.value = params.rival_player || '';
  el.paramRivalPlayerInput.value = formatPlayerDisplayToken(el.paramRivalPlayerInput.value);
  el.paramH2HLosses.value = String(params.h2h_min_losses ?? 2);
  el.paramSurfaceValue.value = params.surface_value || '';
  el.paramWindowHours.value = String(params.window_hours ?? 24);
  const stageSet = new Set(params.stage_rounds || ['QF', 'SF', 'F']);
  el.paramStageQF.checked = stageSet.has('QF');
  el.paramStageSF.checked = stageSet.has('SF');
  el.paramStageF.checked = stageSet.has('F');
  el.paramEmitFirstSeen.checked = params.emit_on_first_seen !== false;

  el.conditionsList.innerHTML = '';
  (rule.conditions || []).forEach((cond) => el.conditionsList.appendChild(createConditionRow(cond)));
  refreshConditionButtonState();
  updateQuietHoursUi();
  updateEventUi();
  updateGuidedFlowUi();
}

function renderRules() {
  el.ruleCount.textContent = String(state.rules.length);
  if (!state.rules.length) {
    el.rulesContainer.innerHTML = '<p class="muted">No rules yet.</p>';
    return;
  }
  el.rulesContainer.innerHTML = '';
  state.rules.forEach((rule) => {
    const card = document.createElement('div');
    card.className = `rule-card ${rule.enabled ? 'rule-card-active' : 'rule-card-inactive'}`;
    const tags = [
      rule.event_type,
      rule.tour,
      rule.severity ? `severity:${rule.severity}` : '',
      rule.round_mode === 'any' ? '' : `${rule.round_mode}:${rule.round_value || '-'}`,
      ...(rule.categories || []).slice(0, 3),
      ...((rule.conditions || []).filter((cond) => cond && cond.field === 'surface' && cond.value).map((cond) => cond.value)),
    ].filter(Boolean);
    card.innerHTML = `
      <div class="rule-top">
        <div>
          <div class="rule-name">${escapeHtml(rule.name || 'Untitled')}</div>
          <div class="rule-meta">
            ${tags.map((tag) => renderTag(tag)).join('')}
            <span class="tag">${rule.enabled ? 'enabled' : 'disabled'}</span>
          </div>
        </div>
        <div class="rule-actions">
          <button class="btn small" data-action="edit">Edit</button>
          <button class="btn small" data-action="toggle">${rule.enabled ? 'Disable' : 'Enable'}</button>
          <button class="btn small danger" data-action="delete">Delete</button>
        </div>
      </div>
      <div class="muted">Players: ${(rule.players || []).join(', ') || '-'} | Tournaments: ${(rule.tournaments || []).join(', ') || '-'} | Channels: ${(rule.channels || ['email']).join(', ')}</div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener('click', () => {
      populateRuleForm(rule);
      window.scrollTo({ top: el.ruleForm.offsetTop - 16, behavior: 'smooth' });
    });
    card.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
      try {
        await api(`/api/rules/${encodeURIComponent(rule.id)}`, {
          method: 'PUT',
          body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
        });
        await loadState();
      } catch (error) {
        setMessage(el.ruleMessage, error.message, true);
      }
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      const confirmed = await openDeleteRuleConfirm(rule.name);
      if (!confirmed) return;
      try {
        await api(`/api/rules/${encodeURIComponent(rule.id)}`, { method: 'DELETE' });
        await loadState();
      } catch (error) {
        setMessage(el.ruleMessage, error.message, true);
      }
    });
    el.rulesContainer.appendChild(card);
  });
}

function renderHistory() {
  if (!state.history.length) {
    el.historyContainer.innerHTML = '<p class="muted">No activity yet.</p>';
    return;
  }
  el.historyContainer.innerHTML = '';
  state.history.forEach((item) => {
    const div = document.createElement('div');
    div.className = `history-item ${item.level === 'error' ? 'error' : ''}`;
    div.innerHTML = `<div><b>${escapeHtml(item.message || '')}</b></div><div class="time">${escapeHtml(item.timestamp || '')}</div>`;
    el.historyContainer.appendChild(div);
  });
}

function renderStatusPills(data) {
  const smtpReady = !!data.smtp_ready;
  el.smtpStatusPill.textContent = smtpReady ? 'SMTP: Ready' : `SMTP: ${data.smtp_message || 'Not configured'}`;
  el.smtpStatusPill.className = smtpReady ? 'pill' : 'pill neutral';
  const seconds = Number(data.scheduler_seconds || 0);
  el.schedulerPill.textContent = `Scheduler: every ${seconds}s`;
}

async function loadState() {
  const payload = await api('/api/state');
  const data = payload.data || {};
  state.rules = data.rules || [];
  state.history = data.history || [];
  el.emailInput.value = data.email || '';
  renderStatusPills(data);
  renderRules();
  renderHistory();
}

async function loadOptions(query = '') {
  const tour = el.tourInput.value || 'both';
  const qs = new URLSearchParams({ tour, query });
  try {
    const payload = await api(`/api/options?${qs.toString()}`);
    const data = payload.data || {};
    state.options = {
      categories: data.categories || [],
      players: data.players || [],
      tournaments: data.tournaments || [],
      tour: data.tour || tour,
    };
    refreshConditionOptionSources();
  } catch (error) {
    setMessage(el.ruleMessage, `Suggestion load failed: ${error.message}`, true);
  }
}

function normalizeOptionItem(raw, kind) {
  if (kind === 'categories') {
    return {
      label: raw,
      value: raw,
      emoji: raw.includes('slam') ? '🏆' : raw.includes('1000') ? '🥇' : raw.includes('500') ? '🎾' : '📌',
      sub: 'Tournament category',
      pill: '',
    };
  }
  if (kind === 'tournaments') {
    const category = raw.category || '';
    const surface = raw.surface || '';
    const parsed = parseTournamentLabel(raw.name, raw.country);
    const flagEmoji = iso2ToFlagEmoji(parsed.flagIso2);
    const displayValue = flagEmoji ? `${flagEmoji} ${parsed.label}` : parsed.label;
    return {
      label: parsed.label,
      value: displayValue,
      normalizedValue: parsed.label,
      flagIso2: parsed.flagIso2,
      countryCode: parsed.countryCode,
      emoji: '🏟',
      sub: [category, surface].filter(Boolean).join(' · '),
      pill: String(raw.tour || '').toUpperCase(),
    };
  }
  const countryCode = String(raw.country || '').toUpperCase();
  const flagIso2 = countryToIso2(countryCode);
  const flagEmoji = iso2ToFlagEmoji(flagIso2);
  const displayValue = flagEmoji ? `${flagEmoji} ${raw.name}` : raw.name;
  return {
    label: raw.name,
    value: displayValue,
    normalizedValue: raw.name,
    flagIso2,
    countryCode,
    sub: `Rank ${raw.rank || '-'} · ${String(raw.tour || '').toUpperCase()}`,
    pill: '',
    image: raw.image_url || '',
    rank: Number.isFinite(raw.rank) ? raw.rank : null,
    initials: getInitials(raw.name),
  };
}

function getItemsForDropdown(kind, query = '') {
  const q = String(query || '').trim().toLowerCase();
  let items = [];
  if (kind === 'categories') items = (state.options.categories || []).map((c) => normalizeOptionItem(c, kind));
  else if (kind === 'tournaments') items = (state.options.tournaments || []).map((t) => normalizeOptionItem(t, kind));
  else items = (state.options.players || []).map((p) => normalizeOptionItem(p, 'players'));

  if (kind === 'tournaments') {
    const byTournament = new Map();
    items.forEach((item) => {
      const key = canonicalizeToken(item.normalizedValue || item.label, 'tournaments');
      if (!key) return;
      const current = byTournament.get(key);
      if (!current) {
        byTournament.set(key, item);
        return;
      }
      const currentHasFlag = current.flagIso2 ? 1 : 0;
      const nextHasFlag = item.flagIso2 ? 1 : 0;
      const currentSubLen = String(current.sub || '').length;
      const nextSubLen = String(item.sub || '').length;
      if (nextHasFlag > currentHasFlag || (nextHasFlag === currentHasFlag && nextSubLen > currentSubLen)) {
        byTournament.set(key, item);
      }
    });
    items = [...byTournament.values()];
  }

  if (kind === 'players') {
    const byName = new Map();
    items.forEach((item) => {
      const key = normalizeLookup(item.label);
      if (!key) return;
      const current = byName.get(key);
      if (!current) {
        byName.set(key, item);
        return;
      }
      const currentRank = Number.isFinite(current.rank) ? current.rank : 10_000;
      const nextRank = Number.isFinite(item.rank) ? item.rank : 10_000;
      const currentHasImage = current.image ? 1 : 0;
      const nextHasImage = item.image ? 1 : 0;
      if (nextRank < currentRank || (nextRank === currentRank && nextHasImage > currentHasImage)) {
        byName.set(key, item);
      }
    });
    items = [...byName.values()];
  }

  if (!q) return items.slice(0, 40);
  return items.filter((item) => normalizeLookup(item.label).includes(normalizeLookup(q))).slice(0, 40);
}

function renderDropdown(kind, inputEl, panelEl, multi = true) {
  let query = multi ? getTokenForInput(inputEl) : inputEl.value.trim().toLowerCase();
  if (kind === 'tournaments') query = normalizeTournamentToken(query);
  if (kind === 'players') query = normalizePlayerToken(query);
  const items = getItemsForDropdown(kind, query);
  const head = `<div class="dropdown-head">${items.length} suggestion${items.length === 1 ? '' : 's'} · ${String(state.options.tour || '').toUpperCase()}</div>`;
  if (!items.length) {
    panelEl.innerHTML = `${head}<div class="dropdown-empty">No matches. Try a different keyword.</div>`;
    return;
  }
  panelEl.innerHTML = `
    ${head}
    ${items.map((item, idx) => `
      <button class="dropdown-item ${idx === 0 ? 'active' : ''}" type="button" data-value="${escapeHtml(item.value)}">
        ${kind === 'players'
          ? (item.image
            ? `<span class="drop-media">
                <img class="drop-avatar" src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.style.display='none'; const fb=this.nextElementSibling; if (fb) fb.style.display='inline-flex';">
                <span class="drop-initials drop-avatar-fallback">${escapeHtml(item.initials || '?')}</span>
              </span>`
            : `<span class="drop-media"><span class="drop-initials">${escapeHtml(item.initials || '?')}</span></span>`)
          : (kind === 'tournaments' && item.flagIso2
            ? `<span class="drop-media"><img class="drop-flag-icon" src="https://flagcdn.com/w40/${escapeHtml(item.flagIso2)}.png" srcset="https://flagcdn.com/w80/${escapeHtml(item.flagIso2)}.png 2x" alt="${escapeHtml(item.countryCode || '')}" loading="lazy" onerror="this.style.display='none'; const fb=this.nextElementSibling; if (fb) fb.style.display='inline-flex';"><span class="drop-emoji drop-emoji-fallback">${escapeHtml(item.emoji || '🏟')}</span></span>`
            : `<span class="drop-emoji">${escapeHtml(item.emoji || '•')}</span>`)}
        <span class="drop-main">
          <span class="drop-title">${kind === 'players' && item.flagIso2 ? `<span class="drop-title-flag"><img class="drop-flag-icon" src="https://flagcdn.com/w40/${escapeHtml(item.flagIso2)}.png" srcset="https://flagcdn.com/w80/${escapeHtml(item.flagIso2)}.png 2x" alt="${escapeHtml(item.countryCode || '')}" loading="lazy" onerror="this.style.display='none';"></span>` : ''}${escapeHtml(item.label)}</span>
          <span class="drop-sub">${escapeHtml(item.sub || '')}</span>
        </span>
        ${(item.pill ? `<span class="drop-pill">${escapeHtml(item.pill)}</span>` : '<span></span>')}
      </button>
    `).join('')}
  `;
  panelEl.querySelectorAll('.dropdown-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-value') || '';
      if (multi) appendCsvValue(inputEl, value, kind);
      else {
        inputEl.value = value;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      closeAllDropdowns();
      inputEl.focus();
    });
  });
}

function openDropdown(kind) {
  closeAllDropdowns();
  const map = {
    categories: { input: el.categoriesInput, panel: el.categoriesDropdown, multi: true, dataKind: 'categories' },
    tournaments: { input: el.tournamentsInput, panel: el.tournamentsDropdown, multi: true, dataKind: 'tournaments' },
    players: { input: el.playersInput, panel: el.playersDropdown, multi: true, dataKind: 'players' },
    trackedPlayer: { input: el.trackedPlayerInput, panel: el.trackedPlayerDropdown, multi: false, dataKind: 'players' },
    rivalPlayer: { input: el.paramRivalPlayerInput, panel: el.paramRivalPlayerDropdown, multi: false, dataKind: 'players' },
  };
  const cfg = map[kind];
  if (!cfg) return;
  renderDropdown(cfg.dataKind, cfg.input, cfg.panel, cfg.multi);
  cfg.panel.classList.add('open');
  state.openDropdown = kind;
}

function closeAllDropdowns() {
  [
    el.categoriesDropdown, el.tournamentsDropdown, el.playersDropdown,
    el.trackedPlayerDropdown, el.paramRivalPlayerDropdown,
  ].forEach((panel) => panel && panel.classList.remove('open'));
  state.openDropdown = null;
}

const debouncedSuggestRefresh = debounce(async (kind) => {
  const map = {
    categories: el.categoriesInput,
    tournaments: el.tournamentsInput,
    players: el.playersInput,
    trackedPlayer: el.trackedPlayerInput,
    rivalPlayer: el.paramRivalPlayerInput,
  };
  const inputEl = map[kind];
  if (!inputEl) return;
  const query = kind === 'categories'
    ? getTokenForInput(inputEl)
    : (kind === 'trackedPlayer' || kind === 'rivalPlayer' ? inputEl.value.trim() : getTokenForInput(inputEl));
  const normalizedQuery = kind === 'tournaments'
    ? normalizeTournamentToken(query)
    : (kind === 'players' || kind === 'trackedPlayer' || kind === 'rivalPlayer'
      ? normalizePlayerToken(query)
      : query);

  // Category suggestions are local/static; do not refresh global options from backend.
  if (kind === 'categories') {
    openDropdown(kind);
    return;
  }

  if (normalizedQuery.length >= 2) await loadOptions(normalizedQuery);
  else await loadOptions('');
  openDropdown(kind);
}, 260);

async function saveSettings() {
  try {
    await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        email: el.emailInput.value.trim(),
      }),
    });
    setMessage(el.settingsMessage, 'Settings saved.');
    await loadState();
  } catch (error) {
    setMessage(el.settingsMessage, error.message, true);
  }
}

async function saveRule(event) {
  event.preventDefault();
  const payload = getRuleFormPayload();
  const requiredStatus = getRuleBuilderRequiredStatus();
  const missingRequired = [
    ...requiredStatus.coreMissing,
    ...requiredStatus.focusMissing,
    ...requiredStatus.deliveryMissing,
  ];
  if (missingRequired.length) {
    updateGuidedFlowUi();
    setMessage(el.ruleMessage, `Please complete required fields: ${summarizeMissing(missingRequired)}.`, true);
    return;
  }
  if ((payload.conditions || []).length > 3) {
    setMessage(el.ruleMessage, 'Max 3 extra filters per rule.', true);
    return;
  }

  try {
    const isEdit = !!payload.id;
    const path = isEdit ? `/api/rules/${encodeURIComponent(payload.id)}` : '/api/rules';
    await api(path, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setMessage(el.ruleMessage, isEdit ? 'Rule updated.' : 'Rule created.');
    resetRuleForm();
    await loadState();
  } catch (error) {
    setMessage(el.ruleMessage, error.message, true);
  }
}

async function runNow() {
  setActionButtonsBusy(true);
  startTaskProgress('Running rules...');
  try {
    const payload = await api('/api/run-now', { method: 'POST' });
    const data = payload.data || {};
    finishTaskProgress(`Completed · Sent ${parseIntSafe(data.sent, 0)} alert(s)`);
    setMessage(el.settingsMessage, `${data.message} Sent: ${data.sent}, matched: ${data.matched}`);
    await loadState();
    openResultDialog({
      title: 'Rule Run Completed',
      body: `${data.message || 'Notification run completed.'} Sent ${parseIntSafe(data.sent, 0)} alert(s), matched ${parseIntSafe(data.matched, 0)}.`,
      items: buildRunNowSummaryItems(data),
      autoCloseSeconds: 20,
    });
  } catch (error) {
    finishTaskProgress(`Failed · ${error.message}`, { error: true });
    setMessage(el.settingsMessage, error.message, true);
    openResultDialog({
      title: 'Rule Run Failed',
      body: error.message || 'Notification run failed.',
      items: [{
        status: 'error',
        title: 'Execution Error',
        meta: error.message || 'Unable to complete run.',
      }],
      autoCloseSeconds: 20,
    });
  } finally {
    setActionButtonsBusy(false);
  }
}

async function sendTestEmail() {
  setActionButtonsBusy(true);
  startTaskProgress('Sending test email...');
  try {
    const payload = await api('/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: el.emailInput.value.trim() }),
    });
    finishTaskProgress('Completed · Test email sent');
    setMessage(el.settingsMessage, payload.message || 'Test email sent.');
    await loadState();
    openResultDialog({
      title: 'Test Email Sent',
      body: payload.message || 'Test email sent successfully.',
      items: [{
        status: 'sent',
        title: 'Delivery Check',
        meta: `Recipient: ${el.emailInput.value.trim() || 'Saved email'} | SMTP test completed`,
      }],
      autoCloseSeconds: 20,
    });
  } catch (error) {
    finishTaskProgress(`Failed · ${error.message}`, { error: true });
    setMessage(el.settingsMessage, error.message, true);
    openResultDialog({
      title: 'Test Email Failed',
      body: error.message || 'Failed to send test email.',
      items: [{
        status: 'error',
        title: 'Delivery Check',
        meta: error.message || 'Unable to deliver test email.',
      }],
      autoCloseSeconds: 20,
    });
  } finally {
    setActionButtonsBusy(false);
  }
}

async function clearHistory() {
  try {
    await api('/api/history/clear', { method: 'POST' });
    await loadState();
  } catch (error) {
    setMessage(el.settingsMessage, error.message, true);
  }
}

function bindQuickChips() {
  document.querySelectorAll('.quick-chip').forEach((chipBtn) => {
    chipBtn.addEventListener('click', () => {
      const target = document.getElementById(chipBtn.dataset.target);
      if (!target) return;
      appendCsvValue(target, chipBtn.dataset.value);
      target.focus();
    });
  });
}

function bindDropdown(inputEl, kind, buttonEl) {
  inputEl.addEventListener('focus', async () => {
    if (kind !== 'categories' && (!state.options.players.length || !state.options.tournaments.length)) {
      await loadOptions('');
    }
    openDropdown(kind);
  });
  inputEl.addEventListener('click', async () => {
    if (kind !== 'categories' && (!state.options.players.length || !state.options.tournaments.length)) {
      await loadOptions('');
    }
    openDropdown(kind);
  });
  inputEl.addEventListener('input', () => debouncedSuggestRefresh(kind));
  if (buttonEl) {
    buttonEl.addEventListener('click', async () => {
      if (state.openDropdown === kind) {
        closeAllDropdowns();
        return;
      }
      const query = kind === 'trackedPlayer' || kind === 'rivalPlayer'
        ? inputEl.value.trim()
        : getTokenForInput(inputEl);
      const normalizedQuery = kind === 'tournaments'
        ? normalizeTournamentToken(query)
        : (kind === 'players' || kind === 'trackedPlayer' || kind === 'rivalPlayer'
          ? normalizePlayerToken(query)
          : query);
      if (normalizedQuery.length >= 2) await loadOptions(normalizedQuery);
      openDropdown(kind);
    });
  }
}

function bindEvents() {
  el.saveSettingsBtn.addEventListener('click', saveSettings);
  el.runNowBtn.addEventListener('click', runNow);
  el.testEmailBtn.addEventListener('click', sendTestEmail);
  el.ruleForm.addEventListener('submit', saveRule);
  if (el.resetFormBtn) el.resetFormBtn.addEventListener('click', resetRuleForm);
  el.clearHistoryBtn.addEventListener('click', clearHistory);
  if (el.confirmCancelBtn) el.confirmCancelBtn.addEventListener('click', () => closeConfirmDialog(false));
  if (el.confirmOkBtn) el.confirmOkBtn.addEventListener('click', () => closeConfirmDialog(true));
  if (el.confirmDialog) {
    el.confirmDialog.addEventListener('click', (event) => {
      if (event.target === el.confirmDialog) closeConfirmDialog(false);
    });
  }
  if (el.resultCloseBtn) el.resultCloseBtn.addEventListener('click', closeResultDialog);
  if (el.resultDialog) {
    el.resultDialog.addEventListener('click', (event) => {
      if (event.target === el.resultDialog) closeResultDialog();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && confirmDialogResolver) {
      closeConfirmDialog(false);
      return;
    }
    if (event.key === 'Escape' && el.resultDialog && !el.resultDialog.classList.contains('is-hidden')) {
      closeResultDialog();
    }
  });

  el.eventTypeInput.addEventListener('change', updateEventUi);
  el.roundModeInput.addEventListener('change', updateRoundUi);
  el.quietHoursEnabledInput.addEventListener('change', updateQuietHoursUi);
  (el.paramSetThresholdButtons || []).forEach((btn) => {
    btn.addEventListener('click', () => {
      setSetThreshold(btn.dataset.setValue);
    });
  });
  if (el.step1ConfirmBtn) el.step1ConfirmBtn.addEventListener('click', confirmStep1);
  if (el.step2NextBtn) el.step2NextBtn.addEventListener('click', confirmStep2);
  if (el.step2SkipBtn) el.step2SkipBtn.addEventListener('click', skipStep2);
  document.querySelectorAll('.scope-link-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const toggle = btn.closest('.scope-link-toggle');
      if (!toggle) return;
      const index = Number.parseInt(toggle.dataset.linkIndex || '-1', 10);
      if (index < 0 || index > 1) return;
      state.scopeLinkOps[index] = btn.dataset.value === 'any' ? 'any' : 'all';
      syncScopeLinkUi();
      updateGuidedFlowUi();
    });
  });
  el.tourInput.addEventListener('change', async () => {
    await loadOptions('');
    refreshConditionOptionSources();
    closeAllDropdowns();
    updateGuidedFlowUi();
  });

  const guidedInputWatch = [
    el.ruleNameInput,
    el.roundValueInput,
    el.playersInput,
    el.trackedPlayerInput,
    el.paramRivalPlayerInput,
    el.cooldownInput,
    el.paramTitleTarget,
  ];
  guidedInputWatch.forEach((node) => node && node.addEventListener('input', updateGuidedFlowUi));

  const guidedChangeWatch = [
    el.conditionGroupInput,
    el.paramSetNumber,
    el.paramUpsetGap,
    el.paramDecidingMode,
    el.paramRankingMilestone,
    el.paramH2HLosses,
    el.paramSurfaceValue,
    el.paramWindowHours,
    el.paramStageQF,
    el.paramStageSF,
    el.paramStageF,
    el.channelEmail,
    el.channelTelegram,
    el.channelDiscord,
    el.channelWebPush,
    el.severityInput,
  ];
  guidedChangeWatch.forEach((node) => node && node.addEventListener('change', updateGuidedFlowUi));

  el.addConditionBtn.addEventListener('click', () => {
    const count = el.conditionsList.querySelectorAll('.condition-row').length;
    if (count >= 3) return;
    el.conditionsList.appendChild(createConditionRow());
    refreshConditionButtonState();
  });

  bindDropdown(el.categoriesInput, 'categories', el.categoriesDropdownBtn);
  bindDropdown(el.tournamentsInput, 'tournaments', el.tournamentsDropdownBtn);
  bindDropdown(el.playersInput, 'players', el.playersDropdownBtn);
  bindDropdown(el.trackedPlayerInput, 'trackedPlayer', el.trackedPlayerDropdownBtn);
  bindDropdown(el.paramRivalPlayerInput, 'rivalPlayer', el.paramRivalPlayerDropdownBtn);
  if (el.tournamentsInput) {
    el.tournamentsInput.addEventListener('blur', normalizeTournamentInputDisplay);
  }
  if (el.playersInput) {
    el.playersInput.addEventListener('blur', normalizePlayersInputDisplay);
  }
  if (el.trackedPlayerInput) {
    el.trackedPlayerInput.addEventListener('blur', () => {
      el.trackedPlayerInput.value = formatPlayerDisplayToken(el.trackedPlayerInput.value);
    });
  }
  if (el.paramRivalPlayerInput) {
    el.paramRivalPlayerInput.addEventListener('blur', () => {
      el.paramRivalPlayerInput.value = formatPlayerDisplayToken(el.paramRivalPlayerInput.value);
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.smart-input-wrap')) closeAllDropdowns();
  });

  bindQuickChips();
}

(async function init() {
  bindEvents();
  resetRuleForm();
  resetScopeLinkOps('all', { notify: false });
  await Promise.all([loadState(), loadOptions('')]);
})();
