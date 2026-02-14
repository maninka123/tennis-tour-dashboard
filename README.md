# 🎾 Tennis Live Dashboard

**Real-time ATP & WTA Tennis Tracking for the 2026 Season**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://tennis-tour-dashboard.onrender.com)

*Your all-in-one tennis companion for live scores, rankings, tournament insights, player analytics, and smart notifications.*

---

## ✨ Features

### 🔴 Live Match Tracking
- Real-time ATP/WTA live scores with server/game-point context.
- Auto-refresh via SocketIO with polling fallback.

### 📊 Match Coverage
- Recently finished matches with quick stat breakdowns.
- Upcoming matches (next 2 days) with H2H/prediction insights.

### 🏆 Rankings & Tournaments
- ATP/WTA rankings with update status and refresh actions.
- Tournament calendar + bracket viewer with round points/prize context.

### ⚔️ H2H Analytics
- ATP and WTA search + head-to-head comparison.
- Surface splits, trends, and radar-style metrics.

### 👤 Player Profiles
- Profile cards, country flags, image fallback, and stat summaries.
- Match-level details integrated with dashboard views.

### 📈 Data Analysis Dashboard
- Dedicated ATP/WTA analysis workspace (`/analysis/atp`, `/analysis/wta`).
- Player Explorer, Tournament Explorer, and Records Book.

### 🔔 Smart Notification System
- Multi-rule alert engine with guided rule builder.
- Event types for upcoming/live/result/milestone-style triggers.
- Channels: Email + integrations, cooldowns, quiet hours, run-now testing.
- Launchable from main dashboard button (auto-start helper route).

---

## 🚀 Quick Start

### 🌐 Live Demo
Visit: **[tennis-tour-dashboard.onrender.com](https://tennis-tour-dashboard.onrender.com)**

### 💻 Local Development

#### Option A: Quick Start Script

```bash
./start.sh
```

#### Option B: Manual Setup

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Frontend (new terminal):

```bash
cd frontend
python3 no_cache_server.py
```

Default local URLs:
- Frontend: `http://localhost:8085`
- Backend: `http://localhost:5001`
- Notification app: `http://localhost:5090`

---

## 🛠️ Tech Stack

### Backend
- Python 3.11+
- Flask + Flask-SocketIO
- Requests / BeautifulSoup / Playwright-based data flows

### Frontend
- HTML/CSS/Vanilla JS (modular files)
- Interactive charts/visualizations + custom UI components

### Deployment
- Render.com (Python service)
- GitHub for source and CI flow

---

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check ✅ |
| `GET` | `/api/live-scores?tour=atp\|wta\|both` | Live match scores 🔴 |
| `GET` | `/api/recent-matches?tour=...&limit=...` | Recently completed matches 📋 |
| `GET` | `/api/upcoming-matches?tour=...&days=7` | Upcoming matches 🎯 |
| `GET` | `/api/intro-gifs` | Intro GIF list 🖼️ |

### Rankings & Players

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rankings/<tour>?limit=...` | ATP/WTA rankings 🏆 |
| `GET` | `/api/rankings/atp/status` | ATP rankings status ⏰ |
| `POST` | `/api/rankings/atp/refresh` | Refresh ATP rankings 🔄 |
| `GET` | `/api/rankings/wta/status` | WTA rankings status ⏰ |
| `POST` | `/api/rankings/wta/refresh` | Refresh WTA rankings 🔄 |
| `GET` | `/api/player/<id>` | Player profile 👤 |
| `GET` | `/api/player/<tour>/<player_id>/image` | Player image route 📸 |

### Tournaments & Brackets

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tournaments/<tour>` | Tournament calendar 📅 |
| `GET` | `/api/tournament/<id>/bracket?tour=...` | Tournament bracket 🌳 |
| `GET` | `/api/categories` | Category list 🏷️ |

### Head-to-Head

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/h2h/atp/search?query=...&limit=...` | ATP player search 🔍 |
| `GET` | `/api/h2h/wta/search?query=...&limit=...` | WTA player search 🔍 |
| `GET` | `/api/h2h/atp?player1_id=...&player2_id=...` | ATP H2H ⚔️ |
| `GET` | `/api/h2h/wta?player1_id=...&player2_id=...&year=2026&meetings=5` | WTA H2H ⚔️ |

### System Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/analysis` | Update analysis summary 📈 |
| `POST` | `/api/system/update` | Trigger update pipeline 🔄 |
| `GET` | `/api/system/update/status` | Update progress 📊 |
| `GET` | `/api/notifications/status` | Notification service status 🔔 |
| `POST` | `/api/notifications/launch` | Launch notification service 🚀 |
| `GET` | `/notifications/open` | Open notification page 🌐 |

### 🔔 Notification System Endpoints (port `5090`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/state` | State: settings/rules/history/config ⚙️ |
| `POST` | `/api/settings` | Save delivery settings 📝 |
| `GET` | `/api/options` | Player/tournament options 🔍 |
| `POST` | `/api/rules` | Create rule ✨ |
| `PUT` | `/api/rules/<rule_id>` | Update rule 🔧 |
| `DELETE` | `/api/rules/<rule_id>` | Delete rule 🗑️ |
| `POST` | `/api/run-now` | Manual run 🚀 |
| `POST` | `/api/test-email` | Send test email 📧 |
| `POST` | `/api/history/clear` | Clear run history 🔄 |

---

## 📁 Project Structure

```bash
Tennis-Dashboard/
├── backend/
│   ├── app.py
│   ├── tennis_api.py
│   ├── config.py
│   ├── requirements.txt
│   └── notification_system/
│       ├── app.py
│       ├── storage/subscriptions.json
│       ├── templates/index.html
│       └── static/{app.js,styles.css,favicon.svg}
├── frontend/
│   ├── index.html
│   ├── update.html
│   ├── no_cache_server.py
│   ├── css/
│   ├── js/
│   └── vendor/
├── data/
├── data_analysis/
├── scripts/
├── Images/
├── start.sh
├── start_local.sh
├── README.md
├── LICENSE
└── .gitignore
```

---

## 📸 Interface Gallery

| Title | Preview | Description |
|---|---|---|
| Loading Intro | ![Loading intro page](Images/loading%20intro.png) | Intro/loading screen. |
| Main Interface | ![Main interface](Images/Interface_Live%20results_recent%20scores_upcoming%20matches.png) | Main dashboard layout. |
| Main Interface (Alt) | ![Alternative interface](Images/Interface_Live%20results_recent%20scores_upcoming%20matches%202.png) | Alternate dashboard composition. |
| Upcoming Match Insights | ![Upcoming match insights](Images/Upcoming%20match%20insights.png) | Upcoming card with insights. |
| Live Rankings and Calendar | ![Live rankings and calendar](Images/Live%20Rankings%20and%20calender.png) | Rankings + calendar + bracket workspace. |
| Favourites Panel | ![Favourites panel](Images/Favourite%20panel.png) | Favourite players side panel. |
| H2H Analytics View 1 | ![H2H view 1](Images/H2H_1.png) | First H2H analysis screen. |
| H2H Analytics View 2 | ![H2H view 2](Images/H2H_2.png) | Detailed H2H comparison screen. |
| Player Stats Card 1 | ![Player stats 1](Images/Player_stats_1.png) | Player profile card style 1. |
| Player Stats Card 2 | ![Player stats 2](Images/Player_stats_2.png) | Player profile card style 2. |
| **Stats Table** | ![Stats table](Images/stat%20table.png) | Tabular stats comparison layout. |
| **Serving Stats Index** | ![Serving stat index](Images/Serving%20stat%20index.png) | Serving metrics index view. |
| Notification System | ![Notification system](Images/Nortification%20system.png) | Notification rules + controls page. |
| Notification System (Detail) | ![Notification system 2](Images/Nortification%20system%202.png) | Notification detail workflow view. |

---

## 📊 Data Analysis Dashboard

| Title | Preview | Description |
|---|---|---|
| Player Analysis | ![Analysis player](Images/Analysis_player.png) | Core player analysis workspace. |
| Player Analysis - Additional View | ![Analysis player 2](Images/Analysis_player%202.png) | Additional player perspective. |
| Player Analysis - Advanced Metrics | ![Analysis player 3](Images/Analysis_player%203.png) | Advanced metrics panel. |
| Player Match Analysis | ![Analysis player matches](Images/Analysis_player%20Matches.png) | Match-level player analysis. |
| Tournament Analysis | ![Analysis tournament](Images/Analyis_Tournament.png) | Tournament explorer screen. |
| Records Book | ![Analysis record book](Images/Analysis_Record%20book.png) | Historical records and holders. |
| Ranking Points Analysis | ![Analysis ranking points](Images/Analysis_ranking_points.png) | Ranking points trends. |

---

## 🔄 Data & Script Notes

- Live scripts update score/match caches.
- Update scripts refresh player profiles, rankings, tournaments, and derived stats.
- Some update flows use browser automation (`playwright install chromium`).

---

## 📄 License

MIT License — see [LICENSE](LICENSE).

---

<p align="center"><strong>⭐ Star this repo if you find it useful! ⭐</strong></p>
<p align="center">
  <a href="https://github.com/maninka123/Tennis-tour-dashboard/stargazers"><img src="https://img.shields.io/github/stars/maninka123/Tennis-tour-dashboard?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/maninka123/Tennis-tour-dashboard/network/members"><img src="https://img.shields.io/github/forks/maninka123/Tennis-tour-dashboard?style=social" alt="GitHub forks"></a>
</p>
<p align="center">Made with 🎾 and ☕ | © 2026 Tennis Dashboard</p>
