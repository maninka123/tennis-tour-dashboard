/**
 * System Update Page Controller
 * Handles background GIF collage and update workflow.
 */

const UpdatePage = {
    backendUrl: window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api',
    pollingInterval: null,
    gifs: [],
    gsNeedsUpdate: false,
    progressModel: null,

    init() {
        this.buildBackgroundCollage();
        this.resetProgressModel();
    },

    // --- Background GIF Logic ---
    async buildBackgroundCollage() {
        const grid = document.getElementById('updateGifGrid');
        if (!grid) return;

        const baseUrl = this.backendUrl.replace('/api', '');
        this.gifs = await this.fetchGifFiles();
        if (!this.gifs.length) return;

        let tiles = [];
        for (let i = 0; i < 4; i++) {
            tiles = tiles.concat(this.shuffleArray(this.gifs));
        }

        grid.innerHTML = '';
        tiles.forEach((file) => {
            const tile = document.createElement('div');
            tile.className = 'update-gif-tile';

            const img = document.createElement('img');
            img.src = `${baseUrl}/Images/intro gifs/${encodeURIComponent(file)}`;
            img.loading = 'lazy';
            img.alt = 'Tennis update background animation';
            img.onerror = () => {
                tile.style.background = 'linear-gradient(140deg, rgba(18,28,43,0.95), rgba(12,20,33,0.88))';
                img.remove();
            };

            tile.appendChild(img);
            grid.appendChild(tile);
        });
    },

    async fetchGifFiles() {
        try {
            const response = await fetch(`${this.backendUrl.replace('/api', '')}/api/intro-gifs`);
            const result = await response.json();
            if (result.success && Array.isArray(result.data) && result.data.length) {
                return result.data;
            }
        } catch (error) {
            console.warn('Could not fetch update GIF list from backend:', error);
        }
        return ['tennis_01.gif', 'tennis_02.gif', 'tennis_03.gif'];
    },

    shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    },

    // --- Update Workflow Logic ---
    showStep(stepId) {
        document.querySelectorAll('.update-step').forEach((el) => {
            el.style.display = 'none';
        });
        document.getElementById(`step-${stepId}`).style.display = 'block';
    },

    async startAnalysis() {
        this.showStep('analysis');

        try {
            const response = await fetch(`${this.backendUrl}/system/analysis`);
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            this.renderAnalysis(data);
            this.showStep('results');
        } catch (error) {
            console.error(error);
            alert(`Failed to analyze data: ${error.message}`);
            window.close();
        }
    },

    renderAnalysis(data) {
        // ATP
        const atpStats = data.atp.stats;
        let atpDays = 0;
        if (data.atp.players_needing_update && data.atp.players_needing_update.length > 0) {
            atpDays = Math.min(...data.atp.players_needing_update.map((p) => p.stats_age_days));
        }
        const atpNeedsUpdate = atpDays > 7;

        document.getElementById('atp-last-update').textContent = `${atpDays >= 999 ? 'Unknown/Never' : `${atpDays} days ago`}`;
        document.getElementById('atp-status-icon').innerHTML = atpNeedsUpdate
            ? '<i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>'
            : '<i class="fas fa-check-circle" style="color:#2ecc71"></i>';
        document.getElementById('atp-coverage-rank').textContent = atpStats.top_rank_coverage;

        // WTA
        const wtaStats = data.wta.stats;
        let wtaDays = 0;
        if (data.wta.players_needing_update && data.wta.players_needing_update.length > 0) {
            wtaDays = Math.min(...data.wta.players_needing_update.map((p) => p.stats_age_days));
        }
        const wtaNeedsUpdate = wtaDays > 7;

        document.getElementById('wta-last-update').textContent = `${wtaDays >= 999 ? 'Unknown/Never' : `${wtaDays} days ago`}`;
        document.getElementById('wta-status-icon').innerHTML = wtaNeedsUpdate
            ? '<i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>'
            : '<i class="fas fa-check-circle" style="color:#2ecc71"></i>';
        document.getElementById('wta-coverage-rank').textContent = wtaStats.top_rank_coverage;

        if (data.atp.players_needing_update) {
            this.gsNeedsUpdate = data.atp.players_needing_update.some((p) => p.gs_update_needed);
        }

        document.getElementById('check-atp').checked = atpNeedsUpdate;
        document.getElementById('check-wta').checked = wtaNeedsUpdate;
    },

    async startUpdate() {
        const targets = [];
        const isAtpChecked = document.getElementById('check-atp').checked;

        if (isAtpChecked) {
            targets.push('atp');
            if (this.gsNeedsUpdate) {
                targets.push('gs');
                this.updateLog('Auto-selecting Grand Slam update (required for accuracy)...');
            }
        }

        if (document.getElementById('check-wta').checked) targets.push('wta');

        if (targets.length === 0) {
            alert('Please select at least one item to update.');
            return;
        }

        this.initializeProgressModel(targets);
        this.showStep('progress');
        this.updateLog('Initialising update...');

        try {
            const res = await fetch(`${this.backendUrl}/system/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets })
            });

            if (res.ok) {
                this.pollProgress();
            } else if (res.status === 409) {
                this.updateLog('Update already in progress. Resuming monitor...');
                this.pollProgress();
            } else {
                const err = await res.json();
                this.updateLog(`Error starting: ${err.error}`);
            }
        } catch (e) {
            this.updateLog(`Network Error: ${e.message}`);
        }
    },

    initializeProgressModel(targets) {
        this.resetProgressModel();
        targets.forEach((target) => this.progressModel.selectedTargets.add(target));

        this.progressModel.tours.atp.enabled = this.progressModel.selectedTargets.has('atp');
        this.progressModel.tours.wta.enabled = this.progressModel.selectedTargets.has('wta');

        Object.values(this.progressModel.tours).forEach((tour) => {
            if (tour.enabled) {
                tour.status = 'queued';
                tour.eta = 'Queued';
                tour.detail = 'Waiting to start';
            } else {
                tour.status = 'idle';
                tour.eta = 'Not selected';
                tour.detail = 'Not selected';
            }
        });

        this.renderTourProgress();
        this.updateSummaryStatus();
    },

    resetProgressModel() {
        this.progressModel = {
            selectedTargets: new Set(),
            activeTour: null,
            lastLogCount: 0,
            tours: {
                atp: this.createTourModel('ATP'),
                wta: this.createTourModel('WTA')
            }
        };
    },

    createTourModel(name) {
        return {
            name,
            enabled: false,
            status: 'idle',
            processed: 0,
            total: 0,
            percent: 0,
            startedAtMs: null,
            eta: 'Not selected',
            detail: 'Not selected',
            counters: {
                updated: 0,
                skipped: 0,
                errors: 0
            }
        };
    },

    pollProgress() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(async () => {
            try {
                const res = await fetch(`${this.backendUrl}/system/update/status`);
                const state = await res.json();

                this.renderLog(state.log || []);
                this.consumeProgressLogs(state);
                this.renderTourProgress();
                this.updateSummaryStatus(state);

                if (state.status === 'completed') {
                    clearInterval(this.pollingInterval);
                    this.updateLog('UPDATE COMPLETE. Closing...', 'success');

                    setTimeout(() => {
                        if (window.opener && !window.opener.closed) window.opener.location.reload();
                        window.close();
                    }, 5000);
                } else if (state.status === 'error') {
                    clearInterval(this.pollingInterval);
                    alert('Update failed. Check logs.');
                }
            } catch (e) {
                console.error(e);
            }
        }, 1000);
    },

    renderLog(lines) {
        const logContainer = document.getElementById('update-log');
        logContainer.innerHTML = '';

        lines.forEach((line) => {
            const parsed = this.parseLogLine(line);
            logContainer.appendChild(parsed.element);
        });

        logContainer.scrollTop = logContainer.scrollHeight;
    },

    consumeProgressLogs(state) {
        const lines = Array.isArray(state.log) ? state.log : [];
        if (lines.length < this.progressModel.lastLogCount) {
            this.progressModel.lastLogCount = 0;
        }

        const currentTaskTour = this.mapTaskToTour(state.current_task || '');

        for (let i = this.progressModel.lastLogCount; i < lines.length; i++) {
            const clean = this.sanitizeLogLine(lines[i]);
            this.processProgressLog(clean, currentTaskTour);
        }

        this.progressModel.lastLogCount = lines.length;

        if (state.status === 'running' && currentTaskTour) {
            const runningTour = this.progressModel.tours[currentTaskTour];
            if (runningTour.enabled && runningTour.status === 'queued') {
                runningTour.status = 'running';
                runningTour.eta = 'Calculating...';
                runningTour.detail = 'Starting...';
            }
            this.progressModel.activeTour = currentTaskTour;
        }

        if (state.status === 'completed') {
            Object.keys(this.progressModel.tours).forEach((tourKey) => {
                if (this.progressModel.tours[tourKey].enabled) {
                    this.completeTour(tourKey);
                }
            });
        }
    },

    processProgressLog(cleanLine, currentTaskTour) {
        if (!cleanLine) return;

        if (cleanLine.includes('Running: Updating ATP Player Stats')) {
            this.setTourStatus('atp', 'running', 'Calculating...', 'Starting ATP player update');
            this.progressModel.activeTour = 'atp';
            return;
        }
        if (cleanLine.includes('Running: Updating WTA Player Stats')) {
            this.setTourStatus('wta', 'running', 'Calculating...', 'Starting WTA player update');
            this.progressModel.activeTour = 'wta';
            return;
        }
        if (cleanLine.includes('Completed: Updating ATP Player Stats')) {
            this.completeTour('atp');
            if (this.progressModel.activeTour === 'atp') this.progressModel.activeTour = null;
            return;
        }
        if (cleanLine.includes('Completed: Updating WTA Player Stats')) {
            this.completeTour('wta');
            if (this.progressModel.activeTour === 'wta') this.progressModel.activeTour = null;
            return;
        }
        if (cleanLine.includes('Error in Updating ATP Player Stats')) {
            this.failTour('atp');
            return;
        }
        if (cleanLine.includes('Error in Updating WTA Player Stats')) {
            this.failTour('wta');
            return;
        }

        const progressMatch = cleanLine.match(/\[(\d+)\/(\d+)\]/);
        if (progressMatch) {
            const processed = Number.parseInt(progressMatch[1], 10);
            const total = Number.parseInt(progressMatch[2], 10);
            const targetTour = this.progressModel.activeTour || currentTaskTour;
            if (targetTour && Number.isFinite(processed) && Number.isFinite(total)) {
                this.updateTourProgress(targetTour, processed, total);
            }
            return;
        }

        const counterTour = this.progressModel.activeTour || currentTaskTour;
        if (!counterTour || !this.progressModel.tours[counterTour]) return;

        if (cleanLine.includes('-> updated')) {
            this.progressModel.tours[counterTour].counters.updated += 1;
        } else if (cleanLine.includes('-> skip:') || cleanLine.includes('-> dry-run')) {
            this.progressModel.tours[counterTour].counters.skipped += 1;
        } else if (cleanLine.includes('-> error') || cleanLine.includes('[ERROR]')) {
            this.progressModel.tours[counterTour].counters.errors += 1;
        }
    },

    setTourStatus(tourKey, status, etaText, detailText) {
        const tour = this.progressModel.tours[tourKey];
        if (!tour || !tour.enabled) return;
        tour.status = status;
        if (etaText) tour.eta = etaText;
        if (detailText) tour.detail = detailText;
    },

    updateTourProgress(tourKey, processed, total) {
        const tour = this.progressModel.tours[tourKey];
        if (!tour || !tour.enabled || total <= 0) return;

        if (!tour.startedAtMs && processed > 0) {
            tour.startedAtMs = Date.now();
        }

        tour.status = 'running';
        tour.total = Math.max(tour.total, total);
        tour.processed = Math.max(0, Math.min(processed, tour.total));
        tour.percent = Math.min(100, (tour.processed / tour.total) * 100);
        tour.eta = this.computeTourEta(tour);
        tour.detail = `${tour.processed} / ${tour.total} players`;

        if (tour.processed >= tour.total) {
            tour.eta = 'Finalizing...';
        }
    },

    completeTour(tourKey) {
        const tour = this.progressModel.tours[tourKey];
        if (!tour || !tour.enabled) return;

        if (tour.total > 0) {
            tour.processed = tour.total;
        }
        tour.percent = 100;
        tour.status = 'completed';
        tour.eta = 'Done';
        tour.detail = tour.total > 0 ? `${tour.total} / ${tour.total} players` : 'Completed';
    },

    failTour(tourKey) {
        const tour = this.progressModel.tours[tourKey];
        if (!tour || !tour.enabled) return;

        tour.status = 'error';
        tour.eta = 'Error';
        if (!tour.detail || tour.detail === 'Waiting to start') {
            tour.detail = 'Failed';
        }
    },

    computeTourEta(tour) {
        if (!tour.startedAtMs || tour.processed <= 0 || tour.total <= 0) {
            return 'Calculating...';
        }

        const elapsedSec = (Date.now() - tour.startedAtMs) / 1000;
        if (elapsedSec <= 0) return 'Calculating...';

        const remaining = tour.total - tour.processed;
        if (remaining <= 0) return 'Finalizing...';

        const rate = tour.processed / elapsedSec;
        if (rate <= 0) return 'Calculating...';

        const etaSec = remaining / rate;
        return `${this.formatDuration(etaSec)} remaining`;
    },

    formatDuration(totalSeconds) {
        const seconds = Math.max(0, Math.round(totalSeconds));
        if (seconds < 60) return `${seconds}s`;

        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m`;

        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
    },

    updateSummaryStatus(state = null) {
        const container = document.getElementById('update-status-msg');
        const tours = Object.values(this.progressModel.tours).filter((tour) => tour.enabled);

        if (!tours.length) {
            container.textContent = 'Please wait while we fetch the latest data. Do not close this window.';
            return;
        }

        const withTotals = tours.filter((tour) => tour.total > 0);
        if (!withTotals.length) {
            if (state?.current_task) {
                container.textContent = `${state.current_task}...`;
            } else {
                container.textContent = 'Preparing update tasks...';
            }
            return;
        }

        const processed = withTotals.reduce((sum, tour) => sum + tour.processed, 0);
        const total = withTotals.reduce((sum, tour) => sum + tour.total, 0);
        const percent = total > 0 ? (processed / total) * 100 : 0;

        let etaText = '';
        const startedTours = withTotals.filter((tour) => tour.startedAtMs && tour.processed > 0);
        if (startedTours.length && processed > 0) {
            const earliestStart = Math.min(...startedTours.map((tour) => tour.startedAtMs));
            const elapsedSec = (Date.now() - earliestStart) / 1000;
            const rate = processed / Math.max(1, elapsedSec);
            const remaining = total - processed;
            if (rate > 0 && remaining > 0) {
                etaText = ` | ${this.formatDuration(remaining / rate)} remaining`;
            }
        }

        container.textContent = `Overall ${percent.toFixed(1)}% completed (${processed}/${total} players)${etaText}`;
    },

    renderTourProgress() {
        this.renderSingleTourProgress('atp');
        this.renderSingleTourProgress('wta');
    },

    renderSingleTourProgress(tourKey) {
        const tour = this.progressModel.tours[tourKey];
        if (!tour) return;

        const bar = document.getElementById(`${tourKey}-progress-bar`);
        const label = document.getElementById(`${tourKey}-progress-label`);
        const eta = document.getElementById(`${tourKey}-progress-eta`);
        const count = document.getElementById(`${tourKey}-progress-count`);
        const state = document.getElementById(`${tourKey}-progress-state`);
        const card = document.getElementById(`progress-card-${tourKey}`);

        bar.style.width = `${tour.percent.toFixed(1)}%`;
        label.textContent = `${tour.percent.toFixed(1)}% completed`;
        eta.textContent = tour.eta;
        count.textContent = tour.enabled
            ? (tour.total > 0 ? `${tour.processed} / ${tour.total} players` : '0 / ? players')
            : 'Not selected';
        state.textContent = this.getTourStatusText(tour);
        state.className = `tour-progress-state status-${tour.status}`;
        card.className = `tour-progress-card status-${tour.status}${tour.enabled ? ' is-enabled' : ''}`;
    },

    getTourStatusText(tour) {
        if (!tour.enabled) return 'Not selected';
        if (tour.status === 'queued') return 'Queued';
        if (tour.status === 'running') {
            if (tour.counters.errors > 0) {
                return `Running - ${tour.counters.errors} errors`;
            }
            return 'Running';
        }
        if (tour.status === 'completed') return 'Completed';
        if (tour.status === 'error') return 'Error';
        return 'Idle';
    },

    mapTaskToTour(task) {
        if (!task) return null;
        const normalized = String(task).toLowerCase();
        if (normalized.includes('atp player stats')) return 'atp';
        if (normalized.includes('wta player stats')) return 'wta';
        return null;
    },

    sanitizeLogLine(line) {
        return String(line || '')
            .replace(/\x1b\[[0-9;]*m/g, '')
            .trim();
    },

    parseLogLine(line) {
        const div = document.createElement('div');
        const cleanText = this.sanitizeLogLine(line);

        let colorClass = 'log-default';
        if (cleanText.includes('-> updated')) colorClass = 'log-success';
        else if (cleanText.includes('-> error') || cleanText.includes('[ERROR]')) colorClass = 'log-error';
        else if (cleanText.includes('-> dry-run') || cleanText.includes('-> skip')) colorClass = 'log-warning';
        else if (cleanText.includes('Found') && cleanText.includes('player folders')) colorClass = 'log-info';

        div.className = colorClass;
        div.textContent = `> ${cleanText}`;
        return { element: div, text: cleanText };
    },

    updateLog(msg) {
        const logContainer = document.getElementById('update-log');
        logContainer.innerHTML += `<div>> ${msg}</div>`;
        logContainer.scrollTop = logContainer.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', () => UpdatePage.init());
