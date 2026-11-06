// Puts the model runtime and model files into extension/ (they're too big and too generated to commit).
// Usage: npm install && npm run build:extension
import { copyFile, mkdir, writeFile, access } from "node:fs/promises";

const ext = new URL("../extension/", import.meta.url), nm = new URL("../node_modules/", import.meta.url);
await mkdir(new URL("lib/", ext), { recursive: true });
for (const [from, to] of [
  ["@huggingface/transformers/dist/transformers.min.js", "lib/transformers.min.js"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs", "lib/ort-wasm-simd-threaded.asyncify.mjs"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm", "lib/ort-wasm-simd-threaded.asyncify.wasm"],
]) await copyFile(new URL(from, nm), new URL(to, ext));

const MODEL = "Xenova/all-MiniLM-L6-v2";
for (const f of ["config.json", "tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"]) {
  const dest = new URL(`models/${MODEL}/${f}`, ext);
  if (await access(dest).then(() => true, () => false)) continue;
  const r = await fetch(`https://huggingface.co/${MODEL}/resolve/main/${f}`);
  if (!r.ok) throw new Error(`download ${f}: ${r.status}`);
  await mkdir(new URL(".", dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}
console.log("extension/ is ready: load it unpacked from chrome://extensions");
