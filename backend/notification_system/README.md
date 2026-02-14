# Tennis Notification System

A comprehensive, real-time notification platform for ATP and WTA tennis events. This system monitors live matches, upcoming fixtures, and recent results to deliver intelligent, customizable alerts based on user-defined rules.

---

## Overview

The Tennis Notification System is a standalone Flask application that integrates with your Tennis Dashboard API to provide smart, automated notifications. It continuously polls match data and triggers alerts when specific conditions are met, ensuring you never miss important tennis moments.

### Key Features

- **Multi-Channel Delivery**: Send notifications via Email, Discord, Telegram, or in-app web push
- **Smart Rule Engine**: Create complex filtering rules with up to 3 custom conditions per rule
- **Automatic Deduplication**: Prevents sending duplicate alerts for the same event
- **Quiet Hours**: Schedule silent periods to avoid notifications during specific times
- **Cooldown Controls**: Limit notification frequency per rule to prevent spam
- **Branded HTML Emails**: Beautiful, responsive email templates with player photos and match details
- **Real-time Monitoring**: Configurable polling intervals (default: 5 minutes)
- **Manual Triggers**: Force immediate rule evaluation with "Run Rules Now" button

---

## Event Types

The system supports 14 distinct event types that cover the entire spectrum of tennis match events:

### Core Match Events
- **Upcoming Match**: Notifies when a match is scheduled within a specified timeframe
- **Match Result**: Alerts when a match concludes with final score and winner
- **Tournament Completed**: Sends notification when a tournament final is finished
- **Player Reaches Round**: Triggers when a tracked player advances to a specific round

### Live Match Events
- **Live Match Starts**: Instant alert when a match begins (status changes to "live")
- **Set Completed**: Notification after each completed set in a live match

### Special Alerts
- **Upset Alert**: Detects when a lower-ranked player defeats a higher-ranked opponent (configurable rank difference)
- **Close Match Deciding Set**: Alerts for matches entering a deciding set (3rd or 5th set)
- **Head-to-Head Breaker**: Notifies when a tracked rivalry match occurs
- **Surface-Specific Result**: Triggers for results on specific surfaces (Hard, Clay, Grass, Indoor, Carpet)

### Milestone Notifications
- **Ranking Milestone**: Alerts when a player reaches a career ranking milestone (Top 100, Top 50, Top 20, Top 10, Career High)
- **Title Milestone**: Notifies when a player wins a significant number of titles

### Schedule Alerts
- **Tournament Stage Reminder**: Sends reminders when specific tournament stages (QF, SF, F) are approaching
- **Time Window Schedule Alert**: Notifies about matches starting within a custom time window (e.g., next 2 hours)

---

## Rule Configuration Options

Each notification rule can be customized with the following parameters:

### Basic Settings
- **Rule Name**: Descriptive identifier for the rule
- **Enabled/Disabled**: Toggle rule activation without deletion
- **Event Type**: Select from 14 event types (see above)
- **Severity**: Classification as `important`, `normal`, or `digest`

### Tour & Competition Filters
- **Tour Selection**: Filter by ATP, WTA, or both
- **Tournament Category**: Grand Slam, ATP/WTA 1000, 500, 250, Finals
- **Specific Tournaments**: Target individual tournaments by name
- **Round Filters**: 
  - Any Round
  - Minimum Round (e.g., QF onwards)
  - Exact Round (e.g., only Finals)

### Player Filters
- **Player List**: Specify multiple players by name
- **Player Matching Mode**: 
  - Alert when **any** specified player is involved
  - Alert when **all** specified players are involved
- **Country Filter**: Limit to players from specific countries

### Advanced Conditions
Add up to **3 additional conditions** per rule using:
- Rank comparisons (player rank ≤, ≥, or = specified value)
- Surface requirements
- Tournament category matching
- Custom logical operators (AND/ALL, OR/ANY)

### Scheduling Controls
- **Quiet Hours**: Define a time window (with timezone offset) during which notifications are suppressed
- **Cooldown Period**: Minimum time (in minutes) between successive notifications for the same rule (0-1440 minutes)

### Delivery Channels
Select one or more channels per rule:
- **Email**: Branded HTML emails with inline player images
- **Discord**: Webhook-based notifications to Discord channels
- **Telegram**: Bot messages to specified chat/channel
- **Web Push**: In-app browser notifications (placeholder for future implementation)

---

## When Notifications Are Sent

The notification system sends alerts based on the following logic:

### Trigger Conditions (ALL must be met)
1. **System Enabled**: The notification system must be running and enabled
2. **Valid Configuration**: At least one delivery channel (email/Discord/Telegram) must be properly configured
3. **Rule Enabled**: The specific rule must be active (not disabled)
4. **Event Match**: An event matching the rule's filters must occur
5. **Not Duplicate**: The event must not have been previously sent (unless manually triggered)
6. **Outside Quiet Hours**: Current time must be outside the rule's quiet hours window
7. **Cooldown Satisfied**: Sufficient time must have passed since the last notification for this rule

### Polling Schedule
- The system automatically checks for new matches every **N seconds** (configurable via `NOTIFY_POLL_SECONDS`, default: 300)
- Manual checks can be triggered via the "Run Rules Now" button in the web interface

### Event Detection Timing
- **Upcoming Matches**: Detected when matches appear in the upcoming schedule (typically 1-7 days in advance)
- **Live Events**: Monitored in real-time during match progression
- **Results**: Captured immediately after match completion
- **Time-Sensitive Alerts**: Evaluated based on match start times and current time

---

## Installation & Setup

### Prerequisites
- Python 3.8 or higher
- The main Tennis Dashboard backend must be running at `http://localhost:5001/api`
- Valid SMTP credentials (for email notifications)
- Optional: Discord webhook URL or Telegram bot credentials

### Step 1: Install Dependencies
```bash
cd backend/notification_system
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables
Copy the example environment file and customize it:
```bash
cp .env.example .env
```

Edit `.env` with your configuration (see Configuration Reference below).

### Step 3: Run the Server
```bash
python app.py
```

The notification system will start on `http://localhost:5090`

---

## Configuration Reference

### Core Settings
- **`NOTIFY_PORT`**: Port for the notification web interface (default: `5090`)
- **`NOTIFY_POLL_SECONDS`**: Interval between automatic rule checks (default: `300`)
- **`NOTIFY_TENNIS_API_BASE_URL`**: Base URL of your Tennis Dashboard API (default: `http://localhost:5001/api`)

### Email Configuration (Required for email notifications)
- **`NOTIFY_SMTP_HOST`**: SMTP server hostname (e.g., `smtp.gmail.com`)
- **`NOTIFY_SMTP_PORT`**: SMTP server port (default: `587` for TLS)
- **`NOTIFY_SMTP_USER`**: SMTP authentication username
- **`NOTIFY_SMTP_PASS`**: SMTP authentication password (use app-specific password for Gmail)
- **`NOTIFY_SMTP_TLS`**: Enable TLS encryption (`true` or `false`, default: `true`)
- **`NOTIFY_SMTP_FROM`**: Sender email address (defaults to `NOTIFY_SMTP_USER`)
- **`NOTIFY_SMTP_REPLY_TO`**: Reply-to email address (optional)

### Image Optimization (Advanced)
- **`NOTIFY_EMAIL_INLINE_IMAGE_MAX_BYTES`**: Maximum size per inline image (default: `3000000`)
- **`NOTIFY_EMAIL_INLINE_IMAGE_TOTAL_MAX_BYTES`**: Maximum total size for all images per email (default: `12000000`)
- **`NOTIFY_EMAIL_INLINE_IMAGE_FETCH_TIMEOUT_SECONDS`**: Timeout for fetching each player image (default: `5`)
- **`NOTIFY_EMAIL_INLINE_IMAGE_TARGET_BYTES`**: Target compression size per image (default: `30000`)

### External Integrations (Optional)
- **`NOTIFY_DISCORD_WEBHOOK_URL`**: Discord webhook URL for Discord notifications
- **`NOTIFY_TELEGRAM_BOT_TOKEN`**: Telegram bot API token
- **`NOTIFY_TELEGRAM_CHAT_ID`**: Telegram chat/channel ID for notifications

### Performance Tuning
- **`NOTIFY_API_TIMEOUT_SECONDS`**: Timeout for Tennis API requests (default: `40`)
- **`NOTIFY_API_RETRIES`**: Number of retry attempts for failed API requests (default: `1`)

---

## Usage Guide

### Web Interface
Access the notification control panel at `http://localhost:5090` to:
- View and manage notification rules
- Configure global settings (email address, enable/disable system)
- View notification history and logs
- Test email configuration with sample notifications
- Manually trigger rule evaluation

### Creating a Rule

1. Click "Add New Rule"
2. Enter a descriptive rule name
3. Select an event type (e.g., "Upcoming Match")
4. Choose tour(s): ATP, WTA, or Both
5. (Optional) Add filters:
   - Tournament categories
   - Specific tournaments
   - Round requirements
   - Player names
   - Countries
6. (Optional) Add advanced conditions (up to 3)
7. Configure delivery channels
8. (Optional) Set quiet hours and cooldown
9. Save the rule

### Example Rules

**"Grand Slam Finals"**: Get notified of all Grand Slam finals
- Event Type: Upcoming Match
- Tour: Both
- Category: Grand Slam
- Round: Exact - F

**"Top 10 Player Alerts"**: Track matches involving top-ranked players
- Event Type: Upcoming Match
- Tour: Both
- Condition: Player1 rank ≤ 10 OR Player2 rank ≤ 10

**"Rafael Nadal Clay Court Results"**: Follow Nadal's clay results
- Event Type: Match Result
- Tour: ATP
- Players: Rafael Nadal
- Surface: Clay

---

## Data Storage

Rule configurations, sent event history, and system state are persisted in:
```
backend/notification_system/storage/subscriptions.json
```

This file contains:
- User email address
- All notification rules (enabled and disabled)
- Sent event IDs (for deduplication)
- Rule state tracking (last sent timestamps, etc.)
- Notification history logs

---

## Performance Optimizations

The system includes several optimizations for fast, reliable delivery:

### Email Performance
- **Concurrent Image Fetching**: Player images are fetched in parallel (up to 6 simultaneous connections)
- **Aggressive Compression**: Images are compressed to ~30KB each for fast delivery
- **Smart Caching**: Previously fetched images are cached per email batch
- **Inline Base64 Encoding**: Images are embedded directly in emails (no external loading)

### API Reliability
- **Automatic Retries**: Failed API requests are retried with exponential backoff
- **Configurable Timeouts**: Prevents hanging on slow API responses
- **Graceful Degradation**: System continues operating even if some data sources fail

### SMTP Robustness
- **Connection Retry Logic**: 3 retry attempts with progressive backoff (1s, 2s delays)
- **Extended Timeouts**: 20-second timeout for reliable Gmail connectivity
- **Error Recovery**: Handles transient connection issues gracefully

---

## Troubleshooting

### Emails Not Sending
- Verify SMTP credentials in `.env`
- For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) (not your regular password)
- Check "History" tab in web interface for error messages
- Test SMTP connection with "Test Email" button

### No Matches Detected
- Ensure main Tennis Dashboard API is running at the configured URL
- Check that the API returns data for the endpoints: `/live-scores`, `/upcoming-matches`, `/recent-matches`
- Verify rule filters are not too restrictive

### Duplicate Notifications
- The system automatically deduplicates events using hashed event IDs
- Duplicates may occur if you click "Run Rules Now" multiple times (manual runs bypass deduplication)

### Performance Issues
- Reduce `NOTIFY_POLL_SECONDS` only if needed (more frequent polling = higher load)
- Limit the number of concurrent enabled rules
- Use cooldown periods to prevent notification storms

---

## Development

### Project Structure
```
backend/notification_system/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env                   # Environment configuration
├── storage/              # Persistent data
│   └── subscriptions.json
├── templates/            # HTML templates
│   └── index.html
└── static/              # CSS/JS assets
    ├── styles.css
    └── app.js
```

### API Endpoints
- `GET /api/config`: Retrieve system configuration
- `POST /api/config`: Update system configuration
- `GET /api/rules`: List all notification rules
- `POST /api/rules`: Create a new rule
- `PUT /api/rules/<id>`: Update a rule
- `DELETE /api/rules/<id>`: Delete a rule
- `POST /api/run-now`: Manually trigger rule evaluation
- `POST /api/test-email`: Send a test email
- `GET /api/history`: Retrieve notification history
- `POST /api/history/clear`: Clear notification history
- `GET /api/options`: Get available players and tournaments

---

## License

This notification system is part of the Tennis Dashboard project.

---

## Support

For issues or questions:
1. Check the notification history in the web interface
2. Review logs for error messages
3. Verify all configuration settings
4. Test individual components (SMTP, API connectivity)

---

*Last updated: February 2026*
