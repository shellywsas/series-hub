import os
import re
import hashlib
from typing import Dict, List, Optional, Any

VIDEO_EXTENSIONS = ('.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts')

# מילון שמות מתורגמים/נורמליזציה
SERIES_ALIASES = {
    'gingi-2015': "ג'ינג'י",
    'gingi': "ג'ינג'י",
    'גינגי': "ג'ינג'י",
    'shchuna': 'שכונה',
    'ha-nephilim': 'הנפילים',
    'hanephilim': 'הנפילים',
    'kadabra': 'כדברא',
    'פלמח': 'פלמ"ח',
    'פלמ_ח': 'פלמ"ח',
    'פלמ ח': 'פלמ"ח',
    'פלמ\'\'ח': 'פלמ"ח',
    'פלמ""ח': 'פלמ"ח',
    'ספיידרז': 'ספיידרז',
    'חצויה': 'חצויה',
    'נעלמים': 'נעלמים',
    'האי': 'האי',
    'סקיי': 'סקיי',
    'החממה': 'החממה',
    'אליפים': 'אליפים',
    'כפולה': 'כפולה',
    'התחנה': 'התחנה',
    'אילת': 'אילת',
    'בני ערובה': 'בני ערובה',
    'בני.ערובה': 'בני ערובה',
    'בני_ערובה': 'בני ערובה',
}

# שמות תמונות פוסטר שמורות מקומית
POSTER_FILES = {
    "האי": "posters/האי.jpg",
    "שכונה": "posters/שכונה.jpg",
    "חצויה": "posters/חצויה.jpg",
    "פלמ\"ח": "posters/פלמח.jpg",
    "פלמ''ח": "posters/פלמח.jpg",
    "נעלמים": "posters/נעלמים.jpg",
    "ספיידרז": "posters/ספיידרז.jpg",
    "אליפים": "posters/אליפים.jpg",
    "כדברא": "posters/כדברא.jpg",
    "החממה": "posters/החממה.jpg",
    "הנפילים": "posters/הנפילים.jpg",
    "אילת": "posters/אילת.jpg",
    "התחנה": "posters/התחנה.jpg",
    "סקיי": "posters/סקיי.jpg",
    "כפולה": "posters/כפולה.jpg",
    "בני ערובה": "posters/בני_ערובה.jpg",
    "ג'ינג'י": "posters/גינגי.jpg",
    "Quantum Leap": "posters/Quantum_Leap.jpg"
}

# קידומות מפיצים להסרה
RELEASE_PREFIXES = [
    r'^(?:1080p|720p|480p|360p)[_\s]+נתי[_\s]+מדיה[_\s]+',
    r'^נתי[_\s]+מדיה[_\s]+',
    r'^יוסי[_\s]+סרטים[_\s]+',
    r'^לולו[_\s]+סרטים[_\s]+',
    r'^קינג[_\s]+סרט\s*',
    r'^סדרות\s+',
    r'^אבי[_\s]+סרטים\s*-\s*',
    r'^ISrTeLeG\s*-\s*',
]

def clean_series_name(name: str) -> str:
    name = name.strip()
    for p in RELEASE_PREFIXES:
        name = re.sub(p, '', name, flags=re.IGNORECASE).strip()
    name = re.sub(r'[_\.]+', ' ', name).strip()
    
    name_lower = name.lower()
    for alias, standard in SERIES_ALIASES.items():
        if name_lower == alias.lower() or name_lower.startswith(alias.lower()):
            return standard
        if standard.replace('"', '').replace("'", "").replace(" ", "") == name.replace('"', '').replace("'", "").replace(" ", ""):
            return standard

    return name

def sanitize_clean_string(clean: str) -> str:
    """מנקה מראש את כל תגיות האיכות, הקבוצות והסיומות כדי שלא יתערבבו עם מספרי הפרקים"""
    # מסיר סיומות איכות כמו _480P, _720P, _1080P, 480p, 720p, 1080p
    clean = re.sub(r'[\s_]+(?:1080[pP]|720[pP]|480[pP]|360[pP])\b', '', clean)
    clean = re.sub(r'\b(?:1080[pP]|720[pP]|480[pP]|360[pP])\b', '', clean)
    # מסיר קידומות נפוצות
    for p in RELEASE_PREFIXES:
        clean = re.sub(p, '', clean, flags=re.IGNORECASE).strip()
    # מסיר תגיות נוספות כמו ISrTeLeG, קינג סרט, אחרון לעונה
    clean = re.sub(r'[\s_]+(?:ISrTeLeG|קינג סרט|אחרון_לעונה|אחרון לעונה)', '', clean, flags=re.IGNORECASE)
    # מסיר סיומות כפילות כגון (1), (2)
    clean = re.sub(r'\s*\(\d+\)$', '', clean)
    return clean.strip()

def validate_episode_str(ep1: int, ep2_candidate: Optional[str]) -> str:
    """מוודא שמספר הפרק נקי ולעולם לא מכיל איכויות כמו 480 או 720 או 1080"""
    if ep2_candidate:
        try:
            ep2 = int(ep2_candidate)
            # פרק כפול חוקי בלבד (למשל 1+2 או 47+48), לא רזולוציות
            if ep2 not in (480, 720, 1080, 360) and ep2 < 200 and (ep2 == ep1 + 1 or ep2 == ep1 + 2 or ep2 == ep1):
                return f"{ep1}+{ep2}"
        except ValueError:
            pass
    return str(ep1)

def parse_episode_filename(filename: str) -> Optional[Dict[str, Any]]:
    base, ext = os.path.splitext(filename)
    if ext.lower() not in VIDEO_EXTENSIONS:
        return None
    
    if base.lower().startswith('whatsapp video'):
        return None

    clean = sanitize_clean_string(base)

    # תבנית מיוחדת: בני.ערובה.ע1פ1
    m_dots = re.search(r'^(בני[\._\s]ערובה)[\._\s]ע(\d+)[\._\s]*פ(\d+)', clean)
    if m_dots:
        ep_num = int(m_dots.group(3))
        return {
            'series': 'בני ערובה',
            'season': int(m_dots.group(2)),
            'episode': str(ep_num),
            'episode_num': ep_num,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 1: שמות לועזיים כגון gingi-2015.S1E10 או shchuna.S1E43
    m1 = re.search(r'^(.*?)[._\-\s]+[sS](\d+)[eE](\d+)(?:[+_\-](\d+))?', clean)
    if m1:
        series_raw = m1.group(1)
        season = int(m1.group(2))
        ep1 = int(m1.group(3))
        ep_str = validate_episode_str(ep1, m1.group(4))
        series_name = clean_series_name(series_raw)
        return {
            'series': series_name,
            'season': season,
            'episode': ep_str,
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 2: עונה X פרק Y
    m2 = re.search(r'^(.*?)(?:[_\s]+)עונה[_\s]*(\d+)[_\s]+פרק[_\s]*(\d+)(?:[+_\-](\d+))?', clean)
    if m2:
        series_raw = m2.group(1).strip('_ ')
        if not series_raw:
            series_raw = "פרקים בודדים"
        season = int(m2.group(2))
        ep1 = int(m2.group(3))
        ep_str = validate_episode_str(ep1, m2.group(4))
        series_name = clean_series_name(series_raw)
        return {
            'series': series_name,
            'season': season,
            'episode': ep_str,
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 3: קיצורים ע1פ27 או ע1 פ30
    m3 = re.search(r'^(.*?)(?:[_\s]+)ע\s*(\d+)\s*פ\s*(\d+)(?:[+_\-](\d+))?', clean)
    if m3:
        series_raw = m3.group(1).strip('_ ')
        if not series_raw:
            series_raw = "פרקים בודדים"
        season = int(m3.group(2))
        ep1 = int(m3.group(3))
        ep_str = validate_episode_str(ep1, m3.group(4))
        series_name = clean_series_name(series_raw)
        return {
            'series': series_name,
            'season': season,
            'episode': ep_str,
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 4: רק עונה X פרק Y
    m4 = re.search(r'עונה[_\s]*(\d+)[_\s]+פרק[_\s]*(\d+)', clean)
    if m4:
        ep1 = int(m4.group(2))
        return {
            'series': 'פרקים בודדים',
            'season': int(m4.group(1)),
            'episode': str(ep1),
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # שירים, קליפים ויצירות אישיות
    clean_title = re.sub(r'[_.]', ' ', clean).strip()
    return {
        'series': 'שירים ויצירות אישיות',
        'season': 1,
        'episode': '1',
        'episode_num': 1,
        'filename': filename,
        'title': clean_title,
        'format': ext.lower().replace('.', '').upper(),
        'is_song_or_misc': True
    }


def scan_directory(directory_path: str) -> Dict[str, Any]:
    if not os.path.exists(directory_path):
        return {'series': {}, 'total_episodes': 0, 'total_series': 0, 'misc_items': []}

    series_dict: Dict[str, Any] = {}
    misc_items: List[Dict[str, Any]] = []
    
    # מפה ייעודית למניעת כפילויות של פרקים זהים: (series, season, episode) -> best_episode
    unique_episodes_map: Dict[tuple, Dict[str, Any]] = {}

    for root, _, files in os.walk(directory_path):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in VIDEO_EXTENSIONS:
                meta = parse_episode_filename(f)
                if not meta:
                    continue

                full_path = os.path.join(root, f)
                try:
                    file_size = os.path.getsize(full_path)
                except OSError:
                    file_size = 0
                
                file_id = hashlib.md5(full_path.encode('utf-8')).hexdigest()[:12]
                
                if meta.get('is_song_or_misc'):
                    misc_items.append({
                        'id': file_id,
                        'title': meta.get('title', f),
                        'filename': f,
                        'path': full_path,
                        'format': meta['format'],
                        'size_mb': round(file_size / (1024 * 1024), 1),
                        'is_playable_in_browser': meta['format'] in ('MP4', 'WEBM')
                    })
                    continue

                series_name = meta['series']
                season_num = meta['season']
                ep_str = meta['episode']

                episode_data = {
                    'id': file_id,
                    'series': series_name,
                    'season': season_num,
                    'episode': ep_str,
                    'episode_num': meta['episode_num'],
                    'filename': f,
                    'path': full_path,
                    'format': meta['format'],
                    'size_mb': round(file_size / (1024 * 1024), 1),
                    'is_playable_in_browser': meta['format'] in ('MP4', 'WEBM')
                }

                # סינון כפילויות: אם הפרק כבר קיים, שומרים רק את העותק הטוב ביותר
                ep_key = (series_name, season_num, ep_str)
                if ep_key in unique_episodes_map:
                    existing = unique_episodes_map[ep_key]
                    # עדיפות 1: MP4 על פני פורמטים שדורשים VLC
                    # עדיפות 2: קובץ בגודל גדול יותר (איכות גבוהה יותר)
                    if not existing['is_playable_in_browser'] and episode_data['is_playable_in_browser']:
                        unique_episodes_map[ep_key] = episode_data
                    elif existing['format'] == episode_data['format'] and episode_data['size_mb'] > existing['size_mb']:
                        unique_episodes_map[ep_key] = episode_data
                else:
                    unique_episodes_map[ep_key] = episode_data

    # בניית עץ הסדרות מהפרקים הייחודיים בלבד (ללא כפילויות!)
    total_unique_episodes = 0
    for (series_name, season_num, _), ep in unique_episodes_map.items():
        if series_name == "פרקים בודדים":
            continue

        if series_name not in series_dict:
            poster_url = POSTER_FILES.get(series_name)
            if not poster_url:
                for s_k, p_v in POSTER_FILES.items():
                    if s_k.replace('"', '').replace("'", "") == series_name.replace('"', '').replace("'", ""):
                        poster_url = p_v
                        break

            series_dict[series_name] = {
                'name': series_name,
                'poster': poster_url,
                'seasons': {},
                'total_episodes': 0,
                'formats': set()
            }

        seasons = series_dict[series_name]['seasons']
        if season_num not in seasons:
            seasons[season_num] = []

        seasons[season_num].append(ep)
        series_dict[series_name]['total_episodes'] += 1
        series_dict[series_name]['formats'].add(ep['format'])
        total_unique_episodes += 1

    # מיון הפרקים
    for s_name, s_data in series_dict.items():
        s_data['formats'] = list(s_data['formats'])
        for s_num in s_data['seasons']:
            s_data['seasons'][s_num].sort(key=lambda x: (x['episode_num'], x['filename']))

    return {
        'series': series_dict,
        'total_episodes': total_unique_episodes,
        'total_series': len(series_dict),
        'misc_items': misc_items
    }
