# Tennis Notification System

Standalone notification platform for ATP/WTA alerts.

## What it does
- Lets users create multiple custom alert rules.
- Filters by tour, round, category, tournament, players, and up to 3 extra conditions.
- Supports event types:
  - Upcoming Match
  - Match Result
  - Tournament Completed (final result)
  - Player Reaches Round
- Sends branded HTML email notifications automatically.
- Deduplicates alerts to avoid sending the same event repeatedly.

## Folder
`backend/notification_system`

## Run
1. Start your main backend first (the API at `http://localhost:5001/api`).
2. Open a terminal in this folder.
3. Install dependencies:
   - `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill SMTP values.
5. Run:
   - `python app.py`
6. Open:
   - `http://localhost:5090`

## Important environment variables
- `NOTIFY_TENNIS_API_BASE_URL`
  - API base for match data. Default: `http://localhost:5001/api`
- `NOTIFY_POLL_SECONDS`
  - Auto-check interval in seconds. Default: `300`
- `NOTIFY_SMTP_HOST`, `NOTIFY_SMTP_PORT`, `NOTIFY_SMTP_USER`, `NOTIFY_SMTP_PASS`
  - SMTP server credentials.
- `NOTIFY_SMTP_TLS`
  - Use TLS (`true`/`false`).
- `NOTIFY_SMTP_FROM`
  - Sender email in outgoing notifications.

## Notes
- Rule state is stored in `storage/subscriptions.json`.
- Emails are only sent when:
  - platform is enabled,
  - recipient email is set,
  - SMTP config is valid.
- Use “Run Rules Now” to trigger checks immediately.
