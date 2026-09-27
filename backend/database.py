import os
import json
from typing import Dict, Any

DATA_FILE = os.path.join(os.path.dirname(__file__), 'watched.json')

def load_watched_data() -> Dict[str, Any]:
    if not os.path.exists(DATA_FILE):
        return {'watched_episodes': {}, 'last_watched': None}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'watched_episodes': {}, 'last_watched': None}

def save_watched_data(data: Dict[str, Any]):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving watch data: {e}")

def toggle_watched(episode_id: str) -> bool:
    data = load_watched_data()
    is_watched = not data['watched_episodes'].get(episode_id, False)
    data['watched_episodes'][episode_id] = is_watched
    save_watched_data(data)
    return is_watched

def set_last_watched(episode_id: str, series_name: str, season: int, episode_num: Any):
    data = load_watched_data()
    data['last_watched'] = {
        'id': episode_id,
        'series': series_name,
        'season': season,
        'episode': episode_num
    }
    save_watched_data(data)
