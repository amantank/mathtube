// Run with: npm test   (no database needed)
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret";
const { makeSession, readSession } = await import("../api/_lib.js");
const { parseVid } = await import("../api/videos.js");

test("parseVid accepts the usual YouTube link shapes", () => {
  for (const u of ["dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube.com/watch?feature=x&v=dQw4w9WgXcQ&t=10",
    "https://youtu.be/dQw4w9WgXcQ?si=abc", "https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"])
    assert.equal(parseVid(u), "dQw4w9WgXcQ", u);
});

test("parseVid rejects other sites and junk", () => {
  for (const u of ["https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "hello", "", null, 42])
    assert.equal(parseVid(u), null, String(u));
});

test("sessions round-trip and reject tampering", () => {
  const tok = makeSession({ id: "1", login: "ada" });
  assert.equal(readSession(tok).login, "ada");
  const [body, mac] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ id: "2", login: "eve", exp: Date.now() + 1e9 })).toString("base64url");
  assert.equal(readSession(`${forged}.${mac}`), null);
  assert.equal(readSession(`${body}.x${mac.slice(1)}`), null);
  assert.equal(readSession("garbage"), null);
});

test("without SESSION_SECRET the key comes from the GitHub secret", () => {
  const saved = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  process.env.GITHUB_CLIENT_SECRET = "gh-secret";
  const tok = makeSession({ id: "1", login: "ada" });
  assert.equal(readSession(tok).login, "ada");
  process.env.GITHUB_CLIENT_SECRET = "other";
  assert.equal(readSession(tok), null, "changing the GitHub secret logs everyone out");
  process.env.SESSION_SECRET = saved;
});
