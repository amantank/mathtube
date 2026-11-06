// POST {want?, items: [{vid, text}]} -> {results: {vid: {math, match}}}
// Asks TypeSafe's Jev classifier whether each YouTube video is math (and matches what the viewer wants).
// Used by the browser extension; answers are cached so each title is paid for once.
import crypto from "node:crypto";
import { VID_RE, db, str } from "./_lib.js";

const MAX_ITEMS = 20;
const DAILY_PER_IP = 3000;   // uncached classifications; Jev costs ~$0.04 per million tokens, this caps abuse
const MODEL = "jev-1.13.0";  // pinned so verdicts stay stable; cached answers would mix versions otherwise

async function jev(text, want) {
  const questions = {
    math: { type: "noul", instructions: "This YouTube video (title, channel and snippet below) is mainly about mathematics: teaching, explaining or exploring math, math history or math puzzles." },
  };
  if (want) questions.match = { type: "noul", instructions: `This video is what the viewer asked to watch: "${want}"` };
  const r = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, state: text, questions }),
  });
  if (!r.ok) throw new Error(`Jev ${r.status}`);
  const { answers } = await r.json();
  return { math: answers.math.noul, match: want ? answers.match.noul : null };
}

export default async function classify(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
    if (!process.env.TYPESAFE_API_KEY) return res.status(503).json({ error: "Classifier not configured." });
    const want = str(req.body?.want, 100).toLowerCase();
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, MAX_ITEMS) : [];
    const valid = items.filter((i) => VID_RE.test(i?.vid || "") && str(i.text, 300))
      .map((i) => ({ vid: i.vid, text: str(i.text, 300).replace(/\s+/g, " ") }));
    if (!valid.length) return res.status(400).json({ error: "No valid items." });

    // keyed by the text itself, not the video id, so a client sending a fake title can't poison anyone else's answer
    const key = (i) => crypto.createHash("sha256").update(`${MODEL}\n${want}\n${i.text}`).digest("base64url");
    const d = await db();
    const cache = d.collection("jev");
    const hits = new Map((await cache.find({ _id: { $in: valid.map(key) } }).toArray()).map((c) => [c._id, c]));
    const misses = valid.filter((i) => !hits.has(key(i)));

    if (misses.length) {
      const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim();
      const day = new Date().toISOString().slice(0, 10);
      const { count } = await d.collection("jev_rate").findOneAndUpdate({ _id: `${ip}:${day}` },
        { $inc: { count: misses.length }, $setOnInsert: { at: new Date() } }, { upsert: true, returnDocument: "after" });
      if (count > DAILY_PER_IP) return res.status(429).json({ error: "Daily limit reached." });

      await Promise.all(misses.map(async (i) => {
        try {
          const v = await jev(i.text, want);
          hits.set(key(i), v);
          await cache.updateOne({ _id: key(i) }, { $set: { ...v, at: new Date() } }, { upsert: true });
        } catch (e) { console.error(e.message); }   // left out of results: the extension falls back to keywords
      }));
    }

    const results = {};
    for (const i of valid) {
      const v = hits.get(key(i));
      if (v) results[i.vid] = { math: v.math, match: v.match ?? null };
    }
    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error, please try again." });
  }
}
