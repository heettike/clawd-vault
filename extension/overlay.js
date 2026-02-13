(() => {
  if (window.__clawdVaultInjected) return;
  window.__clawdVaultInjected = true;

  const CATEGORIES = ["writing", "design", "code", "ideas", "knowledge", "edit", "film"];

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "showVaultOverlay") render(msg.data);
  });

  function render({ url, title, selectedText }) {
    document.getElementById("__clawd-vault-overlay")?.remove();
    let selectedCategory = "";

    const overlay = document.createElement("div");
    overlay.id = "__clawd-vault-overlay";
    overlay.innerHTML = `
      <style>
        #__clawd-vault-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.7); z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
          animation: __cv-in 0.12s ease;
        }
        @keyframes __cv-in { from { opacity: 0; } to { opacity: 1; } }
        #__cv-modal {
          background: #0a0a0a; border: 1px solid #1a1a1a; width: 400px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.9);
        }
        #__cv-modal * { box-sizing: border-box; margin: 0; padding: 0; }
        .__cv-header { padding: 16px 20px 14px; border-bottom: 1px solid #141414; }
        .__cv-brand { color: #333; font-size: 9px; letter-spacing: 1.5px; text-transform: lowercase; margin-bottom: 8px; }
        .__cv-title {
          color: #ccc; font-size: 12px; text-transform: lowercase;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;
        }
        .__cv-url {
          color: #333; font-size: 9px; margin-top: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .__cv-body { padding: 16px 20px; }
        .__cv-selected {
          background: #0f0f0f; border-left: 2px solid #333;
          padding: 8px 12px; margin-bottom: 14px;
          color: #555; font-size: 10px; line-height: 1.5;
          max-height: 48px; overflow: hidden;
        }
        .__cv-label { color: #333; font-size: 9px; letter-spacing: 0.5px; margin-bottom: 8px; }
        .__cv-note-input {
          width: 100%; background: #0f0f0f; border: 1px solid #1a1a1a;
          color: #fff; font-family: inherit; font-size: 11px;
          padding: 10px 12px; outline: none; resize: none;
          height: 56px; display: block; line-height: 1.5;
          transition: border-color 0.15s;
        }
        .__cv-note-input::placeholder { color: #2a2a2a; }
        .__cv-note-input:focus { border-color: #333; }
        .__cv-cats { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; }
        .__cv-cat {
          padding: 5px 12px; font-size: 10px; font-family: inherit;
          background: transparent; border: 1px solid #1a1a1a; color: #444;
          cursor: pointer; text-transform: lowercase; user-select: none;
          transition: all 0.1s;
        }
        .__cv-cat:hover { border-color: #333; color: #888; }
        .__cv-cat.active { background: #fff; border-color: #fff; color: #0a0a0a; }
        .__cv-footer {
          padding: 14px 20px; border-top: 1px solid #141414;
          display: flex; justify-content: space-between; align-items: center;
        }
        .__cv-hint { color: #222; font-size: 9px; }
        .__cv-actions { display: flex; gap: 8px; }
        .__cv-btn {
          padding: 8px 20px; font-size: 11px; font-family: inherit;
          border: 1px solid #1a1a1a; cursor: pointer; text-transform: lowercase;
          transition: all 0.12s; background: transparent; color: #555;
        }
        .__cv-btn:hover { color: #999; border-color: #333; }
        .__cv-btn-save {
          background: #fff; color: #0a0a0a; border-color: #fff; font-weight: 500;
        }
        .__cv-btn-save:hover { background: #e0e0e0; border-color: #e0e0e0; }
        .__cv-btn-save:disabled { background: #222; color: #555; border-color: #222; cursor: default; }
      </style>
      <div id="__cv-modal">
        <div class="__cv-header">
          <div class="__cv-brand">clawd vault</div>
          <div class="__cv-title">${escHtml(title || url)}</div>
          <div class="__cv-url">${escHtml(url)}</div>
        </div>
        <div class="__cv-body">
          ${selectedText ? `<div class="__cv-selected">"${escHtml(selectedText.slice(0, 200))}"</div>` : ""}
          <div class="__cv-label">why are you saving this?</div>
          <textarea class="__cv-note-input" id="__cv-note" placeholder="good typography pattern..."></textarea>
          <div class="__cv-cats" id="__cv-cats">
            ${CATEGORIES.map(c => `<span class="__cv-cat" data-cat="${c}">${c}</span>`).join("")}
          </div>
        </div>
        <div class="__cv-footer">
          <span class="__cv-hint">&#8984;enter to save</span>
          <div class="__cv-actions">
            <button class="__cv-btn" id="__cv-cancel">cancel</button>
            <button class="__cv-btn __cv-btn-save" id="__cv-save">save</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const noteInput = document.getElementById("__cv-note");
    const saveBtn = document.getElementById("__cv-save");
    const cancelBtn = document.getElementById("__cv-cancel");
    const catsContainer = document.getElementById("__cv-cats");

    setTimeout(() => noteInput.focus(), 50);

    catsContainer.addEventListener("click", (e) => {
      const cat = e.target.closest(".__cv-cat");
      if (!cat) return;
      const wasActive = cat.classList.contains("active");
      catsContainer.querySelectorAll(".__cv-cat").forEach(c => c.classList.remove("active"));
      if (!wasActive) { cat.classList.add("active"); selectedCategory = cat.dataset.cat; }
      else { selectedCategory = ""; }
    });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doSave();
    };
    document.addEventListener("keydown", onKey);
    cancelBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", doSave);

    function close() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      window.__clawdVaultInjected = false;
    }

    function doSave() {
      saveBtn.disabled = true;
      saveBtn.textContent = "saving...";
      chrome.runtime.sendMessage({
        action: "vaultSave",
        data: { url, title, selectedText, note: noteInput.value.trim(), category: selectedCategory }
      }, (resp) => {
        if (resp?.ok) {
          saveBtn.textContent = "saved";
          setTimeout(close, 350);
        } else {
          saveBtn.textContent = "error";
          saveBtn.disabled = false;
          setTimeout(() => { saveBtn.textContent = "save"; }, 1500);
        }
      });
    }
  }

  function escHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }
})();
