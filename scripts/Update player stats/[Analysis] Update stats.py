#!/usr/bin/env python3
"""
Analysis script to scan ATP and WTA player folders and report:
- Total players found
- Valid images count and rank distribution (1-200)
- Stats last updated timestamps
- Grand Slam stats update status (ATP only)
- Whether Grand Slam data needs updating based on latest tournament date
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

# Configuration initialization
def load_config(script_dir: Path) -> Dict:
    config_path = script_dir / "update_config.json"
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG = load_config(SCRIPT_DIR)

def resolve_path(cfg_section: str, default_rel: str) -> Path:
    rel = CONFIG.get(cfg_section, {}).get("root", default_rel)
    return (SCRIPT_DIR / rel).resolve()

ATP_ROOT = resolve_path("atp_stats", "../../data/atp")
WTA_ROOT = resolve_path("wta_stats", "../../data/wta")

# Latest Grand Slam dates (2026)
LATEST_GRAND_SLAMS = {
    "Australian Open": "2026-02-02",  # Approximate
    "French Open": "2026-06-14",
    "Wimbledon": "2026-07-13",
    "US Open": "2026-09-13"
}


def green(text: str) -> str:
    return f"\033[92m{text}\033[0m"


def yellow(text: str) -> str:
    return f"\033[93m{text}\033[0m"


def red(text: str) -> str:
    return f"\033[91m{text}\033[0m"


def cyan(text: str) -> str:
    return f"\033[96m{text}\033[0m"


def load_json(path: Path) -> Optional[Dict]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def calculate_average_timestamp(timestamps: List[str]) -> Optional[datetime]:
    """Calculate average timestamp from list of ISO format timestamps"""
    valid_timestamps = []
    for ts in timestamps:
        try:
            valid_timestamps.append(datetime.fromisoformat(ts))
        except Exception:
            pass
    
    if not valid_timestamps:
        return None
    
    # Calculate average as epoch time
    epoch_times = [ts.timestamp() for ts in valid_timestamps]
    avg_epoch = sum(epoch_times) / len(epoch_times)
    return datetime.fromtimestamp(avg_epoch, tz=timezone.utc)


def format_time_ago(dt: datetime) -> str:
    """Format datetime as 'X days and Y hours ago'"""
    if not dt:
        return "Unknown"
    
    now = datetime.now(timezone.utc)
    delta = now - dt
    
    days = delta.days
    seconds = delta.seconds
    hours = seconds // 3600
    
    if days == 0 and hours == 0:
        minutes = seconds // 60
        if minutes == 0:
            return "just now"
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif days == 0:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif hours == 0:
        return f"{days} day{'s' if days != 1 else ''} ago"
    else:
        return f"{days} day{'s' if days != 1 else ''} and {hours} hour{'s' if hours != 1 else ''} ago"


def is_valid_image_url(url: str) -> bool:
    """Check if URL is valid (basic validation)"""
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    if not url or url == "-" or url.lower() == "none":
        return False
    try:
        result = urlparse(url)
        return bool(result.scheme and result.netloc)
    except Exception:
        return False


def extract_image_rank(url: str) -> Optional[int]:
    """Try to extract rank from image URL if present"""
    if not url:
        return None
    # Many sites use ranking in URL like /players/001/, /players/099/, etc.
    import re
    match = re.search(r'/(\d{1,3})/', url)
    if match:
        rank = int(match.group(1))
        if 1 <= rank <= 200:
            return rank
    return None


def extract_rank_from_folder(folder_name: str) -> int:
    """Extract rank index from folder name (e.g., '001_name' -> 1)"""
    try:
        parts = folder_name.split('_')
        if parts and parts[0].isdigit():
            return int(parts[0])
    except Exception:
        pass
    return 0


def analyze_player_folder(folder: Path, tour: str) -> Dict:
    """Analyze a single player folder"""
    profile_path = folder / "profile.json"
    stats_path = folder / "stats_2026.json"
    grandslam_path = folder / "grandslam_performance.json"
    
    profile = load_json(profile_path)
    stats = load_json(stats_path)
    grandslam = load_json(grandslam_path) if tour == "ATP" else None
    
    # Extract rank from folder name
    rank_index = extract_rank_from_folder(folder.name)
    
    result = {
        "player_name": profile.get("name", "Unknown") if profile else folder.name,
        "player_id": profile.get("player_id", "") if profile else "",
        "has_profile": profile is not None,
        "has_stats": stats is not None,
        "has_grandslam": tour == "ATP" and grandslam is not None,
        "image_valid": False,
        "image_rank": rank_index,  # Use folder prefix as the reliable rank
        "stats_updated_at": None,
        "grandslam_updated_at": None,
        "grandslam_needs_update": False,
    }
    
    # Check image validity
    if profile:
        image_url = profile.get("image_url", "")
        result["image_valid"] = is_valid_image_url(image_url)
    
    # Check stats timestamp
    if stats:
        result["stats_updated_at"] = stats.get("updated_at", None)
    
    # Check Grand Slam timestamp and update status (ATP only)
    if tour == "ATP" and grandslam:
        result["grandslam_updated_at"] = grandslam.get("updated_at", None)
        # Determine if update is needed
        if result["grandslam_updated_at"]:
            last_update = datetime.fromisoformat(result["grandslam_updated_at"])
            # Get the latest Grand Slam date
            latest_gs_date = max(
                datetime.fromisoformat(date) 
                for date in LATEST_GRAND_SLAMS.values()
            )
            result["grandslam_needs_update"] = last_update < latest_gs_date
    
    return result


def scan_tour(root: Path, tour: str) -> Tuple[List[Dict], Dict]:
    """Scan all players in a tour folder"""
    if not root.exists():
        return [], {}
    
    folders = sorted([d for d in root.iterdir() if d.is_dir() and not d.name.startswith('.')])
    players = []
    
    for folder in folders:
        analysis = analyze_player_folder(folder, tour)
        players.append(analysis)
    
    # Aggregate statistics
    stats = {
        "total": len(players),
        "with_profile": sum(1 for p in players if p["has_profile"]),
        "with_stats": sum(1 for p in players if p["has_stats"]),
        "with_grandslam": sum(1 for p in players if p["has_grandslam"]),
        "valid_images": sum(1 for p in players if p["image_valid"]),
        "image_ranks": {},
        "stats_updated_recent": 0,
        "grandslam_needs_update": 0,
        "stats_average_timestamp": None,
        "stats_average_ago": "Unknown",
    }
    
    # Get image rank distribution
    for player in players:
        if player["image_rank"]:
            rank = player["image_rank"]
            stats["image_ranks"][rank] = stats["image_ranks"].get(rank, 0) + 1
    
    # Calculate average stats timestamp and check recency
    now = datetime.now(timezone.utc)
    stats_timestamps = []
    for player in players:
        if player["stats_updated_at"]:
            try:
                updated = datetime.fromisoformat(player["stats_updated_at"])
                stats_timestamps.append(player["stats_updated_at"])
                days_ago = (now - updated).days
                if days_ago <= 7:
                    stats["stats_updated_recent"] += 1
            except Exception:
                pass
    
    if stats_timestamps:
        avg_ts = calculate_average_timestamp(stats_timestamps)
        stats["stats_average_timestamp"] = avg_ts.isoformat() if avg_ts else None
        stats["stats_average_ago"] = format_time_ago(avg_ts)
    
    # Count Grand Slam updates needed
    if tour == "ATP":
        stats["grandslam_needs_update"] = sum(
            1 for p in players if p["grandslam_needs_update"]
        )
    
    # Analyze players ranked 1-200
    ranked_players = [p for p in players if p["image_rank"] and 1 <= p["image_rank"] <= 200]
    stats["ranked_1_200_total"] = len(ranked_players)
    stats["ranked_1_200_updated_stats"] = sum(1 for p in ranked_players if p["stats_updated_at"])
    stats["ranked_1_200_valid_images"] = sum(1 for p in ranked_players if p["image_valid"])
    stats["ranked_1_200_with_grandslam"] = 0
    stats["highest_complete_rank"] = 0  # New: track highest rank with all data
    
    if tour == "ATP":
        stats["ranked_1_200_with_grandslam"] = sum(1 for p in ranked_players if p["has_grandslam"])
        # For ATP: find the HIGHEST rank index that satisfies all conditions
        # (Allows gaps, but ensures that after this rank, no player is fully complete)
        complete_atp_ranks = [
            p["image_rank"] for p in players 
            if p.get("image_rank") and p["image_valid"] and p["stats_updated_at"] and p["has_grandslam"]
        ]
        stats["highest_complete_rank"] = max(complete_atp_ranks) if complete_atp_ranks else 0
    else:
        # For WTA: find HIGHEST rank index with valid image AND updated stats
        complete_wta_ranks = [
            p["image_rank"] for p in players 
            if p.get("image_rank") and p["image_valid"] and p["stats_updated_at"]
        ]
        stats["highest_complete_rank"] = max(complete_wta_ranks) if complete_wta_ranks else 0
    
    return players, stats


def print_report(atp_players: List[Dict], atp_stats: Dict, 
                 wta_players: List[Dict], wta_stats: Dict):
    """Print analysis report"""
    print("\n" + "="*70)
    print(cyan("ATP & WTA PLAYER DATA ANALYSIS REPORT"))
    print("="*70 + "\n")
    
    total_all = atp_stats["total"] + wta_stats["total"]
    print(green(f"Total Players Found: {total_all}"))
    print(f"  • ATP: {atp_stats['total']}")
    print(f"  • WTA: {wta_stats['total']}\n")
    
    # Image analysis
    valid_images_all = atp_stats["valid_images"] + wta_stats["valid_images"]
    print(green(f"Valid Images: {valid_images_all}/{total_all}"))
    print(f"  • ATP: {atp_stats['valid_images']}/{atp_stats['total']} ({100*atp_stats['valid_images']//atp_stats['total'] if atp_stats['total'] else 0}%)")
    print(f"  • WTA: {wta_stats['valid_images']}/{wta_stats['total']} ({100*wta_stats['valid_images']//wta_stats['total'] if wta_stats['total'] else 0}%)")
    
    # Image rank distribution
    print("\n" + cyan("Image Rank Distribution (1-200):"))
    all_ranks = {}
    for rank, count in atp_stats["image_ranks"].items():
        all_ranks[rank] = all_ranks.get(rank, 0) + count
    for rank, count in wta_stats["image_ranks"].items():
        all_ranks[rank] = all_ranks.get(rank, 0) + count
    
    if all_ranks:
        sorted_ranks = sorted(all_ranks.items())
        for rank, count in sorted_ranks[:10]:  # Show top 10
            print(f"  Rank {rank:3d}: {count:3d} players")
        if len(sorted_ranks) > 10:
            print(f"  ... and {len(sorted_ranks) - 10} more ranks")
    else:
        print("  No rank data found\n")
    
    # Stats update info
    print("\n" + cyan("Stats Update Status:"))
    atp_pct = 100*atp_stats["stats_updated_recent"]//atp_stats['total'] if atp_stats['total'] else 0
    wta_pct = 100*wta_stats["stats_updated_recent"]//wta_stats['total'] if wta_stats['total'] else 0
    print(f"  Updated in last 7 days:")
    print(f"    • ATP: {atp_stats['stats_updated_recent']}/{atp_stats['total']} ({atp_pct}%)")
    print(f"    • WTA: {wta_stats['stats_updated_recent']}/{wta_stats['total']} ({wta_pct}%)")
    
    # Show average update timestamps
    print(f"\n  Average update time:")
    print(f"    • ATP: {atp_stats['stats_average_ago']}")
    print(f"    • WTA: {wta_stats['stats_average_ago']}")
    
    # Show some example timestamps
    print(f"\n  Sample timestamps:")
    atp_samples = [p for p in atp_players if p["stats_updated_at"]][:3]
    wta_samples = [p for p in wta_players if p["stats_updated_at"]][:3]
    
    if atp_samples:
        print(f"    ATP:")
        for player in atp_samples:
            ago = format_time_ago(datetime.fromisoformat(player["stats_updated_at"]))
            print(f"      • {player['player_name']}: {ago}")
    
    if wta_samples:
        print(f"    WTA:")
        for player in wta_samples:
            ago = format_time_ago(datetime.fromisoformat(player["stats_updated_at"]))
            print(f"      • {player['player_name']}: {ago}")
    
    # Grand Slam analysis (ATP only)
    print("\n" + cyan("Grand Slam Data Status (ATP Only):"))
    print(f"  Total with Grand Slam data: {atp_stats['with_grandslam']}/{atp_stats['total']}")
    print(f"  Needs update: {atp_stats['grandslam_needs_update']}/{atp_stats['with_grandslam']}")
    
    if atp_stats["grandslam_needs_update"] > 0:
        print(f"\n  {yellow('⚠ Action Required:')}")
        print(f"  {atp_stats['grandslam_needs_update']} ATP players need Grand Slam data update")
        print(f"  Latest Grand Slam: {max(LATEST_GRAND_SLAMS.values())}")
        print(f"  Run: python \"[Only once] atp_player_grandslam.py\" to refresh")
    else:
        print(f"\n  {green('✓ Grand Slam data is up-to-date')}")
    
    # Players needing updates
    print("\n" + cyan("ATP Players Needing Grand Slam Update:"))
    atp_gs_outdated = [p for p in atp_players if p["grandslam_needs_update"]]
    if atp_gs_outdated:
        for player in atp_gs_outdated[:5]:
            last_update = player.get("grandslam_updated_at", "Unknown")
            print(f"  • {player['player_name']}: Last updated {last_update}")
        if len(atp_gs_outdated) > 5:
            print(f"  ... and {len(atp_gs_outdated) - 5} more")
    else:
        print("  None - all up-to-date!")
    
    # Data completeness
    print("\n" + cyan("Data Completeness:"))
    print(f"  ATP:")
    print(f"    • Profile files: {atp_stats['with_profile']}/{atp_stats['total']}")
    print(f"    • Stats files: {atp_stats['with_stats']}/{atp_stats['total']}")
    print(f"    • Grand Slam files: {atp_stats['with_grandslam']}/{atp_stats['total']}")
    print(f"  WTA:")
    print(f"    • Profile files: {wta_stats['with_profile']}/{wta_stats['total']}")
    print(f"    • Stats files: {wta_stats['with_stats']}/{wta_stats['total']}")
    
    # Players ranked 1-200 analysis
    print("\n" + cyan("Top Players Data Coverage:"))
    
    if atp_stats['highest_complete_rank'] > 0:
        print(f"  ATP - Complete data available up to Rank {atp_stats['highest_complete_rank']}")
        print(f"    (Includes valid image + stats + Grand Slam data)")
        print(f"    * Note: Some players within range 1-{atp_stats['highest_complete_rank']} might be missing data")
    else:
        print(f"  ATP - No players with complete data found")
    
    if wta_stats['highest_complete_rank'] > 0:
        print(f"\n  WTA - Complete data available up to Rank {wta_stats['highest_complete_rank']}")
        print(f"    (Includes valid image + stats)")
        print(f"    * Note: Some players within range 1-{wta_stats['highest_complete_rank']} might be missing data")
    else:
        print(f"\n  WTA - No players with complete data found")
    
    print("\n" + "="*70 + "\n")


def print_json(atp_players: List[Dict], atp_stats: Dict, wta_players: List[Dict], wta_stats: Dict):
    """Output analysis result as JSON"""
    result = {
        "timestamp": datetime.now().isoformat(),
        "atp": {
            "stats": atp_stats,
            "players_needing_update": [
                {
                    "name": p["player_name"], 
                    "gs_update_needed": p["grandslam_needs_update"],
                    "stats_age_days": (datetime.now(timezone.utc) - datetime.fromisoformat(p["stats_updated_at"])).days if p.get("stats_updated_at") else 999
                } 
                for p in atp_players # Just minimal details for the UI
            ],
            "top_rank_coverage": atp_stats['highest_complete_rank']
        },
        "wta": {
            "stats": wta_stats,
            "players_needing_update": [
                {
                    "name": p["player_name"],
                    "stats_age_days": (datetime.now(timezone.utc) - datetime.fromisoformat(p["stats_updated_at"])).days if p.get("stats_updated_at") else 999
                }
                for p in wta_players
            ],
            "top_rank_coverage": wta_stats['highest_complete_rank']
        }
    }
    print(json.dumps(result, indent=2))


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description='Analyze player data health')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')
    args = parser.parse_args()

    if not args.json:
        print(yellow("Scanning ATP and WTA player folders..."))
    
    atp_players, atp_stats = scan_tour(ATP_ROOT, "ATP")
    wta_players, wta_stats = scan_tour(WTA_ROOT, "WTA")
    
    if not atp_players and not wta_players:
        if not args.json:
            print(red("No player folders found!"))
        else:
            print(json.dumps({"error": "No player folders found"}))
        return 1
    
    if args.json:
        print_json(atp_players, atp_stats, wta_players, wta_stats)
    else:
        print_report(atp_players, atp_stats, wta_players, wta_stats)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
