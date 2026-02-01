/**
 * Tennis Live Dashboard - Rankings Module
 * Handles rendering of player rankings with movement indicators
 */

const RankingsModule = {
    /**
     * Demo rankings data (used when API is unavailable)
     */
    demoRankings: {
        atp: [
            { rank: 1, id: 1, name: 'Novak Djokovic', country: 'SRB', age: 36, points: 11245, career_high: 1, is_career_high: true, movement: 0 },
            { rank: 2, id: 2, name: 'Carlos Alcaraz', country: 'ESP', age: 20, points: 9255, career_high: 1, is_career_high: false, movement: 0 },
            { rank: 3, id: 3, name: 'Jannik Sinner', country: 'ITA', age: 22, points: 8710, career_high: 3, is_career_high: true, movement: 1 },
            { rank: 4, id: 4, name: 'Daniil Medvedev', country: 'RUS', age: 27, points: 7165, career_high: 1, is_career_high: false, movement: -1 },
            { rank: 5, id: 5, name: 'Andrey Rublev', country: 'RUS', age: 26, points: 5110, career_high: 5, is_career_high: true, movement: 2 },
            { rank: 6, id: 6, name: 'Alexander Zverev', country: 'GER', age: 26, points: 5085, career_high: 2, is_career_high: false, movement: 0 },
            { rank: 7, id: 7, name: 'Holger Rune', country: 'DEN', age: 20, points: 4210, career_high: 4, is_career_high: false, movement: -2 },
            { rank: 8, id: 8, name: 'Stefanos Tsitsipas', country: 'GRE', age: 25, points: 4175, career_high: 3, is_career_high: false, movement: 0 },
            { rank: 9, id: 9, name: 'Hubert Hurkacz', country: 'POL', age: 26, points: 3955, career_high: 9, is_career_high: true, movement: 1 },
            { rank: 10, id: 10, name: 'Casper Ruud', country: 'NOR', age: 25, points: 3825, career_high: 2, is_career_high: false, movement: -1 },
            { rank: 11, id: 11, name: 'Taylor Fritz', country: 'USA', age: 26, points: 3505, career_high: 11, is_career_high: true, movement: 3 },
            { rank: 12, id: 12, name: 'Tommy Paul', country: 'USA', age: 26, points: 3170, career_high: 12, is_career_high: true, movement: 0 },
            { rank: 13, id: 13, name: 'Ben Shelton', country: 'USA', age: 21, points: 2920, career_high: 13, is_career_high: true, movement: 5 },
            { rank: 14, id: 14, name: 'Grigor Dimitrov', country: 'BUL', age: 32, points: 2885, career_high: 3, is_career_high: false, movement: -1 },
            { rank: 15, id: 15, name: 'Felix Auger-Aliassime', country: 'CAN', age: 23, points: 2660, career_high: 6, is_career_high: false, movement: -2 },
            { rank: 16, id: 16, name: 'Karen Khachanov', country: 'RUS', age: 27, points: 2605, career_high: 8, is_career_high: false, movement: 0 },
            { rank: 17, id: 17, name: 'Frances Tiafoe', country: 'USA', age: 25, points: 2505, career_high: 10, is_career_high: false, movement: 1 },
            { rank: 18, id: 18, name: 'Ugo Humbert', country: 'FRA', age: 25, points: 2490, career_high: 18, is_career_high: true, movement: 4 },
            { rank: 19, id: 19, name: 'Sebastian Korda', country: 'USA', age: 23, points: 2385, career_high: 19, is_career_high: true, movement: 0 },
            { rank: 20, id: 20, name: 'Nicolas Jarry', country: 'CHI', age: 28, points: 2330, career_high: 20, is_career_high: true, movement: 2 }
        ],
        wta: [
            { rank: 1, id: 101, name: 'Iga Swiatek', country: 'POL', age: 22, points: 10715, career_high: 1, is_career_high: true, movement: 0 },
            { rank: 2, id: 102, name: 'Aryna Sabalenka', country: 'BLR', age: 25, points: 8725, career_high: 1, is_career_high: false, movement: 0 },
            { rank: 3, id: 103, name: 'Coco Gauff', country: 'USA', age: 19, points: 6770, career_high: 3, is_career_high: true, movement: 1 },
            { rank: 4, id: 104, name: 'Elena Rybakina', country: 'KAZ', age: 24, points: 5973, career_high: 3, is_career_high: false, movement: -1 },
            { rank: 5, id: 105, name: 'Jessica Pegula', country: 'USA', age: 29, points: 5580, career_high: 3, is_career_high: false, movement: 0 },
            { rank: 6, id: 106, name: 'Ons Jabeur', country: 'TUN', age: 29, points: 4316, career_high: 2, is_career_high: false, movement: -2 },
            { rank: 7, id: 107, name: 'Marketa Vondrousova', country: 'CZE', age: 24, points: 4075, career_high: 7, is_career_high: true, movement: 3 },
            { rank: 8, id: 108, name: 'Qinwen Zheng', country: 'CHN', age: 21, points: 4005, career_high: 8, is_career_high: true, movement: 5 },
            { rank: 9, id: 109, name: 'Maria Sakkari', country: 'GRE', age: 28, points: 3835, career_high: 3, is_career_high: false, movement: 0 },
            { rank: 10, id: 110, name: 'Jelena Ostapenko', country: 'LAT', age: 26, points: 3438, career_high: 5, is_career_high: false, movement: 1 },
            { rank: 11, id: 111, name: 'Daria Kasatkina', country: 'RUS', age: 26, points: 3130, career_high: 8, is_career_high: false, movement: -1 },
            { rank: 12, id: 112, name: 'Madison Keys', country: 'USA', age: 28, points: 2993, career_high: 7, is_career_high: false, movement: 2 },
            { rank: 13, id: 113, name: 'Liudmila Samsonova', country: 'RUS', age: 24, points: 2985, career_high: 11, is_career_high: false, movement: 0 },
            { rank: 14, id: 114, name: 'Beatriz Haddad Maia', country: 'BRA', age: 27, points: 2956, career_high: 10, is_career_high: false, movement: -3 },
            { rank: 15, id: 115, name: 'Karolina Muchova', country: 'CZE', age: 27, points: 2905, career_high: 8, is_career_high: false, movement: 4 },
            { rank: 16, id: 116, name: 'Ekaterina Alexandrova', country: 'RUS', age: 29, points: 2625, career_high: 12, is_career_high: false, movement: 0 },
            { rank: 17, id: 117, name: 'Caroline Garcia', country: 'FRA', age: 30, points: 2605, career_high: 4, is_career_high: false, movement: -2 },
            { rank: 18, id: 118, name: 'Veronika Kudermetova', country: 'RUS', age: 26, points: 2501, career_high: 9, is_career_high: false, movement: 1 },
            { rank: 19, id: 119, name: 'Barbora Krejcikova', country: 'CZE', age: 27, points: 2436, career_high: 2, is_career_high: false, movement: 0 },
            { rank: 20, id: 120, name: 'Emma Navarro', country: 'USA', age: 22, points: 2380, career_high: 20, is_career_high: true, movement: 8 }
        ]
    },

    /**
     * Generate more rankings for demo (up to 200)
     */
    generateFullRankings(tour) {
        const baseRankings = this.demoRankings[tour];
        const fullRankings = [...baseRankings];
        
        const countries = ['USA', 'FRA', 'ESP', 'ITA', 'GER', 'ARG', 'AUS', 'GBR', 'JPN', 'KOR', 'CAN', 'RUS', 'BRA', 'CHN'];
        const firstNames = tour === 'atp' 
            ? ['Alex', 'Marco', 'Pablo', 'John', 'David', 'Lucas', 'Max', 'Leo', 'Hugo', 'Jack', 'Tom', 'James', 'Michael', 'Daniel']
            : ['Anna', 'Maria', 'Emma', 'Sofia', 'Elena', 'Victoria', 'Anastasia', 'Nina', 'Sara', 'Julia', 'Mia', 'Olivia', 'Sophia', 'Isabella'];
        const lastNames = ['Smith', 'Garcia', 'Muller', 'Martin', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas'];

        for (let i = baseRankings.length + 1; i <= 200; i++) {
            const baseId = tour === 'atp' ? i : 100 + i;
            fullRankings.push({
                rank: i,
                id: baseId,
                name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                country: countries[Math.floor(Math.random() * countries.length)],
                age: Math.floor(Math.random() * 16) + 18, // 18-33
                points: Math.max(100, 2300 - (i * 10) + Math.floor(Math.random() * 100) - 50),
                career_high: Math.floor(Math.random() * Math.min(i, 50)) + Math.max(1, i - 30),
                is_career_high: Math.random() > 0.9,
                movement: Math.floor(Math.random() * 7) - 3 // -3 to +3
            });
        }

        return fullRankings;
    },

    /**
     * Render rankings list
     */
    render() {
        const { AppState, Utils, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Get data (use demo if empty)
        let rankings = AppState.rankings[tour];
        if (!rankings || rankings.length === 0) {
            rankings = this.generateFullRankings(tour);
        }

        // Limit to 200
        rankings = rankings.slice(0, 200);

        if (rankings.length === 0) {
            DOM.rankingsList.innerHTML = `
                <div class="loading-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>No rankings data available</span>
                </div>
            `;
            return;
        }

        DOM.rankingsList.innerHTML = rankings.map(player => this.createRankingItem(player, tour)).join('');
    },

    /**
     * Create ranking item HTML
     */
    createRankingItem(player, tour) {
        const { Utils } = window.TennisApp;
        
        // Movement indicator
        let movementHTML = '';
        let movementClass = 'same';
        
        if (player.movement > 0) {
            movementClass = 'up';
            movementHTML = `<i class="fas fa-arrow-up"></i> ${player.movement}`;
        } else if (player.movement < 0) {
            movementClass = 'down';
            movementHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(player.movement)}`;
        } else {
            movementHTML = `<i class="fas fa-minus"></i>`;
        }

        // Career high - highlight in yellow if at career high
        const careerHighClass = player.is_career_high ? 'career-high-number' : '';
        
        // Check if player is currently playing (for demo, make some top players "playing")
        const isPlaying = player.rank <= 10 && Math.random() > 0.6;
        const playingClass = isPlaying ? 'playing' : '';

        // Only show image for top 200 (already limited)
        const showImage = player.rank <= 200;
        const imageClass = `${playingClass}`;

        return `
            <div class="ranking-item" data-player-id="${player.id}">
                <div class="ranking-position">
                    <span class="rank-number">${player.rank}</span>
                    <span class="rank-movement ${movementClass}">${movementHTML}</span>
                </div>
                ${showImage ? `
                    <img class="ranking-player-img ${imageClass}" 
                         src="${Utils.getPlayerImage(player.id, tour)}" 
                         alt="${player.name}">
                ` : `
                    <div class="ranking-player-img" style="display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">
                        ${player.name.charAt(0)}
                    </div>
                `}
                <div class="ranking-info">
                    <div class="ranking-name">
                        <span class="country-flag">${Utils.getFlag(player.country)}</span>
                        ${player.name}
                    </div>
                    <div class="ranking-details">
                        <span>Age: ${player.age}</span>
                        <span>•</span>
                        <span>CH: <span class="${careerHighClass}">${player.career_high}</span></span>
                    </div>
                </div>
                <div class="ranking-points">
                    <div class="points-value">${player.points.toLocaleString()}</div>
                    <div class="points-label">pts</div>
                </div>
            </div>
        `;
    }
};

// Export module
window.RankingsModule = RankingsModule;
