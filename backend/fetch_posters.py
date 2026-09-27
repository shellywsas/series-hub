import urllib.request
import urllib.parse
import json
import os
import sys

POSTERS_DIR = r"C:\Users\shell\.gemini\antigravity\scratch\series-hub\frontend\posters"
os.makedirs(POSTERS_DIR, exist_ok=True)

SERIES_SEARCH_TERMS = {
    "האי": ["האי (סדרת טלוויזיה)", "האי"],
    "שכונה": ["שכונה (סדרת טלוויזיה)", "שכונה"],
    "חצויה": ["חצויה"],
    "פלמ''ח": ["פלמ\"ח (סדרת טלוויזיה)", "פלמח (סדרת טלוויזיה)"],
    "נעלמים": ["נעלמים (סדרת טלוויזיה)"],
    "ספיידרז": ["ספיידרז"],
    "אליפים": ["אליפים (סדרת טלוויזיה)"],
    "כדברא": ["כדברא (סדרת טלוויזיה)", "כדברא"],
    "החממה": ["החממה"],
    "הנפילים": ["הנפילים"],
    "אילת": ["אילת (סדרת טלוויזיה)"],
    "התחנה": ["התחנה (סדרת טלוויזיה)"],
    "סקיי": ["סקיי (סדרת טלוויזיה)"],
    "כפולה": ["כפולה (סדרת טלוויזיה)"],
    "בני ערובה": ["בני ערובה (סדרת טלוויזיה)"],
    "ג'ינג'י": ["ג'ינג'י (סדרת טלוויזיה 2015)", "ג'ינג'י (סדרת טלוויזיה)"],
    "Quantum Leap": ["Quantum Leap (2022 TV series)", "Quantum Leap"]
}

def get_wiki_poster(titles):
    headers = {"User-Agent": "SeriesHub/2.0 (series.hub@local.app)"}
    for title in titles:
        # Check Hebrew Wikipedia first
        try:
            url = "https://he.wikipedia.org/w/api.php?action=query&titles=" + urllib.parse.quote(title) + "&prop=pageimages&format=json&pithumbsize=800"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                pages = data.get("query", {}).get("pages", {})
                for _, page in pages.items():
                    if "thumbnail" in page:
                        return page["thumbnail"]["source"]
        except Exception as e:
            pass
        
        # Check English Wikipedia if needed
        try:
            url = "https://en.wikipedia.org/w/api.php?action=query&titles=" + urllib.parse.quote(title) + "&prop=pageimages&format=json&pithumbsize=800"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                pages = data.get("query", {}).get("pages", {})
                for _, page in pages.items():
                    if "thumbnail" in page:
                        return page["thumbnail"]["source"]
        except Exception:
            pass
    return None

def download_image(url, target_path):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp, open(target_path, "wb") as out:
            out.write(resp.read())
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    manifest = {}
    for series, terms in SERIES_SEARCH_TERMS.items():
        safe_name = series.replace("'", "").replace('"', '').replace(" ", "_")
        target_file = os.path.join(POSTERS_DIR, f"{safe_name}.jpg")
        
        img_url = get_wiki_poster(terms)
        if img_url:
            print(f"Found poster for {series}: {img_url}")
            success = download_image(img_url, target_file)
            if success:
                manifest[series] = f"posters/{safe_name}.jpg"
                print(f"Saved to {target_file}")
            else:
                manifest[series] = img_url
        else:
            print(f"No Wikipedia poster found for {series}")

    # Save manifest
    with open(os.path.join(os.path.dirname(POSTERS_DIR), "posters_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("Poster manifest saved!")

if __name__ == "__main__":
    main()
