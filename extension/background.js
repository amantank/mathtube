// Calls the mathtube.in classifier for the content script (a content script's own fetch would hit YouTube's CORS rules).
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "classify") return;
  fetch("https://mathtube.in/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ want: msg.want, items: msg.items }),
  })
    .then(r => r.ok ? r.json() : { error: r.status })
    .catch(() => ({ error: "network" }))
    .then(reply);
  return true;   // keeps the channel open for the async reply
});
