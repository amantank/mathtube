import { VID_RE, db, handler } from "./_lib.js";

// POST {vid}: toggles the signed-in user's upvote on a community video
export default handler(async (req, res, user) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const vid = req.body?.vid;
  if (!VID_RE.test(vid || "")) return res.status(400).json({ error: "Bad video id." });
  const d = await db();
  if (!(await d.collection("videos").findOne({ vid }, { projection: { _id: 1 } })))
    return res.status(404).json({ error: "Only community videos can be upvoted." });

  const _id = `${user.id}:${vid}`;
  // the vote document's unique _id makes double votes impossible, even with two clicks at once
  const removed = await d.collection("votes").deleteOne({ _id });
  let voted = false;
  if (!removed.deletedCount) {
    try { await d.collection("votes").insertOne({ _id, user: user.id, vid, at: new Date() }); voted = true; }
    catch (e) { if (e.code !== 11000) throw e; }
  }
  if (removed.deletedCount || voted)
    await d.collection("videos").updateOne({ vid }, { $inc: { votes: voted ? 1 : -1 } });
  const v = await d.collection("videos").findOne({ vid }, { projection: { votes: 1 } });
  res.json({ vid, voted, votes: v.votes });
});
