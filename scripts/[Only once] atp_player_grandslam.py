import os
import json
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import re

# Configuration
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "atp"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
}

def get_player_dirs():
    """Get all player directories in data/atp"""
    if not DATA_DIR.exists():
        print(f"Error: Data directory not found at {DATA_DIR}")
        return []
    
    return [d for d in DATA_DIR.iterdir() if d.is_dir() and not d.name.startswith('.')]

def format_player_name_for_wiki(folder_name):
    """
    Convert '001_carlos-alcaraz' -> 'Carlos_Alcaraz'
    Handles special cases like van de Zandschulp if somewhat possible, 
    but relies on Wikipedia redirects for mostly.
    """
    # Remove the number prefix
    parts = folder_name.split('_', 1)
    if len(parts) < 2:
        return None
    
    clean_name = parts[1]
    # rough title case: 'carlos-alcaraz' -> 'Carlos-Alcaraz' -> 'Carlos_Alcaraz'
    # 'botic-van-de-zandschulp' -> 'Botic_Van_De_Zandschulp'
    wiki_name = clean_name.replace('-', ' ').title().replace(' ', '_')
    
    # Manual Fixes for complex names if needed (can expand this list)
    if "Van_De" in wiki_name:
         # Try to fix 'Van_De' to 'van_de' for particles if strict, 
         # but usually Wiki redirects handle Botic_Van_De_Zandschulp -> Botic_van_de_Zandschulp
         pass
         
    return wiki_name

def parse_performance_table(soup):
    """
    Find and parse the Grand Slam singles performance timeline table.
    """
    tables = soup.find_all("table", class_="wikitable")
    
    grand_slams = ["Australian Open", "French Open", "Wimbledon", "US Open"]
    years_data = {}
    
    target_table = None
    
    # Find the correct table
    for table in tables:
        text = table.get_text()
        # Check if it looks like the performance table
        if "Australian Open" in text and "US Open" in text and ("W–L" in text or "Win%" in text):
            target_table = table
            break
            
    if not target_table:
        return None

    # Parse Header to get Years
    headers = []
    # Try finding headers in 'th'
    header_rows = target_table.find_all("tr")
    
    # Locate the header row with years
    year_map = {} # col_index -> year
    
    for r_idx, row in enumerate(header_rows):
        cols = row.find_all(['th', 'td'])
        for c_idx, col in enumerate(cols):
            txt = col.get_text(strip=True)
            # Match 4-digit year (1990-2030)
            if re.match(r'^20[0-2][0-9]$', txt) or re.match(r'^19[9][0-9]$', txt):
                year_map[c_idx] = txt
        if len(year_map) > 2: # heuristic: found a row with enough years
            break
            
    if not year_map:
        return None
        
    # Extract Grand Slam rows
    result_data = {} # { "Australian Open": { "2019": "1R", ... } }
    
    for row in header_rows:
        # Get the first cell (tournament name)
        # Note: th or td
        cols = row.find_all(['th', 'td'])
        if not cols:
            continue
            
        row_label = cols[0].get_text(strip=True)
        # Clean row label (sometimes has footnotes like [a])
        row_label = re.sub(r'\[.*?\]', '', row_label).strip()
        
        if row_label in grand_slams:
            result_data[row_label] = {}
            
            # Map columns to years
            # Note: colspan might mess this up in complex tables, but usually timeline tables are simple grid
            # If standard grid:
            current_col_idx = 0
            
            # Skip first col (label)
            # But wait, cols list index 0 is valid.
            # We need to align with header columns. Header usually starts after "Tournament"
            
            # Let's try to map by index if possible
            # Need to handle the offset if header row had "Tournament" at index 0
            
            # The year_map keys are indices in the *header* row.
            # We need to see if the data row aligns.
            # Usually data row follows same structure.
            
            for c_idx, col in enumerate(cols):
                if c_idx in year_map:
                    year = year_map[c_idx]
                    val = col.get_text(strip=True)
                    # Clean value (remove [1] etc)
                    val = re.sub(r'\[.*?\]', '', val).strip()
                    if val:
                        result_data[row_label][year] = val
                        
    return result_data

def scrape_player(player_dir):
    folder_name = player_dir.name
    wiki_name = format_player_name_for_wiki(folder_name)
    url = f"https://en.wikipedia.org/wiki/{wiki_name}"
    
    print(f"Processing {folder_name} -> {url}")
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 404:
            print(f"  [404] Page not found: {url}")
            return False
            
        soup = BeautifulSoup(resp.content, 'html.parser')
        data = parse_performance_table(soup)
        
        if data:
            # Save to json
            output_file = player_dir / "grandslam_performance.json"
            with open(output_file, 'w') as f:
                json.dump(data, f, indent=4)
            print(f"  [SUCCESS] Saved {len(data)} tournaments data to {output_file.name}")
            return True
        else:
            print(f"  [WARNING] Could not find/parse GS table for {wiki_name}")
            return False
            
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False

def main():
    player_dirs = get_player_dirs()
    print(f"Found {len(player_dirs)} player directories.")
    
    count = 0
    success = 0
    
    player_dirs.sort(key=lambda x: x.name)
    
    for p_dir in player_dirs:
        if scrape_player(p_dir):
            success += 1
        count += 1
        # Be polite to Wikipedia
        time.sleep(1.0)
        
    print(f"\nFinished. Scraped {success}/{count} players.")

if __name__ == "__main__":
    main()
