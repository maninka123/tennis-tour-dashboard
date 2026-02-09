// Update Data Management
const UpdateManager = {
    gifs: [],
    pollingInterval: null,
    backendUrl: window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api',

    init() {
        // Generate list of gifs tennis_01.gif to tennis_30.gif
        for(let i=1; i<=30; i++) {
            const num = i.toString().padStart(2, '0');
            this.gifs.push(`assets/images/intro-gifs/tennis_${num}.gif`);
        }

        // Attach event listener to global scope for button
        window.openUpdateModal = () => this.openModal();
    },

    openModal() {
        const bg = document.getElementById('updateOverlay');
        const randomGif = this.gifs[Math.floor(Math.random() * this.gifs.length)];
        bg.style.backgroundImage = `url('${randomGif}')`;
        bg.classList.add('active');
        this.showStep('confirmation');
    },

    closeModal() {
        document.getElementById('updateOverlay').classList.remove('active');
        if (this.pollingInterval) clearInterval(this.pollingInterval);
    },

    showStep(stepName) {
        document.querySelectorAll('.update-step').forEach(el => el.style.display = 'none');
        document.getElementById(`step-${stepName}`).style.display = 'block';
    },

    async startAnalysis() {
        this.showStep('analysis');
        
        try {
            const response = await fetch(`${this.backendUrl}/api/system/analysis`);
            const data = await response.json();
            this.renderAnalysis(data);
            this.showStep('results');
        } catch (error) {
            alert('Failed to analyze data: ' + error.message);
            this.closeModal();
        }
    },

    renderAnalysis(data) {
        // ATP
        const atpStats = data.atp.stats;
        const atpDays = Math.min(...data.atp.players_needing_update.map(p => p.stats_age_days));
        const atpNeedsUpdate = atpDays > 7;

        document.getElementById('atp-last-update').textContent = `${atpDays === 999 ? 'Never' : atpDays + ' days ago'}`;
        document.getElementById('atp-status-icon').innerHTML = atpNeedsUpdate ? '<i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>' : '<i class="fas fa-check-circle" style="color:#2ecc71"></i>';
        document.getElementById('atp-coverage-rank').textContent = atpStats.top_rank_coverage;

        // WTA
        const wtaStats = data.wta.stats;
        const wtaDays = Math.min(...data.wta.players_needing_update.map(p => p.stats_age_days));
        const wtaNeedsUpdate = wtaDays > 7;

        document.getElementById('wta-last-update').textContent = `${wtaDays === 999 ? 'Never' : wtaDays + ' days ago'}`;
        document.getElementById('wta-status-icon').innerHTML = wtaNeedsUpdate ? '<i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>' : '<i class="fas fa-check-circle" style="color:#2ecc71"></i>';
        document.getElementById('wta-coverage-rank').textContent = wtaStats.top_rank_coverage;
        
        // GS Check
        const gsNeedsUpdate = data.atp.players_needing_update.some(p => p.gs_update_needed);
        const gsCheckbox = document.getElementById('check-gs');
        const gsContainer = document.getElementById('gs-option-container');
        
        if (gsNeedsUpdate) {
            gsContainer.style.display = 'flex';
            gsCheckbox.checked = true;
            document.getElementById('gs-status-text').textContent = "Update Required";
            document.getElementById('gs-status-text').style.color = "#f39c12";
        } else {
            // Optional
            gsCheckbox.checked = false;
            document.getElementById('gs-status-text').textContent = "Up to date";
            document.getElementById('gs-status-text').style.color = "#2ecc71";
        }
        
        // Auto-select outdated
        document.getElementById('check-atp').checked = atpNeedsUpdate;
        document.getElementById('check-wta').checked = wtaNeedsUpdate;
    },

    async startUpdate() {
        const targets = [];
        if (document.getElementById('check-atp').checked) targets.push('atp');
        if (document.getElementById('check-wta').checked) targets.push('wta');
        if (document.getElementById('check-gs').checked) targets.push('gs');

        if (targets.length === 0) {
            alert("Please select at least one item to update.");
            return;
        }

        this.showStep('progress');
        this.updateLog("Initialising update...");

        try {
            const res = await fetch(`${this.backendUrl}/api/system/update`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ targets })
            });

            if (res.ok) {
                this.pollProgress();
            } else {
                const err = await res.json();
                this.updateLog("Error starting: " + err.error);
            }
        } catch (e) {
            this.updateLog("Network Error: " + e.message);
        }
    },

    pollProgress() {
        this.pollingInterval = setInterval(async () => {
            try {
                const res = await fetch(`${this.backendUrl}/api/system/update/status`);
                const state = await res.json();
                
                // Update Log
                const logContainer = document.getElementById('update-log');
                logContainer.innerHTML = state.log.map(l => `<div>> ${l}</div>`).join('');
                logContainer.scrollTop = logContainer.scrollHeight;

                // Update Progress Bar
                document.getElementById('update-progress-bar').style.width = `${state.progress}%`;

                if (state.status === 'completed') {
                    clearInterval(this.pollingInterval);
                    setTimeout(() => {
                        window.location.reload();
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

    updateLog(msg) {
        const logContainer = document.getElementById('update-log');
        logContainer.innerHTML += `<div>> ${msg}</div>`;
    }
};

document.addEventListener('DOMContentLoaded', () => UpdateManager.init());
