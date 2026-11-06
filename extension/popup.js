const box = document.getElementById("on"), want = document.getElementById("want");
chrome.storage.sync.get(["on", "want"], r => { box.checked = r.on !== false; want.value = r.want || ""; });
box.onchange = () => chrome.storage.sync.set({ on: box.checked });
want.onchange = () => chrome.storage.sync.set({ want: want.value.trim() });   // fires on Enter or leaving the field
