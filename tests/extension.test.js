import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.runInNewContext(readFileSync(new URL("../extension/match.js", import.meta.url), "utf8"), ctx);

test("extension keeps math videos", () => {
  for (const t of [
    "But what is a neural network? | Deep learning chapter 1 3Blue1Brown 20M views",
    "Lecture 1: The Geometry of Linear Equations MIT OpenCourseWare",
    "The Riemann Hypothesis, Explained Quanta Magazine",
    "Why is this 15-Puzzle Impossible? Numberphile",
    "Gödel's Incompleteness Theorem Veritasium",
    "Calculus 1 Lecture 1.1: An Introduction to Limits Professor Leonard",
  ]) assert.ok(ctx.isMath(t), t);
});

test("extension hides everything else", () => {
  for (const t of [
    "Taylor Swift - Anti-Hero (Official Music Video) 1B views",
    "I Spent 100 Days in Minecraft Hardcore",
    "Amazon Prime Video: new this month",
    "GTA 6 Trailer 2 Rockstar Games",
    "Messi vs Ronaldo – Who is better? Sponsored",
  ]) assert.ok(!ctx.isMath(t), t);
});

test("on-device model tells math from the rest and follows the chosen topic", async () => {
  const { pipeline, env } = await import("@huggingface/transformers");
  const { classifier } = await import("../extension/classifier.js");
  env.allowRemoteModels = false;   // use the exact files shipped in the extension
  env.localModelPath = new URL("../extension/models/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
  const classify = classifier(async (t) => (await extractor(t, { pooling: "mean", normalize: true })).tolist());

  const math = ["Topology of a coffee cup", "How big is a googolplex?", "Monty Hall problem explained", "The Collatz Conjecture"];
  const other = ["GTA 6 Trailer 2", "Learn React in 1 hour", "Lo-fi beats to study to", "How quantum computers work"];
  const out = await classify([...math, ...other]);
  assert.deepEqual(out.map((o) => o.math), [...math.map(() => true), ...other.map(() => false)]);
  assert.equal(out[0].match, null);

  const topic = await classify(["Eigenvectors and eigenvalues", "Calculus 1 Lecture 1"], "linear algebra for beginners");
  assert.deepEqual(topic.map((o) => o.match), [true, false]);
});
