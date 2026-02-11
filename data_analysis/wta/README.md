# WTA Historic Data Analysis

Standalone WTA app built from local yearly match CSV files in:

- `historic data_wta/*.csv`

Dataset scope:

- `1968-2024` (static archive)
- no live refresh/update during load

Features mirror the ATP analysis app:

- Player Explorer (autocomplete, profile, matches, rivalries, ranking timeline)
- Tournament Explorer
- Records Book
- Country flags and player images from local WTA player profiles

Run from repo root:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/data_analysis/wta/
```
