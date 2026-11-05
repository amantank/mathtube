"""Build data/videos.json from the HackerTube open dataset (ODC-By, https://hackertube.org/data).

Usage: python scripts/build_data.py path/to/hackertube-data
"""
import json, sys, pathlib

MATH = {
    "pure-mathematics": "Pure math",
    "recreational-math": "Visual & recreational",
    "probability-game-theory": "Probability & games",
    "logic-formal-methods": "Logic & proof",
    "information-theory": "Information theory",
    "computational-theory": "Theory of computation",
    "math-theory-other": "Other math",
}
OFF_TOPIC_AREAS = {"politics-history-society", "life-sciences-health", "earth-energy-environment",
                   "business-economics", "systems-security", "hardware", "arts-entertainment"}
MAX_COMMENTS = 8

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / "data" / "videos.json"

def jsonl(name):
    with open(src / name, encoding="utf-8") as f:
        for line in f:
            yield json.loads(line)

videos = {}
for v in jsonl("videos.jsonl"):
    cats = [c["id"] for c in v["categories"] if c["id"] in MATH]
    # a single math tag on a politics/psychology/security video is usually incidental
    if not cats or (len(cats) < 2 and v["categories"][0]["area"] in OFF_TOPIC_AREAS):
        continue
    videos[v["vid"]] = {
        "vid": v["vid"], "title": v["title"], "channel": v["channel"],
        "summary": v["summary"], "why": v["why_hn"], "type": v["content_type"],
        "level": v["level"], "topic": v["primary_topic"], "tags": v["tags"],
        "cats": cats, "score": v["score"], "recs": v["hn"]["recommenders"],
        "years": [v["hn"]["first_year"], v["hn"]["last_year"]], "comments": [],
    }

# strongest recommendations first, then newest
rank = {"strong_rec": 0, "rec": 1}
for m in sorted(jsonl("mentions.jsonl"), key=lambda m: (rank.get(m["stance"], 2), m["month"]), reverse=False):
    v = videos.get(m["vid"])
    if v and len(v["comments"]) < MAX_COMMENTS:
        v["comments"].append({"id": m["hn_comment_id"], "by": m["author"], "month": m["month"],
                              "story": m["story_title"], "text": m["text"]})

for r in jsonl("related.jsonl"):
    if r["vid"] in videos:
        videos[r["vid"]]["related"] = [x["vid"] for x in r["related"] if x["vid"] in videos][:12]

data = {"categories": MATH, "videos": sorted(videos.values(), key=lambda v: -v["score"])}
assert data["videos"], "no math videos found: wrong dataset path?"
assert all(v["comments"] for v in data["videos"]), "every video should have at least one HN comment"
out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"wrote {len(videos)} videos to {out}")
