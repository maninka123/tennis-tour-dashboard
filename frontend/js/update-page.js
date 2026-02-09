/**
 * System Update Page Controller
 * Handles background GIF collage and update workflow.
 */

const UpdatePage = {
    backendUrl: window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api',
    pollingInterval: null,
    gifs: [],
    gsNeedsUpdate: false, // Store system state

    init() {
        this.buildBackgroundCollage();
        // Step 1 is already visible by default HTML structure
    },

    // --- Background GIF Logic ---
    async buildBackgroundCollage() {
        const grid = document.getElementById('updateGifGrid');
        if (!grid) return;

        // Generate list of gifs tennis_01.gif to tennis_30.gif
        this.gifs = [];
        for(let i=1; i<=30; i++) {
            const num = i.toString().padStart(2, '0');
            this.gifs.push(`assets/images/intro-gifs/tennis_${num}.gif`);
        }
        
        // Create a large pool of tiles by shuffling multiple copies of the gif list
        // This ensures we have enough tiles to fill large screens (30 * 4 = 120 tiles)
        let tiles = [];
        for (let i = 0; i < 4; i++) {
            tiles = tiles.concat(this.shuffleArray(this.gifs));
        }

        grid.innerHTML = '';
        tiles.forEach(file => {
            const tile = document.createElement('div');
            tile.className = 'update-gif-tile';
            
            const img = document.createElement('img');
            img.src = file;
            img.loading = 'lazy';
            
            tile.appendChild(img);
            grid.appendChild(tile);
        });
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
        document.querySelectorAll('.update-step').forEach(el => el.style.display = 'none');
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
            alert('Failed to analyze data: ' + error.message);
            window.close();
        }
    },

    renderAnalysis(data) {
        // ATP
        const atpStats = data.atp.stats;
        // Handle case where players_needing_update might be empty
        let atpDays = 0;
        if (data.atp.players_needing_update && data.atp.players_needing_update.length > 0) {
            atpDays = Math.min(...data.atp.players_needing_update.map(p => p.stats_age_days));
        } else {
            // Fallback if list is empty but stats exist, specific logic depends on backend
            // For now assume if empty, everything is updated recently or never?
            atpDays = 0; 
        }

        const atpNeedsUpdate = atpDays > 7;

        document.getElementById('atp-last-update').textContent = `${atpDays >= 999 ? 'Unknown/Never' : atpDays + ' days ago'}`;
        document.getElementById('atp-status-icon').innerHTML = atpNeedsUpdate ? '<i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>' : '<i class="fas fa-check-circle" style="color:#2ecc71"></i>';
        document.getElementById('atp-coverage-rank').textContent = atpStats.top_rank_coverage;

        // WTA
        const wtaStats = data.wta.stats;
        let wtaDays = 0;
        if (data.wta.players_needing_update && data.wta.players_needing_update.length > 0) {
             wtaDays = Math.min(...data.wta.players_needing_update.map(p => p.stats_age_days));
        }
        const wtaNeedsUpdate = wtaDays > 7;

        document.getElementById('wta-last-update').textContent = `${wtaDays >= 999 ? 'Unknown/Never' : wtaDays + ' days ago'}`;
        document.getElementById('wta-status-icon').innerHTML = wtaNeedsUpdate ? '<i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>' : '<i class="fas fa-check-circle" style="color:#2ecc71"></i>';
        document.getElementById('wta-coverage-rank').textContent = wtaStats.top_rank_coverage;
        
        // GS Check
        if (data.atp.players_needing_update) {
            this.gsNeedsUpdate = data.atp.players_needing_update.some(p => p.gs_update_needed);
        }
        
        // Auto-select outdated
        document.getElementById('check-atp').checked = atpNeedsUpdate;
        document.getElementById('check-wta').checked = wtaNeedsUpdate;
    },

    async startUpdate() {
        const targets = [];
        const isAtpChecked = document.getElementById('check-atp').checked;
        
        if (isAtpChecked) {
            targets.push('atp');
            // Auto add GS if needed when ATP is selected
            if (this.gsNeedsUpdate) {
                targets.push('gs');
                this.updateLog("Auto-selecting Grand Slam update (required for accuracy)...");
            }
        }
        
        if (document.getElementById('check-wta').checked) targets.push('wta');

        if (targets.length === 0) {
            alert("Please select at least one item to update.");
            return;
        }

        this.showStep('progress');
        this.updateLog("Initialising update...");

        try {
            const res = await fetch(`${this.backendUrl}/system/update`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ targets })
            });

            if (res.ok) {
                this.pollProgress();
            } else {
                // If update is already running (409), just attach to it
                if (res.status === 409) {
                    this.updateLog("Update already in progress. Resuming monitor...");
                    this.pollProgress();
                } else {
                    const err = await res.json();
                    this.updateLog("Error starting: " + err.error);
                }
            }
        } catch (e) {
            this.updateLog("Network Error: " + e.message);
        }
    },

    pollProgress() {
        let lastLoggedLine = -1; // To avoid re-parsing lines if we optimize logs later
        let startTime = Date.now();
        let totalItems = 0;
        let processedItems = 0;

        this.pollingInterval = setInterval(async () => {
            try {
                const res = await fetch(`${this.backendUrl}/system/update/status`);
                const state = await res.json();
                const logContainer = document.getElementById('update-log');
                
                // Clear previous generic lines if full refresh
                // But for seamless effect, we just render what we get
                logContainer.innerHTML = ''; 

                // Process logs for formatting and progress stats
                state.log.forEach(line => {
                    const parsed = this.parseLogLine(line);
                    logContainer.appendChild(parsed.element);

                    // Extract Progress info [XXX/YYY]
                    const match = line.match(/^\s*\[(\d+)\/(\d+)\]/); // Looks for [010/201]
                    if (match) {
                        processedItems = parseInt(match[1]);
                        totalItems = parseInt(match[2]);
                    }
                });

                // Auto Scroll
                logContainer.scrollTop = logContainer.scrollHeight;

                // Update Progress Bar
                document.getElementById('update-progress-bar').style.width = `${state.progress}%`;

                // Update Time Estimation
                this.updateTimeEstimation(startTime, processedItems, totalItems);

                if (state.status === 'completed') {
                    clearInterval(this.pollingInterval);
                    this.updateLog("UPDATE COMPLETE. Closing...", 'success');
                    
                    setTimeout(() => {
                        if (window.opener && !window.opener.closed) window.opener.location.reload();
                        window.close();
                    }, 5000);

                } else if (state.status === 'error') {
                    clearInterval(this.pollingInterval);
                    alert("Update failed. Check logs.");
                }
            } catch (e) {
                console.error(e);
            }
        }, 1000);
    },

    // Add colors and remove ANSI codes
    parseLogLine(line) {
        const div = document.createElement('div');
        // Strip ANSI codes: \u001b[32m etc.
        let cleanText = line.replace(/\u001b\[\d+m/g, ''); 
        
        let colorClass = 'log-default';
        if (cleanText.includes('-> updated')) colorClass = 'log-success';
        else if (cleanText.includes('-> error') || cleanText.includes('[ERROR]')) colorClass = 'log-error';
        else if (cleanText.includes('-> dry-run') || cleanText.includes('-> skip')) colorClass = 'log-warning';
        else if (cleanText.includes('Found') && cleanText.includes('player folders')) colorClass = 'log-info';

        div.className = colorClass;
        div.textContent = '> ' + cleanText;
        return { element: div, text: cleanText };
    },

    updateTimeEstimation(startTime, current, total) {
        const container = document.getElementById('update-status-msg'); // The p tag under "Updating System..."
        if (!total || current === 0) return;

        const now = Date.now();
        const elapsedSeconds = (now - startTime) / 1000;
        const rate = current / elapsedSeconds; // items per second
        const remaining = total - current;
        
        if (remaining <= 0) {
            container.innerHTML = 'Finalizing...';
            return;
        }

        const etaSeconds = remaining / rate;
        const etaMins = Math.floor(etaSeconds / 60);
        const etaSecs = Math.floor(etaSeconds % 60);
        
        container.innerHTML = `Processing <span style="color:#3498db;font-weight:bold">${current}</span> of <span style="color:#3498db;font-weight:bold">${total}</span>. ` +
                              `Est. Remaining: <span style="color:#e74c3c;font-weight:bold">${etaMins}m ${etaSecs}s</span>`;
    },

    updateLog(msg, type='default') {
        const logContainer = document.getElementById('update-log');
        logContainer.innerHTML += `<div>> ${msg}</div>`;
        logContainer.scrollTop = logContainer.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', () => UpdatePage.init());
