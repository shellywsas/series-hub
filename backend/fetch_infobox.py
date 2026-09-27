import urllib.request
import urllib.parse
import re
import os
import json
import sys

POSTERS_DIR = r"C:\Users\shell\.gemini\antigravity\scratch\series-hub\frontend\posters"
os.makedirs(POSTERS_DIR, exist_ok=True)

SHOW_PAGES = {
    "נעלמים": "נעלמים_(סדרת_טלוויזיה)",
    "שכונה": "שכונה_(סדרת_טלוויזיה)",
    "אליפים": "אליפים_(סדרת_טלוויזיה)",
    "כדברא": "כדברא_(סדרת_טלוויזיה)",
    "התחנה": "התחנה_(סדרת_טלוויזיה)",
    "כפולה": "כפולה_(סדרת_טלוויזיה)",
    "הנפילים": "הנפילים",
    "ג'ינג'י": "ג'ינג'י_(סדרת_טלוויזיה,_2015)",
    "Quantum Leap": "Quantum_Leap_(2022_TV_series)"
}

def extract_image(page_title, lang="he"):
    if lang == "en":
        url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(page_title)}"
    else:
        url = f"https://he.wikipedia.org/wiki/{urllib.parse.quote(page_title)}"
    
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode("utf-8")
            # find infobox image
            m = re.search(r'infobox-image.*?src="([^"]+)"', html, re.DOTALL)
            if not m:
                m = re.search(r'class="infobox.*?src="([^"]+)"', html, re.DOTALL)
            if m:
                src = m.group(1)
                if src.startswith("//"):
                    src = "https:" + src
                # remove thumbnail reduction if possible to get better quality
                return src
    except Exception as e:
        print(f"Error fetching {page_title}: {e}")
    return None

def download(url, dest):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r, open(dest, "wb") as f:
            f.write(r.read())
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    for show, page in SHOW_PAGES.items():
        lang = "en" if show == "Quantum Leap" else "he"
        img_url = extract_image(page, lang=lang)
        if img_url:
            safe_name = show.replace("'", "").replace('"', '').replace(" ", "_")
            dest = os.path.join(POSTERS_DIR, f"{safe_name}.jpg")
            if download(img_url, dest):
                print(f"SUCCESS: {show} -> {dest}")
            else:
                print(f"FAILED DOWNLOAD: {show}")
        else:
            print(f"NO IMAGE FOUND: {show}")

if __name__ == '__main__':
    main()
