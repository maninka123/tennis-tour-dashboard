#!/usr/bin/env python3
"""
Standalone WTA head-to-head stats + charts script.

Fetches:
- H2H summary + recent meetings
- Career surface records
- Season match stats (serving + returning) for a chosen year

Generates:
- Serving radar chart
- Returning radar chart
- JSON report
"""

from __future__ import annotations

import argparse
import difflib
import json
import math
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

try:
    import matplotlib.pyplot as plt
except Exception as exc:  # pragma: no cover - runtime dependency check
    raise SystemExit(
        "matplotlib is required. Install with: pip install matplotlib"
    ) from exc


BASE_TENNIS_API = "https://api.wtatennis.com/tennis"
BASE_SEARCH_API = "https://api.wtatennis.com/search/v2/wta/"
DEFAULT_PLAYER1 = "Xinyu Wang"
DEFAULT_PLAYER2 = "Jessica Pegula"
DEFAULT_YEAR = 2026
HEADERS = {
    "account": "wta",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
}


@dataclass(frozen=True)
class MetricSpec:
    key: str
    label: str
    value_path: str
    min_path: str
    avg_path: str
    max_path: str
    lower_is_better: bool = False
    is_percent: bool = False


SERVING_SPECS: List[MetricSpec] = [
    MetricSpec("aces", "Aces", "Aces", "MinAces", "AverageAces", "MaxAces"),
    MetricSpec(
        "double-faults",
        "Double\nFaults",
        "Double_Faults",
        "MinDoubleFaults",
        "AverageDoubleFaults",
        "MaxDoubleFaults",
        lower_is_better=True,
    ),
    MetricSpec(
        "first-serves-percent",
        "1st Serve %",
        "first_serve_percent",
        "MinFirstServePercent",
        "AverageFirstServePercent",
        "MaxFirstServePercent",
        is_percent=True,
    ),
    MetricSpec(
        "first-serve-won-percent",
        "1st Serve\nWon %",
        "first_serve_won_percent",
        "MinFirstServeWonPercent",
        "AverageFirstServeWonPercent",
        "MaxFirstServeWonPercent",
        is_percent=True,
    ),
    MetricSpec(
        "second-serve-won-percent",
        "2nd Serve\nWon %",
        "second_serve_won_percent",
        "MinSecondServeWonPercent",
        "AverageSecondServeWonPercent",
        "MaxSecondServeWonPercent",
        is_percent=True,
    ),
    MetricSpec(
        "break-points-saved",
        "Break Points\nSaved %",
        "breakpoint_saved_percent",
        "MinBreakpointSavedPercent",
        "AverageBreakpointSavedPercent",
        "MaxBreakpointSavedPercent",
        is_percent=True,
    ),
    MetricSpec(
        "service-points-won-percent",
        "Service\nPoints Won %",
        "service_points_won_percent",
        "MinServicePointsWonPercent",
        "AverageServicePointsWonPercent",
        "MaxServicePointsWonPercent",
        is_percent=True,
    ),
    MetricSpec(
        "service-games-won-percent",
        "Service\nGames Won %",
        "service_games_won_percent",
        "MinServiceGamesWonPercent",
        "AverageServiceGamesWonPercent",
        "MaxServiceGamesWonPercent",
        is_percent=True,
    ),
    MetricSpec(
        "service-games-played",
        "Service\nGames Played",
        "Service_Games_Played",
        "MinServiceGamesPlayed",
        "AverageServiceGamesPlayed",
        "MaxServiceGamesPlayed",
    ),
]

RETURNING_SPECS: List[MetricSpec] = [
    MetricSpec(
        "return-points-won-percent",
        "Return\nPoints Won %",
        "return_points_won_percent",
        "MinReturnPointsWonPercent",
        "AverageReturnPointsWonPercent",
        "MaxReturnPointsWonPercent",
        is_percent=True,
    ),
    MetricSpec(
        "first-return-points-won-percent",
        "1st Return\nPoints Won %",
        "first_return_percent",
        "MinFirstReturnPercent",
        "AverageFirstReturnPercent",
        "MaxFirstReturnPercent",
        is_percent=True,
    ),
    MetricSpec(
        "second-return-points-won-percent",
        "2nd Return\nPoints Won %",
        "second_return_percent",
        "MinSecondReturnPercent",
        "AverageSecondReturnPercent",
        "MaxSecondReturnPercent",
        is_percent=True,
    ),
    MetricSpec(
        "break-points-converted-percent",
        "Break Points\nConverted %",
        "breakpoint_converted_percent",
        "MinBreakpointConvertedPercent",
        "AverageBreakpointConvertedPercent",
        "MaxBreakpointConvertedPercent",
        is_percent=True,
    ),
    MetricSpec(
        "return-games-won-percent",
        "Return Games\nWon %",
        "return_games_won_percent",
        "MinReturnGamesWonPercent",
        "AverageReturnGamesWonPercent",
        "MaxReturnGamesWonPercent",
        is_percent=True,
    ),
    MetricSpec(
        "return-games-played",
        "Return Games\nPlayed",
        "Return_Games_Played",
        "MinReturnGamesPlayed",
        "AverageReturnGamesPlayed",
        "MaxReturnGamesPlayed",
    ),
]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def format_value(value: Optional[float], is_percent: bool) -> str:
    if value is None:
        return "-"
    if is_percent:
        return f"{value:.1f}%"
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.1f}"


def normalize_value(
    value: Optional[float],
    min_value: Optional[float],
    max_value: Optional[float],
    lower_is_better: bool = False,
) -> float:
    if value is None:
        return 0.0
    if min_value is None or max_value is None or max_value <= min_value:
        return 0.0
    scaled = (value - min_value) / (max_value - min_value) * 100.0
    if lower_is_better:
        scaled = 100.0 - scaled
    return max(0.0, min(100.0, scaled))


class WTAClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": HEADERS["User-Agent"]})

    def _get_json(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        include_account_header: bool = False,
    ) -> Any:
        headers: Dict[str, str] = {}
        if include_account_header:
            headers["account"] = "wta"
        response = self.session.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()

    def search_player(self, name: str) -> Dict[str, Any]:
        target = " ".join(name.lower().split())
        search_data = self._get_json(
            BASE_SEARCH_API,
            params={
                "lang": "en",
                "terms": f"{name}*",
                "size": 100,
                "type": "PLAYER",
                "start": 0,
                "fullObjectResponse": "true",
            },
            include_account_header=False,
        )
        candidates = []
        for hit in search_data.get("hits", []):
            ref = hit.get("contentReference") or {}
            full_name = ref.get("fullName")
            player_id = ref.get("id")
            if full_name and player_id:
                candidates.append(
                    {
                        "id": int(player_id),
                        "fullName": full_name,
                        "countryCode": ref.get("countryCode"),
                    }
                )

        if not candidates:
            raise ValueError(f'No player candidates returned for "{name}"')

        exact = [c for c in candidates if " ".join(c["fullName"].lower().split()) == target]
        if exact:
            return exact[0]

        scored = sorted(
            candidates,
            key=lambda c: difflib.SequenceMatcher(
                None, target, " ".join(c["fullName"].lower().split())
            ).ratio(),
            reverse=True,
        )
        best = scored[0]
        score = difflib.SequenceMatcher(
            None, target, " ".join(best["fullName"].lower().split())
        ).ratio()
        if score < 0.6:
            raise ValueError(
                f'Could not confidently resolve "{name}". Top candidate: {best["fullName"]}'
            )
        return best

    def get_h2h(self, player1_id: int, player2_id: int) -> Dict[str, Any]:
        return self._get_json(
            f"{BASE_TENNIS_API}/players/{player1_id}/headtohead/{player2_id}",
            params={"sort": "desc"},
            include_account_header=True,
        )

    def get_player_year_stats(self, player_id: int, year: int) -> Dict[str, Any]:
        return self._get_json(
            f"{BASE_TENNIS_API}/players/{player_id}/year/{year}",
            include_account_header=True,
        )

    def get_player_records(self, player_id: int) -> Dict[str, Any]:
        return self._get_json(
            f"{BASE_TENNIS_API}/players/{player_id}/records",
            include_account_header=True,
        )


def extract_last_meetings(h2h: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
    meetings = []
    for match in (h2h.get("matchEncounterResults") or [])[:limit]:
        p1_name = (match.get("player1Info") or {}).get("fullName", "Player 1")
        p2_name = (match.get("player2Info") or {}).get("fullName", "Player 2")
        winner_flag = match.get("winner")
        winner_name = p1_name if winner_flag == 1 else p2_name if winner_flag == 2 else "Unknown"
        start_date = match.get("StartDate")
        if start_date:
            date_text = datetime.fromisoformat(start_date.replace("Z", "+00:00")).date().isoformat()
        else:
            date_text = "-"
        meetings.append(
            {
                "date": date_text,
                "tournament": match.get("TournamentName"),
                "surface": match.get("Surface"),
                "score": match.get("scores"),
                "winner": winner_name,
            }
        )
    return meetings


def extract_surface_records(records: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    by_surface = records.get("bySurface") or []
    out: Dict[str, Dict[str, Any]] = {}
    for item in by_surface:
        surface = (item.get("surface") or "").upper()
        stats = item.get("statistics") or {}
        out[surface] = {
            "wins": stats.get("wins"),
            "losses": stats.get("losses"),
            "winPercentage": stats.get("winPercentage"),
        }
    return out


def build_metrics(
    player_stats: Dict[str, Any],
    opponent_stats: Dict[str, Any],
    specs: List[MetricSpec],
) -> List[Dict[str, Any]]:
    p_stats = player_stats.get("stats") or {}
    o_stats = opponent_stats.get("stats") or {}
    aggregate = (p_stats.get("AggregateData") or o_stats.get("AggregateData") or {})
    rows = []

    for spec in specs:
        p_raw = to_float(p_stats.get(spec.value_path))
        o_raw = to_float(o_stats.get(spec.value_path))
        avg_raw = to_float(aggregate.get(spec.avg_path))
        min_raw = to_float(aggregate.get(spec.min_path))
        max_raw = to_float(aggregate.get(spec.max_path))

        rows.append(
            {
                "key": spec.key,
                "label": spec.label,
                "is_percent": spec.is_percent,
                "lower_is_better": spec.lower_is_better,
                "player_raw": p_raw,
                "opponent_raw": o_raw,
                "avg_raw": avg_raw,
                "min_raw": min_raw,
                "max_raw": max_raw,
                "player_display": format_value(p_raw, spec.is_percent),
                "opponent_display": format_value(o_raw, spec.is_percent),
                "avg_display": format_value(avg_raw, spec.is_percent),
                "player_norm": normalize_value(p_raw, min_raw, max_raw, spec.lower_is_better),
                "opponent_norm": normalize_value(o_raw, min_raw, max_raw, spec.lower_is_better),
                "avg_norm": normalize_value(avg_raw, min_raw, max_raw, spec.lower_is_better),
            }
        )
    return rows


def radar_plot(
    rows: List[Dict[str, Any]],
    player_name: str,
    opponent_name: str,
    title: str,
    out_path: Path,
) -> None:
    labels = [row["label"] for row in rows]
    p_values = [row["player_norm"] for row in rows]
    o_values = [row["opponent_norm"] for row in rows]
    a_values = [row["avg_norm"] for row in rows]

    angles = [n / float(len(labels)) * 2.0 * math.pi for n in range(len(labels))]
    angles += angles[:1]
    p_values += p_values[:1]
    o_values += o_values[:1]
    a_values += a_values[:1]

    fig = plt.figure(figsize=(11, 9), facecolor="#2D0046")
    ax = plt.subplot(111, polar=True, facecolor="#2D0046")
    ax.set_theta_offset(math.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_ylim(0, 100)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, color="#FAFAF5", fontsize=13)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels([])
    ax.grid(color="#421959", linewidth=1.2)
    ax.spines["polar"].set_color("#421959")

    ax.plot(angles, p_values, color="#00A360", linewidth=2.5, marker="o", markersize=7)
    ax.fill(angles, p_values, color="#00A360", alpha=0.12)

    ax.plot(angles, o_values, color="#F5FA00", linewidth=2.5, marker="o", markersize=7)
    ax.fill(angles, o_values, color="#F5FA00", alpha=0.10)

    ax.plot(angles, a_values, color="#FAFAF5", linewidth=2.2, marker="o", markersize=6)
    ax.fill(angles, a_values, color="#FAFAF5", alpha=0.09)

    legend = ax.legend(
        [player_name, opponent_name, "Tour avg"],
        loc="upper center",
        bbox_to_anchor=(0.5, 1.18),
        ncol=3,
        frameon=False,
        fontsize=13,
        labelcolor="#CFC3D5",
        handlelength=1.8,
    )
    if legend:
        for text in legend.get_texts():
            text.set_color("#CFC3D5")

    ax.set_title(title, color="#FAFAF5", fontsize=16, pad=42)
    fig.tight_layout()
    fig.savefig(out_path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def print_console_report(
    player1: Dict[str, Any],
    player2: Dict[str, Any],
    summary: Dict[str, Any],
    meetings: List[Dict[str, Any]],
    surfaces_p1: Dict[str, Dict[str, Any]],
    surfaces_p2: Dict[str, Dict[str, Any]],
) -> None:
    p1_name = player1["fullName"]
    p2_name = player2["fullName"]
    wins = summary.get("wins", "-")
    losses = summary.get("losses", "-")

    print(f"\nH2H: {p1_name} vs {p2_name}")
    print(f"Career H2H (from {p1_name} perspective): {wins}-{losses}")

    print("\nPast Meetings (latest first):")
    if not meetings:
        print("- No meetings found")
    for m in meetings:
        print(
            f"- {m['date']} | {m['tournament']} | {m['surface']} | "
            f"{m['score']} | Winner: {m['winner']}"
        )

    print("\nCareer Surface Records:")
    for surface in ["HARD", "CLAY", "GRASS"]:
        s1 = surfaces_p1.get(surface, {})
        s2 = surfaces_p2.get(surface, {})
        p1_rec = f"{s1.get('wins', '-')}/{s1.get('losses', '-')}"
        p2_rec = f"{s2.get('wins', '-')}/{s2.get('losses', '-')}"
        p1_pct = s1.get("winPercentage", "-")
        p2_pct = s2.get("winPercentage", "-")
        print(
            f"- {surface}: {p1_name} {p1_rec} ({p1_pct}%) | "
            f"{p2_name} {p2_rec} ({p2_pct}%)"
        )


def print_metric_rows(
    section_title: str,
    rows: List[Dict[str, Any]],
    player1_name: str,
    player2_name: str,
) -> None:
    print(f"\n{section_title}:")
    print(f"- Columns: metric | {player1_name} | {player2_name} | Tour avg")
    for row in rows:
        label = row.get("label", row.get("key", "-")).replace("\n", " ")
        p1_val = row.get("player_display", "-")
        p2_val = row.get("opponent_display", "-")
        avg_val = row.get("avg_display", "-")
        print(f"- {label}: {p1_val} | {p2_val} | {avg_val}")


def show_result_images(serving_png: Path, returning_png: Path) -> None:
    """Display generated radar charts before program exit."""
    try:
        import matplotlib.image as mpimg
    except Exception:
        print("\nCould not import matplotlib.image to display charts.")
        return

    try:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        fig.patch.set_facecolor("#2D0046")

        img1 = mpimg.imread(serving_png)
        img2 = mpimg.imread(returning_png)

        axes[0].imshow(img1)
        axes[0].axis("off")

        axes[1].imshow(img2)
        axes[1].axis("off")

        plt.tight_layout()
        print("\nDisplaying charts. Close the image window to finish.")
        plt.show()
    except Exception as exc:
        print(f"\nCould not display chart window: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Standalone WTA H2H stats + radar charts")
    parser.add_argument("--player1", default=DEFAULT_PLAYER1, help="First player name")
    parser.add_argument("--player2", default=DEFAULT_PLAYER2, help="Second player name")
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR, help="Season stats year")
    parser.add_argument(
        "--out-dir",
        default="standalone_h2h_output",
        help="Output directory for report + charts",
    )
    parser.add_argument(
        "--show-results",
        dest="show_results",
        action="store_true",
        default=True,
        help="Show generated chart images before program exits (default: on).",
    )
    parser.add_argument(
        "--no-show-results",
        dest="show_results",
        action="store_false",
        help="Do not open chart image windows.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    client = WTAClient()

    p1 = client.search_player(args.player1)
    p2 = client.search_player(args.player2)

    h2h = client.get_h2h(p1["id"], p2["id"])
    meetings = extract_last_meetings(h2h, limit=5)
    summary = ((h2h.get("headToHeadSummary") or [{}])[0]) or {}

    p1_year = client.get_player_year_stats(p1["id"], args.year)
    p2_year = client.get_player_year_stats(p2["id"], args.year)
    p1_records = client.get_player_records(p1["id"])
    p2_records = client.get_player_records(p2["id"])

    surfaces_p1 = extract_surface_records(p1_records)
    surfaces_p2 = extract_surface_records(p2_records)

    serving_rows = build_metrics(p1_year, p2_year, SERVING_SPECS)
    returning_rows = build_metrics(p1_year, p2_year, RETURNING_SPECS)

    p1_name = p1["fullName"]
    p2_name = p2["fullName"]
    year = args.year

    serving_png = out_dir / f"serving_radar_{slugify(p1_name)}_vs_{slugify(p2_name)}_{year}.png"
    returning_png = out_dir / f"returning_radar_{slugify(p1_name)}_vs_{slugify(p2_name)}_{year}.png"

    radar_plot(
        serving_rows,
        p1_name,
        p2_name,
        "Serving",
        serving_png,
    )
    radar_plot(
        returning_rows,
        p1_name,
        p2_name,
        "Returning",
        returning_png,
    )

    report = {
        "generatedAtUtc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "players": {"player1": p1, "player2": p2},
        "year": year,
        "careerHeadToHead": {
            "player1Wins": summary.get("wins"),
            "player2Wins": summary.get("losses"),
        },
        "pastMeetings": meetings,
        "careerSurfaceRecords": {
            p1_name: surfaces_p1,
            p2_name: surfaces_p2,
        },
        "seasonMatchStats": {
            "serving": serving_rows,
            "returning": returning_rows,
        },
        "charts": {
            "servingRadarPng": str(serving_png),
            "returningRadarPng": str(returning_png),
        },
    }

    report_path = out_dir / f"h2h_report_{slugify(p1_name)}_vs_{slugify(p2_name)}_{year}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print_console_report(p1, p2, summary, meetings, surfaces_p1, surfaces_p2)
    print_metric_rows(f"Season Match Stats {year} - Serving", serving_rows, p1_name, p2_name)
    print_metric_rows(f"Season Match Stats {year} - Returning", returning_rows, p1_name, p2_name)
    print("\nOutputs:")
    print(f"- Report JSON: {report_path}")
    print(f"- Serving radar: {serving_png}")
    print(f"- Returning radar: {returning_png}")
    if args.show_results:
        show_result_images(serving_png, returning_png)


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as exc:
        body = exc.response.text[:600] if exc.response is not None else str(exc)
        print(f"HTTP error: {body}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
