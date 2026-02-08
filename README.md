# Tennis Live Dashboard

Real-time ATP and WTA dashboard for the 2026 season with live scores, rankings, upcoming-match insights, tournament calendars, draw trees, H2H tools, and stat views.

## Real-Time 2026, No Paid APIs

- Built for fast tennis tracking in one place across ATP and WTA.
- Uses public web sources and open endpoints only (no paid data API subscriptions).
- Useful for quick match monitoring, player comparison, and tournament context during the season.
- Designed for practical daily use: live scores, recent results, upcoming predictions, rankings, and stats in one workflow.

## What Is Included

- Live matches with current game points and serving indicator
- Recent match cards with clickable stat popups
- Upcoming matches (next 2 days) with:
  - H2H snapshot
  - Win-edge percentages for both players
  - Insight modal with form and momentum notes
- ATP/WTA rankings panel
  - WTA-specific refresh button
  - `Updated ... ago` status
  - WTA load-more support (up to 400 shown in UI)
- Tournament calendar with category and surface pills
- Bracket panel for tournament draw/progression
- WTA H2H module with:
  - Player autocomplete search
  - Career H2H summary
  - Interactive serving/returning radar charts
  - Career surface records
  - Past meetings with set-by-set score boxes

## Screenshots

### 1) Main Interface: Live, Recent, Upcoming
Live matches, recent results, and upcoming cards in one flow.

<img src="Images/Interface_Live%20results_recent%20scores_upcoming%20matches.png" alt="Main interface with live, recent, and upcoming sections" width="1200" />

### 2) Rankings and Calendar Panel
Left rankings panel plus tournament calendar layout.

<img src="Images/Live%20Rankings%20and%20calender.png" alt="WTA rankings and tournament calendar view" width="1200" />

### 3) Upcoming Match Insights (Win Percentages)
Modal insight view for upcoming matches with percentage edge split, H2H snapshot, and contextual notes.

<img src="Images/Upcoming%20match%20insights.png" alt="Upcoming match insights with win percentage bars" width="1200" />

### 4) Match Stats Popup
Detailed post/live match stat comparison popup for two players.

Overview view:
<img src="Images/Player_stats_1.png" alt="Player stats comparison popup overview" width="1200" />

Detailed breakdown view:
<img src="Images/Player_stats_2.png" alt="Player stats popup detailed rows" width="1200" />

### 5) WTA H2H Dashboard
Head-to-head hero section, career records, radar analytics, and past meetings.

Overview view:
<img src="Images/H2H_1.png" alt="WTA H2H overview with radar charts" width="1200" />

Past meetings and surface records view:
<img src="Images/H2H_2.png" alt="WTA H2H past meetings and surface records" width="1200" />

## Quick Start

### Option A: Start both servers

```bash
./start.sh
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5001`

### Option B: Manual start

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

In a second terminal:

```bash
cd frontend
python3 no_cache_server.py
```

## Core API Endpoints

- `GET /api/health`
- `GET /api/live-scores?tour=atp|wta|both`
- `GET /api/recent-matches?tour=...&limit=...`
- `GET /api/upcoming-matches?tour=...`
- `GET /api/rankings/<tour>?limit=...`
- `GET /api/rankings/wta/status`
- `POST /api/rankings/wta/refresh`
- `GET /api/tournaments/<tour>`
- `GET /api/tournament/<id>/bracket?tour=...`
- `GET /api/player/<id>`
- `GET /api/h2h/wta/search?query=...&limit=...`
- `GET /api/h2h/wta?player1_id=...&player2_id=...&year=2026&meetings=5`

## Data and Utility Scripts

- `scripts/wta_live_rankings_to_csv.py`
  - Pulls latest WTA rankings CSV used by the app
- `scripts/wta_scrape_wtatennis.py`
  - Scrapes WTA player profile/stats/records into `data/wta` (no image download in this script)
- `scripts/[Only once] wta_fix_player_images.py`
  - Validates/replaces missing or broken WTA player images
- `scripts/wta_tournaments_to_json.py`
  - Tournament data refresh utility
- `scripts/standalone_wta_h2h_stats.py`
  - Standalone WTA H2H radar/stat extraction script
- `scripts/[Live] wta_live_matches.py`
  - Fetches live WTA singles raw matches (used by API)
- `scripts/[Live] wta_recent_matches.py`
  - Fetches recent/finished WTA singles raw matches (used by API)
- `scripts/[Live] wta_upcoming_matches.py`
  - Fetches upcoming WTA singles raw matches (used by API)

Note: some scripts may require extra packages (for example `playwright` + Chromium install) beyond backend runtime dependencies.

## Project Structure

```text
backend/
  app.py
  tennis_api.py
  config.py
  requirements.txt

frontend/
  index.html
  css/styles.css
  js/app.js
  js/scores.js
  js/rankings.js
  js/tournaments.js
  js/bracket.js
  js/h2h.js

data/
  atp/
  wta/

scripts/
  wta_live_rankings_to_csv.py
  wta_scrape_wtatennis.py
  [Only once] wta_fix_player_images.py
  [Live] wta_live_matches.py
  [Live] wta_recent_matches.py
  [Live] wta_upcoming_matches.py
  wta_tournaments_to_json.py
  standalone_wta_h2h_stats.py

Images/
  (README screenshots)
```

## License

MIT (see `LICENSE`).
