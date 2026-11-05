"""Check data/library.json: every website answers, every YouTube playlist exists.
Fills in each playlist's title and channel from YouTube oEmbed and drops playlists that are gone.

Usage: python scripts/check_library.py
"""
import json, pathlib, urllib.parse, urllib.request

path = pathlib.Path(__file__).resolve().parent.parent / "data" / "library.json"
lib = json.loads(path.read_text(encoding="utf-8"))
UA = {"User-Agent": "Mozilla/5.0 (mathtube link check)"}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return r.status, r.read()

bad_sites = []
for s in lib["sites"]:
    try:
        get(s["url"])
    except Exception as e:   # 403s from bot walls still mean the site exists
        if getattr(e, "code", None) not in (403, 429):
            bad_sites.append((s["name"], s["url"], str(e)[:80]))

kept = []
for p in lib["playlists"]:
    url = "https://www.youtube.com/playlist?list=" + p["list"]
    try:
        _, body = get("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe=""))
        meta = json.loads(body)
        kept.append({**p, "title": meta["title"], "channel": meta["author_name"]})
    except Exception as e:
        print("DROP playlist", p["list"], str(e)[:60])
lib["playlists"] = kept

path.write_text(json.dumps(lib, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(kept)} playlists kept")
for b in bad_sites:
    print("BAD SITE", *b)
