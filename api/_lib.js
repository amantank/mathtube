// Shared helpers for the API functions (files starting with _ are not deployed as endpoints).
import { MongoClient } from "mongodb";
import crypto from "node:crypto";

export const CATS = ["pure-mathematics", "recreational-math", "probability-game-theory", "logic-formal-methods",
  "information-theory", "computational-theory", "math-theory-other"];
export const VID_RE = /^[\w-]{11}$/;

// one client per warm function instance
let dbPromise;
export function db() {
  dbPromise ??= (async () => {
    // password kept out of the URI so it can be pasted as-is, special characters included
    const { MONGODB_URI, MONGODB_USER, MONGODB_PASSWORD } = process.env;
    const client = await new MongoClient(MONGODB_URI,
      MONGODB_PASSWORD ? { auth: { username: MONGODB_USER, password: MONGODB_PASSWORD } } : {}).connect();
    const d = client.db(process.env.MONGODB_DB || "mathtube");
    await Promise.all([
      d.collection("videos").createIndex({ vid: 1 }, { unique: true }),
      d.collection("videos").createIndex({ createdAt: -1 }),
      d.collection("videos").createIndex({ votes: -1 }),
      d.collection("playlists").createIndex({ owner: 1 }),
      d.collection("playlists").createIndex({ updatedAt: -1 }),
    ]);
    return d;
  })().catch((e) => { dbPromise = undefined; throw e; });
  return dbPromise;
}

// ---------- session cookie: base64url(json).hmac ----------
// SESSION_SECRET is optional: by default the key is derived from the GitHub client secret
const sessionKey = () => process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update("mathtube-session:" + process.env.GITHUB_CLIENT_SECRET).digest();
const sign = (s) => crypto.createHmac("sha256", sessionKey()).update(s).digest("base64url");

export function makeSession(user) {
  const body = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 30 * 864e5 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean)
    .map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
}

export function setCookie(res, name, value, maxAgeSec) {
  const secure = process.env.VERCEL_ENV ? "; Secure" : "";
  const prev = res.getHeader("Set-Cookie") || [];
  res.setHeader("Set-Cookie", [...[].concat(prev),
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`]);
}

export const currentUser = (req) => readSession(cookies(req).mt_session);

export function origin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

// Wraps a handler: JSON errors, login check for writes, same-origin check against CSRF.
export function handler(fn) {
  return async (req, res) => {
    try {
      const user = currentUser(req);
      if (req.method !== "GET") {
        if (!user) return res.status(401).json({ error: "Please sign in first." });
        const from = req.headers.origin;
        if (from && from !== origin(req)) return res.status(403).json({ error: "Bad origin." });
      }
      await fn(req, res, user);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error, please try again." });
    }
  };
}

export const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
