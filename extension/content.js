// MathTube mode: hides every YouTube video tile that isn't about math, plus Shorts and feed shelves.
// Each video is first judged by keywords (instant), then by the Jev AI classifier via mathtube.in when it answers.
const TILES = [
  "ytd-rich-item-renderer", "ytd-video-renderer", "ytd-compact-video-renderer", "ytd-grid-video-renderer",
  "ytd-playlist-renderer", "ytd-compact-playlist-renderer", "ytd-radio-renderer", "ytd-compact-radio-renderer",
  "ytd-channel-renderer", "yt-lockup-view-model",
].join(",");
const ALWAYS_HIDE = [
  "ytd-reel-shelf-renderer", "ytd-rich-section-renderer", "grid-shelf-view-model",
  "ytm-shorts-lockup-view-model", "ytd-ad-slot-renderer", "ytd-guide-entry-renderer:has(a[title='Shorts'])",
  "ytd-mini-guide-entry-renderer:has(a[title='Shorts'])", "ytd-reel-video-renderer",
  // with most of the home feed hidden, its "load more" marker stays on screen and would fetch pages forever
  'ytd-browse[page-subtype="home"] ytd-continuation-item-renderer',
].join(",");
const TOPICS = ["Linear algebra", "Calculus", "Probability", "Number theory", "Geometry", "Topology"];

let on = false, want = "", aiDown = false;   // off until settings load, so nothing is sent if the user turned it off
const verdicts = new Map();   // video id -> {math, match} from the classifier
const queue = new Map();      // video id -> text, waiting to be classified
const asked = new Set();

function vidOf(el) {
  const a = el.querySelector('a[href*="watch?v="]');
  return a ? new URL(a.href).searchParams.get("v") : null;
}

function keep(el) {
  const text = el.textContent;   // not innerText: that is empty once the tile is hidden, so it would never come back
  const vid = vidOf(el);
  const v = vid && verdicts.get(vid);
  if (v) return v.math >= 0.5 && (v.match == null || v.match >= 0.5);
  if (vid && on && !aiDown && !asked.has(vid)) {
    asked.add(vid);
    queue.set(vid, text.replace(/\s+/g, " ").trim().slice(0, 300));
    flushSoon();
  }
  return isMath(text);
}

let flushing = false;
function flushSoon() {
  if (flushing) return;
  flushing = true;
  setTimeout(flush, 400);   // collect a screenful of tiles into one request
}

function flush() {
  const batch = [...queue].slice(0, 20);
  if (!batch.length) { flushing = false; return; }   // queue was cleared by a topic change while waiting
  batch.forEach(([vid]) => queue.delete(vid));
  const askedWant = want;
  const done = (r) => {
    flushing = false;
    if (!r || (r.error && r.error !== 400)) aiDown = true;   // no key, limit hit or offline: keywords for this page
    else if (!r.error && askedWant === want) for (const [vid, v] of Object.entries(r.results)) verdicts.set(vid, v);
    if (queue.size && !aiDown) flushSoon();
    pass();
  };
  try {
    chrome.runtime.sendMessage({ type: "classify", want, items: batch.map(([vid, text]) => ({ vid, text })) }, done);
  } catch { done(null); }   // extension was reloaded; this old content script can't reach it any more
}

function pass() {
  for (const el of document.querySelectorAll(TILES)) el.classList.toggle("mathtube-hide", !keep(el));
  for (const el of document.querySelectorAll(ALWAYS_HIDE)) el.classList.add("mathtube-hide");
  banner();
}

function banner() {
  const home = document.querySelector('ytd-browse[page-subtype="home"]:not([hidden]) #primary');
  if (!home || home.querySelector("#mathtube-banner")) return;
  const b = document.createElement("div");
  b.id = "mathtube-banner";
  // built with DOM calls: YouTube's Trusted Types policy rejects innerHTML
  b.append(Object.assign(document.createElement("b"), { textContent: "MathTube mode: only math videos." }));
  for (const t of TOPICS) {
    const a = document.createElement("a");
    a.href = "/results?search_query=" + encodeURIComponent(t + " explained");
    a.textContent = t;
    b.append(a);
  }
  const site = document.createElement("a");
  site.href = "https://mathtube.in";
  site.target = "_blank";
  site.textContent = "mathtube.in ↗";
  b.append(site);
  home.prepend(b);
}

let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; pass(); }, 250);   // YouTube mutates constantly; batch the work
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

function setOn(v) {
  on = v !== false;
  document.documentElement.classList.toggle("mathtube-on", on);
}
chrome.storage.sync.get(["on", "want"], (r) => { setOn(r.on); want = r.want || ""; pass(); });
chrome.storage.onChanged.addListener((c) => {
  if (c.on) setOn(c.on.newValue);
  if (c.want) { want = c.want.newValue || ""; verdicts.clear(); asked.clear(); queue.clear(); }
  pass();
});
