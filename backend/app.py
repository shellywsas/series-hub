import os
import sys
import re
import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pydantic import BaseModel

from scanner import scan_directory, clean_series_name
from database import load_watched_data, toggle_watched, set_last_watched
from organizer import plan_organization, execute_organization

DOWNLOADS_DIR = r"C:\Users\shell\Downloads"
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

app = FastAPI(title="SeriesHub API", description="Local streaming and series management server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# מטמון סריקה בזיכרון
CACHE = {
    "data": None,
    "file_map": {}
}

# פלטות צבעים ניאון גרדיאנטים עבור Glassmorphism
PALETTES = [
    {"from": "#8b5cf6", "to": "#3b82f6", "accent": "#a855f7"},  # Purple - Blue
    {"from": "#06b6d4", "to": "#3b82f6", "accent": "#22d3ee"},  # Cyan - Blue
    {"from": "#ec4899", "to": "#8b5cf6", "accent": "#f43f5e"},  # Pink - Purple
    {"from": "#10b981", "to": "#06b6d4", "accent": "#34d399"},  # Emerald - Cyan
    {"from": "#f59e0b", "to": "#ef4444", "accent": "#fbbf24"},  # Amber - Red
    {"from": "#6366f1", "to": "#a855f7", "accent": "#818cf8"},  # Indigo - Purple
    {"from": "#14b8a6", "to": "#0284c7", "accent": "#2dd4bf"},  # Teal - Sky
]

def get_series_palette(name: str):
    idx = sum(ord(c) for c in name) % len(PALETTES)
    return PALETTES[idx]

def get_scanned_data(force: bool = False):
    if CACHE["data"] is None or force:
        res = scan_directory(DOWNLOADS_DIR)
        file_map = {}
        for s_name, s_data in res["series"].items():
            for season_num, eps in s_data["seasons"].items():
                for ep in eps:
                    file_map[ep["id"]] = ep
        CACHE["data"] = res
        CACHE["file_map"] = file_map
    return CACHE["data"]

@app.get("/api/stats")
def get_stats():
    data = get_scanned_data()
    watched_data = load_watched_data()
    watched_map = watched_data.get("watched_episodes", {})
    
    total_watched = sum(1 for ep_id, w in watched_map.items() if w and ep_id in CACHE["file_map"])
    
    return {
        "total_series": data["total_series"],
        "total_episodes": data["total_episodes"],
        "total_watched": total_watched,
        "last_watched": watched_data.get("last_watched")
    }

@app.get("/api/series")
def list_series():
    data = get_scanned_data()
    watched_data = load_watched_data()
    watched_map = watched_data.get("watched_episodes", {})

    result = []
    for name, s in sorted(data["series"].items(), key=lambda x: -x[1]["total_episodes"]):
        watched_count = 0
        seasons_summary = {}
        for s_num, eps in s["seasons"].items():
            s_watched = sum(1 for ep in eps if watched_map.get(ep["id"], False))
            watched_count += s_watched
            seasons_summary[s_num] = {
                "episode_count": len(eps),
                "watched_count": s_watched
            }

        result.append({
            "name": name,
            "total_episodes": s["total_episodes"],
            "watched_episodes": watched_count,
            "seasons_count": len(s["seasons"]),
            "seasons": seasons_summary,
            "formats": s["formats"],
            "palette": get_series_palette(name)
        })

    return {"series": result}

@app.get("/api/series/{series_name}")
def get_series_details(series_name: str):
    data = get_scanned_data()
    if series_name not in data["series"]:
        raise HTTPException(status_code=404, detail="סדרה לא נמצאה")

    s = data["series"][series_name]
    watched_data = load_watched_data()
    watched_map = watched_data.get("watched_episodes", {})

    seasons_data = {}
    for s_num, eps in s["seasons"].items():
        ep_list = []
        for ep in eps:
            ep_dict = dict(ep)
            ep_dict["watched"] = watched_map.get(ep["id"], False)
            ep_list.append(ep_dict)
        seasons_data[s_num] = ep_list

    return {
        "name": series_name,
        "palette": get_series_palette(series_name),
        "total_episodes": s["total_episodes"],
        "seasons": seasons_data
    }

class OpenFileRequest(BaseModel):
    id: Optional[str] = None
    path: Optional[str] = None

@app.post("/api/open-external")
def open_in_external_player(req: OpenFileRequest):
    """
    פותח את הקובץ ישירות בנגן המדיה המקומי (VLC או נגן ברירת המחדל של Windows).
    מעולה עבור MKV, AVI, פורמטים עם קידודים כבדים וסאונד היקפי.
    """
    file_path = req.path
    if not file_path and req.id:
        ep = CACHE["file_map"].get(req.id)
        if ep:
            file_path = ep["path"]
            set_last_watched(ep["id"], ep["series"], ep["season"], ep["episode"])

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="קובץ לא נמצא")

    try:
        os.startfile(file_path)
        return {"status": "success", "message": "הקובץ נפתח בנגן המדיה המקומי"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאה בפתיחת הקובץ: {str(e)}")

class ToggleWatchedRequest(BaseModel):
    id: str

@app.post("/api/watched")
def toggle_watched_status(req: ToggleWatchedRequest):
    new_status = toggle_watched(req.id)
    return {"id": req.id, "watched": new_status}

@app.post("/api/rescan")
def rescan():
    data = get_scanned_data(force=True)
    return {
        "status": "success",
        "total_series": data["total_series"],
        "total_episodes": data["total_episodes"]
    }

@app.get("/api/organize/preview")
def get_organize_preview():
    plan = plan_organization()
    return plan

@app.post("/api/organize/execute")
def run_organization():
    result = execute_organization(dry_run=False)
    # סריקה מחדש של הנתונים כדי לעדכן את המטמון בנתיבים החדשים
    get_scanned_data(force=True)
    return result

@app.get("/api/stream/{episode_id}")
def stream_video(episode_id: str, request: Request):
    """
    הזרמת וידאו עם תמיכה מלאה ב-HTTP Range Requests (קידום והרצה חלקה בדפדפן).
    """
    get_scanned_data()
    ep = CACHE["file_map"].get(episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="הפרק לא נמצא")

    file_path = ep["path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="קובץ הווידאו לא קיים בדיסק")

    # עדכון פרק אחרון שנצפה
    set_last_watched(ep["id"], ep["series"], ep["season"], ep["episode"])

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "video/mp4"

    if range_header:
        # פענוח Range: bytes=start-end
        range_match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            start = min(start, file_size - 1)
            end = min(end, file_size - 1)
            content_length = (end - start) + 1

            def iterfile():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    remaining = content_length
                    chunk_size = 1024 * 1024  # 1MB chunks
                    while remaining > 0:
                        read_bytes = min(chunk_size, remaining)
                        data = f.read(read_bytes)
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": mime_type,
            }
            return StreamingResponse(iterfile(), status_code=206, headers=headers)

    # ללא Range Header
    def iter_full():
        with open(file_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": mime_type,
    }
    return StreamingResponse(iter_full(), status_code=200, headers=headers)

# הגשת קבצי ה-Frontend
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 שרת SeriesHub פועל כעת!")
    print("🌐 פתח בדפדפן: http://localhost:5000")
    print("=" * 60)
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=False)
