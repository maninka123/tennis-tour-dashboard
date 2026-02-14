/**
 * Tennis Live Dashboard - Tournaments Module
 * Handles rendering of tournament calendar with color coding
 */

const TournamentsModule = {
    sanitizeTournamentName(name) {
        if (!name) return 'Tournament';
        return String(name)
            .replace(/\s+(presented|powered)\s+by\s+.*$/i, '')
            .trim();
    },

    /**
     * Demo tournaments data (used when API is unavailable)
     */
    demoTournaments: {
        atp: [
            // Finished tournaments
            { id: 1, name: 'Brisbane International', category: 'atp_250', location: 'Brisbane, Australia', 
              start_date: '2026-01-01', end_date: '2026-01-07', surface: 'Hard', status: 'finished',
              winner: { name: 'Holger Rune', country: 'DEN' }, runner_up: { name: 'Grigor Dimitrov', country: 'BUL' } },
            { id: 2, name: 'Adelaide International', category: 'atp_250', location: 'Adelaide, Australia', 
              start_date: '2026-01-08', end_date: '2026-01-13', surface: 'Hard', status: 'finished',
              winner: { name: 'Thanasi Kokkinakis', country: 'AUS' }, runner_up: { name: 'Sebastian Korda', country: 'USA' } },
            
            // In Progress
            { id: 3, name: 'Australian Open', category: 'grand_slam', location: 'Melbourne, Australia', 
              start_date: '2026-01-14', end_date: '2026-01-28', surface: 'Hard', status: 'in_progress',
              winner: null, runner_up: null },
            
            // Upcoming tournaments
            { id: 4, name: 'Rotterdam Open', category: 'atp_500', location: 'Rotterdam, Netherlands', 
              start_date: '2026-02-10', end_date: '2026-02-16', surface: 'Hard (Indoor)', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Alex de Minaur', country: 'AUS' } },
            { id: 5, name: 'Dubai Tennis Championships', category: 'atp_500', location: 'Dubai, UAE', 
              start_date: '2026-02-24', end_date: '2026-03-01', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Ugo Humbert', country: 'FRA' }, runner_up: { name: 'Alexander Bublik', country: 'KAZ' } },
            { id: 6, name: 'Indian Wells Masters', category: 'masters_1000', location: 'Indian Wells, USA', 
              start_date: '2026-03-05', end_date: '2026-03-16', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Carlos Alcaraz', country: 'ESP' }, runner_up: { name: 'Daniil Medvedev', country: 'RUS' } },
            { id: 7, name: 'Miami Open', category: 'masters_1000', location: 'Miami, USA', 
              start_date: '2026-03-19', end_date: '2026-03-30', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Grigor Dimitrov', country: 'BUL' } },
            { id: 8, name: 'Monte-Carlo Masters', category: 'masters_1000', location: 'Monte Carlo, Monaco', 
              start_date: '2026-04-06', end_date: '2026-04-13', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Stefanos Tsitsipas', country: 'GRE' }, runner_up: { name: 'Casper Ruud', country: 'NOR' } },
            { id: 9, name: 'Barcelona Open', category: 'atp_500', location: 'Barcelona, Spain', 
              start_date: '2026-04-14', end_date: '2026-04-20', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Carlos Alcaraz', country: 'ESP' }, runner_up: { name: 'Stefanos Tsitsipas', country: 'GRE' } },
            { id: 10, name: 'Madrid Open', category: 'masters_1000', location: 'Madrid, Spain', 
              start_date: '2026-04-27', end_date: '2026-05-04', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Carlos Alcaraz', country: 'ESP' }, runner_up: { name: 'Jan-Lennard Struff', country: 'GER' } },
            { id: 11, name: 'Italian Open', category: 'masters_1000', location: 'Rome, Italy', 
              start_date: '2026-05-08', end_date: '2026-05-18', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Alexander Zverev', country: 'GER' }, runner_up: { name: 'Nicolas Jarry', country: 'CHI' } },
            { id: 12, name: 'Roland Garros', category: 'grand_slam', location: 'Paris, France', 
              start_date: '2026-05-25', end_date: '2026-06-08', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Carlos Alcaraz', country: 'ESP' }, runner_up: { name: 'Alexander Zverev', country: 'GER' } },
            { id: 13, name: 'Queen\'s Club Championships', category: 'atp_500', location: 'London, UK', 
              start_date: '2026-06-15', end_date: '2026-06-21', surface: 'Grass', status: 'upcoming',
              winner: { name: 'Tommy Paul', country: 'USA' }, runner_up: { name: 'Lorenzo Musetti', country: 'ITA' } },
            { id: 14, name: 'Halle Open', category: 'atp_500', location: 'Halle, Germany', 
              start_date: '2026-06-15', end_date: '2026-06-21', surface: 'Grass', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Hubert Hurkacz', country: 'POL' } },
            { id: 15, name: 'Wimbledon', category: 'grand_slam', location: 'London, UK', 
              start_date: '2026-06-29', end_date: '2026-07-12', surface: 'Grass', status: 'upcoming',
              winner: { name: 'Carlos Alcaraz', country: 'ESP' }, runner_up: { name: 'Novak Djokovic', country: 'SRB' } },
            { id: 16, name: 'Canadian Open', category: 'masters_1000', location: 'Toronto, Canada', 
              start_date: '2026-08-04', end_date: '2026-08-10', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Alexei Popyrin', country: 'AUS' }, runner_up: { name: 'Andrey Rublev', country: 'RUS' } },
            { id: 17, name: 'Cincinnati Masters', category: 'masters_1000', location: 'Cincinnati, USA', 
              start_date: '2026-08-11', end_date: '2026-08-17', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Frances Tiafoe', country: 'USA' } },
            { id: 18, name: 'US Open', category: 'grand_slam', location: 'New York, USA', 
              start_date: '2026-08-24', end_date: '2026-09-06', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Taylor Fritz', country: 'USA' } },
            { id: 19, name: 'Shanghai Masters', category: 'masters_1000', location: 'Shanghai, China', 
              start_date: '2026-10-05', end_date: '2026-10-12', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Novak Djokovic', country: 'SRB' } },
            { id: 20, name: 'Paris Masters', category: 'masters_1000', location: 'Paris, France', 
              start_date: '2026-10-27', end_date: '2026-11-02', surface: 'Hard (Indoor)', status: 'upcoming',
              winner: { name: 'Alexander Zverev', country: 'GER' }, runner_up: { name: 'Daniil Medvedev', country: 'RUS' } },
            { id: 21, name: 'ATP Finals', category: 'finals', location: 'Turin, Italy', 
              start_date: '2026-11-10', end_date: '2026-11-17', surface: 'Hard (Indoor)', status: 'upcoming',
              winner: { name: 'Jannik Sinner', country: 'ITA' }, runner_up: { name: 'Taylor Fritz', country: 'USA' } },
        ],
        wta: [
            // Finished tournaments
            { id: 101, name: 'Brisbane International', category: 'atp_500', location: 'Brisbane, Australia', 
              start_date: '2026-01-01', end_date: '2026-01-07', surface: 'Hard', status: 'finished',
              winner: { name: 'Elena Rybakina', country: 'KAZ' }, runner_up: { name: 'Aryna Sabalenka', country: 'BLR' } },
            { id: 102, name: 'Adelaide International', category: 'atp_250', location: 'Adelaide, Australia', 
              start_date: '2026-01-08', end_date: '2026-01-13', surface: 'Hard', status: 'finished',
              winner: { name: 'Qinwen Zheng', country: 'CHN' }, runner_up: { name: 'Jelena Ostapenko', country: 'LAT' } },
            
            // In Progress
            { id: 103, name: 'Australian Open', category: 'grand_slam', location: 'Melbourne, Australia', 
              start_date: '2026-01-14', end_date: '2026-01-28', surface: 'Hard', status: 'in_progress',
              winner: null, runner_up: null },
            
            // Upcoming tournaments
            { id: 104, name: 'Dubai Championships', category: 'atp_500', location: 'Dubai, UAE', 
              start_date: '2026-02-17', end_date: '2026-02-22', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Jasmine Paolini', country: 'ITA' }, runner_up: { name: 'Anna Kalinskaya', country: 'RUS' } },
            { id: 105, name: 'Qatar Open', category: 'atp_500', location: 'Doha, Qatar', 
              start_date: '2026-02-10', end_date: '2026-02-15', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Iga Swiatek', country: 'POL' }, runner_up: { name: 'Elena Rybakina', country: 'KAZ' } },
            { id: 106, name: 'Indian Wells Masters', category: 'masters_1000', location: 'Indian Wells, USA', 
              start_date: '2026-03-05', end_date: '2026-03-16', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Iga Swiatek', country: 'POL' }, runner_up: { name: 'Maria Sakkari', country: 'GRE' } },
            { id: 107, name: 'Miami Open', category: 'masters_1000', location: 'Miami, USA', 
              start_date: '2026-03-19', end_date: '2026-03-30', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Danielle Collins', country: 'USA' }, runner_up: { name: 'Elena Rybakina', country: 'KAZ' } },
            { id: 108, name: 'Madrid Open', category: 'masters_1000', location: 'Madrid, Spain', 
              start_date: '2026-04-25', end_date: '2026-05-04', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Iga Swiatek', country: 'POL' }, runner_up: { name: 'Aryna Sabalenka', country: 'BLR' } },
            { id: 109, name: 'Italian Open', category: 'masters_1000', location: 'Rome, Italy', 
              start_date: '2026-05-08', end_date: '2026-05-18', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Iga Swiatek', country: 'POL' }, runner_up: { name: 'Coco Gauff', country: 'USA' } },
            { id: 110, name: 'Roland Garros', category: 'grand_slam', location: 'Paris, France', 
              start_date: '2026-05-25', end_date: '2026-06-08', surface: 'Clay', status: 'upcoming',
              winner: { name: 'Iga Swiatek', country: 'POL' }, runner_up: { name: 'Jasmine Paolini', country: 'ITA' } },
            { id: 111, name: 'Wimbledon', category: 'grand_slam', location: 'London, UK', 
              start_date: '2026-06-29', end_date: '2026-07-12', surface: 'Grass', status: 'upcoming',
              winner: { name: 'Barbora Krejcikova', country: 'CZE' }, runner_up: { name: 'Jasmine Paolini', country: 'ITA' } },
            { id: 112, name: 'Canadian Open', category: 'masters_1000', location: 'Montreal, Canada', 
              start_date: '2026-08-04', end_date: '2026-08-10', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Jessica Pegula', country: 'USA' }, runner_up: { name: 'Amanda Anisimova', country: 'USA' } },
            { id: 113, name: 'Cincinnati Masters', category: 'masters_1000', location: 'Cincinnati, USA', 
              start_date: '2026-08-11', end_date: '2026-08-17', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Aryna Sabalenka', country: 'BLR' }, runner_up: { name: 'Jessica Pegula', country: 'USA' } },
            { id: 114, name: 'US Open', category: 'grand_slam', location: 'New York, USA', 
              start_date: '2026-08-24', end_date: '2026-09-06', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Aryna Sabalenka', country: 'BLR' }, runner_up: { name: 'Jessica Pegula', country: 'USA' } },
            { id: 115, name: 'China Open', category: 'masters_1000', location: 'Beijing, China', 
              start_date: '2026-09-28', end_date: '2026-10-05', surface: 'Hard', status: 'upcoming',
              winner: { name: 'Coco Gauff', country: 'USA' }, runner_up: { name: 'Karolina Muchova', country: 'CZE' } },
            { id: 116, name: 'WTA Finals', category: 'finals', location: 'Riyadh, Saudi Arabia', 
              start_date: '2026-11-02', end_date: '2026-11-09', surface: 'Hard (Indoor)', status: 'upcoming',
              winner: { name: 'Coco Gauff', country: 'USA' }, runner_up: { name: 'Iga Swiatek', country: 'POL' } },
        ]
    },

    /**
     * Render tournament calendar
     */
    render() {
        const { AppState, Utils, DOM } = window.TennisApp;
        const tour = AppState.currentTour;
        
        // Get data (use demo if empty)
        let tournaments = AppState.tournaments[tour];
        if (!tournaments || tournaments.length === 0) {
            tournaments = this.demoTournaments[tour] || [];
        }

        if (tournaments.length === 0) {
            DOM.tournamentCalendar.innerHTML = `
                <div class="loading-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>No tournament data available</span>
                </div>
            `;
            return;
        }

        // Sort tournaments by date
        tournaments.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        // Split into finished, in progress, and upcoming
        const finished = tournaments.filter(t => t.status === 'finished');
        const inProgress = tournaments.filter(t => t.status === 'in_progress');
        const upcoming = tournaments.filter(t => t.status === 'upcoming');

        let html = '';

        // Finished tournaments
        if (finished.length > 0) {
            finished.forEach(tournament => {
                html += this.createTournamentItem(tournament);
            });
        }

        // In Progress tournaments
        if (inProgress.length > 0) {
            inProgress.forEach(tournament => {
                html += this.createTournamentItem(tournament);
            });
        }

        // Today divider
        html += `
            <div class="calendar-divider">
                <span class="divider-label">
                    <i class="fas fa-calendar-day"></i>
                    Today - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </div>
        `;

        // Upcoming tournaments
        if (upcoming.length > 0) {
            upcoming.forEach(tournament => {
                html += this.createTournamentItem(tournament);
            });
        }

        DOM.tournamentCalendar.innerHTML = html;

        // Add click handlers
        this.attachEventListeners();
    },

    /**
     * Create tournament item HTML
     */
    createTournamentItem(tournament) {
        const { Utils } = window.TennisApp;
        const categoryKey = String(tournament.category || '').trim().toLowerCase();
        const categoryClass = Utils.getCategoryClass(categoryKey, tournament.tour || window.TennisApp?.AppState?.currentTour || '');
        const cleanedName = this.sanitizeTournamentName(tournament.name);
        const date = Utils.formatDate(tournament.start_date);
        const startDate = new Date(tournament.start_date);
        const endDate = new Date(tournament.end_date || tournament.start_date);
        const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
        const startDay = startDate.toLocaleDateString('en-US', { day: 'numeric' });
        const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
        const endDay = endDate.toLocaleDateString('en-US', { day: 'numeric' });
        let dateRange = `${startMonth} ${startDay}`;
        if (tournament.end_date && (startMonth !== endMonth || startDay !== endDay)) {
            dateRange = startMonth === endMonth
                ? `${startMonth} ${startDay} - ${endDay}`
                : `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
        }
        dateRange = dateRange.replace(/,?\s*\d{4}/g, '').trim();

        const formatLocation = (value) => {
            if (!value) return '';
            const parts = value.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length === 1) return parts[0];
            const rawCity = parts[0];
            const rawCountry = parts[parts.length - 1];
            if (rawCity.length <= 2 && parts.length >= 2) {
                return `${parts.join(', ')}`;
            }
            return `${rawCity}, ${rawCountry}`;
        };
        const rawLocation = formatLocation(tournament.location);
        const locationText = rawLocation ? rawLocation.replace(/\s+/g, ' ').trim() : '';

        // Results section
        let resultsHTML = '';
        const formatShortName = (name) => {
            if (!name) return '';
            const parts = name.trim().split(/\s+/);
            if (parts.length === 1) return parts[0];
            return `${parts[0][0]}. ${parts[parts.length - 1]}`;
        };

        if (tournament.status === 'finished' && tournament.winner) {
            resultsHTML = `
                <div class="tournament-results">
                    <div class="result-label">Champion</div>
                    <div class="result-player">
                        <i class="fas fa-trophy"></i>
                        <span class="result-name">${Utils.getFlag(tournament.winner.country)} ${formatShortName(tournament.winner.name)}</span>
                    </div>
                    <div class="result-player runner-up">
                        <i class="fas fa-medal"></i>
                        <span class="result-name">${Utils.getFlag(tournament.runner_up.country)} ${formatShortName(tournament.runner_up.name)}</span>
                    </div>
                </div>
            `;
        } else if (tournament.status === 'upcoming' && tournament.winner) {
            resultsHTML = `
                <div class="tournament-results">
                    <div class="result-label">2025 Champion</div>
                    <div class="result-player" style="opacity: 0.7;">
                        <i class="fas fa-trophy"></i>
                        <span class="result-name">${Utils.getFlag(tournament.winner.country)} ${formatShortName(tournament.winner.name)}</span>
                    </div>
                </div>
            `;
        }

        // Category badge name
        const tour = window.TennisApp?.AppState?.currentTour || 'atp';
        const categoryNames = {
            'grand_slam': 'Grand Slam',
            'atp_1000': 'Masters 1000',
            'wta_1000': 'WTA 1000',
            'masters_1000': tour === 'wta' ? 'WTA 1000' : 'Masters 1000',
            'atp_500': 'ATP 500',
            'wta_500': 'WTA 500',
            'atp_250': 'ATP 250',
            'wta_250': 'WTA 250',
            'atp_125': 'ATP 125',
            'wta_125': 'WTA 125',
            'atp_finals': 'ATP Finals',
            'wta_finals': 'WTA Finals',
            'finals': tour === 'wta' ? 'WTA Finals' : 'ATP Finals',
            'other': 'Other'
        };

        // Surface class for coloring
        const surfaceLower = tournament.surface.toLowerCase();
        let surfaceClass = 'hard';
        if (surfaceLower.includes('clay')) surfaceClass = 'clay';
        else if (surfaceLower.includes('grass')) surfaceClass = 'grass';
        else if (surfaceLower.includes('indoor')) surfaceClass = 'indoor';

        const isSelected = `${window.TennisApp?.AppState?.selectedTournament}` === `${tournament.id}`;
        const rawStatus = (tournament.status || '').toLowerCase();
        const statusClass = rawStatus.replace(/_/g, '-');
        const isLive = rawStatus === 'in_progress' || rawStatus === 'live' || rawStatus === 'current' || rawStatus === 'running';
        const liveBadge = isLive
            ? '<span class="tournament-status-badge live">Live</span>'
            : '';

        return `
            <div class="tournament-item ${categoryClass} ${statusClass} ${isSelected ? 'selected' : ''}" data-tournament-id="${tournament.id}" data-category="${tournament.category}" data-name="${cleanedName}" data-surface="${tournament.surface}" data-status="${tournament.status}">
                <div class="tournament-date">
                    <div class="date-month">${date.month}</div>
                    <div class="date-day">${date.day}</div>
                </div>
                <div class="tournament-main">
                    <div class="tournament-title">
                        <span class="tournament-name-text">${cleanedName}</span>
                        <div class="tournament-badges">
                            <span class="tournament-category-badge ${categoryClass}">${categoryNames[categoryKey] || categoryKey || 'other'}</span>
                            ${liveBadge}
                        </div>
                    </div>
                    ${locationText ? `
                    <div class="tournament-location" title="${locationText}">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="location-text">${locationText}</span>
                    </div>` : ''}
                    <div class="tournament-date-range">
                        <i class="fas fa-calendar-day"></i>
                        ${dateRange}
                    </div>
                    <span class="tournament-surface ${surfaceClass}">${tournament.surface}</span>
                </div>
                ${resultsHTML}
            </div>
        `;
    },

    /**
     * Attach event listeners to tournament items
     */
    attachEventListeners() {
        const { DOM, AppState } = window.TennisApp;
        
        document.querySelectorAll('.tournament-item').forEach(item => {
            item.addEventListener('click', async () => {
                const tournamentId = item.dataset.tournamentId;
                const category = item.dataset.category;
                const tournamentName = item.dataset.name || item.querySelector('.tournament-title')?.childNodes[0]?.textContent?.trim();
                const tournamentSurface = item.dataset.surface || '';
                const tournamentStatus = item.dataset.status || '';
                AppState.selectedTournament = tournamentId;
                AppState.selectedTournamentName = tournamentName || null;
                AppState.selectedTournamentSurface = tournamentSurface;

                document.querySelectorAll('.tournament-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                
                // Show bracket panel
                DOM.tournamentDetailsPanel.classList.add('visible');
                
                // Load and render bracket (special handling for finals)
                await BracketModule.loadAndRender(tournamentId, category, tournamentName, tournamentSurface, tournamentStatus);
            });
        });
    }
};

// Export module
window.TournamentsModule = TournamentsModule;
