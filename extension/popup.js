// popup.js — vault browser (crash-proof)
(function() {
  "use strict";

  const list = document.getElementById("list");
  const countEl = document.getElementById("count");
  const searchBox = document.getElementById("search-box");
  const saveBtn = document.getElementById("save-btn");

  if (!list || !countEl || !searchBox || !saveBtn) {
    document.body.innerHTML = '<div style="padding:40px;color:#555;font-size:11px;font-family:monospace">failed to init vault ui</div>';
    return;
  }

  function escHtml(s) {
    if (!s) return "";
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function renderItems(items) {
    try {
      if (!items || items.length === 0) {
        list.innerHTML = '<div class="empty">nothing here yet</div>';
        return;
      }
      list.innerHTML = items.map(function(i) {
        var dateStr = "";
        try {
          dateStr = new Date(i.timestamp || i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } catch(e) { dateStr = ""; }
        var tag = i.category ? '<span class="item-tag">' + escHtml(i.category) + '</span>' : "";
        var note = i.note ? '<div class="item-note">' + escHtml(i.note) + '</div>' : "";
        var title = (i.title || i.url || "untitled").toLowerCase();
        if (title.length > 80) title = title.substring(0, 80) + "...";
        return '<div class="item" data-url="' + escHtml(i.url) + '">' +
          '<div class="item-title">' + escHtml(title) + '</div>' +
          note +
          '<div class="item-meta"><span class="item-date">' + escHtml(dateStr) + '</span>' + tag + '</div>' +
          '</div>';
      }).join("");

      list.querySelectorAll(".item").forEach(function(el) {
        el.addEventListener("click", function() {
          try {
            var url = el.getAttribute("data-url");
            if (url) window.open(url, "_blank");
          } catch(e) {}
        });
      });
    } catch(e) {
      list.innerHTML = '<div class="empty">render error</div>';
    }
  }

  var allItems = [];

  function loadRecent(limit) {
    limit = limit || 50;
    try {
      chrome.runtime.sendMessage({ action: "getRecent", limit: limit }, function(resp) {
        if (chrome.runtime.lastError) {
          list.innerHTML = '<div class="empty">could not connect to vault</div>';
          return;
        }
        if (!resp) {
          list.innerHTML = '<div class="empty">no response from vault server</div>';
          return;
        }
        allItems = resp.items || [];
        renderItems(allItems);
        var total = resp.total || 0;
        if (total > 0) countEl.textContent = total + " saved";
        if (total > allItems.length) showLoadMore(total);
      });
    } catch(e) {
      list.innerHTML = '<div class="empty">error: ' + escHtml(String(e)) + '</div>';
    }
  }

  function showLoadMore(total) {
    var existing = document.getElementById("load-more");
    if (existing) existing.remove();
    var btn = document.createElement("div");
    btn.id = "load-more";
    btn.style.cssText = "padding:10px 16px;text-align:center;color:#555;font-size:10px;cursor:pointer;border-top:1px solid #111";
    btn.textContent = "showing " + allItems.length + " of " + total + " — tap to load all";
    btn.addEventListener("click", function() {
      try {
        chrome.runtime.sendMessage({ action: "getRecent", limit: total }, function(resp) {
          if (chrome.runtime.lastError || !resp) return;
          allItems = resp.items || [];
          renderItems(allItems);
          btn.remove();
        });
      } catch(e) {}
    });
    list.appendChild(btn);
  }

  var searchTimeout;
  searchBox.addEventListener("input", function() {
    clearTimeout(searchTimeout);
    var q = searchBox.value.trim();
    if (!q) { loadRecent(); return; }
    searchTimeout = setTimeout(function() {
      try {
        chrome.runtime.sendMessage({ action: "search", query: q }, function(resp) {
          if (chrome.runtime.lastError || !resp) return;
          renderItems(resp.items || []);
        });
      } catch(e) {}
    }, 300);
  });

  saveBtn.addEventListener("click", function() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) return;
        var tab = tabs[0];
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] }, function() {
          if (chrome.runtime.lastError) return;
          chrome.tabs.sendMessage(tab.id, {
            action: "showVaultOverlay",
            data: { url: tab.url, title: tab.title, selectedText: "" }
          });
        });
      });
    } catch(e) {}
  });

  // load on start
  loadRecent();
})();
