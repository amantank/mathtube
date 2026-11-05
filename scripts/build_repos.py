"""Build data/repos.json: the most-starred math repositories on GitHub, grouped by GitHub topic.

Usage: GITHUB_TOKEN=... python scripts/build_repos.py   (token optional; without it GitHub allows ~10 searches/min)
"""
import json, os, re, pathlib, time, urllib.parse, urllib.request

GROUPS = {
    "Math in general": ["mathematics"],   # "math"/"maths" are mostly calculators and coding-interview repos
    "Proof assistants": ["theorem-proving", "proof-assistant", "lean4", "coq", "isabelle", "agda", "formal-mathematics"],
    "Computer algebra": ["computer-algebra", "computer-algebra-system", "symbolic-math", "symbolic-computation"],
    "Numerical computing": ["numerical-methods", "numerical-analysis", "linear-algebra"],
    "Visualization": ["manim", "math-visualization", "mathematical-visualization"],
    "Learning math": ["math-education", "mathematics-education", "math-learning"],
    "Math typesetting": ["mathjax", "katex", "latex-math"],
    "Math topics": ["number-theory", "graph-theory", "combinatorics", "topology", "category-theory", "geometry", "calculus", "probability"],
}
PER_TOPIC = 100
# coding-interview and course collections tag themselves "mathematics" too
NOT_MATH = re.compile(r"leetcode|interview|freecodecamp|\bdsa\b|bootcamp|100.days", re.I)
MIN_STARS = 20

token = os.environ.get("GITHUB_TOKEN")
headers = {"Accept": "application/vnd.github+json", "User-Agent": "mathtube-build"}
if token:
    headers["Authorization"] = f"Bearer {token}"

repos = {}
for group, topics in GROUPS.items():
    for topic in topics:
        q = urllib.parse.urlencode({"q": f"topic:{topic} stars:>={MIN_STARS}", "sort": "stars", "order": "desc", "per_page": PER_TOPIC})
        req = urllib.request.Request(f"https://api.github.com/search/repositories?{q}", headers=headers)
        items = json.load(urllib.request.urlopen(req, timeout=30))["items"]
        print(f"{topic}: {len(items)}")
        for r in items:
            if NOT_MATH.search(r["full_name"] + " " + (r["description"] or "")):
                continue
            e = repos.setdefault(r["full_name"], {
                "name": r["full_name"], "desc": (r["description"] or "")[:220], "stars": r["stargazers_count"],
                "lang": r["language"], "url": r["html_url"], "pushed": r["pushed_at"][:10],
                "archived": r["archived"], "groups": []})
            if group not in e["groups"]:
                e["groups"].append(group)
        time.sleep(2.2 if token else 6.5)   # search API: 30 req/min with a token, 10 without

out = pathlib.Path(__file__).resolve().parent.parent / "data" / "repos.json"
data = {"groups": list(GROUPS), "generated": time.strftime("%Y-%m-%d"),
        "repos": sorted(repos.values(), key=lambda r: -r["stars"])}
assert len(data["repos"]) > 100, "suspiciously few repos; did the API rate-limit us?"
out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"wrote {len(repos)} repos to {out}")
