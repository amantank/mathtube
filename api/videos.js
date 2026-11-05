import { CATS, db, handler, str } from "./_lib.js";
import curated from "../data/videos.json" with { type: "json" };

const CURATED = new Set(curated.videos.map((v) => v.vid));

const DAILY_LIMIT = 20;
const LIST_LIMIT = 500; // shortcut: the frontend loads all community videos at once; page this past a few thousand

export function parseVid(url) {
  const s = str(url, 300);
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/);
  return m ? m[1] : null;
}

const pub = ({ _id, owner, ...v }) => v;

export default handler(async (req, res, user) => {
  const videos = (await db()).collection("videos");

  if (req.method === "GET") {
    const sort = req.query.sort === "top" ? { votes: -1, createdAt: -1 } : { createdAt: -1 };
    const list = await videos.find({}).sort(sort).limit(LIST_LIMIT).toArray();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
    return res.json(list.map(pub));
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const body = req.body || {};
  const vid = parseVid(body.url);
  if (!vid) return res.status(400).json({ error: "That doesn't look like a YouTube video link." });
  const cats = [...new Set([].concat(body.cats || []))].filter((c) => CATS.includes(c));
  if (!cats.length) return res.status(400).json({ error: "Pick at least one topic." });
  const note = str(body.note, 1000);
  if (note.length < 10) return res.status(400).json({ error: "Tell people in a sentence why this video is worth watching." });

  if (CURATED.has(vid)) return res.status(409).json({ error: "This one is already on MathTube.", vid });
  const since = new Date(Date.now() - 864e5);
  if (await videos.countDocuments({ owner: user.id, createdAt: { $gt: since } }) >= DAILY_LIMIT)
    return res.status(429).json({ error: `You can submit up to ${DAILY_LIMIT} videos a day.` });
  if (await videos.findOne({ vid }, { projection: { _id: 1 } }))
    return res.status(409).json({ error: "Someone already shared this video.", vid });

  // oEmbed confirms the video exists and can be embedded, and gives us the real title and channel
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + vid)}`);
  if (!r.ok) return res.status(400).json({ error: "YouTube says this video doesn't exist or can't be embedded." });
  const meta = await r.json();

  const doc = {
    vid, title: str(meta.title, 200), channel: str(meta.author_name, 100), summary: note, cats,
    owner: user.id, by: user.login, votes: 1, createdAt: new Date(),
  };
  try {
    await videos.insertOne(doc);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "Someone already shared this video.", vid });
    throw e;
  }
  await (await db()).collection("votes").updateOne({ _id: `${user.id}:${vid}` },
    { $setOnInsert: { user: user.id, vid, at: new Date() } }, { upsert: true });
  res.status(201).json(pub(doc));
});
