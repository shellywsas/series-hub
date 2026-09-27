import os
import sys
import re
import mimetypes
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pydantic import BaseModel

from scanner import scan_directory, clean_series_name
from database import load_watched_data, toggle_watched, toggle_favorite, set_last_watched

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

CACHE = {
    "data": None,
    "file_map": {}
}

def get_scanned_data(force: bool = False):
    if CACHE["data"] is None or force:
        res = scan_directory(DOWNLOADS_DIR)
        file_map = {}
        for s_name, s_data in res["series"].items():
            for season_num, eps in s_data["seasons"].items():
                for ep in eps:
                    file_map[ep["id"]] = ep
        for m in res.get("misc_items", []):
            file_map[m["id"]] = m
        CACHE["data"] = res
        CACHE["file_map"] = file_map
    return CACHE["data"]

@app.get("/api/stats")
def get_stats():
    data = get_scanned_data()
    watched_data = load_watched_data()
    watched_map = watched_data.get("watched_episodes", {})
    favs_map = watched_data.get("favorites", {})
    
    total_watched = sum(1 for ep_id, w in watched_map.items() if w and ep_id in CACHE["file_map"])
    total_favorites = sum(1 for ep_id, f in favs_map.items() if f and ep_id in CACHE["file_map"])
    
    return {
        "total_series": data["total_series"],
        "total_episodes": data["total_episodes"],
        "total_watched": total_watched,
        "total_favorites": total_favorites,
        "total_songs": len(data.get("misc_items", []))
    }

@app.get("/api/series")
def list_series():
    data = get_scanned_data()
    watched_data = load_watched_data()
    watched_map = watched_data.get("watched_episodes", {})
    favs_map = watched_data.get("favorites", {})

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
            "poster": s.get("poster"),
            "total_episodes": s["total_episodes"],
            "watched_episodes": watched_count,
            "seasons_count": len(s["seasons"]),
            "seasons": seasons_summary,
            "formats": s["formats"]
        })

    # מציאת פרקים מועדפים
    favorite_episodes = []
    for ep_id, is_fav in favs_map.items():
        if is_fav and ep_id in CACHE["file_map"]:
            ep_item = dict(CACHE["file_map"][ep_id])
            ep_item["watched"] = watched_map.get(ep_id, False)
            ep_item["favorite"] = True
            favorite_episodes.append(ep_item)

    return {
        "series": result,
        "favorites": favorite_episodes,
        "songs": data.get("misc_items", [])
    }

@app.get("/api/series/{series_name}")
def get_series_details(series_name: str):
    data = get_scanned_data()
    if series_name not in data["series"]:
        raise HTTPException(status_code=404, detail="סדרה לא נמצאה")

    s = data["series"][series_name]
    watched_data = load_watched_data()
    watched_map = watched_data.get("watched_episodes", {})
    favs_map = watched_data.get("favorites", {})

    seasons_data = {}
    for s_num, eps in s["seasons"].items():
        ep_list = []
        for ep in eps:
            ep_dict = dict(ep)
            ep_dict["watched"] = watched_map.get(ep["id"], False)
            ep_dict["favorite"] = favs_map.get(ep["id"], False)
            ep_list.append(ep_dict)
        seasons_data[s_num] = ep_list

    return {
        "name": series_name,
        "poster": s.get("poster"),
        "total_episodes": s["total_episodes"],
        "seasons": seasons_data
    }

class OpenFileRequest(BaseModel):
    id: Optional[str] = None
    path: Optional[str] = None

@app.post("/api/open-external")
def open_in_external_player(req: OpenFileRequest):
    file_path = req.path
    if not file_path and req.id:
        ep = CACHE["file_map"].get(req.id)
        if ep:
            file_path = ep["path"]
            if "series" in ep:
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
    watched: Optional[bool] = None

@app.post("/api/watched")
def toggle_watched_status(req: ToggleWatchedRequest):
    new_status = toggle_watched(req.id, req.watched)
    return {"id": req.id, "watched": new_status}

class ToggleFavoriteRequest(BaseModel):
    id: str

@app.post("/api/favorite")
def toggle_favorite_status(req: ToggleFavoriteRequest):
    new_fav = toggle_favorite(req.id)
    return {"id": req.id, "favorite": new_fav}

@app.post("/api/rescan")
def rescan():
    data = get_scanned_data(force=True)
    return {
        "status": "success",
        "total_series": data["total_series"],
        "total_episodes": data["total_episodes"]
    }

@app.get("/api/stream/{episode_id}")
def stream_video(episode_id: str, request: Request):
    """
    הזרמת וידאו סופר-מהירה באיכות מקסימלית (100% ללא דחיסה או ירידת איכות).
    """
    get_scanned_data()
    ep = CACHE["file_map"].get(episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="הקובץ לא נמצא")

    file_path = ep["path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="קובץ הווידאו לא קיים בדיסק")

    if "series" in ep:
        set_last_watched(ep["id"], ep["series"], ep["season"], ep["episode"])

    file_size = os.path.getsize(file_path)
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "video/mp4"

    range_header = request.headers.get("range")
    CHUNK_SIZE = 256 * 1024

    if range_header:
        range_match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            start = max(0, min(start, file_size - 1))
            end = max(start, min(end, file_size - 1))
            content_length = (end - start) + 1

            def range_generator():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    bytes_remaining = content_length
                    while bytes_remaining > 0:
                        to_read = min(CHUNK_SIZE, bytes_remaining)
                        chunk = f.read(to_read)
                        if not chunk:
                            break
                        bytes_remaining -= len(chunk)
                        yield chunk

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": mime_type,
                "Cache-Control": "public, max-age=86400",
            }
            return StreamingResponse(range_generator(), status_code=206, headers=headers)

    def full_generator():
        with open(file_path, "rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": mime_type,
        "Cache-Control": "public, max-age=86400",
    }
    return StreamingResponse(full_generator(), status_code=200, headers=headers)

if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=False)
