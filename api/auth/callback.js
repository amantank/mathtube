import { cookies, db, makeSession, setCookie } from "../_lib.js";

export default async function callback(req, res) {
  const { code, state } = req.query;
  if (!code || !state || state !== cookies(req).mt_state) return res.redirect(302, "/#/?login=failed");
  try {
    const tok = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
    }).then((r) => r.json());
    if (!tok.access_token) throw new Error("no token: " + tok.error);
    const gh = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tok.access_token}`, "User-Agent": "mathtube" },
    }).then((r) => r.json());
    if (!gh.id) throw new Error("no github user");
    const user = { id: String(gh.id), login: gh.login, avatar: gh.avatar_url };
    await (await db()).collection("users").updateOne({ _id: user.id },
      { $set: { login: user.login, avatar: user.avatar, lastLogin: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true });
    setCookie(res, "mt_state", "", 0);
    setCookie(res, "mt_session", makeSession(user), 30 * 86400);
    res.redirect(302, "/#/");
  } catch (e) {
    console.error(e);
    res.redirect(302, "/#/?login=failed");
  }
}
