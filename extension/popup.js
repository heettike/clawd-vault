const list = document.getElementById("list");
const countEl = document.getElementById("count");
const searchBox = document.getElementById("search-box");
const saveBtn = document.getElementById("save-btn");

function renderItems(items) {
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="empty">nothing here yet</div>';
    return;
  }
  list.innerHTML = items.map(i => {
    const date = new Date(i.timestamp || i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const tag = i.category ? `<span class="item-tag">${i.category}</span>` : "";
    const note = i.note ? `<div class="item-note">${i.note}</div>` : "";
    return `<div class="item" data-url="${i.url}">
      <div class="item-title">${(i.title || i.url).toLowerCase()}</div>
      ${note}
      <div class="item-meta"><span class="item-date">${date}</span>${tag}</div>
    </div>`;
  }).join("");
  list.querySelectorAll(".item").forEach(el => {
    el.addEventListener("click", () => chrome.tabs.create({ url: el.dataset.url }));
  });
}

let currentOffset = 0;
let allItems = [];

function loadRecent(limit = 50) {
  chrome.runtime.sendMessage({ action: "getRecent", limit }, (resp) => {
    allItems = resp?.items || [];
    currentOffset = allItems.length;
    renderItems(allItems);
    if (resp?.total !== undefined) {
      countEl.textContent = `${resp.total} saved`;
      if (resp.total > allItems.length) {
        showLoadMore(resp.total);
      }
    }
  });
}

function showLoadMore(total) {
  const existing = document.getElementById("load-more");
  if (existing) existing.remove();
  const btn = document.createElement("div");
  btn.id = "load-more";
  btn.style.cssText = "padding:10px 16px;text-align:center;color:#444;font-size:10px;cursor:pointer;border-top:1px solid #111";
  btn.textContent = `showing ${allItems.length} of ${total} — tap to load more`;
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getRecent", limit: total }, (resp) => {
      allItems = resp?.items || [];
      renderItems(allItems);
      btn.remove();
    });
  });
  list.appendChild(btn);
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
