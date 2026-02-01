# 🎾 Tennis Live Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Python-blue)](#)
[![Live Updates](https://img.shields.io/badge/Live-Real--time%20Scores-red)](#)
[![Status](https://img.shields.io/badge/Status-Feature%20Complete-success)](#)
[![Version](https://img.shields.io/badge/version-2.0-blue)](#)

A comprehensive real-time tennis dashboard displaying live scores, rankings, tournament calendars, interactive brackets, and player statistics for both ATP and WTA tours.

## ✨ Features

### 🔴 Live Match Tracking
- **Real-time Score Updates** via WebSocket connections
- **Live Match Indicators** with pulsing animations  
- **Serving Indicators** showing which player is serving
- **Current Game Scores** displayed alongside set scores
- **Tiebreak Display** with superscript notation (e.g., 7⁷ for 7-6(7))
- **Match Statistics Popup** - Click any match to view:
  - Aces & Double Faults
  - First & Second Serve percentages
  - Break Points won/total
  - Winners & Unforced Errors
  - Total points with visual comparison bars

### 📊 Rankings System
- **Top 200 ATP/WTA Rankings** with real-time updates
- **Player Cards** with country flags and ranking changes
- **Smooth Scrolling** interface
- **Tour Switching** between ATP and WTA

### 📅 Tournament Calendar
- **Full Season Calendar** with all tournaments
- **Category Color Coding**:
  - 🟣 Grand Slam (Purple)
  - 🟡 Masters 1000 (Gold)  
  - 🟠 ATP 500 (Orange) - Updated from blue
  - 🟢 ATP 250 (Green)
  - 🩷 Finals (Pink)
- **Surface Indicators** (Hard, Clay, Grass)
- **Date Ranges** and locations
- **Interactive Tournament Cards**

### 🏆 Interactive Bracket System
- **Enhanced Tree Structure** with proper connector lines between rounds
- **Visual Hierarchy** showing tournament progression
- **Prize Money Display** for each round (Grand Slam: $100K-$3.5M)
- **Points Distribution** shown for every stage
- **Match Cards** with:
  - Player photos (placeholder.com integration)
  - Seed numbers
  - Rankings in [rank] format
  - Abbreviated names (A. LastName)
  - Live scores with tiebreak notation
  - Winner highlighting
- **Finals Visualization**:
  - Group stage display with qualified players marked
  - Knockout rounds
  - Special Finals formatting (200 pts per win in groups)

### 🎉 Champion Celebration
- **Animated Trophy** display with bounce effect
- **Confetti Animation** on champion reveal (50 falling particles)
- **Prize Breakdown**:
  - Ranking points earned
  - Prize money won
- **Champion Stats** with player photo and details
- **View Champion Button** for completed tournaments (glowing gold effect)

### 👥 Head-to-Head Player Comparison
- **Dropdown Player Search** with autocomplete (8 results max)
- **H2H Record** display (wins-losses)
- **Career Statistics**:
  - Career titles
  - Grand Slam titles
  - Win percentage
  - Career prize money ($M format)
- **Last 5 Matches** between players showing:
  - Match dates (YYYY-MM format)
  - Tournaments
  - Scores
  - Surface type (Hard/Clay/Grass)
  - Winner highlighted in green
- **Visual Comparison Bars** for statistics

### 🎨 Modern UI/UX Enhancements
- **Dark Theme** optimized for extended viewing
- **Smooth Animations** and transitions (200ms-300ms)
- **Responsive Design** for all screen sizes
- **Color-Coded Categories** for easy identification
- **Player Name Format**: A. LastName (abbreviated first name)
- **Ranking Badges**: [rank] displayed before player names
- **Match Card Width**: 365px (1.3x wider) for better readability
- **Enhanced Bracket Connectors**: Animated tree structure with accent colors

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip
- Modern web browser

### Installation

1. **Clone and navigate to the repository**
```bash
cd "Tennis Dashboard"
```

2. **Install Python dependencies**
```bash
cd backend
pip install -r requirements.txt
```

3. **Start the backend server**
```bash
python app.py
```

The server will start on `http://localhost:5001`

4. **Open the dashboard**
```bash
# Simply open frontend/index.html in your browser
# Or use a local server:
cd ../frontend
python -m http.server 8000
```

Then navigate to `http://localhost:8000`

## 📁 Project Structure

```
Tennis Dashboard/
├── backend/
│   ├── app.py                 # Flask application & WebSocket server (port 5001)
│   ├── tennis_api.py          # API data fetching + integration guide
│   ├── config.py              # Configuration settings
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── index.html            # Main dashboard HTML
│   ├── css/
│   │   └── styles.css        # Complete styling (2300+ lines)
│   └── js/
│       ├── app.js            # Core application & state management
│       ├── scores.js         # Live & recent match handling
│       ├── rankings.js       # Rankings display
│       ├── tournaments.js    # Tournament calendar
│       ├── bracket.js        # Interactive bracket system
│       └── h2h.js            # Head-to-head comparison
└── README.md
```

## API Endpoints

- `GET /api/live-scores` - Current live matches
- `GET /api/recent-matches` - Recently finished matches
- `GET /api/rankings/{tour}` - ATP/WTA rankings (top 200)
- `GET /api/tournaments/{tour}` - Tournament calendar
- `GET /api/tournament/{id}/bracket` - Tournament bracket/tree
- `GET /api/player/{id}` - Player details

## Data Sources

The dashboard can fetch data from tennis APIs and live score providers. This repo includes realistic demo data for offline use and development.

## Technologies

- **Backend**: Python, Flask, WebSocket
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Real-time**: WebSocket for live updates
- **Styling**: Custom CSS with responsive design

## Notes

- Challenger/Futures events are excluded by design.
- Upcoming tournaments show last year’s winner to distinguish from finished events.
- The bracket panel supports hover match popups and seeded player markers.

## License

MIT License
