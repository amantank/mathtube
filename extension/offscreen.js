// Hidden extension page that runs the classifier model, shared by every YouTube tab. Nothing leaves the browser.
import { pipeline, env } from "./lib/transformers.min.js";
import { classifier } from "./classifier.js";

env.allowRemoteModels = false;
env.allowLocalModels = true;   // off by default in browsers
env.localModelPath = chrome.runtime.getURL("models/");
env.useBrowserCache = false;   // the Cache API can't store chrome-extension:// files; they're local anyway
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("lib/");
env.backends.onnx.wasm.numThreads = 1;   // extension pages aren't cross-origin isolated, so no worker threads

const extractor = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const classify = classifier(async (texts) =>
  (await (await extractor)(texts, { pooling: "mean", normalize: true })).tolist());

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "classify-offscreen") return;
  classify(msg.items.map((i) => i.text), msg.want)
    .then((out) => reply({ results: Object.fromEntries(msg.items.map((i, k) => [i.vid, out[k]])) }))
    .catch((e) => { console.error(e); reply({ error: "model" }); });
  return true;
});
