(function (global) {
    const DEFAULT_WEIGHTS = {
        rank: 0.30,
        points: 0.20,
        recent_form: 0.20,
        surface_form: 0.15,
        h2h: 0.10,
        momentum: 0.05
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function toNumber(value, fallback = NaN) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function normalizeName(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function parseWonLost(text) {
        const source = String(text || '').trim();
        if (!source) return null;
        const match = source.match(/(\d+)\s*[\/-]\s*(\d+)/);
        if (!match) return null;
        const wins = Number(match[1]);
        const losses = Number(match[2]);
        const total = wins + losses;
        const pct = total > 0 ? (wins / total) * 100 : 0;
        return { wins, losses, total, pct };
    }

    function parseH2HText(text) {
        const source = String(text || '').trim();
        const match = source.match(/(\d+)\s*-\s*(\d+)/);
        if (!match) {
            return { available: false, p1Wins: 0, p2Wins: 0, total: 0 };
        }
        const p1Wins = Number(match[1]);
        const p2Wins = Number(match[2]);
        const total = p1Wins + p2Wins;
        return {
            available: total > 0,
            p1Wins,
            p2Wins,
            total
        };
    }

    function parseSurfaceKey(match) {
        const src = String(match?.surface || match?.tournament_surface || '').toLowerCase();
        const tName = String(match?.tournament || '').toLowerCase();
        if (src.includes('clay') || tName.includes('roland') || tName.includes('madrid') || tName.includes('rome')) {
            return 'clay';
        }
        if (src.includes('grass') || tName.includes('wimbledon') || tName.includes('halle') || tName.includes('queen')) {
            return 'grass';
        }
        if (src.includes('indoor')) {
            return 'indoor';
        }
        return 'hard';
    }

    function flattenRecentMatches(stats2026) {
        const tournaments = Array.isArray(stats2026?.recent_matches_tab?.tournaments)
            ? stats2026.recent_matches_tab.tournaments
            : [];
        const rows = [];
        for (const tournament of tournaments) {
            const surfaceKey = String(tournament?.surface_key || tournament?.surface || '').toLowerCase();
            const matches = Array.isArray(tournament?.matches) ? tournament.matches : [];
            for (const match of matches) {
                const result = String(match?.result || '').trim().toUpperCase();
                if (result !== 'W' && result !== 'L') continue;
                rows.push({
                    result,
                    surfaceKey,
                    round: match?.round || ''
                });
            }
        }
        return rows;
    }

    function computeRecentForm(stats2026, maxMatches = 8, surfaceKey = '') {
        const rows = flattenRecentMatches(stats2026);
        const filtered = surfaceKey
            ? rows.filter((row) => row.surfaceKey.includes(surfaceKey))
            : rows;
        const sample = filtered.slice(0, maxMatches);
        const wins = sample.filter((row) => row.result === 'W').length;
        const losses = sample.filter((row) => row.result === 'L').length;
        const total = wins + losses;
        const pct = total > 0 ? (wins / total) * 100 : 0;
        return { wins, losses, total, pct };
    }

    function findRankingPlayer(player, appState) {
        const players = Array.isArray(appState?.rankings?.wta) ? appState.rankings.wta : [];
        if (!players.length) return null;

        const playerId = toNumber(player?.id, NaN);
        if (Number.isFinite(playerId)) {
            const byId = players.find((row) => Number(row?.id) === playerId);
            if (byId) return byId;
        }

        const target = normalizeName(player?.name);
        if (!target) return null;
        return players.find((row) => normalizeName(row?.name) === target) || null;
    }

    function formatRecord(form) {
        if (!form || !form.total) return '-';
        return `${form.wins}-${form.losses}`;
    }

    function formatPoints(value) {
        const num = toNumber(value, NaN);
        return Number.isFinite(num) ? `${Math.round(num).toLocaleString()} pts` : '-';
    }

    function formatRank(value) {
        const num = toNumber(value, NaN);
        return Number.isFinite(num) ? `#${Math.round(num)}` : '-';
    }

    function buildFactor({ key, label, weight, edge, p1Display, p2Display, note, available }) {
        const safeEdge = Number.isFinite(edge) ? clamp(edge, -1, 1) : 0;
        const absEdge = Math.abs(safeEdge);
        return {
            key,
            label,
            weight,
            available: !!available,
            edge: safeEdge,
            p1Display,
            p2Display,
            note: note || '',
            impact: safeEdge * weight,
            magnitudePct: Math.round(absEdge * 100)
        };
    }

    function probabilityFromEdge(overallEdge) {
        const pct = Math.round(clamp(50 + (overallEdge * 36), 5, 95));
        return {
            p1: pct,
            p2: 100 - pct
        };
    }

    function confidenceLabel(diff) {
        const gap = Math.abs(diff);
        if (gap >= 22) return 'High confidence';
        if (gap >= 12) return 'Medium confidence';
        return 'Low confidence';
    }

    function makeSummary(prediction, match, p1Name, p2Name) {
        const favoriteName = prediction.p1 >= prediction.p2 ? p1Name : p2Name;
        const underdogName = prediction.p1 >= prediction.p2 ? p2Name : p1Name;
        const favPct = Math.max(prediction.p1, prediction.p2);

        const topFactors = prediction.factors
            .filter((f) => f.available)
            .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
            .slice(0, 3);

        const bullets = topFactors.map((f) => {
            if (f.edge > 0.02) return `${p1Name} leads on ${f.label.toLowerCase()} (${f.p1Display} vs ${f.p2Display}).`;
            if (f.edge < -0.02) return `${p2Name} leads on ${f.label.toLowerCase()} (${f.p2Display} vs ${f.p1Display}).`;
            return `${f.label} is very close (${f.p1Display} vs ${f.p2Display}).`;
        });

        if (!bullets.length) {
            bullets.push('Limited background data was available, so this preview relies on rank/points baseline.');
        }

        const surfaceKey = parseSurfaceKey(match);
        const surfaceLabel = surfaceKey.charAt(0).toUpperCase() + surfaceKey.slice(1);
        bullets.push(`Surface context: ${surfaceLabel} court weighting is applied in this estimate.`);

        const conclusion = `${favoriteName} is projected ahead at ${favPct}% based on weighted rank, points, recent form, surface form, H2H, and momentum.`;
        const rationale = `${favoriteName} is favored over ${underdogName} with ${prediction.confidence}.`;

        return { conclusion, rationale, bullets };
    }

    function predictMatch(match, appState) {
        const p1 = match?.player1 || {};
        const p2 = match?.player2 || {};
        const p1Rank = toNumber(p1.rank, NaN);
        const p2Rank = toNumber(p2.rank, NaN);

        const p1Row = findRankingPlayer(p1, appState);
        const p2Row = findRankingPlayer(p2, appState);

        const p1Points = toNumber(p1Row?.points, NaN);
        const p2Points = toNumber(p2Row?.points, NaN);

        const p1Movement = toNumber(p1Row?.movement ?? p1Row?.rank_change, 0);
        const p2Movement = toNumber(p2Row?.movement ?? p2Row?.rank_change, 0);

        const p1Stats = p1Row?.stats_2026 || {};
        const p2Stats = p2Row?.stats_2026 || {};

        const p1SeasonRecord = parseWonLost(p1Stats?.won_lost);
        const p2SeasonRecord = parseWonLost(p2Stats?.won_lost);

        const surfaceKey = parseSurfaceKey(match);
        const p1Recent = computeRecentForm(p1Stats, 8, '');
        const p2Recent = computeRecentForm(p2Stats, 8, '');
        const p1Surface = computeRecentForm(p1Stats, 12, surfaceKey);
        const p2Surface = computeRecentForm(p2Stats, 12, surfaceKey);

        const h2h = parseH2HText(match?.h2h_text);

        const factors = [];

        const rankAvailable = Number.isFinite(p1Rank) && Number.isFinite(p2Rank);
        const rankEdge = rankAvailable
            ? clamp((p2Rank - p1Rank) / Math.max(10, Math.max(p1Rank, p2Rank)), -1, 1)
            : 0;
        factors.push(buildFactor({
            key: 'rank',
            label: 'Ranking',
            weight: DEFAULT_WEIGHTS.rank,
            edge: rankEdge,
            p1Display: formatRank(p1Rank),
            p2Display: formatRank(p2Rank),
            note: 'Lower rank number is better',
            available: rankAvailable
        }));

        const pointsAvailable = Number.isFinite(p1Points) && Number.isFinite(p2Points);
        const pointsEdge = pointsAvailable
            ? clamp((p1Points - p2Points) / Math.max(1, Math.max(p1Points, p2Points)), -1, 1)
            : 0;
        factors.push(buildFactor({
            key: 'points',
            label: 'Ranking Points',
            weight: DEFAULT_WEIGHTS.points,
            edge: pointsEdge,
            p1Display: formatPoints(p1Points),
            p2Display: formatPoints(p2Points),
            note: 'Current tour ranking points',
            available: pointsAvailable
        }));

        const recentAvailable = p1Recent.total > 0 && p2Recent.total > 0;
        const recentEdge = recentAvailable
            ? clamp((p1Recent.pct - p2Recent.pct) / 100, -1, 1)
            : 0;
        factors.push(buildFactor({
            key: 'recent_form',
            label: 'Recent Form (last 8)',
            weight: DEFAULT_WEIGHTS.recent_form,
            edge: recentEdge,
            p1Display: formatRecord(p1Recent),
            p2Display: formatRecord(p2Recent),
            note: 'Recent wins/losses from player match history',
            available: recentAvailable
        }));

        const surfaceAvailable = p1Surface.total >= 2 && p2Surface.total >= 2;
        const surfaceEdge = surfaceAvailable
            ? clamp((p1Surface.pct - p2Surface.pct) / 100, -1, 1)
            : 0;
        factors.push(buildFactor({
            key: 'surface_form',
            label: `${surfaceKey.charAt(0).toUpperCase() + surfaceKey.slice(1)} Form`,
            weight: DEFAULT_WEIGHTS.surface_form,
            edge: surfaceEdge,
            p1Display: formatRecord(p1Surface),
            p2Display: formatRecord(p2Surface),
            note: 'Recent matches on the same surface',
            available: surfaceAvailable
        }));

        const h2hAvailable = h2h.available;
        const h2hEdge = h2hAvailable
            ? clamp((h2h.p1Wins - h2h.p2Wins) / Math.max(1, h2h.total), -1, 1)
            : 0;
        factors.push(buildFactor({
            key: 'h2h',
            label: 'Head-to-Head',
            weight: DEFAULT_WEIGHTS.h2h,
            edge: h2hEdge,
            p1Display: h2hAvailable ? `${h2h.p1Wins}-${h2h.p2Wins}` : 'N/A',
            p2Display: h2hAvailable ? `${h2h.p2Wins}-${h2h.p1Wins}` : 'N/A',
            note: 'Career H2H between these players',
            available: h2hAvailable
        }));

        const momentumAvailable = Number.isFinite(p1Movement) && Number.isFinite(p2Movement);
        const momentumEdge = momentumAvailable
            ? clamp((p1Movement - p2Movement) / 8, -1, 1)
            : 0;
        factors.push(buildFactor({
            key: 'momentum',
            label: 'Ranking Momentum',
            weight: DEFAULT_WEIGHTS.momentum,
            edge: momentumEdge,
            p1Display: `${p1Movement >= 0 ? '+' : ''}${Math.round(p1Movement)}`,
            p2Display: `${p2Movement >= 0 ? '+' : ''}${Math.round(p2Movement)}`,
            note: 'Recent movement in ranking positions',
            available: momentumAvailable
        }));

        const availableFactors = factors.filter((factor) => factor.available);
        const weightSum = availableFactors.reduce((acc, factor) => acc + factor.weight, 0);
        const impactSum = availableFactors.reduce((acc, factor) => acc + factor.impact, 0);
        const overallEdge = weightSum > 0 ? (impactSum / weightSum) : rankEdge;

        const probs = probabilityFromEdge(overallEdge);
        const diff = probs.p1 - probs.p2;

        const prediction = {
            p1: probs.p1,
            p2: probs.p2,
            confidence: confidenceLabel(diff),
            factors,
            diagnostics: {
                weightCoverage: Math.round(weightSum * 100),
                edge: Number(overallEdge.toFixed(4))
            },
            players: {
                p1: {
                    rank: Number.isFinite(p1Rank) ? Math.round(p1Rank) : null,
                    points: Number.isFinite(p1Points) ? Math.round(p1Points) : null,
                    seasonRecord: p1SeasonRecord,
                    recentRecord: p1Recent,
                    surfaceRecord: p1Surface
                },
                p2: {
                    rank: Number.isFinite(p2Rank) ? Math.round(p2Rank) : null,
                    points: Number.isFinite(p2Points) ? Math.round(p2Points) : null,
                    seasonRecord: p2SeasonRecord,
                    recentRecord: p2Recent,
                    surfaceRecord: p2Surface
                }
            }
        };

        const summary = makeSummary(
            prediction,
            match,
            String(p1.name || 'Player 1'),
            String(p2.name || 'Player 2')
        );

        prediction.conclusion = summary.conclusion;
        prediction.reason = summary.rationale;
        prediction.summaryBullets = summary.bullets;
        prediction.h2hText = String(match?.h2h_text || 'N/A').trim() || 'N/A';
        prediction.formNote = `${formatRecord(p1Recent)} vs ${formatRecord(p2Recent)}`;

        return prediction;
    }

    global.WTAUpcomingPrediction = {
        predictMatch,
        WEIGHTS: { ...DEFAULT_WEIGHTS },
        version: '1.0.0'
    };
})(window);
