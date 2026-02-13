// clawd vault — openclaw backend
// Sends vault data as messages to your OpenClaw gateway

async function getConfig() {
  const { gatewayUrl, gatewayToken } = await chrome.storage.sync.get(["gatewayUrl", "gatewayToken"]);
  return { gatewayUrl: (gatewayUrl || "").replace(/\/+$/, ""), gatewayToken: gatewayToken || "" };
}

async function sendToGateway(message) {
  const { gatewayUrl, gatewayToken } = await getConfig();
  if (!gatewayUrl) return { ok: false, error: "no gateway configured — open extension options" };
  const resp = await fetch(`${gatewayUrl}/api/v1/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(gatewayToken ? { "Authorization": `Bearer ${gatewayToken}` } : {})
    },
    body: JSON.stringify({ message, channel: "vault-extension" })
  });
  if (!resp.ok) throw new Error(`gateway ${resp.status}`);
  return await resp.json();
}

// -- install --
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

// -- context menu --
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

// -- keyboard shortcut (cmd+shift+v): open overlay --
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

// -- toast notification --
async function showToast(tabId, message, savedUrl) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => {
        const existing = document.getElementById("__cv-toast");
        if (existing) existing.remove();
        const toast = document.createElement("div");
        toast.id = "__cv-toast";
        toast.innerHTML = `
          <style>
            #__cv-toast { position:fixed; top:16px; right:16px; z-index:2147483647;
              background:#0a0a0a; border:1px solid rgba(255,255,255,0.08);
              font-family:'SF Mono',Consolas,monospace; padding:10px 14px;
              box-shadow:0 8px 32px rgba(0,0,0,0.4);
              animation:__cv-tin 0.15s ease; pointer-events:all; }
            @keyframes __cv-tin { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
            @keyframes __cv-tout { from{opacity:1} to{opacity:0} }
            .__cv-t-msg { color:#fff; font-size:11px; }
          </style>
          <span class="__cv-t-msg">${msg}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.animation = "__cv-tout 0.15s ease forwards";
          setTimeout(() => toast.remove(), 150);
        }, 2000);
      },
      args: [message]
    });
  } catch {}
}

async function showOverlay(tabId, data) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["overlay.js"] });
    await chrome.tabs.sendMessage(tabId, { action: "showVaultOverlay", data });
  } catch (e) {
    console.error("overlay inject failed:", e);
  }
}

// -- message handling --
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "vaultSave") {
    doSave(msg.data).then(r => sendResponse(r)).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.action === "save") {
    doSave(msg.data).then(r => sendResponse(r)).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.action === "getRecent") {
    getVaultItems(msg.limit || 50).then(r => sendResponse(r)).catch(() => sendResponse({ items: [] }));
    return true;
  }
  if (msg.action === "search") {
    searchVault(msg.query).then(r => sendResponse(r)).catch(() => sendResponse({ items: [] }));
    return true;
  }
  if (msg.action === "checkConfig") {
    getConfig().then(c => sendResponse({ configured: !!c.gatewayUrl }));
    return true;
  }
});

// -- vault operations via local storage + gateway sync --

async function getVaultStore() {
  const { vaultItems } = await chrome.storage.local.get("vaultItems");
  return vaultItems || [];
}

async function setVaultStore(items) {
  await chrome.storage.local.set({ vaultItems: items });
}

async function doSave({ url, title, selectedText, note, category }) {
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    url: url || "",
    title: title || "",
    note: note || "",
    category: category || "",
    selected_text: selectedText || "",
    created_at: new Date().toISOString()
  };

  // save locally
  const items = await getVaultStore();
  items.unshift(item);
  await setVaultStore(items);

  // sync to openclaw (fire-and-forget)
  syncToGateway(item).catch(e => console.warn("gateway sync failed:", e.message));

  updateBadge(items.length);
  return { ok: true };
}

async function syncToGateway(item) {
  const parts = [`[vault:save]`];
  parts.push(`url: ${item.url}`);
  if (item.title) parts.push(`title: ${item.title}`);
  if (item.category) parts.push(`category: ${item.category}`);
  if (item.note) parts.push(`note: ${item.note}`);
  if (item.selected_text) parts.push(`selected: ${item.selected_text.slice(0, 500)}`);
  parts.push(`saved: ${item.created_at}`);
  await sendToGateway(parts.join("\n"));
}

async function getVaultItems(limit) {
  const items = await getVaultStore();
  return { items: items.slice(0, limit), total: items.length };
}

async function searchVault(query) {
  const items = await getVaultStore();
  const q = query.toLowerCase();
  const filtered = items.filter(i =>
    (i.title || "").toLowerCase().includes(q) ||
    (i.url || "").toLowerCase().includes(q) ||
    (i.note || "").toLowerCase().includes(q) ||
    (i.category || "").toLowerCase().includes(q) ||
    (i.selected_text || "").toLowerCase().includes(q)
  );
  return { items: filtered, total: filtered.length };
}

async function updateBadge(count) {
  if (count === undefined) {
    const items = await getVaultStore();
    count = items.length;
  }
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#333" });
}

// init badge
updateBadge();
