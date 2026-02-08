---

## 📸 Image Gallery

<img src="Images/Interface_Live%20results_recent%20scores_upcoming%20matches.png" alt="Main interface" width="900" />

Main interface with live scores, recent results, and upcoming match insights.

<img src="Images/Live%20Rankings%20and%20calender.png" alt="Rankings and calendar" width="900" />

Rankings panel and tournament calendar with surface filters.

<img src="Images/Upcoming%20match%20insights.png" alt="Match insights" width="900" />

Upcoming match insights with win probability and form notes.

<img src="Images/Player_stats_1.png" alt="Player stats overview" width="900" />

Player stats comparison overview.

<img src="Images/Player_stats_2.png" alt="Player stats details" width="900" />

Detailed serve and return breakdowns.

<img src="Images/H2H_1.png" alt="H2H overview" width="900" />

Head-to-head overview with radar charts.

<img src="Images/H2H_2.png" alt="H2H details" width="900" />

Past meetings and surface records.

---

<div align="center">

# 🎾 Tennis Live Dashboard

**Real-time ATP & WTA Tennis Tracking for 2026 Season**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://tennis-tour-dashboard.onrender.com)

*Your all-in-one tennis companion for live scores, rankings, tournament insights, and head-to-head analytics*

</div>

---

## ✨ Features

### 🔴 Live Match Tracking
- **Real-time scores** with current game points and serving indicators
- **Live match statistics** with detailed player comparison popups
- Auto-refreshing data for up-to-the-minute updates

### 📊 Comprehensive Match Coverage
- **Recent Results**: Completed matches with clickable stat breakdowns
- **Upcoming Matches**: Next 48 hours with AI-powered predictions
  - 🎯 Win-edge percentages for both players
  - 📈 H2H snapshot and historical data
  - 💡 Form & momentum insights
  - 🧠 Smart prediction algorithms

### 🏆 Rankings & Tournament Data
- **Live ATP/WTA Rankings** with real-time updates
- **Tournament Calendar** with surface and category filters
- **Interactive Draw Brackets** for ongoing tournaments
- **Player Profiles** with detailed statistics and records

### 🎯 Advanced H2H Analytics
- **Player Search** with autocomplete (500+ WTA players)
- **Career H2H Summary** with win/loss records
- **Interactive Radar Charts** comparing serve/return stats
- **Surface Performance** breakdown (Hard/Clay/Grass)
- **Past Meetings** with detailed set-by-set scores

### 🔄 System Update Management
- **Dedicated Update UI** with real-time progress tracking
- **Color-coded logs** for easy monitoring
- **Time estimation** for update completion
- **GIF grid background** for visual appeal
- **Auto-selection** of Grand Slam tournaments

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
- ![Flask](https://img.shields.io/badge/-Flask-000000?logo=flask&logoColor=white) **Flask 3.0.0** - Web framework
- ![SocketIO](https://img.shields.io/badge/-SocketIO-010101?logo=socket.io&logoColor=white) **Flask-SocketIO** - Real-time updates
- ![Gunicorn](https://img.shields.io/badge/-Gunicorn-499848?logo=gunicorn&logoColor=white) **Gunicorn** - Production server
- ![BeautifulSoup](https://img.shields.io/badge/-BeautifulSoup-43B02A?logo=python&logoColor=white) **BeautifulSoup4** - Web scraping
- ![Playwright](https://img.shields.io/badge/-Playwright-2EAD33?logo=playwright&logoColor=white) **Playwright** - Browser automation

### Frontend
- ![HTML5](https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white) **HTML5**
- ![CSS3](https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white) **CSS3** with custom animations
- ![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black) **Vanilla JavaScript**
- ![Chart.js](https://img.shields.io/badge/-Chart.js-FF6384?logo=chart.js&logoColor=white) **Chart.js** - Radar charts

### Deployment
- ![Render](https://img.shields.io/badge/-Render-46E3B7?logo=render&logoColor=white) **Render.com** - Cloud hosting
- ![GitHub](https://img.shields.io/badge/-GitHub-181717?logo=github&logoColor=white) **GitHub Actions** - CI/CD
- ![Git](https://img.shields.io/badge/-Git-F05032?logo=git&logoColor=white) **Git** - Version control

---

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check ✅ |
| `GET` | `/api/live-scores?tour=atp\|wta\|both` | Live match scores 🔴 |
| `GET` | `/api/recent-matches?tour=...&limit=...` | Recently completed matches 📋 |
| `GET` | `/api/upcoming-matches?tour=...&days=7` | Upcoming matches with predictions 🎯 |

### Rankings & Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rankings/<tour>?limit=...` | ATP/WTA rankings 🏆 |
| `GET` | `/api/rankings/wta/status` | WTA rankings cache status ⏰ |
| `POST` | `/api/rankings/wta/refresh` | Force refresh WTA rankings 🔄 |
| `GET` | `/api/player/<id>` | Player profile & stats 👤 |

### Tournaments & Brackets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tournaments/<tour>` | Tournament calendar 📅 |
| `GET` | `/api/tournament/<id>/bracket?tour=...` | Tournament draw bracket 🌳 |

### Head-to-Head Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/h2h/wta/search?query=...&limit=...` | Search WTA players 🔍 |
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
├── 🔧 backend/                      # Flask API Server
│   ├── app.py                       # Main application & routes
│   ├── tennis_api.py                # API logic & data processing
│   ├── config.py                    # Configuration settings
│   ├── requirements.txt             # Python dependencies
│   └── venv/                        # Virtual environment
│
├── 🎨 frontend/                     # Web Interface
│   ├── index.html                   # Main dashboard page
│   ├── update.html                  # System update page
│   │
│   ├── css/                         # Stylesheets
│   │   ├── styles.css               # Main styles
│   │   ├── update-page.css          # Update UI styles
│   │   └── dark-theme.css           # Dark mode theme
│   │
│   ├── js/                          # JavaScript modules
│   │   ├── config.js                # Environment configuration
│   │   ├── app.js                   # Main app controller
│   │   ├── scores.js                # Live scores module
│   │   ├── rankings.js              # Rankings display
│   │   ├── tournaments.js           # Tournament calendar
│   │   ├── bracket.js               # Draw bracket viewer
│   │   ├── h2h.js                   # H2H analytics
│   │   └── update-page.js           # System update UI
│   │
│   ├── assets/                      # Images & media
│   └── vendor/                      # Third-party libraries
│
├── 📊 data/                         # Player & Match Data
│   ├── atp/                         # ATP player profiles
│   │   ├── 001_carlos-alcaraz/
│   │   ├── 002_jannik-sinner/
│   │   └── ...
│   │
│   ├── wta/                         # WTA player profiles
│   │   ├── 001_aryna-sabalenka/
│   │   └── ...
│   │
│   ├── atp_stats/                   # ATP statistics
│   ├── wta_stats/                   # WTA statistics
│   ├── atp_live_ranking.csv         # ATP rankings cache
│   ├── wta_live_ranking.csv         # WTA rankings cache
│   └── wta_player_connections.json  # WTA player search index
│
├── 🔨 scripts/                      # Data Management Scripts
│   │
│   ├── 🔴 Live Data Scripts
│   │   ├── [Live] atp_live_matches.py
│   │   ├── [Live] atp_match_stats.py
│   │   ├── [Live] atp_recent_matches.py
│   │   ├── [Live] atp_upcoming_matches.py
│   │   ├── [Live] wta_live_matches.py
│   │   ├── [Live] wta_recent_matches.py
│   │   └── [Live] wta_upcoming_matches.py
│   │
│   ├── 🔄 Update Scripts
│   │   ├── [Update] Atp_player_stats.py
│   │   └── [Update] Wta_player_stats.py
│   │
│   ├── 🎯 Initial Setup Scripts
│   │   ├── [Only once] atp_scrape_atptour.py
│   │   ├── [Only once] atp_fix_player_images.py
│   │   ├── [Only once] wta_scrape_wtatennis.py
│   │   └── [Only once] wta_fix_player_images.py
│   │
│   └── 🛠️ Utility Scripts
│       ├── atp_live_rankings_to_csv.py
│       ├── wta_live_rankings_to_csv.py
│       ├── atp_tournaments_to_json.py
│       ├── wta_tournaments_to_json.py
│       └── standalone_wta_h2h_stats.py
│
├── 🖼️ Images/                       # README screenshots
│   └── intro gifs/                  # Update UI backgrounds
│
├── 🚀 Deployment Files
│   ├── render.yaml                  # Render.com config
│   ├── Procfile                     # Heroku/Railway config
│   ├── start.sh                     # Local startup script
│   └── start_local.sh               # Alternative startup
│
├── 📄 Documentation
│   ├── README.md                    # This file
│   ├── LICENSE                      # MIT License
│   └── .gitignore                   # Git ignore rules
│
└── 🔒 Configuration
    └── .env                         # Environment variables (create locally)
```

---

## 🔄 Data Management

### 🔴 Live Data Updates
Scripts that fetch real-time match data from official tour websites:
- `[Live] atp/wta_live_matches.py` - Current ongoing matches
- `[Live] atp/wta_recent_matches.py` - Recently completed matches  
- `[Live] atp/wta_upcoming_matches.py` - Scheduled future matches
- `[Live] atp_match_stats.py` - Detailed match statistics

### 📊 Player Database Updates
- `[Update] Atp_player_stats.py` - Update ATP player profiles & stats
- `[Update] Wta_player_stats.py` - Update WTA player profiles & stats
  - *⚠️ Requires Playwright + Chromium installation*

### 🎯 Initial Setup (One-Time)
- `[Only once] atp/wta_scrape_*.py` - Initial player database population
- `[Only once] atp/wta_fix_player_images.py` - Validate/fix player images

### 🛠️ Utility Scripts
- `atp/wta_live_rankings_to_csv.py` - Update rankings cache
- `atp/wta_tournaments_to_json.py` - Update tournament calendar
- `standalone_wta_h2h_stats.py` - Generate H2H analytics

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

### 🔄 System Update UI
Access via `/update.html` or the dashboard update button:
- ✅ **Step 1:** Select tour (ATP/WTA/Both)
- 🔍 **Step 2:** Preview available updates
- 🎯 **Step 3:** Select specific updates (with Grand Slam auto-selection)
- 📊 **Step 4:** Real-time progress monitoring with color-coded logs

### 🎨 UI/UX Features
- 🌓 Dark theme optimized for extended viewing
- 📱 Responsive design for mobile/tablet/desktop
- ⚡ Real-time updates without page refresh
- 🎯 Smart caching for fast load times
- 🔍 Instant search with autocomplete

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
- Chart.js 3.x *(included)*

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

### Planned Features
- [ ] 🔔 Match notification system
- [ ] 📊 Extended historical data (multi-year)
- [ ] 🎾 ATP H2H analytics (currently WTA only)
- [ ] 📱 Progressive Web App (PWA) support
- [ ] 🌐 Multi-language support
- [ ] 📈 Advanced analytics dashboard
- [ ] 🤖 Machine learning prediction models
- [ ] 📺 Video highlights integration

---

## 🐛 Known Issues

- WTA player images may occasionally fail to load (run fix script)
- Some historical H2H data may be incomplete
- Playwright requires significant memory for browser automation

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

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

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/maninka123/Tennis-tour-dashboard?style=social)](https://github.com/maninka123/Tennis-tour-dashboard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/maninka123/Tennis-tour-dashboard?style=social)](https://github.com/maninka123/Tennis-tour-dashboard/network/members)

Made with 🎾 and ☕ | © 2026 Tennis Dashboard

</div>
