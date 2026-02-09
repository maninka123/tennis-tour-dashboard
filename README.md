# 🎾 Tennis Live Dashboard

**Real-time ATP & WTA Tennis Tracking for 2026 Season**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/) [![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/) [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://tennis-tour-dashboard.onrender.com)

*Your all-in-one tennis companion for live scores, rankings, tournament insights, and head-to-head analytics*

---

## ✨ Features

### 🔴 Live Match Tracking

- **Real-time scores** with current game points and serving indicators
- **Live match statistics** with detailed player comparison popups
- Auto-refreshing data via WebSocket + polling fallback

### 📊 Comprehensive Match Coverage

- **Recent Results**: Completed matches with clickable stat breakdowns
- **Upcoming Matches**: Next 48 hours with AI-powered predictions
  - 🎯 Win-edge percentages for both players
  - 📈 H2H snapshot and historical data
  - 💡 Form & momentum insights
  - 🧠 Smart prediction algorithms

### 🏆 Rankings & Tournament Data

- **Live ATP/WTA Rankings** with real-time point updates
- **Tournament Calendar** with surface and category filters
- **Interactive Draw Brackets** for ongoing tournaments
- **Player Profiles** with detailed statistics, career records, and local images

### ⭐ Favourites System

- **Per-tour favourites** — separate lists for ATP and WTA
- **Search-to-add** with autocomplete powered by the H2H search API
- **Live match detection** — favourite icon glows when any favourite is currently playing
- **Red blink highlight** on individual players who are live
- **Player images** served from local data folders
- **Persistent storage** via localStorage across sessions
- **Click to open** player stats card directly from favourites
- **Schedule button** placeholder for future upcoming match view

### 🎯 Advanced H2H Analytics

- **ATP & WTA H2H** — full support for both tours
- **Player Search** with autocomplete (500+ players per tour)
- **Career H2H Summary** with win/loss records
- **Interactive Radar Charts** comparing serve/return stats
- **Surface Performance** breakdown (Hard/Clay/Grass)
- **Past Meetings** with detailed set-by-set scores

### 👤 Player Stats Cards

- **Detailed profiles** with age, height, plays, coach info
- **Season & career stats** with serve/return breakdowns
- **Grand Slam performance** records
- **Recent match history** within the card
- **"Not Available" popup** with styled initials fallback for players without full data
- **WTA text filtering** — cleans up ranking "previous" field (removes parenthetical data, trailing numbers, etc.)

### 🔄 System Update Management

- **Dedicated Update UI** with real-time progress tracking
- **Color-coded logs** for easy monitoring
- **GIF grid background** for visual appeal

---

## 🚀 Quick Start

### 🌐 Live Demo

Visit the live deployment: **[tennis-tour-dashboard.onrender.com](https://tennis-tour-dashboard.onrender.com)**

### 💻 Local Development

#### Option A: Quick Start Script

```bash
./start.sh
```

- 🌐 Frontend: `http://localhost:8080`
- 🔧 Backend API: `http://localhost:5001`

#### Option B: Manual Setup

**Backend:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Frontend** (separate terminal):

```bash
cd frontend
python3 no_cache_server.py
```

---

## 🛠️ Technologies Used

### Backend

- ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white) **Python 3.11+**
- ![Flask](https://img.shields.io/badge/-Flask-000000?logo=flask&logoColor=white) **Flask 3.0.0** — Web framework
- ![SocketIO](https://img.shields.io/badge/-SocketIO-010101?logo=socket.io&logoColor=white) **Flask-SocketIO** — Real-time updates
- ![Gunicorn](https://img.shields.io/badge/-Gunicorn-499848?logo=gunicorn&logoColor=white) **Gunicorn** — Production server
- ![BeautifulSoup](https://img.shields.io/badge/-BeautifulSoup-43B02A?logo=python&logoColor=white) **BeautifulSoup4** — Web scraping
- ![Playwright](https://img.shields.io/badge/-Playwright-2EAD33?logo=playwright&logoColor=white) **Playwright** — Browser automation

### Frontend

- ![HTML5](https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white) **HTML5**
- ![CSS3](https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white) **CSS3** with custom animations
- ![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black) **Vanilla JavaScript** (modular architecture)
- ![Chart.js](https://img.shields.io/badge/-Chart.js-FF6384?logo=chart.js&logoColor=white) **Chart.js** — Radar charts

### Deployment

- ![Render](https://img.shields.io/badge/-Render-46E3B7?logo=render&logoColor=white) **Render.com** — Cloud hosting
- ![GitHub](https://img.shields.io/badge/-GitHub-181717?logo=github&logoColor=white) **GitHub** — Version control & CI/CD

---

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check ✅ |
| `GET` | `/api/live-scores?tour=atp\|wta\|both` | Live match scores 🔴 |
| `GET` | `/api/recent-matches?tour=...&limit=...` | Recently completed matches 📋 |
| `GET` | `/api/upcoming-matches?tour=...&days=7` | Upcoming matches with predictions 🎯 |
| `GET` | `/api/intro-gifs` | Loading page GIF list 🖼️ |

### Rankings & Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rankings/<tour>?limit=...` | ATP/WTA rankings 🏆 |
| `GET` | `/api/rankings/wta/status` | WTA rankings cache status ⏰ |
| `POST` | `/api/rankings/wta/refresh` | Force refresh WTA rankings 🔄 |
| `GET` | `/api/player/<id>` | Player profile & stats 👤 |
| `GET` | `/api/player/<tour>/<player_id>/image` | Player image (local or redirect) 📸 |

### Tournaments & Brackets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tournaments/<tour>` | Tournament calendar 📅 |
| `GET` | `/api/tournament/<id>/bracket?tour=...` | Tournament draw bracket 🌳 |

### Head-to-Head Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/h2h/atp/search?query=...&limit=...` | Search ATP players 🔍 |
| `GET` | `/api/h2h/wta/search?query=...&limit=...` | Search WTA players 🔍 |
| `GET` | `/api/h2h/atp?player1_id=...&player2_id=...` | ATP H2H analysis ⚔️ |
| `GET` | `/api/h2h/wta?player1_id=...&player2_id=...&year=2026&meetings=5` | WTA H2H analysis ⚔️ |

### System Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/system/update` | Trigger player data update 🔄 |
| `GET` | `/api/system/update/status` | Get update progress status 📊 |
| `GET` | `/api/system/update/preview` | Preview available updates 👀 |

---

## 📁 Project Structure

```
Tennis-Dashboard/
│
├── backend/                           # Flask API Server
│   ├── app.py                         # Main application & routes
│   ├── tennis_api.py                  # API logic & data processing
│   ├── config.py                      # Configuration settings
│   ├── requirements.txt               # Python dependencies
│   └── venv/                          # Virtual environment
│
├── frontend/                          # Web Interface
│   ├── index.html                     # Main dashboard page
│   ├── update.html                    # System update page
│   ├── no_cache_server.py             # Dev server (port 8080)
│   │
│   ├── css/
│   │   ├── styles.css                 # Main styles + favourites panel
│   │   ├── update-page.css            # Update page styles
│   │   └── update-modal.css           # Update modal styles
│   │
│   ├── js/
│   │   ├── config.js                  # Environment config (API URL)
│   │   ├── app.js                     # Main controller, Utils, API
│   │   ├── scores.js                  # Live/recent/upcoming scores
│   │   ├── rankings.js                # Rankings display
│   │   ├── tournaments.js             # Tournament calendar
│   │   ├── bracket.js                 # Draw bracket viewer
│   │   ├── h2h.js                     # H2H analytics
│   │   ├── player.js                  # Player stats cards
│   │   ├── favourites.js              # ⭐ Favourites panel module
│   │   ├── stats-zone.js              # Stats zone features
│   │   ├── data-update.js             # Data update integration
│   │   ├── loading-intro-gifs.js      # Intro loading animation
│   │   ├── prediction_wta_upcoming.js # WTA prediction logic
│   │   └── update-page.js            # System update UI
│   │
│   ├── assets/                        # Images & media
│   └── vendor/                        # Third-party libraries (Chart.js)
│
├── data/                              # Player & Match Data
│   ├── atp/                           # ATP player folders
│   │   ├── 001_carlos-alcaraz/        #   profile.json, image.jpg, stats
│   │   ├── 002_jannik-sinner/
│   │   └── ...                        #   (200+ players)
│   │
│   ├── wta/                           # WTA player folders
│   │   ├── 001_aryna-sabalenka/
│   │   └── ...                        #   (400+ players)
│   │
│   ├── atp_stats/                     # ATP serve/return statistics
│   ├── wta_stats/                     # WTA serve/return statistics
│   ├── atp_live_ranking.csv           # ATP rankings cache
│   ├── wta_live_ranking.csv           # WTA rankings cache
│   └── wta_player_connections.json    # WTA player search index
│
├── scripts/                           # Data Management Scripts
│   ├── [Live] atp_live_matches.py     # Fetch live ATP scores
│   ├── [Live] atp_match_stats.py      # Fetch live match stats
│   ├── [Live] atp_recent_matches.py   # Fetch recent ATP results
│   ├── [Live] atp_upcoming_matches.py # Fetch upcoming ATP matches
│   ├── [Live] wta_live_matches.py     # Fetch live WTA scores
│   ├── [Live] wta_recent_matches.py   # Fetch recent WTA results
│   ├── [Live] wta_upcoming_matches.py # Fetch upcoming WTA matches
│   ├── [Update] Atp_player_stats.py   # Update ATP player profiles
│   ├── [Update] Wta_player_stats.py   # Update WTA player profiles
│   ├── [Only once] atp_scrape_atptour.py      # Initial ATP scrape
│   ├── [Only once] atp_fix_player_images.py   # Fix ATP images
│   ├── [Only once] atp_player_grandslam.py    # ATP Grand Slam data
│   ├── [Only once] wta_scrape_wtatennis.py    # Initial WTA scrape
│   ├── [Only once] wta_fix_player_images.py   # Fix WTA images
│   ├── atp_live_rankings_to_csv.py    # Update ATP rankings CSV
│   ├── wta_live_rankings_to_csv.py    # Update WTA rankings CSV
│   ├── atp_tournaments_to_json.py     # Update ATP tournaments
│   ├── wta_tournaments_to_json.py     # Update WTA tournaments
│   ├── atp_return_serve_stats_to_csv.py  # ATP stats export
│   ├── wta_return_serve_stats_to_csv.py  # WTA stats export
│   └── standalone_wta_h2h_stats.py    # Standalone H2H generator
│
├── Images/                            # README screenshots
│   └── intro gifs/                    # Update UI backgrounds
│
├── start.sh                           # Quick start script
├── start_local.sh                     # Alternative startup
├── README.md                          # This file
├── LICENSE                            # MIT License
└── .gitignore                         # Git ignore rules
```

---

## 🔄 Data Management

### 🔴 Live Data Updates

Scripts that fetch real-time match data from official tour websites:

- `[Live] atp/wta_live_matches.py` — Current ongoing matches
- `[Live] atp/wta_recent_matches.py` — Recently completed matches
- `[Live] atp/wta_upcoming_matches.py` — Scheduled future matches
- `[Live] atp_match_stats.py` — Detailed match statistics

### 📊 Player Database Updates

- `[Update] Atp_player_stats.py` — Update ATP player profiles & stats
- `[Update] Wta_player_stats.py` — Update WTA player profiles & stats
  - *⚠️ Requires Playwright + Chromium installation*

### 🎯 Initial Setup (One-Time)

- `[Only once] atp/wta_scrape_*.py` — Initial player database population
- `[Only once] atp/wta_fix_player_images.py` — Validate/fix player images

### 🛠️ Utility Scripts

- `atp/wta_live_rankings_to_csv.py` — Update rankings cache
- `atp/wta_tournaments_to_json.py` — Update tournament calendar
- `standalone_wta_h2h_stats.py` — Generate H2H analytics

> **📝 Note:** Some scripts require additional packages beyond runtime dependencies.
> Run `pip install playwright && playwright install chromium` for browser automation scripts.

---

## 🌍 Deployment

### Render.com (Current)

The app is deployed on [Render.com](https://render.com) with auto-deploy from GitHub.

**Configuration:**

- **Runtime:** Python 3.11
- **Build Command:** `pip install -r backend/requirements.txt && playwright install chromium`
- **Start Command:** `cd backend && gunicorn --worker-class gevent -w 1 --bind 0.0.0.0:$PORT app:app`
- **Auto-Deploy:** Enabled on `main` branch pushes

### Heroku/Railway Compatible

Use the included `Procfile` for Heroku or Railway deployment:

```bash
git push heroku main
# or
railway up
```

### Environment Variables

Create a `.env` file in the `backend/` directory for local development:

```bash
HOST=0.0.0.0
PORT=5001
DEBUG=False
```

---

## 🎯 Key Features Explained

### 📈 Match Prediction Algorithm

The upcoming match predictions use a multi-factor algorithm:

- 🏅 Recent form (last 5-10 matches)
- ⚔️ Head-to-head history
- 🎾 Surface-specific performance
- 📊 Current ranking momentum
- 🏆 Tournament category weighting

### ⭐ Favourites System

The favourites panel provides quick access to your tracked players:

- **Slide-in panel** from the right side (360px width)
- **Per-tour storage** — ATP and WTA favourites are maintained separately
- **Search autocomplete** — reuses the H2H search API for fast player lookup
- **Live detection** — checks `AppState.liveScores` to identify live players
- **Icon glow** — the star button pulses amber when any favourite is currently playing
- **Red blink** — individual player rows blink red if they're in a live match
- **Player images** — served from local `data/<tour>/<folder>/image.jpg` via backend API
- **Persistent** — stored in `localStorage` under `rallycourt_favourites`

### 🔄 System Update UI

Access via `/update.html` or the dashboard update button:

- ✅ **Step 1:** Select tour (ATP/WTA/Both)
- 🔍 **Step 2:** Preview available updates
- 🎯 **Step 3:** Select specific updates (with Grand Slam auto-selection)
- 📊 **Step 4:** Real-time progress monitoring with color-coded logs

### 🎨 UI/UX Features

- 🌓 Dark theme optimized for extended viewing
- 📱 Responsive design for mobile/tablet/desktop
- ⚡ Real-time updates via WebSocket with polling fallback
- 🎯 Smart caching for fast load times
- 🔍 Instant search with autocomplete
- 🏳️ Country flag emoji support (40+ countries)

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🍴 **Fork the repository**
2. 🌿 **Create a feature branch**

```bash
git checkout -b feature/AmazingFeature
```

3. 💾 **Commit your changes**

```bash
git commit -m "Add some AmazingFeature"
```

4. 📤 **Push to the branch**

```bash
git push origin feature/AmazingFeature
```

5. 🎉 **Open a Pull Request**

### Development Guidelines

- ✅ Follow existing code style and structure
- 📝 Update README if adding new features
- 🧪 Test locally before submitting PR
- 💬 Provide clear commit messages

---

## 📋 Requirements

### Backend Dependencies

- Python 3.11+
- Flask 3.0.0
- Flask-SocketIO 5.3.6
- BeautifulSoup4 4.12.2
- Requests 2.31.0
- lxml 5.3.0
- Playwright 1.58.0 *(for WTA scraping)*
- Gunicorn 21.2.0 *(production)*
- Gevent 24.2.1 *(production)*

### Frontend Dependencies

- Modern web browser (Chrome/Firefox/Safari/Edge)
- JavaScript enabled
- Chart.js 3.x *(included in vendor/)*

---

## 🎓 Data Sources

This project uses **public web sources only**:

- 🌐 Official ATP Tour website
- 🌐 Official WTA Tennis website
- 🌐 Public tournament draws and schedules
- 🌐 Freely available match statistics

**No paid APIs or subscriptions required!** 🎉

---

## 📌 Roadmap

### Completed ✅

- ~~ATP H2H analytics~~ — Done
- ~~Favourites system with live detection~~ — Done
- ~~Player stats cards with "not available" fallback~~ — Done

### Planned

- 🔔 Match notification system
- 📊 Extended historical data (multi-year)
- 📱 Progressive Web App (PWA) support
- 🌐 Multi-language support
- 📈 Advanced analytics dashboard
- 📅 Favourite player schedule view
- 🤖 Machine learning prediction models

---

## 🐛 Known Issues

- WTA player images may occasionally fail to load (run fix script)
- Some historical H2H data may be incomplete
- Playwright requires significant memory for browser automation

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

Created with ❤️ for tennis fans worldwide 🎾

---

## 🙏 Acknowledgments

- 🎾 ATP Tour and WTA Tennis for public data
- 📊 Chart.js for beautiful radar charts
- 🎨 Tennis GIF creators for update UI backgrounds
- 🌐 Open-source community for amazing tools

---

**⭐ Star this repo if you find it useful! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/maninka123/Tennis-tour-dashboard?style=social)](https://github.com/maninka123/Tennis-tour-dashboard/stargazers) [![GitHub forks](https://img.shields.io/github/forks/maninka123/Tennis-tour-dashboard?style=social)](https://github.com/maninka123/Tennis-tour-dashboard/network/members)

Made with 🎾 and ☕ | © 2026 Tennis Dashboard

---

### 📸 Image Gallery

| Screenshot | Description |
|------------|-------------|
| ![Loading intro page](Images/loading%20intro.png) | Loading intro page with animated GIF grid background |
| ![Main interface](Images/Interface_Live%20results_recent%20scores_upcoming%20matches.png) | Main interface with live scores, recent results, and upcoming match insights |
| ![Rankings and calendar](Images/Live%20Rankings%20and%20calender.png) | Rankings panel and tournament calendar with surface filters |
| ![Match insights](Images/Upcoming%20match%20insights.png) | Upcoming match insights with win probability and form notes |
| ![Statistics table](Images/stat%20table.png) | Detailed match statistics table with serve and return metrics |
| ![Player stats overview](Images/Player_stats_1.png) | Player stats comparison overview |
| ![Player stats details](Images/Player_stats_2.png) | Detailed serve and return breakdowns |
| ![H2H overview](Images/H2H_1.png) | Head-to-head overview with radar charts |
| ![H2H details](Images/H2H_2.png) | Past meetings and surface records |

---