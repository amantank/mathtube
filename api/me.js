import { db, handler } from "./_lib.js";

// who is signed in, plus the community videos they upvoted
export default handler(async (req, res, user) => {
  if (!user) return res.json({ user: null, voted: [] });
  const votes = await (await db()).collection("votes").find({ user: user.id }, { projection: { vid: 1 } }).toArray();
  res.json({ user: { id: user.id, login: user.login, avatar: user.avatar }, voted: votes.map((v) => v.vid) });
});
