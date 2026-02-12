import { APP_CONFIG, CATEGORY_LABELS } from './config.js';
import {
  compareByDateDesc,
  deriveCategory,
  deriveSurfaceClass,
  formatPercent,
  getCategoryLabel,
  normalizeKey,
  parseTourneyDate,
  resolveCountryCode,
  resolvePlayerImage,
  roundWeight,
  toInt,
} from './utils.js';

export class DataService {
  constructor() {
    this.matches = [];
    this.players = new Map();
    this.playerMetaByName = new Map();
    this.tournaments = new Map();
    this.loaded = false;
    this.csvManifest = null;
    this.liveYearSync = this.#buildLiveYearSync();
  }

  async loadAll(onProgress = () => {}) {
    this.matches = [];
    this.players.clear();
    this.tournaments.clear();
    this.loaded = false;
    this.liveYearSync = this.#buildLiveYearSync();

    onProgress({ phase: 'meta', message: 'Loading manifests…' });
    const [csvManifest, playerManifest] = await Promise.all([
      fetch(APP_CONFIG.csvManifestPath, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`CSV manifest missing (${r.status})`);
        return r.json();
      }),
      fetch(APP_CONFIG.playerManifestPath, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`Player manifest missing (${r.status})`);
        return r.json();
      }),
    ]);

    this.csvManifest = csvManifest;
    this.#loadPlayerMeta(playerManifest);

    const files = Array.isArray(csvManifest?.files) ? csvManifest.files : [];
    let totalRows = 0;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const fileYear = Number(file?.year);
      const isLiveYear = fileYear === APP_CONFIG.liveYear;
      onProgress({
        phase: 'loading',
        fileIndex: i + 1,
        totalFiles: files.length,
        year: file.year,
        totalRows,
        message: `Loading ${file.name} (${i + 1}/${files.length})${isLiveYear ? ' • online refresh' : ''}…`
      });

      const source = await this.#loadCsvTextForFile(file);
      if (!source?.csvText) {
        if (isLiveYear) {
          this.liveYearSync.sourceLabel = 'unavailable';
          this.liveYearSync.sourceType = 'missing';
          this.liveYearSync.sourceUrl = '';
          this.liveYearSync.lastModified = '';
          this.liveYearSync.refreshedAtIso = new Date().toISOString();
        }
        console.warn(`Skipped ${file?.path || file?.name || 'unknown file'} (could not load CSV content)`);
        continue;
      }

      const parsed = window.Papa.parse(source.csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        console.warn(`Parse warnings in ${file.name} (${source.sourceLabel}):`, parsed.errors.slice(0, 3));
      }

      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      for (const row of rows) {
        const match = this.#rowToMatch(row);
        if (!match) continue;
        const index = this.matches.length;
        match.index = index;
        this.matches.push(match);
        this.#ingestMatch(match, index);
        totalRows += 1;

        if (isLiveYear && match.dateSort > this.liveYearSync.latestMatchDateSort) {
          this.liveYearSync.latestMatchDateSort = match.dateSort;
          this.liveYearSync.latestMatchDateIso = match.dateIso;
        }
      }

      if (isLiveYear) {
        this.liveYearSync.sourceLabel = source.sourceLabel;
        this.liveYearSync.sourceType = source.sourceType;
        this.liveYearSync.sourceUrl = source.sourceUrl;
        this.liveYearSync.lastModified = source.lastModified || '';
        this.liveYearSync.refreshedAtIso = new Date().toISOString();
      }
    }

    this.#finalize();
    this.loaded = true;

    const years = files
      .map((file) => Number(file?.year))
      .filter((year) => Number.isFinite(year));
    const minYear = years.length ? Math.min(...years) : null;
    const maxYear = years.length ? Math.max(...years) : null;

    const liveYearSync = { ...this.liveYearSync };
    delete liveYearSync.latestMatchDateSort;

    onProgress({
      phase: 'done',
      totalFiles: files.length,
      totalRows: this.matches.length,
      totalPlayers: this.players.size,
      totalTournaments: this.tournaments.size,
      minYear,
      maxYear,
      liveYearSync,
      message: 'Historic ATP data loaded'
    });
  }

  getCoverageSummary() {
    const files = Array.isArray(this.csvManifest?.files) ? this.csvManifest.files : [];
    const years = files
      .map((file) => Number(file?.year))
      .filter((year) => Number.isFinite(year));
    const minYear = years.length ? Math.min(...years) : null;
    const maxYear = years.length ? Math.max(...years) : null;

    const liveYearSync = { ...this.liveYearSync };
    delete liveYearSync.latestMatchDateSort;

    return {
      minYear,
      maxYear,
      liveYearSync,
    };
  }

  #buildLiveYearSync() {
    return {
      year: APP_CONFIG.liveYear,
      sourceLabel: 'local archive',
      sourceType: 'local',
      sourceUrl: '',
      lastModified: '',
      refreshedAtIso: '',
      latestMatchDateIso: '',
      latestMatchDateSort: 0,
    };
  }

  #fillYearTemplate(template, year) {
    const raw = String(template || '').trim();
    if (!raw) return '';
    return raw.replaceAll('{year}', String(year));
  }

  #looksLikeMatchCsv(csvText) {
    const text = String(csvText || '').trimStart();
    if (!text) return false;
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    return firstLine.includes('tourney_id')
      && firstLine.includes('winner_name')
      && firstLine.includes('loser_name');
  }

  async #fetchCsvSource(url, sourceLabel, sourceType) {
    const target = String(url || '').trim();
    if (!target) return null;

    const response = await fetch(encodeURI(target), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    const csvText = await response.text();
    if (!this.#looksLikeMatchCsv(csvText)) {
      throw new Error('response did not look like ATP match CSV data');
    }

    return {
      csvText,
      sourceLabel,
      sourceType,
      sourceUrl: target,
      lastModified: response.headers.get('last-modified') || '',
    };
  }

  async #loadCsvTextForFile(file) {
    const fileYear = Number(file?.year);
    const filePath = String(file?.path || '').trim();
    const isLiveYear = fileYear === APP_CONFIG.liveYear;

    if (!isLiveYear) {
      try {
        return await this.#fetchCsvSource(filePath, 'local archive', 'local');
      } catch (error) {
        console.warn(`Failed to load ${filePath}:`, error?.message || error);
        return null;
      }
    }

    const attempts = [];
    const sourceTemplates = Array.isArray(APP_CONFIG.liveYearSourceTemplates)
      ? APP_CONFIG.liveYearSourceTemplates
      : [];

    for (const template of sourceTemplates) {
      const url = this.#fillYearTemplate(template, fileYear);
      if (!url) continue;
      const isLocalhostProxy = /^https?:\/\/localhost:\d+\/api\//i.test(url);
      const isSameOriginProxy = /^\/api\//i.test(url);
      attempts.push({
        url,
        sourceLabel: isLocalhostProxy || isSameOriginProxy
          ? 'internet via backend proxy'
          : 'internet direct',
        sourceType: 'online',
      });
    }

    if (filePath) {
      attempts.push({
        url: filePath,
        sourceLabel: 'local fallback',
        sourceType: 'local',
      });
    }

    const failures = [];
    for (const attempt of attempts) {
      try {
        return await this.#fetchCsvSource(attempt.url, attempt.sourceLabel, attempt.sourceType);
      } catch (error) {
        failures.push(`${attempt.url} -> ${error?.message || error}`);
      }
    }

    if (failures.length) {
      console.warn(`Could not refresh ${file?.name || `${fileYear}.csv`} from internet, all attempts failed:\n${failures.join('\n')}`);
    }
    return null;
  }

  #loadPlayerMeta(playerManifest) {
    this.playerMetaByName.clear();
    const players = Array.isArray(playerManifest?.players) ? playerManifest.players : [];
    for (const player of players) {
      const name = String(player?.name || '').trim();
      if (!name) continue;
      const key = normalizeKey(name);
      this.playerMetaByName.set(key, player);
    }
  }

  #rowToMatch(row) {
    const winnerName = String(row?.winner_name || '').trim();
    const loserName = String(row?.loser_name || '').trim();
    if (!winnerName || !loserName) return null;

    const parsedDate = parseTourneyDate(row?.tourney_date);
    if (!parsedDate.year) return null;

    const tournament = String(row?.tourney_name || 'Unknown').trim() || 'Unknown';
    const category = deriveCategory(row?.tourney_level, tournament);
    const surfaceClass = deriveSurfaceClass(row?.surface, row?.indoor);

    const winnerRank = toInt(row?.winner_rank);
    const loserRank = toInt(row?.loser_rank);

    const winnerCountry = resolveCountryCode(row?.winner_ioc || this.playerMetaByName.get(normalizeKey(winnerName))?.country);
    const loserCountry = resolveCountryCode(row?.loser_ioc || this.playerMetaByName.get(normalizeKey(loserName))?.country);

    return {
      id: `${row?.tourney_id || 'x'}-${row?.match_num || 'x'}-${row?.winner_id || winnerName}-${row?.loser_id || loserName}`,
      tourneyId: String(row?.tourney_id || '').trim(),
      tournament,
      category,
      categoryLabel: getCategoryLabel(category),
      surfaceClass,
      surfaceRaw: String(row?.surface || '').trim(),
      indoor: String(row?.indoor || '').trim(),
      levelRaw: String(row?.tourney_level || '').trim(),
      drawSize: toInt(row?.draw_size),
      dateIso: parsedDate.iso,
      dateSort: parsedDate.sort,
      year: parsedDate.year,
      round: String(row?.round || '').trim(),
      matchNum: toInt(row?.match_num),
      bestOf: toInt(row?.best_of),
      minutes: toInt(row?.minutes),
      score: String(row?.score || '').trim(),
      winner: {
        key: normalizeKey(winnerName),
        name: winnerName,
        id: String(row?.winner_id || '').trim(),
        countryCode: winnerCountry,
        rank: winnerRank,
        rankPoints: toInt(row?.winner_rank_points),
      },
      loser: {
        key: normalizeKey(loserName),
        name: loserName,
        id: String(row?.loser_id || '').trim(),
        countryCode: loserCountry,
        rank: loserRank,
        rankPoints: toInt(row?.loser_rank_points),
      },
    };
  }

  #createPlayerIfMissing(name, key, countryCode) {
    if (this.players.has(key)) {
      const existing = this.players.get(key);
      if (!existing.countryCode && countryCode) existing.countryCode = countryCode;
      return existing;
    }

    const meta = this.playerMetaByName.get(key);
    const resolvedCountry = countryCode || resolveCountryCode(meta?.country);

    const player = {
      key,
      name,
      countryCode: resolvedCountry,
      image: resolvePlayerImage(meta, name),
      profileUrl: meta?.profile_url || '',
      matches: 0,
      wins: 0,
      losses: 0,
      titles: 0,
      finals: 0,
      grandSlamTitles: 0,
      mastersTitles: 0,
      atp500Titles: 0,
      atp250Titles: 0,
      minutes: 0,
      bestRank: null,
      currentRank: null,
      lastDateSort: 0,
      lastDateIso: '',
      lastTournament: '',
      surface: {
        'surface-hard': { wins: 0, losses: 0 },
        'surface-clay': { wins: 0, losses: 0 },
        'surface-grass': { wins: 0, losses: 0 },
        'surface-indoor': { wins: 0, losses: 0 },
        'surface-carpet': { wins: 0, losses: 0 },
      },
      category: {
        'grand-slam': { wins: 0, losses: 0 },
        'masters-1000': { wins: 0, losses: 0 },
        'atp-500': { wins: 0, losses: 0 },
        'atp-250': { wins: 0, losses: 0 },
        'atp-125': { wins: 0, losses: 0 },
        finals: { wins: 0, losses: 0 },
        other: { wins: 0, losses: 0 },
      },
      tournaments: new Map(),
      opponents: new Map(),
      matchIndexes: [],
    };

    this.players.set(key, player);
    return player;
  }

  #updatePlayerRanks(player, rank, match) {
    if (Number.isFinite(rank) && rank > 0) {
      if (!player.bestRank || rank < player.bestRank) {
        player.bestRank = rank;
      }
      if (match.dateSort >= player.lastDateSort) {
        player.currentRank = rank;
      }
    }

    if (match.dateSort >= player.lastDateSort) {
      player.lastDateSort = match.dateSort;
      player.lastDateIso = match.dateIso;
      player.lastTournament = match.tournament;
    }
  }

  #updateTournamentMapForPlayer(player, match, isWin) {
    const tKey = normalizeKey(match.tournament);
    const current = player.tournaments.get(tKey) || {
      key: tKey,
      name: match.tournament,
      matches: 0,
      wins: 0,
      losses: 0,
      titles: 0,
      bestRoundWeight: 0,
      bestRound: '',
      lastDateSort: 0,
      lastDateIso: '',
      category: match.category,
      surfaceClass: match.surfaceClass,
    };

    current.matches += 1;
    if (isWin) current.wins += 1;
    else current.losses += 1;

    const rWeight = roundWeight(match.round);
    if (rWeight >= current.bestRoundWeight) {
      current.bestRoundWeight = rWeight;
      current.bestRound = match.round;
    }

    if (isWin && match.round === 'F') {
      current.titles += 1;
    }

    if (match.dateSort >= current.lastDateSort) {
      current.lastDateSort = match.dateSort;
      current.lastDateIso = match.dateIso;
    }

    player.tournaments.set(tKey, current);
  }

  #updateOpponents(player, opponent, match, isWin) {
    const current = player.opponents.get(opponent.key) || {
      key: opponent.key,
      name: opponent.name,
      countryCode: opponent.countryCode,
      wins: 0,
      losses: 0,
      lastDateSort: 0,
      lastDateIso: '',
      lastResult: '',
      lastTournament: '',
      lastScore: '',
    };

    if (isWin) current.wins += 1;
    else current.losses += 1;

    if (match.dateSort >= current.lastDateSort) {
      current.lastDateSort = match.dateSort;
      current.lastDateIso = match.dateIso;
      current.lastResult = isWin ? 'W' : 'L';
      current.lastTournament = match.tournament;
      current.lastScore = match.score;
    }

    player.opponents.set(opponent.key, current);
  }

  #ingestMatch(match, index) {
    const winner = this.#createPlayerIfMissing(match.winner.name, match.winner.key, match.winner.countryCode);
    const loser = this.#createPlayerIfMissing(match.loser.name, match.loser.key, match.loser.countryCode);

    winner.matches += 1;
    winner.wins += 1;
    winner.minutes += Number(match.minutes || 0);
    winner.matchIndexes.push(index);
    this.#updatePlayerRanks(winner, match.winner.rank, match);
    this.#updateTournamentMapForPlayer(winner, match, true);
    this.#updateOpponents(winner, loser, match, true);

    loser.matches += 1;
    loser.losses += 1;
    loser.minutes += Number(match.minutes || 0);
    loser.matchIndexes.push(index);
    this.#updatePlayerRanks(loser, match.loser.rank, match);
    this.#updateTournamentMapForPlayer(loser, match, false);
    this.#updateOpponents(loser, winner, match, false);

    winner.surface[match.surfaceClass].wins += 1;
    loser.surface[match.surfaceClass].losses += 1;

    winner.category[match.category].wins += 1;
    loser.category[match.category].losses += 1;

    if (match.round === 'F') {
      winner.titles += 1;
      winner.finals += 1;
      loser.finals += 1;

      if (match.category === 'grand-slam') winner.grandSlamTitles += 1;
      if (match.category === 'masters-1000') winner.mastersTitles += 1;
      if (match.category === 'atp-500') winner.atp500Titles += 1;
      if (match.category === 'atp-250') winner.atp250Titles += 1;
    }

    const tKey = normalizeKey(match.tournament);
    const tournament = this.tournaments.get(tKey) || {
      key: tKey,
      name: match.tournament,
      matches: 0,
      events: new Set(),
      years: new Set(),
      surfaces: new Map(),
      categories: new Map(),
      players: new Set(),
      champions: new Map(),
      finals: [],
      latestDateSort: 0,
      latestDateIso: '',
    };

    tournament.matches += 1;
    if (match.tourneyId) tournament.events.add(match.tourneyId);
    tournament.years.add(match.year);
    tournament.players.add(match.winner.key);
    tournament.players.add(match.loser.key);
    tournament.surfaces.set(match.surfaceClass, (tournament.surfaces.get(match.surfaceClass) || 0) + 1);
    tournament.categories.set(match.category, (tournament.categories.get(match.category) || 0) + 1);

    if (match.dateSort >= tournament.latestDateSort) {
      tournament.latestDateSort = match.dateSort;
      tournament.latestDateIso = match.dateIso;
    }

    if (match.round === 'F') {
      const champ = tournament.champions.get(match.winner.key) || {
        key: match.winner.key,
        name: match.winner.name,
        countryCode: match.winner.countryCode,
        count: 0,
        firstYear: match.year,
        lastYear: match.year,
      };
      champ.count += 1;
      champ.firstYear = Math.min(champ.firstYear || match.year, match.year);
      champ.lastYear = Math.max(champ.lastYear || match.year, match.year);
      tournament.champions.set(match.winner.key, champ);

      tournament.finals.push({
        dateSort: match.dateSort,
        dateIso: match.dateIso,
        year: match.year,
        winnerKey: match.winner.key,
        winnerName: match.winner.name,
        winnerCountryCode: match.winner.countryCode,
        loserKey: match.loser.key,
        loserName: match.loser.name,
        loserCountryCode: match.loser.countryCode,
        score: match.score,
        category: match.category,
        surfaceClass: match.surfaceClass,
        eventId: match.tourneyId,
      });
    }

    this.tournaments.set(tKey, tournament);
  }

  #finalize() {
    this.matches.sort((a, b) => b.dateSort - a.dateSort || (b.matchNum || 0) - (a.matchNum || 0));

    const oldToNew = new Map();
    this.matches.forEach((m, newIndex) => {
      oldToNew.set(m.index, newIndex);
      m.index = newIndex;
    });

    for (const player of this.players.values()) {
      player.matchIndexes = player.matchIndexes
        .map((oldIndex) => oldToNew.get(oldIndex))
        .filter((n) => Number.isInteger(n))
        .sort((a, b) => this.matches[b].dateSort - this.matches[a].dateSort);

      player.winPct = player.matches > 0 ? (player.wins / player.matches) * 100 : 0;
      player.avgMinutes = player.matches > 0 ? player.minutes / player.matches : 0;
    }

    for (const tournament of this.tournaments.values()) {
      tournament.eventCount = tournament.events.size;
      tournament.playerCount = tournament.players.size;
      tournament.finals.sort(compareByDateDesc);
      tournament.topChampions = Array.from(tournament.champions.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      tournament.primaryCategory = Array.from(tournament.categories.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
      tournament.primarySurface = Array.from(tournament.surfaces.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'surface-hard';
    }
  }

  getPlayerOptions(query = '', limit = APP_CONFIG.defaultPlayerSearchLimit) {
    const q = normalizeKey(query);
    const list = Array.from(this.players.values());
    if (!q) {
      return list
        .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name))
        .slice(0, limit);
    }

    const startsWith = [];
    const contains = [];
    for (const player of list) {
      const key = normalizeKey(player.name);
      if (key.startsWith(q)) startsWith.push(player);
      else if (key.includes(q)) contains.push(player);
    }

    const sorted = [...startsWith, ...contains]
      .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));

    return sorted.slice(0, limit);
  }

  getTopPlayers(limit = 30) {
    return Array.from(this.players.values())
      .sort((a, b) => b.wins - a.wins || b.matches - a.matches)
      .slice(0, limit);
  }

  getPlayerByKey(playerKey) {
    return this.players.get(playerKey) || null;
  }

  getPlayerOverview(playerKey) {
    const player = this.players.get(playerKey);
    if (!player) return null;

    const surfaces = Object.entries(player.surface)
      .map(([surfaceClass, stats]) => {
        const matches = stats.wins + stats.losses;
        return {
          surfaceClass,
          wins: stats.wins,
          losses: stats.losses,
          matches,
          winPct: matches > 0 ? (stats.wins / matches) * 100 : 0,
        };
      })
      .filter((entry) => entry.matches > 0)
      .sort((a, b) => b.matches - a.matches);

    const categories = Object.entries(player.category)
      .map(([category, stats]) => {
        const matches = stats.wins + stats.losses;
        return {
          category,
          label: CATEGORY_LABELS[category] || category,
          wins: stats.wins,
          losses: stats.losses,
          matches,
          winPct: matches > 0 ? (stats.wins / matches) * 100 : 0,
        };
      })
      .filter((entry) => entry.matches > 0)
      .sort((a, b) => b.matches - a.matches);

    const topTournaments = Array.from(player.tournaments.values())
      .sort((a, b) => b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name))
      .slice(0, 12);

    return {
      player,
      surfaces,
      categories,
      topTournaments,
    };
  }

  #toPerspective(match, playerKey) {
    const isWinner = match.winner.key === playerKey;
    return {
      id: match.id,
      dateIso: match.dateIso,
      dateSort: match.dateSort,
      year: match.year,
      tournament: match.tournament,
      category: match.category,
      categoryLabel: match.categoryLabel,
      surfaceClass: match.surfaceClass,
      round: match.round,
      result: isWinner ? 'W' : 'L',
      opponentName: isWinner ? match.loser.name : match.winner.name,
      opponentKey: isWinner ? match.loser.key : match.winner.key,
      opponentCountryCode: isWinner ? match.loser.countryCode : match.winner.countryCode,
      opponentRank: isWinner ? match.loser.rank : match.winner.rank,
      opponentRankPoints: isWinner ? match.loser.rankPoints : match.winner.rankPoints,
      playerRank: isWinner ? match.winner.rank : match.loser.rank,
      playerRankPoints: isWinner ? match.winner.rankPoints : match.loser.rankPoints,
      score: match.score,
      minutes: match.minutes,
    };
  }

  getPlayerMatches(playerKey, filters = {}) {
    const player = this.players.get(playerKey);
    if (!player) return [];

    const yearFilter = String(filters.year || 'all');
    const surfaceFilter = String(filters.surface || 'all');
    const categoryFilter = String(filters.category || 'all');
    const resultFilter = String(filters.result || 'all');
    const q = normalizeKey(filters.query || '');

    const rows = [];
    for (const index of player.matchIndexes) {
      const match = this.matches[index];
      if (!match) continue;
      const perspective = this.#toPerspective(match, playerKey);

      if (yearFilter !== 'all' && String(perspective.year) !== yearFilter) continue;
      if (surfaceFilter !== 'all' && perspective.surfaceClass !== surfaceFilter) continue;
      if (categoryFilter !== 'all' && perspective.category !== categoryFilter) continue;
      if (resultFilter !== 'all' && perspective.result !== resultFilter) continue;

      if (q) {
        const hay = normalizeKey(`${perspective.tournament} ${perspective.opponentName} ${perspective.round}`);
        if (!hay.includes(q)) continue;
      }

      rows.push(perspective);
    }

    return rows.sort((a, b) => b.dateSort - a.dateSort);
  }

  getPlayerRivalries(playerKey, limit = 60) {
    const player = this.players.get(playerKey);
    if (!player) return [];

    return Array.from(player.opponents.values())
      .map((row) => {
        const matches = row.wins + row.losses;
        return {
          ...row,
          matches,
          winPct: matches > 0 ? (row.wins / matches) * 100 : 0,
        };
      })
      .sort((a, b) => b.matches - a.matches || b.winPct - a.winPct || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  getPlayerRankingTimeline(playerKey) {
    const player = this.players.get(playerKey);
    if (!player) return null;

    const rows = [];
    for (const index of player.matchIndexes) {
      const match = this.matches[index];
      if (!match) continue;
      const view = this.#toPerspective(match, playerKey);
      if (!Number.isFinite(view.playerRank) || view.playerRank <= 0) continue;

      rows.push({
        dateIso: view.dateIso,
        dateSort: view.dateSort,
        rank: view.playerRank,
        rankPoints: view.playerRankPoints,
        tournament: view.tournament,
        category: view.category,
        categoryLabel: view.categoryLabel,
        surfaceClass: view.surfaceClass,
        round: view.round,
        result: view.result,
        opponentName: view.opponentName,
        opponentCountryCode: view.opponentCountryCode,
      });
    }

    if (!rows.length) {
      return {
        player,
        points: [],
        changes: [],
        best: null,
        worst: null,
        current: null,
        biggestRise: null,
        biggestDrop: null,
      };
    }

    rows.sort((a, b) => a.dateSort - b.dateSort);

    // Keep one representative sample per rank/date combo to avoid noisy duplicates.
    const points = [];
    for (const row of rows) {
      const prev = points[points.length - 1];
      if (prev && prev.dateSort === row.dateSort && prev.rank === row.rank) {
        if ((row.rankPoints || 0) > (prev.rankPoints || 0)) prev.rankPoints = row.rankPoints;
        prev.tournament = row.tournament;
        prev.category = row.category;
        prev.categoryLabel = row.categoryLabel;
        prev.surfaceClass = row.surfaceClass;
        prev.round = row.round;
        prev.result = row.result;
        prev.opponentName = row.opponentName;
        prev.opponentCountryCode = row.opponentCountryCode;
        continue;
      }
      points.push({ ...row, deltaFromPrev: 0 });
    }

    const changes = [];
    let previousRank = null;
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      if (previousRank === null) {
        point.deltaFromPrev = 0;
        changes.push({ ...point, index: i, deltaFromPrev: 0 });
      } else {
        const delta = previousRank - point.rank;
        point.deltaFromPrev = delta;
        if (delta !== 0) {
          changes.push({ ...point, index: i, deltaFromPrev: delta });
        }
      }
      previousRank = point.rank;
    }

    const best = points.reduce((acc, row) => {
      if (!acc || row.rank < acc.rank) return row;
      return acc;
    }, null);

    const worst = points.reduce((acc, row) => {
      if (!acc || row.rank > acc.rank) return row;
      return acc;
    }, null);

    const current = points[points.length - 1] || null;

    const biggestRise = changes.reduce((acc, row) => {
      if (!acc || row.deltaFromPrev > acc.deltaFromPrev) return row;
      return acc;
    }, null);

    const biggestDrop = changes.reduce((acc, row) => {
      if (!acc || row.deltaFromPrev < acc.deltaFromPrev) return row;
      return acc;
    }, null);

    return {
      player,
      points,
      changes,
      best,
      worst,
      current,
      biggestRise: biggestRise && biggestRise.deltaFromPrev > 0 ? biggestRise : null,
      biggestDrop: biggestDrop && biggestDrop.deltaFromPrev < 0 ? biggestDrop : null,
    };
  }

  getTournamentRows(filters = {}) {
    const search = normalizeKey(filters.search || '');
    const category = String(filters.category || 'all');
    const surface = String(filters.surface || 'all');
    const year = String(filters.year || 'all');

    const list = [];
    for (const tournament of this.tournaments.values()) {
      if (category !== 'all' && tournament.primaryCategory !== category) continue;
      if (surface !== 'all' && tournament.primarySurface !== surface) continue;
      if (year !== 'all' && !tournament.years.has(Number(year))) continue;

      if (search) {
        const hay = normalizeKey(`${tournament.name} ${CATEGORY_LABELS[tournament.primaryCategory] || ''}`);
        if (!hay.includes(search)) continue;
      }

      const topChampion = tournament.topChampions[0] || null;
      list.push({
        key: tournament.key,
        name: tournament.name,
        eventCount: tournament.eventCount,
        matchCount: tournament.matches,
        playerCount: tournament.playerCount,
        firstYear: Math.min(...tournament.years),
        lastYear: Math.max(...tournament.years),
        category: tournament.primaryCategory,
        surfaceClass: tournament.primarySurface,
        topChampion,
      });
    }

    return list.sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name));
  }

  getTournamentDetails(tournamentKey) {
    const t = this.tournaments.get(tournamentKey);
    if (!t) return null;

    const categories = Array.from(t.categories.entries())
      .map(([key, value]) => ({ key, label: CATEGORY_LABELS[key] || key, count: value }))
      .sort((a, b) => b.count - a.count);

    const surfaces = Array.from(t.surfaces.entries())
      .map(([key, value]) => ({ key, count: value }))
      .sort((a, b) => b.count - a.count);

    return {
      key: t.key,
      name: t.name,
      eventCount: t.eventCount,
      matchCount: t.matches,
      playerCount: t.playerCount,
      years: Array.from(t.years).sort((a, b) => a - b),
      categories,
      surfaces,
      topChampions: t.topChampions.slice(0, 10),
      finals: t.finals.slice(0, 14),
      latestDateIso: t.latestDateIso,
      primaryCategory: t.primaryCategory,
      primarySurface: t.primarySurface,
    };
  }

  getAllYears() {
    const years = new Set();
    for (const match of this.matches) years.add(match.year);
    return Array.from(years).sort((a, b) => b - a);
  }

  getRecords(category = 'all') {
    const minMatches = APP_CONFIG.minMatchesForLeaderboards;
    const players = Array.from(this.players.values());

    const eligible = players.filter((p) => p.matches >= minMatches);

    const row = (group, record, value, holders, goatPoints = '') => ({
      group,
      record,
      value,
      holders,
      goatPoints,
    });

    const top = (list, valueFn) => {
      let max = Number.NEGATIVE_INFINITY;
      const holders = [];
      for (const item of list) {
        const value = valueFn(item);
        if (!Number.isFinite(value)) continue;
        if (value > max) {
          max = value;
          holders.length = 0;
          holders.push(item);
        } else if (value === max) {
          holders.push(item);
        }
      }
      return { max, holders };
    };

    const topPositive = (list, valueFn) => {
      const ranked = top(list, valueFn);
      if (!Number.isFinite(ranked.max) || ranked.max <= 0) {
        return { max: 0, holders: [] };
      }
      return ranked;
    };

    const rows = [];

    const mostWins = top(eligible, (p) => p.wins);
    rows.push(row('wins', 'Most Match Wins', `${mostWins.max}`, mostWins.holders, '4, 2, 1'));

    const mostMatches = top(eligible, (p) => p.matches);
    rows.push(row('wins', 'Most Matches Played', `${mostMatches.max}`, mostMatches.holders, '2, 1'));

    const bestWinPct = top(eligible, (p) => Number(p.winPct.toFixed(1)));
    rows.push(row('wins', 'Highest Win % (min 25 matches)', formatPercent(bestWinPct.max), bestWinPct.holders, '2, 1'));

    const mostTitles = top(players, (p) => p.titles);
    rows.push(row('titles', 'Most Titles', `${mostTitles.max}`, mostTitles.holders, '8, 5, 3, 2, 1'));

    const gsTitles = top(players, (p) => p.grandSlamTitles);
    rows.push(row('titles', 'Most Grand Slam Titles', `${gsTitles.max}`, gsTitles.holders, '8, 5, 3, 2, 1'));

    const mastersTitles = top(players, (p) => p.mastersTitles);
    rows.push(row('titles', 'Most Masters 1000 Titles', `${mastersTitles.max}`, mastersTitles.holders, '4, 2, 1'));

    const atp500Titles = top(players, (p) => p.atp500Titles);
    rows.push(row('titles', 'Most ATP 500 Titles', `${atp500Titles.max}`, atp500Titles.holders, '2, 1'));

    const atp250Titles = top(players, (p) => p.atp250Titles);
    rows.push(row('titles', 'Most ATP 250 Titles', `${atp250Titles.max}`, atp250Titles.holders, '2, 1'));

    const mostFinals = top(players, (p) => p.finals);
    rows.push(row('titles', 'Most Finals Reached', `${mostFinals.max}`, mostFinals.holders, '2, 1'));

    const hardWins = topPositive(eligible, (p) => p.surface['surface-hard'].wins);
    if (hardWins.holders.length) rows.push(row('surfaces', 'Most Hard-Court Wins', `${hardWins.max}`, hardWins.holders, '2, 1'));

    const clayWins = topPositive(eligible, (p) => p.surface['surface-clay'].wins);
    if (clayWins.holders.length) rows.push(row('surfaces', 'Most Clay-Court Wins', `${clayWins.max}`, clayWins.holders, '2, 1'));

    const grassWins = topPositive(eligible, (p) => p.surface['surface-grass'].wins);
    if (grassWins.holders.length) rows.push(row('surfaces', 'Most Grass-Court Wins', `${grassWins.max}`, grassWins.holders, '2, 1'));

    const indoorWins = topPositive(eligible, (p) => p.surface['surface-indoor'].wins);
    if (indoorWins.holders.length) rows.push(row('surfaces', 'Most Indoor Wins', `${indoorWins.max}`, indoorWins.holders, '1'));

    const carpetWins = topPositive(eligible, (p) => p.surface['surface-carpet'].wins);
    if (carpetWins.holders.length) rows.push(row('surfaces', 'Most Carpet Wins', `${carpetWins.max}`, carpetWins.holders, '1'));

    const groups = category === 'all' ? null : new Set([category]);
    return rows.filter((entry) => {
      if (!groups) return true;
      return groups.has(entry.group);
    });
  }

  static holdersLabel(holders) {
    return holders.map((h) => `${h.name} (${h.wins}-${h.losses})`).join(', ');
  }
}
