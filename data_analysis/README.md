# Data Analysis Apps

This folder now contains both standalone historic analysis apps:

- `data_analysis/`:
  ATP historic app (1968-2026), with `2026.csv` refresh on each load.
- `data_analysis/wta/`:
  WTA historic app (1968-2024), static dataset (no live refresh).

Both apps share the same UX/features:

- Player Explorer (autocomplete, profile, matches, rivalries, ranking timeline)
- Tournament Explorer
- Records Book
- Player images + country flags + tournament/surface badge styling

## Run

Serve from repository root:

```bash
python3 -m http.server 8080
```

Open:

```text
ATP: http://localhost:8080/data_analysis/
WTA: http://localhost:8080/data_analysis/wta/
```
