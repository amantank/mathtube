import { ObjectId } from "mongodb";
import { VID_RE, db, handler, str } from "./_lib.js";

const MAX_VIDEOS = 500;
const MAX_PER_USER = 100;

const pub = ({ _id, ...p }) => ({ id: String(_id), ...p });
const oid = (s) => (ObjectId.isValid(s) ? new ObjectId(String(s)) : null);

export default handler(async (req, res, user) => {
  const playlists = (await db()).collection("playlists");
  const q = req.query;

  if (req.method === "GET") {
    if (q.id) {
      const p = oid(q.id) && await playlists.findOne({ _id: oid(q.id) });
      return p ? res.json(pub(p)) : res.status(404).json({ error: "Playlist not found." });
    }
    const filter = q.mine ? { owner: user?.id ?? "-" } : { "vids.0": { $exists: true } };
    const list = await playlists.find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    return res.json(list.map(pub));
  }

  if (req.method === "POST") {
    const title = str(req.body?.title, 100);
    if (!title) return res.status(400).json({ error: "Give the playlist a name." });
    if (await playlists.countDocuments({ owner: user.id }) >= MAX_PER_USER)
      return res.status(429).json({ error: `You can have up to ${MAX_PER_USER} playlists.` });
    const vid = req.body?.vid;
    const doc = { title, description: str(req.body?.description, 1000), owner: user.id, by: user.login,
      vids: VID_RE.test(vid || "") ? [vid] : [], createdAt: new Date(), updatedAt: new Date() };
    const { insertedId } = await playlists.insertOne(doc);
    return res.status(201).json(pub({ _id: insertedId, ...doc }));
  }

  // PATCH and DELETE: owner only
  const _id = oid(q.id || req.body?.id);
  const p = _id && await playlists.findOne({ _id });
  if (!p) return res.status(404).json({ error: "Playlist not found." });
  if (p.owner !== user.id) return res.status(403).json({ error: "That's not your playlist." });

  if (req.method === "DELETE") {
    await playlists.deleteOne({ _id });
    return res.json({ ok: true });
  }
  if (req.method === "PATCH") {
    const b = req.body || {};
    const set = { updatedAt: new Date() };
    if (b.title !== undefined) { set.title = str(b.title, 100); if (!set.title) return res.status(400).json({ error: "Name can't be empty." }); }
    if (b.description !== undefined) set.description = str(b.description, 1000);
    const update = { $set: set };
    if (b.add !== undefined) {
      if (!VID_RE.test(b.add)) return res.status(400).json({ error: "Bad video id." });
      if (p.vids.length >= MAX_VIDEOS) return res.status(400).json({ error: `A playlist holds up to ${MAX_VIDEOS} videos.` });
      update.$addToSet = { vids: b.add };
    } else if (b.remove !== undefined) {
      update.$pull = { vids: b.remove };
    }
    const after = await playlists.findOneAndUpdate({ _id }, update, { returnDocument: "after" });
    return res.json(pub(after));
  }
  res.status(405).json({ error: "Method not allowed." });
});
