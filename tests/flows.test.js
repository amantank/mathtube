// End-to-end API flows against a throwaway in-memory MongoDB. Run with: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo, lib, videos, vote, playlists, me;
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.SESSION_SECRET = "test-secret";
  lib = await import("../api/_lib.js");
  ({ default: videos } = await import("../api/videos.js"));
  ({ default: vote } = await import("../api/vote.js"));
  ({ default: playlists } = await import("../api/playlists.js"));
  ({ default: me } = await import("../api/me.js"));
  // stand in for YouTube oEmbed so tests run offline
  globalThis.fetch = async (url) => String(url).includes("BADBADBAD00")
    ? { ok: false, json: async () => ({}) }
    : { ok: true, json: async () => ({ title: "A great proof", author_name: "Some Channel" }) };
});
after(async () => { await (await lib.db()).client.close(); await mongo.stop(); });

const ada = { id: "1", login: "ada", avatar: "" }, eve = { id: "2", login: "eve", avatar: "" };
async function call(fn, { method = "GET", user, body, query = {} } = {}) {
  const req = { method, body, query, headers: { host: "localhost", cookie: user ? `mt_session=${lib.makeSession(user)}` : "" } };
  const res = { statusCode: 200, headers: {}, data: undefined,
    status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; },
    setHeader(k, v) { this.headers[k] = v; }, getHeader(k) { return this.headers[k]; } };
  await fn(req, res);
  return res;
}
const good = { url: "https://youtu.be/AAAAAAAAAAA", cats: ["pure-mathematics", "not-a-cat"], note: "Beautiful visual proof of a classic." };

test("anonymous users can read but not write", async () => {
  assert.equal((await call(videos)).statusCode, 200);
  assert.equal((await call(videos, { method: "POST", body: good })).statusCode, 401);
  assert.deepEqual((await call(me)).data, { user: null, voted: [] });
});

test("submit validates input, stores the video and self-upvotes", async () => {
  assert.equal((await call(videos, { method: "POST", user: ada, body: { ...good, url: "https://evil.com/x" } })).statusCode, 400);
  assert.equal((await call(videos, { method: "POST", user: ada, body: { ...good, cats: ["nope"] } })).statusCode, 400);
  assert.equal((await call(videos, { method: "POST", user: ada, body: { ...good, note: "meh" } })).statusCode, 400);
  assert.equal((await call(videos, { method: "POST", user: ada, body: { ...good, url: "BADBADBAD00" } })).statusCode, 400);
  assert.equal((await call(videos, { method: "POST", user: ada, body: { ...good, url: "fNk_zzaMoSs" } })).statusCode, 409, "curated videos can't be re-shared");

  const r = await call(videos, { method: "POST", user: ada, body: good });
  assert.equal(r.statusCode, 201);
  assert.equal(r.data.title, "A great proof");
  assert.deepEqual(r.data.cats, ["pure-mathematics"]);
  assert.equal(r.data.votes, 1);
  assert.equal(r.data.owner, undefined, "owner id is not exposed");
  assert.equal((await call(videos, { method: "POST", user: eve, body: good })).statusCode, 409);
  assert.deepEqual((await call(me, { user: ada })).data.voted, ["AAAAAAAAAAA"]);
});

test("votes toggle and can't be doubled", async () => {
  const v = (user) => call(vote, { method: "POST", user, body: { vid: "AAAAAAAAAAA" } });
  assert.equal((await v(eve)).data.votes, 2);
  assert.equal((await v(eve)).data.votes, 1);
  const [a, b] = await Promise.all([v(eve), v(eve)]);   // double click
  assert.ok([a.data.votes, b.data.votes].every((n) => n >= 1 && n <= 2));
  const after = (await call(videos)).data[0].votes;
  const count = await (await lib.db()).collection("votes").countDocuments({ vid: "AAAAAAAAAAA" });
  assert.equal(after, count, "stored count matches real votes");
  assert.equal((await call(vote, { method: "POST", user: eve, body: { vid: "ZZZZZZZZZZZ" } })).statusCode, 404);
});

test("playlists: create, add, only the owner can change or delete", async () => {
  const c = await call(playlists, { method: "POST", user: ada, body: { title: "  Linear algebra path ", vid: "fNk_zzaMoSs" } });
  assert.equal(c.statusCode, 201);
  const id = c.data.id;
  assert.equal(c.data.title, "Linear algebra path");

  const add = await call(playlists, { method: "PATCH", user: ada, body: { id, add: "AAAAAAAAAAA" } });
  assert.deepEqual(add.data.vids, ["fNk_zzaMoSs", "AAAAAAAAAAA"]);
  assert.equal((await call(playlists, { method: "PATCH", user: ada, body: { id, add: "AAAAAAAAAAA" } })).data.vids.length, 2, "no duplicates");
  assert.equal((await call(playlists, { method: "PATCH", user: ada, body: { id, add: "<script>" } })).statusCode, 400);

  assert.equal((await call(playlists, { method: "PATCH", user: eve, body: { id, title: "mine now" } })).statusCode, 403);
  assert.equal((await call(playlists, { method: "DELETE", user: eve, query: { id } })).statusCode, 403);

  assert.equal((await call(playlists, { query: { id } })).data.vids.length, 2);
  assert.equal((await call(playlists)).data.length, 1);
  assert.equal((await call(playlists, { user: eve, query: { mine: "1" } })).data.length, 0);
  assert.equal((await call(playlists, { query: { id: "nope" } })).statusCode, 404);

  assert.equal((await call(playlists, { method: "DELETE", user: ada, query: { id } })).statusCode, 200);
  assert.equal((await call(playlists, { query: { id } })).statusCode, 404);
});

test("cross-site writes are refused", async () => {
  const req = { method: "POST", body: good, query: {}, headers: { host: "mathtube.in", origin: "https://evil.com", cookie: `mt_session=${lib.makeSession(ada)}` } };
  let code; await videos(req, { status(c) { code = c; return this; }, json() { return this; }, setHeader() {}, getHeader() {} });
  assert.equal(code, 403);
});

