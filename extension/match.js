// Decides whether a YouTube tile (its title, channel and metadata text) is about math.
// Channels that post almost only math; everything else has to match a math keyword.
const MATH_CHANNELS = [
  "3Blue1Brown", "Numberphile", "Stand-up Maths", "Mathologer", "Reducible", "Bivector", "sudgylacmoe",
  "Welch Labs", "Insights into Mathematics", "PBS Infinite Series", "National Museum of Mathematics",
  "Timothy Gowers", "Polylog", "2swap", "Freya Holmér", "Bartosz Milewski", "Steve Brunton",
  "Dr. Trefor Bazett", "Professor Leonard", "Michael Penn", "blackpenredpen", "Eddie Woo", "Zach Star",
  "Flammable Maths", "Richard E Borcherds", "Another Roof", "Combo Class", "Morphocular", "Mathemaniac",
  "Aleph 0", "Think Twice", "Wrath of Math", "Dr Peyam", "patrickJMT", "The Math Sorcerer", "Vihart",
  "Tom Rocks Maths", "Tipping Point Math", "Kuvina Saydaki", "Numberphile2",
];
const MATH_WORDS = new RegExp("\\b(" + [
  "maths?", "mathematic(s|al|ian|ians)", "algebra(ic)?", "calculus", "geometr(y|ic)", "topolog(y|ical)",
  "theorems?", "lemma", "proofs?", "equations?", "integrals?", "integration", "derivatives?",
  "differential", "matri(x|ces)", "eigen\\w*", "vector spaces?", "linear algebra", "probabilit(y|ies)",
  "statistics", "number theory", "prime numbers?", "fractals?", "fourier", "trigonometry", "polynomials?",
  "logarithms?", "arithmetic", "combinatorics", "graph theory", "set theory", "group theory",
  "category theory", "riemann", "euler'?s?", "fibonacci", "olympiad", "precalculus", "pre-calculus",
  "quadratic", "infinite series", "manifolds?", "tensors?", "homolog(y|ical)", "gödel", "godel",
].join("|") + ")\\b", "i");

function isMath(text) {
  return MATH_WORDS.test(text) || MATH_CHANNELS.some(c => text.includes(c));
}

globalThis.isMath = isMath;   // shared with content.js and the tests
