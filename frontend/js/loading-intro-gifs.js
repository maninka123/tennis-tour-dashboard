/**
 * Intro GIF collage loader
 * Builds a full-screen random mosaic while app data initializes.
 * Dynamically loads gif filenames from backend to support easy gif additions.
 */
(function () {
    let GIF_FILES = [];
    let gifsLoaded = false;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const shuffle = (arr) => {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    const buildGifUrl = (file) => {
        // Get the API base from config if available, otherwise build it
        const apiBase = window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api';
        const baseUrl = apiBase.replace('/api', '');  // Get base URL without /api
        return `${baseUrl}/Images/intro gifs/${encodeURIComponent(file)}`;
    };

    /**
     * Fetch available gif files from backend
     */
    async function fetchGifFiles() {
        try {
            // Use the app's API base URL configuration
            const apiBase = window.TennisApp?.CONFIG?.API_BASE_URL || 'http://localhost:5001/api';
            const response = await fetch(`${apiBase.replace('/api', '')}/api/intro-gifs`);
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
                GIF_FILES = result.data;
                gifsLoaded = true;
                console.log(`Loaded ${GIF_FILES.length} gifs from backend`);
                return true;
            }
        } catch (error) {
            console.warn('Could not fetch gif list from backend:', error);
        }
        // Fallback: use a minimal default set if fetch fails
        GIF_FILES = ['tennis_01.gif', 'tennis_02.gif', 'tennis_03.gif'];
        gifsLoaded = true;
        return false;
    }

    function getTileCount() {
        const width = window.innerWidth || 1440;
        const height = window.innerHeight || 900;
        // Use all available gifs to ensure screen is fully covered
        return GIF_FILES.length;
    }

    async function buildCollage() {
        const grid = document.getElementById('introGifGrid');
        if (!grid) return;

        // Wait for gifs to be loaded if not already
        if (!gifsLoaded) {
            await fetchGifFiles();
        }

        if (GIF_FILES.length === 0) {
            console.error('No gif files available');
            return;
        }

        grid.innerHTML = '';
        // Shuffle to randomize which gifs are shown each time
        const pool = shuffle(GIF_FILES);

        // Use each gif at 80% of its original size and repeat the pool to fill the screen
        const repeatedPool = Array(3).fill(pool).flat(); // Repeat 3 times

        for (let i = 0; i < repeatedPool.length; i += 1) {
            const tile = document.createElement('div');
            tile.className = 'intro-gif-tile';

            const img = document.createElement('img');
            const file = repeatedPool[i];
            img.src = buildGifUrl(file);
            img.alt = 'Tennis intro animation';
            img.loading = 'eager';
            img.decoding = 'async';

            img.onload = () => {
                img.width = img.naturalWidth * 0.8;
            };

            img.onerror = () => {
                // Keep the tile but show gradient background if gif fails to load
                tile.style.background = 'linear-gradient(140deg, rgba(18,28,43,0.95), rgba(12,20,33,0.88))';
                img.remove();
            };

            tile.appendChild(img);
            grid.appendChild(tile);
        }
    }

    function watchOverlayLifecycle() {
        const overlay = document.getElementById('loadingOverlay');
        const grid = document.getElementById('introGifGrid');
        if (!overlay || !grid) return;

        const observer = new MutationObserver(() => {
            if (!overlay.classList.contains('hidden')) return;
            window.setTimeout(() => {
                grid.innerHTML = '';
                overlay.remove();
            }, 700);
            observer.disconnect();
        });
        observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    async function init() {
        if (!document.getElementById('loadingOverlay')) return;
        
        // Fetch and load gifs first
        await fetchGifFiles();
        
        // Build the collage with all available gifs
        await buildCollage();
        
        watchOverlayLifecycle();
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => buildCollage(), 200);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
