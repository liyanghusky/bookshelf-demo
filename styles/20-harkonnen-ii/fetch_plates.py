# -*- coding: utf-8 -*-
"""Fetch on-theme images from Wikimedia Commons and render them as Giedi-Prime
infrared plates (high-contrast B&W) for the Harkonnen II style. Distinct per slot."""
import json, os, io, time, urllib.request, urllib.parse, urllib.error
from PIL import Image, ImageOps, ImageEnhance

UA = "Mozilla/5.0 (harkonnen-plates; personal demo)"
START = int(os.environ.get("START","0"))   # numbering offset
TERMS = [
    ("figure",  "classical greek statue nude figure"),
    ("brutal",  "brutalist architecture concrete building"),
    ("monolith","concrete monument modernist"),
    ("cathedral","gothic cathedral nave interior"),
    ("foundry", "foundry molten metal furnace"),
    ("dome",    "monumental dome architecture interior"),
]
OUT = os.path.join(os.path.dirname(__file__), "img")

def api_url(term):
    q = urllib.parse.urlencode({
        "action":"query","generator":"search","gsrsearch":term,"gsrnamespace":"6",
        "gsrlimit":"4","prop":"imageinfo","iiprop":"url|mime","iiurlwidth":"1400","format":"json",
    })
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?"+q, headers={"User-Agent":UA})
    data = json.load(urllib.request.urlopen(req, timeout=40))
    pages = (data.get("query") or {}).get("pages") or {}
    for p in sorted(pages.values(), key=lambda x:x.get("index",99)):
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime","")
        if mime in ("image/jpeg","image/png") and ii.get("thumburl"):
            return ii["thumburl"], ii.get("descriptionurl","")
    return None, None

def treat(raw):
    im = Image.open(io.BytesIO(raw)).convert("L")          # grayscale
    im = ImageOps.autocontrast(im, cutoff=1)               # stretch range
    im = ImageEnhance.Contrast(im).enhance(1.45)           # hard infrared contrast
    im = ImageEnhance.Brightness(im).enhance(0.94)
    # tint toward bone/void duotone
    lo, hi = (14,14,16), (233,230,221)
    duo = ImageOps.colorize(im, black=lo, white=hi, mid=(120,116,108))
    # portrait crop ~3:4 centered
    w,h = duo.size; tw,th = 900,1200
    sc = max(tw/w, th/h); duo = duo.resize((int(w*sc),int(h*sc)), Image.LANCZOS)
    w,h = duo.size; duo = duo.crop(((w-tw)//2,(h-th)//2,(w-tw)//2+tw,(h-th)//2+th))
    return duo

def fetch_retry(fn, *a):
    for attempt in range(4):
        try: return fn(*a)
        except urllib.error.HTTPError as e:
            if e.code==429: time.sleep(12*(attempt+1)); continue
            raise
    return None

def main():
    os.makedirs(OUT, exist_ok=True)
    credits = []
    n = START
    for key, term in TERMS:
        try:
            time.sleep(5)
            url, desc = fetch_retry(api_url, term) or (None,None)
            if not url: print("  no result:", term); continue
            time.sleep(3)
            raw = fetch_retry(lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":UA}), timeout=60).read(), url)
            plate = treat(raw)
            fn = "plate%02d.jpg" % (n+1)
            plate.save(os.path.join(OUT, fn), quality=82)
            credits.append("%s  <-  %s  (%s)" % (fn, term, desc))
            print("  %s  %-9s %dx%d" % (fn, key, *plate.size))
            n += 1
        except Exception as e:
            print("  ERR", term, e)
    open(os.path.join(OUT, "CREDITS.txt"),"w",encoding="utf-8").write("\n".join(credits))
    print("done:", n, "plates")

if __name__ == "__main__":
    main()
