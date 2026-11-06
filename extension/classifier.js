// On-device math classifier: compares a video's text embedding with short descriptions of math and of
// everything else. Thresholds were tuned on sample YouTube titles (see tests/extension.test.js).
export const MATH = ["a mathematics lecture", "a math explainer video", "solving a math problem step by step",
  "a mathematical proof", "math puzzle or paradox", "history of mathematics and famous mathematicians",
  "statistics and probability tutorial", "geometry, numbers and shapes"];
export const OTHER = ["music video song", "video game gameplay", "vlog daily life", "news and politics", "sports highlights",
  "cooking recipe", "comedy sketch funny", "movie trailer", "programming tutorial for software developers",
  "product review unboxing", "podcast interview", "travel", "fitness workout", "physics and science documentary",
  "quantum physics and computers", "technology explained"];
export const MATH_MARGIN = 0.025;   // math titles scored 0.033+, everything else 0.011 or less
export const WANT_MIN = 0.3;        // "linear algebra for beginners": on-topic 0.37+, other math 0.19 or less

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const best = (v, list) => Math.max(...list.map((x) => dot(v, x)));

// embed(texts) -> normalized vectors. Returns classify(texts, want) -> [{math, match}] with booleans.
export function classifier(embed) {
  const anchors = embed([...MATH, ...OTHER]).then((v) => ({ math: v.slice(0, MATH.length), other: v.slice(MATH.length) }));
  const wants = new Map();
  return async (texts, want) => {
    const { math, other } = await anchors;
    if (want && !wants.has(want)) wants.set(want, embed([want]).then((v) => v[0]));
    const w = want && await wants.get(want);
    return (await embed(texts)).map((v) => ({
      math: best(v, math) - best(v, other) > MATH_MARGIN,
      match: w ? dot(v, w) > WANT_MIN : null,
    }));
  };
}
