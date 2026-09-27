import os
import re
import hashlib
from typing import Dict, List, Optional, Any

VIDEO_EXTENSIONS = ('.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts')

# מילון שמות מתורגמים/נורמליזציה של שמות סדרות באנגלית או כתיב שונה
SERIES_ALIASES = {
    'gingi-2015': "ג'ינג'י",
    'gingi': "ג'ינג'י",
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
}

# קידומות מפיצים ואיכויות להסרה משם הקובץ
RELEASE_PREFIXES = [
    r'^(?:1080p|720p|480p|360p)\s+נתי\s+מדיה\s+',
    r'^נתי\s+מדיה\s+',
    r'^יוסי\s+סרטים\s+',
    r'^לולו_סרטים_',
    r'^קינג סרט\s*',
    r'^סדרות\s+',
    r'^אבי סרטים\s*-\s*',
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
    # הסרת קידומות נותרות
    for p in RELEASE_PREFIXES:
        name = re.sub(p, '', name, flags=re.IGNORECASE).strip()
    name = re.sub(r'[_\.]+', ' ', name).strip()
    
    # בדיקת מילון שמות
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
    
    # התעלמות מווידאו שאינו סדרה (כמו סרטוני וואטסאפ)
    if base.lower().startswith('whatsapp video'):
        return None

    clean = base
    # הסרת קידומות מפיצים
    for prefix in RELEASE_PREFIXES:
        clean = re.sub(prefix, '', clean, flags=re.IGNORECASE).strip()

    # בדיקת זיהוי עונה ופרק במגוון תבניות:
    
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
            series_raw = "ללא שם סדרה"
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
            series_raw = "ללא שם סדרה"
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

    # תבנית 4: רק "עונה X פרק Y" ללא שם סדרה
    m4 = re.search(r'עונה[_\s]*(\d+)[_\s]+פרק[_\s]*(\d+)', clean)
    if m4:
        return {
            'series': 'פרקים ללא זיהוי סדרה',
            'season': int(m4.group(1)),
            'episode': str(int(m4.group(2))),
            'episode_num': int(m4.group(2)),
            'filename': filename,
            'format': ext.lower().replace('.', '').upper()
        }

    # אם הקובץ וידאו אך לא זוהתה עונה/פרק (סרט בודד או מיוחד)
    clean_title = re.sub(r'[_.]', ' ', clean).strip()
    for q in QUALITY_TAGS:
        clean_title = re.sub(q, '', clean_title, flags=re.IGNORECASE)
    
    return {
        'series': 'סרטים ותכנים נוספים',
        'season': 1,
        'episode': '1',
        'episode_num': 1,
        'filename': filename,
        'title': clean_title,
        'format': ext.lower().replace('.', '').upper()
    }


def scan_directory(directory_path: str) -> Dict[str, Any]:
    """
    סורק את התיקייה בצורה בטוחה (Read-Only) ומקבץ את כל הסדרות, העונות והפרקים.
    """
    if not os.path.exists(directory_path):
        return {'series': {}, 'total_episodes': 0, 'total_series': 0}

    series_dict: Dict[str, Any] = {}
    total_episodes = 0

    # סריקה רקורסיבית (כולל תתי-תיקיות אם יש)
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
                
                # יצירת מזהה ייחודי לפרק
                file_id = hashlib.md5(full_path.encode('utf-8')).hexdigest()[:12]
                
                series_name = meta['series']
                season_num = meta['season']
                
                if series_name not in series_dict:
                    series_dict[series_name] = {
                        'name': series_name,
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

    # מיון הפרקים בכל עונה לפי מספר הפרק
    for s_name, s_data in series_dict.items():
        s_data['formats'] = list(s_data['formats'])
        for s_num in s_data['seasons']:
            s_data['seasons'][s_num].sort(key=lambda x: (x['episode_num'], x['filename']))

    return {
        'series': series_dict,
        'total_episodes': total_episodes,
        'total_series': len(series_dict)
    }

if __name__ == '__main__':
    # בדיקה מהירה מול תיקיית ההורדות
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    downloads_dir = r'C:\Users\shell\Downloads'
    result = scan_directory(downloads_dir)
    print(f"Total Series: {result['total_series']}")
    print(f"Total Episodes: {result['total_episodes']}")
    print("\nSeries Breakdown:")
    for name, data in sorted(result['series'].items(), key=lambda x: -x[1]['total_episodes']):
        seasons_str = ", ".join([f"עונה {s} ({len(eps)} פרקים)" for s, eps in sorted(data['seasons'].items())])
        print(f"• {name}: {data['total_episodes']} פרקים [{seasons_str}] - פורמטים: {data['formats']}")
