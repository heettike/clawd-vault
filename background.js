const DEFAULT_API_URL = "http://100.119.198.102:9877";
let API = DEFAULT_API_URL;

// Load API URL from storage
chrome.storage.local.get({ vaultApiUrl: DEFAULT_API_URL }, (r) => {
  API = r.vaultApiUrl || DEFAULT_API_URL;
});

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
  chrome.contextMenus.create({
    id: "open-vault",
    title: "open vault",
    contexts: ["action"]
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
  if (info.menuItemId === "open-vault") {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    return;
  }
  if (info.menuItemId === "save-to-vault-with-note") {
    const url = info.linkUrl || info.srcUrl || info.pageUrl;
    const title = tab?.title || "";
    const selectedText = info.selectionText || "";
    showOverlay(tab.id, { url, title, selectedText });
  }
});

// ICON CLICK: single = save + toast with note/cancel, double = open vault panel on same tab
let lastClick = 0;
let singleTimer = null;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  const now = Date.now();
  const gap = now - lastClick;
  lastClick = now;

  if (gap < 400 && singleTimer) {
    // DOUBLE CLICK: open vault panel on same tab
    clearTimeout(singleTimer);
    singleTimer = null;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["vault-panel.js"]
      });
      await chrome.tabs.sendMessage(tab.id, { action: "toggleVaultPanel" });
    } catch(e) { console.error("panel inject failed:", e); }
    return;
  }

  // Wait to see if double-click comes
  singleTimer = setTimeout(async () => {
    singleTimer = null;
    // SINGLE CLICK: instant save + toast with note option & cancel
    let selectedText = "";
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || ""
      });
      selectedText = r?.result || "";
    } catch {}

    const saveData = { url: tab.url, title: tab.title, selectedText, note: "", category: "" };
    const result = await doSave(saveData);
    showSaveToast(tab.id, result.ok, tab.url, result.id, result.alreadySaved);
  }, 350);
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

// show save toast with note option + cancel
async function showSaveToast(tabId, success, savedUrl, entryId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (ok, url, id, apiUrl) => {
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
            .__cv-t-btn { color:#555; font-size:10px; cursor:pointer; background:none; border:none;
              font-family:inherit; padding:0; }
            .__cv-t-btn:hover { color:#fff; }
            .__cv-t-note { display:none; padding:0 14px 10px; }
            .__cv-t-note.show { display:block; }
            .__cv-t-input { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);
              color:#ccc; font-family:inherit; font-size:10px; padding:6px 8px; outline:none;
              resize:none; height:36px; }
            .__cv-t-input::placeholder { color:#333; }
            .__cv-t-input:focus { border-color:rgba(255,255,255,0.15); }
            .__cv-t-actions { display:flex; gap:8px; align-items:center; }
          </style>
          <div class="__cv-t-top">
            <span class="__cv-t-msg">${ok ? 'saved' : 'error'}</span>
            <div class="__cv-t-actions">
              <button class="__cv-t-btn" id="__cv-t-note-btn">+ note</button>
              <button class="__cv-t-btn" id="__cv-t-cancel">cancel</button>
            </div>
          </div>
          <div class="__cv-t-note" id="__cv-t-note">
            <textarea class="__cv-t-input" id="__cv-t-input" placeholder="why are you saving this?"></textarea>
          </div>
        `;
        document.body.appendChild(toast);

        let autoClose = setTimeout(() => dismiss(), 3000);

        document.getElementById("__cv-t-cancel").addEventListener("click", () => {
          // delete the saved entry
          if (id) {
            fetch(apiUrl + "/api/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id })
            }).catch(() => {});
          }
          dismiss();
        });

        const noteBtn = document.getElementById("__cv-t-note-btn");
        const noteDiv = document.getElementById("__cv-t-note");
        const noteInput = document.getElementById("__cv-t-input");

        noteBtn.addEventListener("click", () => {
          clearTimeout(autoClose);
          noteDiv.classList.add("show");
          noteBtn.style.display = "none";
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
      args: [success, savedUrl || "", entryId || null, API]
    });
  } catch {}
}

// legacy toast for context menu saves
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
            <span style="display:flex;gap:8px;align-items:center">
              <button class="__cv-t-add" id="__cv-t-add">+ note</button>
              <button class="__cv-t-add" id="__cv-t-close" style="font-size:14px;line-height:1">&times;</button>
            </span>
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

        document.getElementById("__cv-t-close").addEventListener("click", dismiss);

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
  if (msg.action === "deleteEntry") {
    fetch(`${API}/api/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: msg.id })
    }).then(r => r.json()).then(d => { updateBadge(); sendResponse(d); }).catch(() => sendResponse({ ok: false }));
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
    return { ok: data.ok, id: data.id || null, alreadySaved: data.alreadySaved || false };
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
