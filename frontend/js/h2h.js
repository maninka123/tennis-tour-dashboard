/**
 * Tennis Live Dashboard - Head-to-Head Comparison Module
 * Handles player comparison and H2H records
 */

const H2HModule = {
    /**
     * Demo player database for search
     */
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
        wta: [
            { id: 101, name: 'Iga Swiatek', country: 'POL', rank: 1 },
            { id: 102, name: 'Aryna Sabalenka', country: 'BLR', rank: 2 },
            { id: 103, name: 'Coco Gauff', country: 'USA', rank: 3 },
            { id: 104, name: 'Elena Rybakina', country: 'KAZ', rank: 4 },
            { id: 105, name: 'Jessica Pegula', country: 'USA', rank: 5 },
            { id: 106, name: 'Ons Jabeur', country: 'TUN', rank: 6 },
            { id: 107, name: 'Marketa Vondrousova', country: 'CZE', rank: 7 },
            { id: 108, name: 'Qinwen Zheng', country: 'CHN', rank: 8 },
            { id: 109, name: 'Maria Sakkari', country: 'GRE', rank: 9 },
            { id: 110, name: 'Jelena Ostapenko', country: 'LAT', rank: 10 },
            { id: 111, name: 'Daria Kasatkina', country: 'RUS', rank: 11 },
            { id: 112, name: 'Madison Keys', country: 'USA', rank: 12 },
            { id: 113, name: 'Liudmila Samsonova', country: 'RUS', rank: 13 },
            { id: 114, name: 'Beatriz Haddad Maia', country: 'BRA', rank: 14 },
            { id: 115, name: 'Karolina Muchova', country: 'CZE', rank: 15 }
        ]
    },

    selectedPlayer1: null,
    selectedPlayer2: null,

    /**
     * Initialize H2H module
     */
    init() {
        const player1Input = document.getElementById('h2hPlayer1');
        const player2Input = document.getElementById('h2hPlayer2');

        if (player1Input) {
            player1Input.addEventListener('input', (e) => this.handleSearch(e, 1));
            player1Input.addEventListener('focus', (e) => this.handleSearch(e, 1));
        }

        if (player2Input) {
            player2Input.addEventListener('input', (e) => this.handleSearch(e, 2));
            player2Input.addEventListener('focus', (e) => this.handleSearch(e, 2));
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.player-search-box')) {
                document.getElementById('h2hPlayer1Results').style.display = 'none';
                document.getElementById('h2hPlayer2Results').style.display = 'none';
            }
        });
    },

    /**
     * Handle player search
     */
    handleSearch(e, playerNum) {
        const query = e.target.value.toLowerCase();
        const { AppState } = window.TennisApp;
        const tour = AppState.currentTour;
        const players = this.playerDatabase[tour];

        const resultsDiv = document.getElementById(`h2hPlayer${playerNum}Results`);
        
        if (query.length === 0) {
            resultsDiv.innerHTML = '';
            resultsDiv.style.display = 'none';
            return;
        }

        const filtered = players.filter(p => 
            p.name.toLowerCase().includes(query)
        ).slice(0, 8);

        if (filtered.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item">No players found</div>';
            resultsDiv.style.display = 'block';
            return;
        }

        const { Utils } = window.TennisApp;
        resultsDiv.innerHTML = filtered.map(p => `
            <div class="search-result-item" onclick="window.TennisApp.H2HModule.selectPlayer(${playerNum}, ${p.id})">
                <img src="${Utils.getPlayerImage(p.id)}" alt="${p.name}">
                <div class="search-result-info">
                    <div class="search-result-name">${Utils.getFlag(p.country)} ${p.name}</div>
                    <div class="search-result-rank">Rank: ${p.rank}</div>
                </div>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    },

    /**
     * Select a player
     */
    selectPlayer(playerNum, playerId) {
        const { AppState, Utils } = window.TennisApp;
        const tour = AppState.currentTour;
        const player = this.playerDatabase[tour].find(p => p.id === playerId);

        if (playerNum === 1) {
            this.selectedPlayer1 = player;
            document.getElementById('h2hPlayer1').value = player.name;
            document.getElementById('h2hPlayer1Results').style.display = 'none';
        } else {
            this.selectedPlayer2 = player;
            document.getElementById('h2hPlayer2').value = player.name;
            document.getElementById('h2hPlayer2Results').style.display = 'none';
        }

        // If both players selected, show comparison
        if (this.selectedPlayer1 && this.selectedPlayer2) {
            this.showComparison();
        }
    },

    /**
     * Show H2H comparison
     */
    showComparison() {
        const p1 = this.selectedPlayer1;
        const p2 = this.selectedPlayer2;
        const { Utils } = window.TennisApp;

        // Generate demo H2H data
        const h2h = this.generateH2HData(p1, p2);

        const resultsDiv = document.getElementById('h2hResults');
        resultsDiv.innerHTML = `
            <div class="h2h-header">
                <div class="h2h-player-card">
                    <img src="${Utils.getPlayerImage(p1.id)}" alt="${p1.name}">
                    <div class="h2h-player-name">${p1.name}</div>
                    <div class="h2h-player-rank">${Utils.getFlag(p1.country)} Rank: ${p1.rank}</div>
                </div>
                <div class="h2h-record">
                    <div class="h2h-record-score">${h2h.p1Wins} - ${h2h.p2Wins}</div>
                    <div class="h2h-record-label">Career H2H</div>
                </div>
                <div class="h2h-player-card">
                    <img src="${Utils.getPlayerImage(p2.id)}" alt="${p2.name}">
                    <div class="h2h-player-name">${p2.name}</div>
                    <div class="h2h-player-rank">${Utils.getFlag(p2.country)} Rank: ${p2.rank}</div>
                </div>
            </div>

            <div class="h2h-stats-section">
                <h4>Career Statistics</h4>
                <div class="stats-grid">
                    ${this.createComparisonStat('Career Titles', h2h.p1Stats.titles, h2h.p2Stats.titles)}
                    ${this.createComparisonStat('Grand Slam Titles', h2h.p1Stats.grandSlams, h2h.p2Stats.grandSlams)}
                    ${this.createComparisonStat('Win %', h2h.p1Stats.winPercent + '%', h2h.p2Stats.winPercent + '%', h2h.p1Stats.winPercent, h2h.p2Stats.winPercent)}
                    ${this.createComparisonStat('Prize Money', h2h.p1Stats.prizeMoney, h2h.p2Stats.prizeMoney)}
                </div>
            </div>

            <div class="h2h-matches-section">
                <h4>Last 5 Matches Between Players</h4>
                <div class="h2h-matches-list">
                    ${h2h.recentMatches.map(m => this.createMatchItem(m, p1, p2)).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Create comparison stat row
     */
    createComparisonStat(label, val1, val2, num1 = null, num2 = null) {
        if (num1 !== null && num2 !== null) {
            const total = num1 + num2;
            const percent1 = total > 0 ? (num1 / total * 100).toFixed(1) : 50;
            const percent2 = total > 0 ? (num2 / total * 100).toFixed(1) : 50;
            
            return `
                <div class="stat-row">
                    <div class="stat-value left">${val1}</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-value right">${val2}</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill left" style="width: ${percent1}%"></div>
                        <div class="stat-bar-fill right" style="width: ${percent2}%"></div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="stat-row">
                    <div class="stat-value left">${val1}</div>
                    <div class="stat-label">${label}</div>
                    <div class="stat-value right">${val2}</div>
                </div>
            `;
        }
    },

    /**
     * Create match item for recent matches
     */
    createMatchItem(match, p1, p2) {
        const winnerId = match.winnerId;
        return `
            <div class="h2h-match-item">
                <div class="h2h-match-date">${match.date}</div>
                <div class="h2h-match-tournament">${match.tournament}</div>
                <div class="h2h-match-score">
                    <span class="${winnerId === p1.id ? 'winner' : ''}">${p1.name}</span>
                    <span class="score-detail">${match.score}</span>
                    <span class="${winnerId === p2.id ? 'winner' : ''}">${p2.name}</span>
                </div>
                <div class="h2h-match-surface">${match.surface}</div>
            </div>
        `;
    },

    /**
     * Generate demo H2H data
     */
    generateH2HData(p1, p2) {
        const p1Wins = Math.floor(Math.random() * 10) + 3;
        const p2Wins = Math.floor(Math.random() * 10) + 3;

        const tournaments = ['Australian Open', 'French Open', 'Wimbledon', 'US Open', 'Miami', 'Indian Wells', 'Madrid', 'Rome'];
        const surfaces = ['Hard', 'Clay', 'Grass'];
        const years = [2024, 2023, 2022, 2021, 2020];

        const recentMatches = [];
        for (let i = 0; i < 5; i++) {
            const winnerId = Math.random() > 0.5 ? p1.id : p2.id;
            recentMatches.push({
                date: `${years[i]}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`,
                tournament: tournaments[Math.floor(Math.random() * tournaments.length)],
                score: `${Math.floor(Math.random() * 3) + 6}-${Math.floor(Math.random() * 5) + 2} ${Math.floor(Math.random() * 3) + 6}-${Math.floor(Math.random() * 5) + 3}`,
                surface: surfaces[Math.floor(Math.random() * surfaces.length)],
                winnerId: winnerId
            });
        }

        return {
            p1Wins,
            p2Wins,
            p1Stats: {
                titles: Math.floor(Math.random() * 30) + 10,
                grandSlams: Math.floor(Math.random() * 15) + 1,
                winPercent: Math.floor(Math.random() * 20) + 70,
                prizeMoney: `$${(Math.random() * 100 + 50).toFixed(1)}M`
            },
            p2Stats: {
                titles: Math.floor(Math.random() * 30) + 10,
                grandSlams: Math.floor(Math.random() * 15) + 1,
                winPercent: Math.floor(Math.random() * 20) + 70,
                prizeMoney: `$${(Math.random() * 100 + 50).toFixed(1)}M`
            },
            recentMatches
        };
    },

    /**
     * Reset H2H selection
     */
    reset() {
        this.selectedPlayer1 = null;
        this.selectedPlayer2 = null;
        document.getElementById('h2hPlayer1').value = '';
        document.getElementById('h2hPlayer2').value = '';
        document.getElementById('h2hResults').innerHTML = '';
        document.getElementById('h2hPlayer1Results').style.display = 'none';
        document.getElementById('h2hPlayer2Results').style.display = 'none';
    }
};

// Export module
window.H2HModule = H2HModule;
