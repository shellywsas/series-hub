import os
import re
import hashlib
from typing import Dict, List, Optional, Any

VIDEO_EXTENSIONS = ('.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts')

# מילון שמות מתורגמים/נורמליזציה של שמות סדרות באנגלית או כתיב שונה
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

# קידומות מפיצים ואיכויות להסרה משם הקובץ
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

# סיומות ואיכויות להסרה
QUALITY_TAGS = [
    r'[\s_]+(1080p|720p|480p|360p|HD|FHD|WEB-DL|WEBRip|BluRay|DVDRip|HDRip)',
    r'[\s_]+ISrTeLeG',
    r'[\s_]+קינג סרט',
    r'[\s_]+אחרון_לעונה',
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

def parse_episode_filename(filename: str) -> Optional[Dict[str, Any]]:
    base, ext = os.path.splitext(filename)
    if ext.lower() not in VIDEO_EXTENSIONS:
        return None
    
    # התעלמות מווידאו שאינו שייך
    if base.lower().startswith('whatsapp video'):
        return None

    clean = base
    for prefix in RELEASE_PREFIXES:
        clean = re.sub(prefix, '', clean, flags=re.IGNORECASE).strip()

    # תבנית מיוחדת עם נקודות כגון: בני.ערובה.ע1פ1
    m_dots = re.search(r'^(בני[\._]ערובה)[\._]ע(\d+)פ(\d+)', clean)
    if m_dots:
        return {
            'series': 'בני ערובה',
            'season': int(m_dots.group(2)),
            'episode': str(int(m_dots.group(3))),
            'episode_num': int(m_dots.group(3)),
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 1: שמות לועזיים כגון gingi-2015.S1E10_480P או shchuna.S1E43
    m1 = re.search(r'^(.*?)[._\-\s]+[sS](\d+)[eE](\d+)(?:[+_\-](\d+))?', clean)
    if m1:
        series_raw = m1.group(1)
        season = int(m1.group(2))
        ep1 = int(m1.group(3))
        ep2 = int(m1.group(4)) if m1.group(4) else None
        ep_str = f"{ep1}+{ep2}" if ep2 else str(ep1)
        series_name = clean_series_name(series_raw)
        return {
            'series': series_name,
            'season': season,
            'episode': ep_str,
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 2: עונה X פרק Y (עם תמיכה ב-פרק כפול 1+2 או 1-2)
    m2 = re.search(r'^(.*?)(?:[_\s]+)עונה[_\s]*(\d+)[_\s]+פרק[_\s]*(\d+)(?:[+_\-](\d+))?', clean)
    if m2:
        series_raw = m2.group(1).strip('_ ')
        if not series_raw:
            series_raw = "פרקים בודדים"
        season = int(m2.group(2))
        ep1 = int(m2.group(3))
        ep2 = int(m2.group(4)) if m2.group(4) else None
        ep_str = f"{ep1}+{ep2}" if ep2 else str(ep1)
        series_name = clean_series_name(series_raw)
        return {
            'series': series_name,
            'season': season,
            'episode': ep_str,
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 3: קיצורים ישראליים כגון ע1פ27 או ע1 פ30 או ע2 פ 28
    m3 = re.search(r'^(.*?)(?:[_\s]+)ע\s*(\d+)\s*פ\s*(\d+)(?:[+_\-](\d+))?', clean)
    if m3:
        series_raw = m3.group(1).strip('_ ')
        if not series_raw:
            series_raw = "פרקים בודדים"
        season = int(m3.group(2))
        ep1 = int(m3.group(3))
        ep2 = int(m3.group(4)) if m3.group(4) else None
        ep_str = f"{ep1}+{ep2}" if ep2 else str(ep1)
        series_name = clean_series_name(series_raw)
        return {
            'series': series_name,
            'season': season,
            'episode': ep_str,
            'episode_num': ep1,
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # תבנית 4: רק "עונה X פרק Y"
    m4 = re.search(r'עונה[_\s]*(\d+)[_\s]+פרק[_\s]*(\d+)', clean)
    if m4:
        return {
            'series': 'פרקים בודדים',
            'season': int(m4.group(1)),
            'episode': str(int(m4.group(2))),
            'episode_num': int(m4.group(2)),
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # שירים, קליפים ופרויקטים אישיים (לא סדרות)
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
    total_episodes = 0

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
                
                # אם מדובר בשיר/יצירה אישית ולא בסדרה
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
                
                if series_name not in series_dict:
                    # בדיקת פוסטר רשמי
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

                episode_data = {
                    'id': file_id,
                    'series': series_name,
                    'season': season_num,
                    'episode': meta['episode'],
                    'episode_num': meta['episode_num'],
                    'filename': f,
                    'path': full_path,
                    'format': meta['format'],
                    'size_mb': round(file_size / (1024 * 1024), 1),
                    'is_playable_in_browser': meta['format'] in ('MP4', 'WEBM')
                }

                seasons[season_num].append(episode_data)
                series_dict[series_name]['total_episodes'] += 1
                series_dict[series_name]['formats'].add(meta['format'])
                total_episodes += 1

    # מיון הפרקים
    for s_name, s_data in series_dict.items():
        s_data['formats'] = list(s_data['formats'])
        for s_num in s_data['seasons']:
            s_data['seasons'][s_num].sort(key=lambda x: (x['episode_num'], x['filename']))

    return {
        'series': series_dict,
        'total_episodes': total_episodes,
        'total_series': len(series_dict),
        'misc_items': misc_items
    }
