import os
import re
import shutil
from typing import Dict, List, Any
from scanner import scan_directory, parse_episode_filename, VIDEO_EXTENSIONS

DOWNLOADS_DIR = r"C:\Users\shell\Downloads"
SERIES_TARGET_DIR = r"C:\Users\shell\Downloads\סדרות"

def sanitize_folder_name(name: str) -> str:
    """
    מסיר או ממיר תווים שאינם חוקיים בשמות תיקיות ב-Windows:
    < > : " / \ | ? *
    """
    clean = name.replace('"', "''")
    clean = re.sub(r'[<>:/\\|?*]', '-', clean)
    return clean.strip(' .')

def plan_organization(downloads_path: str = DOWNLOADS_DIR, target_base: str = SERIES_TARGET_DIR) -> Dict[str, Any]:
    """
    מתכנן את ארגון הקבצים לתיקיות סדרה ועונה מבלי לגעת בקבצים עצמם (Dry Run).
    """
    moves = []
    skipped = []
    
    if not os.path.exists(downloads_path):
        return {"moves": [], "skipped": [], "total_moves": 0}

    # סורקים רק קבצים שנמצאים ישירות בתיקיית ההורדות (לא נוגעים במה שכבר אורגן)
    for item in os.listdir(downloads_path):
        item_path = os.path.join(downloads_path, item)
        if not os.path.isfile(item_path):
            continue

        ext = os.path.splitext(item)[1].lower()
        if ext not in VIDEO_EXTENSIONS:
            continue

        meta = parse_episode_filename(item)
        if not meta or meta["series"] in ("סרטים ותכנים נוספים", "פרקים ללא זיהוי סדרה"):
            skipped.append({"filename": item, "reason": "לא זוהתה סדרה מוגדרת"})
            continue

        series_folder_name = sanitize_folder_name(meta["series"])
        season_folder_name = f"עונה {meta['season']}"
        dest_dir = os.path.join(target_base, series_folder_name, season_folder_name)
        
        target_filename = item
        dest_path = os.path.join(dest_dir, target_filename)

        moves.append({
            "source_path": item_path,
            "filename": item,
            "series": meta["series"],
            "season": meta["season"],
            "dest_dir": dest_dir,
            "dest_path": dest_path
        })

    return {
        "moves": moves,
        "skipped": skipped,
        "total_moves": len(moves),
        "total_skipped": len(skipped)
    }

def execute_organization(dry_run: bool = True) -> Dict[str, Any]:
    """
    מבצע את הארגון הפיזי בבטיחות מלאה של 100%:
    - שום קובץ לעולם לא נמחק.
    - אם קובץ יעד כבר קיים, מייצר שם ייחודי כדי לא לדרוס לעולם.
    """
    plan = plan_organization()
    if dry_run:
        return {"dry_run": True, **plan}

    executed_moves = []
    for item in plan["moves"]:
        src = item["source_path"]
        dest_dir = item["dest_dir"]
        dest_path = item["dest_path"]

        # יצירת התיקייה במידת הצורך
        try:
            os.makedirs(dest_dir, exist_ok=True)
        except Exception as e:
            executed_moves.append({
                "source": src,
                "dest": dest_path,
                "status": "error",
                "error": f"Failed to create dir: {e}"
            })
            continue

        # וידוא שאין דריסה של קובץ קיים
        if os.path.exists(dest_path):
            base, ext = os.path.splitext(item["filename"])
            counter = 1
            while os.path.exists(dest_path):
                dest_path = os.path.join(dest_dir, f"{base}_copy{counter}{ext}")
                counter += 1

        try:
            shutil.move(src, dest_path)
            executed_moves.append({
                "source": src,
                "dest": dest_path,
                "status": "success"
            })
        except Exception as e:
            executed_moves.append({
                "source": src,
                "dest": dest_path,
                "status": "error",
                "error": str(e)
            })

    return {
        "dry_run": False,
        "total_executed": len([m for m in executed_moves if m["status"] == "success"]),
        "target_directory": SERIES_TARGET_DIR,
        "results": executed_moves
    }

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    print("בדיקת תוכנית ארגון (Dry Run)...")
    res = plan_organization()
    print(f"סה\"כ קבצים המיועדים למיון מסודר: {res['total_moves']}")
    print(f"סה\"כ קבצים שיישארו במקומם: {res['total_skipped']}")
    print("\nדוגמה ל-5 קבצים ראשונים שייכנסו לתיקיות סדרה:")
    for m in res['moves'][:5]:
        print(f"• {m['filename']} ➔ {m['series']} / עונה {m['season']}")
