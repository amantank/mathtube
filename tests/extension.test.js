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
