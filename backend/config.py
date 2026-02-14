import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration for the Tennis Dashboard API"""
    
    # Server settings
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5001))
    # Default OFF to avoid Flask reloader double-start in local scripts.
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    
    # API Keys (if needed for premium data sources)
    RAPID_API_KEY = os.getenv('RAPID_API_KEY', '')
    
    # Cache settings (seconds)
    CACHE_LIVE_SCORES = 30  # Update live scores every 30 seconds
    CACHE_RANKINGS = 3600   # Update rankings every hour
    CACHE_TOURNAMENTS = 1800  # Update tournaments every 30 minutes
    
    # Tournament categories and their colors (for reference)
    TOURNAMENT_CATEGORIES = {
        'grand_slam': {
            'name': 'Grand Slam',
            'color': '#9B59B6',
            'points': 2000
        },
        'masters_1000': {
            'name': 'Masters 1000',
            'color': '#F1C40F',
            'points': 1000
        },
        'atp_500': {
            'name': 'ATP/WTA 500',
            'color': '#3498DB',
            'points': 500
        },
        'atp_250': {
            'name': 'ATP/WTA 250',
            'color': '#2ECC71',
            'points': 250
        },
        'atp_125': {
            'name': 'ATP/WTA 125',
            'color': '#E67E22',
            'points': 125
        },
        'other': {
            'name': 'Other',
            'color': '#95A5A6',
            'points': 0
        }
    }
    
    # Grand Slam tournaments
    GRAND_SLAMS = [
        'Australian Open',
        'Roland Garros',
        'Wimbledon',
        'US Open'
    ]
    
    # Masters 1000 tournaments
    MASTERS_1000 = [
        'Indian Wells',
        'Miami Open',
        'Monte-Carlo',
        'Madrid Open',
        'Italian Open',
        'Canadian Open',
        'Cincinnati Open',
        'Shanghai Masters',
        'Paris Masters'
    ]
