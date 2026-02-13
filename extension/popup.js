const list = document.getElementById("list");
const countEl = document.getElementById("count");
const searchBox = document.getElementById("search-box");
const saveBtn = document.getElementById("save-btn");
const setupBanner = document.getElementById("setup-banner");

// check config
chrome.runtime.sendMessage({ action: "checkConfig" }, (resp) => {
  if (!resp?.configured) setupBanner.style.display = "block";
});

function renderItems(items) {
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="empty">nothing here yet</div>';
    return;
  }
  list.innerHTML = items.map(i => {
    const date = new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const tag = i.category ? `<span class="item-tag">${i.category}</span>` : "";
    const note = i.note ? `<div class="item-note">${i.note}</div>` : "";
    return `<div class="item" data-url="${escHtml(i.url)}">
      <div class="item-title">${escHtml((i.title || i.url).toLowerCase())}</div>
      ${note}
      <div class="item-meta"><span class="item-date">${date}</span>${tag}</div>
    </div>`;
  }).join("");
  list.querySelectorAll(".item").forEach(el => {
    el.addEventListener("click", () => chrome.tabs.create({ url: el.dataset.url }));
  });
}

function escHtml(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function loadRecent(limit = 50) {
  chrome.runtime.sendMessage({ action: "getRecent", limit }, (resp) => {
    const items = resp?.items || [];
    renderItems(items);
    if (resp?.total !== undefined) countEl.textContent = `${resp.total} saved`;
  });
}

let searchTimeout;
searchBox.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const q = searchBox.value.trim();
  if (!q) { loadRecent(); return; }
  searchTimeout = setTimeout(() => {
    chrome.runtime.sendMessage({ action: "search", query: q }, (resp) => {
      renderItems(resp?.items || []);
    });
  }, 300);
});

saveBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
    let selectedText = "";
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || ""
      });
      selectedText = result?.result || "";
    } catch {}
    await chrome.tabs.sendMessage(tab.id, {
      action: "showVaultOverlay",
      data: { url: tab.url, title: tab.title, selectedText }
    });
  } catch {}
  window.close();
});

loadRecent();
