const API = "http://100.119.198.102:9877";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-vault",
    title: "save to clawd vault",
    contexts: ["page", "link", "image", "selection"]
  });
  chrome.contextMenus.create({
    id: "save-to-vault-with-note",
    title: "save to vault + add note",
    contexts: ["page", "link", "image", "selection"]
  });
  updateBadge();
});

// RIGHT-CLICK: instant save (no overlay)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-to-vault") {
    const url = info.linkUrl || info.srcUrl || info.pageUrl;
    const title = tab?.title || "";
    const selectedText = info.selectionText || "";
    const result = await doSave({ url, title, selectedText, note: "", category: "" });
    showToast(tab.id, result.ok ? "saved" : "error", url);
  }
  if (info.menuItemId === "save-to-vault-with-note") {
    const url = info.linkUrl || info.srcUrl || info.pageUrl;
    const title = tab?.title || "";
    const selectedText = info.selectionText || "";
    showOverlay(tab.id, { url, title, selectedText });
  }
});

// ICON CLICK: single = instant save, double = open popup
let clickTimer = null;
let clickCount = 0;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  clickCount++;
  if (clickCount === 1) {
    clickTimer = setTimeout(async () => {
      clickCount = 0;
      // SINGLE CLICK: instant save
      let selectedText = "";
      try {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || ""
        });
        selectedText = r?.result || "";
      } catch {}
      const result = await doSave({ url: tab.url, title: tab.title, selectedText, note: "", category: "" });
      showToast(tab.id, result.ok ? "saved" : "error", tab.url);
    }, 300);
  } else {
    // DOUBLE CLICK: open popup/search
    clearTimeout(clickTimer);
    clickCount = 0;
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 400,
      height: 520,
      top: 80,
      left: Math.max(0, (tab.width || 1200) - 420)
    });
  }
});

// KEYBOARD SHORTCUT (cmd+shift+v): open overlay for notes/category
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-current-tab") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      let selectedText = "";
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || ""
        });
        selectedText = result?.result || "";
      } catch {}
      showOverlay(tab.id, { url: tab.url, title: tab.title, selectedText });
    }
  }
});

// show toast with optional expandable notes field
async function showToast(tabId, message, savedUrl) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, url, apiUrl) => {
        const existing = document.getElementById("__cv-toast");
        if (existing) existing.remove();
        const toast = document.createElement("div");
        toast.id = "__cv-toast";
        toast.innerHTML = `
          <style>
            #__cv-toast { position:fixed; top:16px; right:16px; z-index:2147483647;
              background:#0a0a0a; border:1px solid rgba(255,255,255,0.08);
              font-family:'SF Mono',Consolas,monospace; width:240px;
              box-shadow:0 8px 32px rgba(0,0,0,0.4);
              animation:__cv-tin 0.15s ease; pointer-events:all; }
            @keyframes __cv-tin { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
            @keyframes __cv-tout { from{opacity:1} to{opacity:0} }
            .__cv-t-top { padding:10px 14px; display:flex; justify-content:space-between; align-items:center; }
            .__cv-t-msg { color:#fff; font-size:11px; }
            .__cv-t-add { color:#333; font-size:10px; cursor:pointer; background:none; border:none;
              font-family:inherit; padding:0; }
            .__cv-t-add:hover { color:#666; }
            .__cv-t-note { display:none; padding:0 14px 10px; }
            .__cv-t-note.show { display:block; }
            .__cv-t-input { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);
              color:#ccc; font-family:inherit; font-size:10px; padding:6px 8px; outline:none;
              resize:none; height:36px; }
            .__cv-t-input::placeholder { color:#222; }
            .__cv-t-input:focus { border-color:rgba(255,255,255,0.15); }
          </style>
          <div class="__cv-t-top">
            <span class="__cv-t-msg">${msg}</span>
            <button class="__cv-t-add" id="__cv-t-add">+ note</button>
          </div>
          <div class="__cv-t-note" id="__cv-t-note">
            <textarea class="__cv-t-input" id="__cv-t-input" placeholder="add context..."></textarea>
          </div>
        `;
        document.body.appendChild(toast);

        let autoClose = setTimeout(() => dismiss(), 2500);
        const addBtn = document.getElementById("__cv-t-add");
        const noteDiv = document.getElementById("__cv-t-note");
        const noteInput = document.getElementById("__cv-t-input");

        addBtn.addEventListener("click", () => {
          clearTimeout(autoClose);
          noteDiv.classList.add("show");
          addBtn.style.display = "none";
          noteInput.focus();
        });

        noteInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            const note = noteInput.value.trim();
            if (note && url) {
              fetch(apiUrl + "/api/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, note, title: "", selected_text: "", category: "" })
              }).catch(() => {});
            }
            dismiss();
          }
          if (e.key === "Escape") dismiss();
        });

        function dismiss() {
          toast.style.animation = "__cv-tout 0.15s ease forwards";
          setTimeout(() => toast.remove(), 150);
        }
      },
      args: [message, savedUrl || "", API]
    });
  } catch {}
}

async function showOverlay(tabId, data) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["overlay.js"]
    });
    await chrome.tabs.sendMessage(tabId, {
      action: "showVaultOverlay",
      data
    });
  } catch (e) {
    console.error("overlay inject failed:", e);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "vaultSave") {
    doSave(msg.data).then(r => sendResponse(r));
    return true;
  }
  if (msg.action === "save") {
    doSave(msg.data).then(r => sendResponse(r));
    return true;
  }
  if (msg.action === "getRecent") {
    const limit = msg.limit || 50;
    fetch(`${API}/api/list?limit=${limit}`).then(r => r.json()).then(d => sendResponse(d)).catch(() => sendResponse({ items: [] }));
    return true;
  }
  if (msg.action === "search") {
    fetch(`${API}/api/search?q=${encodeURIComponent(msg.query)}`).then(r => r.json()).then(d => sendResponse(d)).catch(() => sendResponse({ items: [] }));
    return true;
  }
});

async function doSave({ url, title, selectedText, note, category }) {
  try {
    const resp = await fetch(`${API}/api/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title, selected_text: selectedText || "", note: note || "", category: category || "" })
    });
    const data = await resp.json();
    if (data.ok) updateBadge();
    return data;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function updateBadge() {
  try {
    const resp = await fetch(`${API}/api/list?limit=1`);
    const data = await resp.json();
    const count = data.total || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#333" });
  } catch {
    chrome.action.setBadgeText({ text: "" });
  }
}
