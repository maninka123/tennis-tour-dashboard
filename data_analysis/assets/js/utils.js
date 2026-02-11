import {
  CATEGORY_LABELS,
  COUNTRY_NAME_TO_CODE,
  COUNTRY_TO_ISO2,
  SURFACE_LABELS,
  TOP_PLAYER_IMAGE_MAP,
} from './config.js';

export function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toInt(value) {
  const n = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function toFloat(value) {
  const n = Number.parseFloat(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toLocaleString('en-US');
}

export function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(digits)}%`;
}

export function parseTourneyDate(raw) {
  const text = String(raw || '').trim();
  if (!/^\d{8}$/.test(text)) {
    return { iso: '', year: null, sort: 0 };
  }
  const year = Number(text.slice(0, 4));
  const month = text.slice(4, 6);
  const day = text.slice(6, 8);
  return {
    iso: `${year}-${month}-${day}`,
    year,
    sort: Number(text),
  };
}

export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function deriveSurfaceClass(rowSurface, indoor = '') {
  const surface = String(rowSurface || '').toLowerCase();
  const indoorFlag = String(indoor || '').toUpperCase();
  if (surface.includes('clay')) return 'surface-clay';
  if (surface.includes('grass')) return 'surface-grass';
  if (surface.includes('carpet')) return 'surface-carpet';
  if (surface.includes('indoor') || indoorFlag === 'I') return 'surface-indoor';
  return 'surface-hard';
}

function looksLikeGrandSlam(name) {
  return /(australian open|roland garros|wimbledon|us open)/i.test(name);
}

function looksLikeMasters(name) {
  return /(indian wells|miami|monte carlo|madrid|rome|canada|cincinnati|shanghai|paris masters|masters)/i.test(name);
}

function looksLikeFinals(name) {
  return /(tour finals|atp finals|masters cup|year end championships|world tour finals)/i.test(name);
}

export function deriveCategory(levelRaw, tournamentName = '') {
  const level = String(levelRaw || '').trim().toUpperCase();
  const name = String(tournamentName || '');

  if (level === 'G' || looksLikeGrandSlam(name)) return 'grand-slam';
  if (level === 'M' || looksLikeMasters(name)) return 'masters-1000';
  if (level === 'F' || looksLikeFinals(name)) return 'finals';
  if (level === '500') return 'atp-500';
  if (level === '250') return 'atp-250';
  if (level === '125') return 'atp-125';

  if (level === 'A') {
    if (/\b500\b/i.test(name)) return 'atp-500';
    if (/\b250\b/i.test(name)) return 'atp-250';
    if (looksLikeMasters(name)) return 'masters-1000';
    return 'other';
  }

  return 'other';
}

export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || 'Other';
}

export function getSurfaceLabel(surfaceClass) {
  return SURFACE_LABELS[surfaceClass] || 'Hard';
}

export function roundWeight(round) {
  const text = String(round || '').toUpperCase();
  const map = {
    F: 9,
    SF: 8,
    QF: 7,
    R16: 6,
    R32: 5,
    R64: 4,
    R128: 3,
    R256: 2,
    RR: 1,
  };
  return map[text] || 0;
}

export function resolveCountryCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length === 3 && /^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_CODE[raw] || raw.slice(0, 3).toUpperCase();
}

export function getFlagHtml(value) {
  const code = resolveCountryCode(value);
  if (!code) return '<span class="flag-fallback">🏳️</span>';
  const iso2 = COUNTRY_TO_ISO2[code] || code.slice(0, 2).toLowerCase();
  return `<img class="flag-icon" src="https://flagcdn.com/w40/${iso2}.png" srcset="https://flagcdn.com/w80/${iso2}.png 2x" alt="${code}" loading="lazy" onerror="this.style.display='none'">`;
}

export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  return parts.slice(0, 2).map((x) => x[0].toUpperCase()).join('');
}

export function initialsSvgDataUri(name) {
  const initials = getInitials(name);
  const palette = ['d1e8ff', 'e8f5e9', 'fff4e6', 'f3e5f5', 'e0f7fa', 'fce4ec'];
  const hash = String(name || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#${color}"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="'Space Grotesk',sans-serif" font-size="88" fill="#0f172a">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolvePlayerImage(playerMeta, playerName) {
  if (playerMeta?.image_path) return playerMeta.image_path;
  if (playerName && TOP_PLAYER_IMAGE_MAP[playerName]) return TOP_PLAYER_IMAGE_MAP[playerName];

  const rawRemote = String(playerMeta?.image_url || '').trim();
  if (rawRemote) {
    if (/^http:\/\//i.test(rawRemote)) return rawRemote.replace(/^http:\/\//i, 'https://');
    if (/^https:\/\//i.test(rawRemote)) return rawRemote;
  }

  return initialsSvgDataUri(playerName);
}

export function compareByDateDesc(a, b) {
  const left = Number(a?.dateSort || 0);
  const right = Number(b?.dateSort || 0);
  return right - left;
}

export function cappedText(text, max = 42) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
