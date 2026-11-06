// Relays classify requests from YouTube tabs to the offscreen page that runs the model.
let creating;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ??= chrome.offscreen.createDocument({
    url: "offscreen.html", reasons: ["WORKERS"], justification: "Runs the on-device math classifier model",
  }).finally(() => { creating = undefined; });
  await creating;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "classify") return;
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ ...msg, type: "classify-offscreen" }))
    .then(reply, (e) => { console.error(e); reply({ error: "model" }); });
  return true;   // keeps the channel open for the async reply
});
