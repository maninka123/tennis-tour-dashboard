# 🎾 Tennis Live Dashboard

**Real-time ATP & WTA Tennis Tracking for 2026 Season**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/) [![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/) [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://tennis-tour-dashboard.onrender.com)

*Your all-in-one tennis companion for live scores, rankings, tournament insights, and head-to-head analytics*

---

## ✨ Features

### 🔴 Live Match Tracking

-   Real-time scores with server and game-point indicators
-   Live stat comparison popups with WebSocket + polling refresh

### 📊 Match Coverage

-   Recent results with quick stat breakdowns
-   Upcoming 48-hour matches with win-edge, H2H, and form insights

### 🏆 Rankings & Tournaments

-   Live ATP/WTA rankings with point updates
-   Filterable tournament calendar, draw brackets, and player cards

### 🎯 Advanced H2H Analytics

-   ATP and WTA head-to-head support with fast search
-   Career summary, surface splits, set-by-set history, and radar comparison

### 👤 Player Profiles

-   Bio, season/career stats, and recent match history
-   Serve/return and Slam breakdowns with clean fallback UI

### 📈 Data Analysis Dashboard

-   Historical ATP/WTA trend analysis workspace
-   Player Explorer: surface matrix, Elo trajectory, calendar heatmap, and style clustering
-   Tournament Explorer: champions/finals insights with full-results drill-down
-   Records Book: expandable holders with contextual metrics
-   Interactive Plotly charts with hover details and export tools

### 🔔 Smart Notification System

-   **Multi-Channel Delivery**: Email, Discord, Telegram, and in-app web push
-   **14 Event Types**: Upcoming matches, results, upsets, ranking milestones, live updates, and more
-   **Intelligent Filtering**: Tour selection, tournament categories, player tracking, surface specificity
-   **Advanced Scheduling**: Quiet hours, cooldown periods, and multiple rules per account
-   **Real-time Monitoring**: Automatic polling with configurable intervals (default: 5 minutes)
-   **Automatic Deduplication**: Prevents duplicate alerts for the same event
-   **Beautiful Email Templates**: Branded HTML emails with player photos and match details
-   **Event Types Include**:
    -   Upcoming Match & Match Result alerts
    -   Tournament Completions & Player Round Progressions
    -   Live Match Updates & Set Completions
    -   Upset Alerts (rank-based)
    -   Ranking Milestones (Top 10, Top 20, etc.)
    -   Tournament Stage Reminders
    -   Time Window Schedule Alerts

### 🔄 System Update Management

-   Dedicated update UI with real-time progress and color-coded logs
-   ATP/WTA/Both update flow with preview support
-   Runs automatically every week (approximately 30 minutes per update)

---

## 🚀 Quick Start

### 🌐 Live Demo

Visit the live deployment: **[tennis-tour-dashboard.onrender.com](https://tennis-tour-dashboard.onrender.com)**

### 💻 Local Development

#### Option A: Quick Start Script

**For macOS/Linux/Ubuntu:**

```bash
./start.sh
```

**For Windows (using Git Bash or WSL):**

```bash
bash start.sh
```

-   🌐 Frontend: `http://localhost:8080`
-   🔧 Backend API: `http://localhost:5001`

#### Option B: Manual Setup

**Backend:**

```bash
cd backendpython3 -m venv venvsource venv/bin/activate  # On Windows: venvScriptsactivatepip install -r requirements.txtpython app.py
```

**Frontend** (separate terminal):

```bash
cd frontend
python3 no_cache_server.py
```

---

## 🛠️ Technologies Used

### Backend

-   ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white) **Python 3.11+**
-   ![Flask](https://img.shields.io/badge/-Flask-000000?logo=flask&logoColor=white) **Flask 3.0.0** — Web framework
-   ![SocketIO](https://img.shields.io/badge/-SocketIO-010101?logo=socket.io&logoColor=white) **Flask-SocketIO** — Real-time updates
-   ![Gunicorn](https://img.shields.io/badge/-Gunicorn-499848?logo=gunicorn&logoColor=white) **Gunicorn** — Production server
-   ![BeautifulSoup](https://img.shields.io/badge/-BeautifulSoup-43B02A?logo=python&logoColor=white) **BeautifulSoup4** — Web scraping
-   ![Playwright](https://img.shields.io/badge/-Playwright-2EAD33?logo=playwright&logoColor=white) **Playwright** — Browser automation

### Frontend

-   ![HTML5](https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white) **HTML5**
-   ![CSS3](https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white) **CSS3** with custom animations
-   ![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black) **Vanilla JavaScript** (modular architecture)
-   ![Chart.js](https://img.shields.io/badge/-Chart.js-FF6384?logo=chart.js&logoColor=white) **Chart.js** — Radar charts

### Deployment

-   ![Render](https://img.shields.io/badge/-Render-46E3B7?logo=render&logoColor=white) **Render.com** — Cloud hosting
-   ![GitHub](https://img.shields.io/badge/-GitHub-181717?logo=github&logoColor=white) **GitHub** — Version control & CI/CD

---

## 📡 API Endpoints

### Core Endpoints

Method

Endpoint

Description

`GET`

`/api/health`

Health check ✅

`GET`

`/api/live-scores?tour=atp|wta|both`

Live match scores 🔴

`GET`

`/api/recent-matches?tour=...&limit=...`

Recently completed matches 📋

`GET`

`/api/upcoming-matches?tour=...&days=7`

Upcoming matches with predictions 🎯

`GET`

`/api/intro-gifs`

Loading page GIF list 🖼️

### Rankings & Players

Method

Endpoint

Description

`GET`

`/api/rankings/<tour>?limit=...`

ATP/WTA rankings 🏆

`GET`

`/api/rankings/wta/status`

WTA rankings cache status ⏰

`POST`

`/api/rankings/wta/refresh`

Force refresh WTA rankings 🔄

`GET`

`/api/player/<id>`

Player profile & stats 👤

`GET`

`/api/player/<tour>/<player_id>/image`

Player image (local or redirect) 📸

### Tournaments & Brackets

Method

Endpoint

Description

`GET`

`/api/tournaments/<tour>`

Tournament calendar 📅

`GET`

`/api/tournament/<id>/bracket?tour=...`

Tournament draw bracket 🌳

### Head-to-Head Analytics

Method

Endpoint

Description

`GET`

`/api/h2h/atp/search?query=...&limit=...`

Search ATP players 🔍

`GET`

`/api/h2h/wta/search?query=...&limit=...`

Search WTA players 🔍

`GET`

`/api/h2h/atp?player1_id=...&player2_id=...`

ATP H2H analysis ⚔️

`GET`

`/api/h2h/wta?player1_id=...&player2_id=...&year=2026&meetings=5`

WTA H2H analysis ⚔️

### System Management

Method

Endpoint

Description

`POST`

`/api/system/update`

Trigger player data update 🔄

`GET`

`/api/system/update/status`

Get update progress status 📊

`GET`

`/api/system/update/preview`

Preview available updates 👀

### 🔔 Notification System Endpoints

*Note: Notification system runs on separate port (default: `http://localhost:5090`)*

Method

Endpoint

Description

`GET`

`/api/config`

Get notification system config & email ⚙️

`POST`

`/api/config`

Update notification system config 📝

`GET`

`/api/rules`

List all notification rules 📋

`POST`

`/api/rules`

Create a new notification rule ✨

`PUT`

`/api/rules/<id>`

Update an existing rule 🔧

`DELETE`

`/api/rules/<id>`

Delete a rule 🗑️

`POST`

`/api/run-now`

Manually trigger rule evaluation 🚀

`POST`

`/api/test-email`

Send a test email to configured address 📧

`GET`

`/api/history`

Get notification history & logs 📜

`POST`

`/api/history/clear`

Clear notification history 🔄

`GET`

`/api/options`

Get available players & tournaments 🔍

---

## 📁 Project Structure

```
Tennis-Dashboard/│├── backend/                           # Flask API Server│   ├── app.py                         # Main application & routes│   ├── tennis_api.py                  # API logic & data processing│   ├── config.py                      # Configuration settings│   ├── requirements.txt               # Python dependencies│   ├── venv/                          # Virtual environment│   ││   └── notification_system/           # 🔔 Smart Notification Service│       ├── app.py                     # Notification Flask app & API│       ├── requirements.txt           # Notification dependencies│       ├── .env                       # SMTP & integration credentials│       ├── README.md                  # Detailed notification docs│       ├── storage/│       │   └── subscriptions.json     # Rule storage & history│       ├── templates/│       │   └── index.html             # Notification control panel│       └── static/│           ├── app.js                 # Notification UI logic│           └── styles.css             # Notification panel styles│├── frontend/                          # Web Interface│   ├── index.html                     # Main dashboard page│   ├── update.html                    # System update page│   ├── no_cache_server.py             # Dev server (port 8080)│   ││   ├── css/│   │   ├── styles.css                 # Main styles + favourites panel│   │   ├── update-page.css            # Update page styles│   │   └── update-modal.css           # Update modal styles│   ││   ├── js/│   │   ├── config.js                  # Environment config (API URL)│   │   ├── app.js                     # Main controller, Utils, API│   │   ├── scores.js                  # Live/recent/upcoming scores│   │   ├── rankings.js                # Rankings display│   │   ├── tournaments.js             # Tournament calendar│   │   ├── bracket.js                 # Draw bracket viewer│   │   ├── h2h.js                     # H2H analytics│   │   ├── player.js                  # Player stats cards│   │   ├── favourites.js              # ⭐ Favourites panel module│   │   ├── stats-zone.js              # Stats zone features│   │   ├── data-update.js             # Data update integration│   │   ├── loading-intro-gifs.js      # Intro loading animation│   │   ├── prediction_wta_upcoming.js # WTA prediction logic│   │   └── update-page.js            # System update UI│   ││   ├── assets/                        # Images & media│   └── vendor/                        # Third-party libraries (Chart.js)│├── data/                              # Player & Match Data│   ├── atp/                           # ATP player folders│   │   ├── 001_carlos-alcaraz/        #   profile.json, image.jpg, stats│   │   ├── 002_jannik-sinner/│   │   └── ...                        #   (200+ players)│   ││   ├── wta/                           # WTA player folders│   │   ├── 001_aryna-sabalenka/│   │   └── ...                        #   (400+ players)│   ││   ├── atp_stats/                     # ATP serve/return statistics│   ├── wta_stats/                     # WTA serve/return statistics│   ├── atp_live_ranking.csv           # ATP rankings cache│   ├── wta_live_ranking.csv           # WTA rankings cache│   └── wta_player_connections.json    # WTA player search index│├── scripts/                           # Data Management Scripts│   ├── [Live] atp_live_matches.py     # Fetch live ATP scores│   ├── [Live] atp_match_stats.py      # Fetch live match stats│   ├── [Live] atp_recent_matches.py   # Fetch recent ATP results│   ├── [Live] atp_upcoming_matches.py # Fetch upcoming ATP matches│   ├── [Live] wta_live_matches.py     # Fetch live WTA scores│   ├── [Live] wta_recent_matches.py   # Fetch recent WTA results│   ├── [Live] wta_upcoming_matches.py # Fetch upcoming WTA matches│   ├── [Update] Atp_player_stats.py   # Update ATP player profiles│   ├── [Update] Wta_player_stats.py   # Update WTA player profiles│   ├── [Only once] atp_scrape_atptour.py      # Initial ATP scrape│   ├── [Only once] atp_fix_player_images.py   # Fix ATP images│   ├── [Only once] atp_player_grandslam.py    # ATP Grand Slam data│   ├── [Only once] wta_scrape_wtatennis.py    # Initial WTA scrape│   ├── [Only once] wta_fix_player_images.py   # Fix WTA images│   ├── atp_live_rankings_to_csv.py    # Update ATP rankings CSV│   ├── wta_live_rankings_to_csv.py    # Update WTA rankings CSV│   ├── atp_tournaments_to_json.py     # Update ATP tournaments│   ├── wta_tournaments_to_json.py     # Update WTA tournaments│   ├── atp_return_serve_stats_to_csv.py  # ATP stats export│   ├── wta_return_serve_stats_to_csv.py  # WTA stats export│   └── standalone_wta_h2h_stats.py    # Standalone H2H generator│├── Images/                            # README screenshots│   └── intro gifs/                    # Update UI backgrounds│├── start.sh                           # Quick start script├── start_local.sh                     # Alternative startup├── README.md                          # This file├── LICENSE                            # MIT License└── .gitignore                         # Git ignore rules
```

---

## 🔄 Data Management

### 🔴 Live Data Updates

Scripts that fetch real-time match data from official tour websites:

-   `[Live] atp/wta_live_matches.py` — Current ongoing matches
-   `[Live] atp/wta_recent_matches.py` — Recently completed matches
-   `[Live] atp/wta_upcoming_matches.py` — Scheduled future matches
-   `[Live] atp_match_stats.py` — Detailed match statistics

### 📊 Player Database Updates

-   `[Update] Atp_player_stats.py` — Update ATP player profiles & stats
-   `[Update] Wta_player_stats.py` — Update WTA player profiles & stats
    -   *⚠️ Requires Playwright + Chromium installation*

### 🎯 Initial Setup (One-Time)

-   `[Only once] atp/wta_scrape_*.py` — Initial player database population
-   `[Only once] atp/wta_fix_player_images.py` — Validate/fix player images

### 🛠️ Utility Scripts

-   `atp/wta_live_rankings_to_csv.py` — Update rankings cache
-   `atp/wta_tournaments_to_json.py` — Update tournament calendar
-   `standalone_wta_h2h_stats.py` — Generate H2H analytics

> **📝 Note:** Some scripts require additional packages beyond runtime dependencies.Run `pip install playwright && playwright install chromium` for browser automation scripts.

---

## 🌍 Deployment

### Render.com (Current)

The app is deployed on [Render.com](https://render.com) with auto-deploy from GitHub.

**Configuration:**

-   **Runtime:** Python 3.11
-   **Build Command:** `pip install -r backend/requirements.txt && playwright install chromium`
-   **Start Command:** `cd backend && gunicorn --worker-class gevent -w 1 --bind 0.0.0.0:$PORT app:app`
-   **Auto-Deploy:** Enabled on `main` branch pushes

### Heroku/Railway Compatible

Use the included `Procfile` for Heroku or Railway deployment:

```bash
git push heroku main# orrailway up
```

### Environment Variables

Create a `.env` file in the `backend/` directory for local development:

```bash
HOST=0.0.0.0PORT=5001DEBUG=False
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1.  🍴 **Fork the repository**
2.  🌿 **Create a feature branch**

```bash
git checkout -b feature/AmazingFeature
```

3.  💾 **Commit your changes**

```bash
git commit -m "Add some AmazingFeature"
```

4.  📤 **Push to the branch**

```bash
git push origin feature/AmazingFeature
```

5.  🎉 **Open a Pull Request**

### Development Guidelines

-   ✅ Follow existing code style and structure
-   📝 Update README if adding new features
-   🧪 Test locally before submitting PR
-   💬 Provide clear commit messages

---

## 🎓 Data Sources

This project uses **public web sources only**:

-   🌐 Official ATP Tour website
-   🌐 Official WTA Tennis website
-   🌐 Public tournament draws and schedules
-   🌐 Freely available match statistics

**No paid APIs or subscriptions required!** 🎉

---

## 📌 Roadmap

### Completed ✅

-   ATP H2H analytics — Done
-   Favourites system with live detection — Done
-   Player stats cards with "not available" fallback — Done
-   Smart Notification System (14 event types, multi-channel, advanced filtering) — Done ✨

### Planned

-   📊 Extended historical data (multi-year)
-   📱 Progressive Web App (PWA) support
-   🌐 Multi-language support
-   📈 Advanced analytics dashboard
-   📅 Favourite player schedule view
-   🤖 Machine learning prediction models

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

Built by a tennis and tech enthusiast focused on practical, data-driven sports tools.

---

## 🙏 Acknowledgments

-   🎾 ATP Tour and WTA Tennis for public data
-   📊 Chart.js for beautiful radar charts
-   🎨 Tennis GIF creators for update UI backgrounds
-   🌐 Open-source community for amazing tools

---

**⭐ Star this repo if you find it useful! ⭐**

[![GitHub stars](https://img.shields.io/github/stars/maninka123/Tennis-tour-dashboard?style=social)](https://github.com/maninka123/Tennis-tour-dashboard/stargazers) [![GitHub forks](https://img.shields.io/github/forks/maninka123/Tennis-tour-dashboard?style=social)](https://github.com/maninka123/Tennis-tour-dashboard/network/members)

Made with 🎾 and ☕ | © 2026 Tennis Dashboard

---

### 📸 Previous Images

Title

Preview

Loading Intro

![Loading intro page](Images/loading%20intro.png)

Main Interface

![Main interface](Images/Interface_Live%20results_recent%20scores_upcoming%20matches.png)

Main Interface (Alternative View)

![Alternative interface](Images/Interface_Live%20results_recent%20scores_upcoming%20matches%202.png)

Upcoming Match Insights

![Upcoming match insights](Images/Upcoming%20match%20insights.png)

Live Rankings and Calendar

![Live rankings and calendar](Images/Live%20Rankings%20and%20calender.png)

Favourites Panel

![Favourites panel](Images/Favourite%20panel.png)

H2H Analytics View 1

![H2H view 1](Images/H2H_1.png)

H2H Analytics View 2

![H2H view 2](Images/H2H_2.png)

Player Stats Card 1

![Player stats 1](Images/Player_stats_1.png)

Player Stats Card 2

![Player stats 2](Images/Player_stats_2.png)

Serving Stats Index

![Serving stat index](Images/Serving%20stat%20index.png)

Stats Table

![Stats table](Images/stat%20table.png)

---

## 📊 Data Analysis Dashboard

The project also includes a dedicated historical analysis app under `data_analysis/` for ATP and WTA.

-   Player Explorer with deep profile metrics and trend charts
-   Tournament Explorer with clickable details, champions, and recent finals
-   Records Book with expandable record-holder context
-   Interactive analytics including surface matrices, clustering, form, and Elo-style trajectories

### 📸 Data Analysis Images

Title

Preview

Player Analysis

![Analysis player](Images/Analysis_player.png)

Player Analysis - Additional View

![Analysis player 2](Images/Analysis_player%202.png)

Player Analysis - Advanced Metrics

![Analysis player 3](Images/Analysis_player%203.png)

Player Match History

![Analysis player matches](Images/Analysis_player%20Matches.png)

Ranking Points Analysis

![Analysis ranking points](Images/Analysis_ranking_points.png)

Tournament Analysis

![Analysis tournament](Images/Analyis_Tournament.png)

Record Book Analysis

![Analysis record book](Images/Analysis_Record%20book.png)

---

## 🔔 Notification System Interface

The project includes a comprehensive notification management system with a dedicated control panel.

-   Create and manage custom notification rules
-   Configure multi-channel delivery (Email, Discord, Telegram)
-   Set up advanced filters and scheduling
-   View notification history and logs

### 📸 Notification System Images

Title

Preview

Notification Control Panel

![Notification system](Images/Nortification%20system.png)

Notification Rules & Settings

![Notification system 2](Images/Nortification%20system%202.png)

---