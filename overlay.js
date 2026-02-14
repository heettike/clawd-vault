(() => {
  if (window.__clawdVaultInjected) return;
  window.__clawdVaultInjected = true;

  const DEFAULT_CATEGORIES = ["writing", "design", "code", "ideas", "knowledge", "edit", "film"];

  function getCategories() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ vaultCategories: DEFAULT_CATEGORIES }, (r) => {
        resolve(r.vaultCategories || DEFAULT_CATEGORIES);
      });
    });
  }

  function saveCategories(cats) {
    chrome.storage.sync.set({ vaultCategories: cats });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "showVaultOverlay") render(msg.data);
  });

  async function render({ url, title, selectedText }) {
    document.getElementById("__clawd-vault-overlay")?.remove();
    let selectedCategory = "";
    let editingCats = false;
    const CATEGORIES = await getCategories();

    const overlay = document.createElement("div");
    overlay.id = "__clawd-vault-overlay";
    overlay.innerHTML = `
      <style>
        #__clawd-vault-overlay {
          position: fixed; top: 0; right: 0; bottom: 0; left: 0;
          z-index: 2147483647;
          font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
          pointer-events: none;
        }
        #__cv-panel {
          position: absolute; top: 16px; right: 16px;
          width: 320px; background: #0a0a0a;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 16px 64px rgba(0,0,0,0.6);
          pointer-events: all;
          animation: __cv-slide 0.15s ease;
        }
        @keyframes __cv-slide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        #__cv-panel * { box-sizing: border-box; margin: 0; padding: 0; }

        .__cv-top {
          padding: 14px 16px 12px;
          display: flex; justify-content: space-between; align-items: flex-start;
        }
        .__cv-brand { color: #666; font-size: 10px; letter-spacing: 0.5px; }
        .__cv-close {
          background: none; border: none; color: #333; font-size: 16px;
          cursor: pointer; padding: 0; line-height: 1; font-family: inherit;
        }
        .__cv-close:hover { color: #666; }

        .__cv-meta { padding: 0 16px 14px; }
        .__cv-title {
          color: #e0e0e0; font-size: 12px; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .__cv-url {
          color: #2a2a2a; font-size: 9px; margin-top: 3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .__cv-divider { height: 1px; background: rgba(255,255,255,0.04); margin: 0 16px; }

        .__cv-section { padding: 12px 16px; }

        .__cv-selected {
          background: rgba(255,255,255,0.02); border-left: 2px solid #333;
          padding: 6px 10px; margin-bottom: 12px;
          color: #555; font-size: 10px; line-height: 1.5;
          max-height: 40px; overflow: hidden;
        }

        .__cv-note-input {
          width: 100%; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #ccc; font-family: inherit; font-size: 11px;
          padding: 8px 10px; outline: none; resize: none;
          height: 48px; display: block; line-height: 1.5;
          transition: border-color 0.15s;
        }
        .__cv-note-input::placeholder { color: #222; }
        .__cv-note-input:focus { border-color: rgba(255,255,255,0.12); }

        .__cv-cats-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 8px;
        }
        .__cv-cats-label { color: #333; font-size: 9px; letter-spacing: 0.5px; }
        .__cv-cats-edit {
          background: none; border: none; color: #2a2a2a; font-size: 9px;
          cursor: pointer; font-family: inherit; padding: 0;
        }
        .__cv-cats-edit:hover { color: #555; }

        .__cv-cats { display: flex; gap: 5px; flex-wrap: wrap; }
        .__cv-cat {
          padding: 4px 10px; font-size: 10px; font-family: inherit;
          background: transparent; border: 1px solid rgba(255,255,255,0.06);
          color: #444; cursor: pointer; user-select: none;
          transition: all 0.1s; line-height: 1.3;
        }
        .__cv-cat:hover { border-color: rgba(255,255,255,0.12); color: #777; }
        .__cv-cat.active { background: #fff; border-color: #fff; color: #0a0a0a; }
        .__cv-cat .remove-cat {
          display: none; margin-left: 4px; color: #888; cursor: pointer;
        }
        .__cv-cat.editing .remove-cat { display: inline; }

        .__cv-add-cat {
          padding: 4px 8px; font-size: 10px; font-family: inherit;
          background: transparent; border: 1px dashed rgba(255,255,255,0.08);
          color: #2a2a2a; cursor: pointer; display: none;
        }
        .__cv-add-cat:hover { border-color: rgba(255,255,255,0.15); color: #555; }
        .__cv-add-cat.visible { display: inline-block; }

        .__cv-add-input {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          color: #ccc; font-family: inherit; font-size: 10px;
          padding: 4px 8px; outline: none; width: 80px; display: none;
        }
        .__cv-add-input.visible { display: inline-block; }

        .__cv-bottom {
          padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.04);
          display: flex; justify-content: space-between; align-items: center;
        }
        .__cv-hint { color: #1a1a1a; font-size: 9px; }

        .__cv-save-btn {
          padding: 6px 16px; font-size: 11px; font-family: inherit;
          background: #fff; color: #0a0a0a; border: none;
          cursor: pointer; font-weight: 500; transition: all 0.1s;
        }
        .__cv-save-btn:hover { background: #e5e5e5; }
        .__cv-save-btn:disabled { background: #1a1a1a; color: #444; cursor: default; }
      </style>
      <div id="__cv-panel">
        <div class="__cv-top">
          <span class="__cv-brand">clawd vault</span>
          <button class="__cv-close" id="__cv-close">&times;</button>
        </div>
        <div class="__cv-meta">
          <div class="__cv-title">${escHtml(title || url)}</div>
          <div class="__cv-url">${escHtml(url)}</div>
        </div>
        <div class="__cv-divider"></div>
        <div class="__cv-section">
          ${selectedText ? `<div class="__cv-selected">"${escHtml(selectedText.slice(0, 200))}"</div>` : ""}
          <textarea class="__cv-note-input" id="__cv-note" placeholder="why are you saving this?"></textarea>
        </div>
        <div class="__cv-section" style="padding-top: 0;">
          <div class="__cv-cats-header">
            <span class="__cv-cats-label">category</span>
            <button class="__cv-cats-edit" id="__cv-cats-edit">edit</button>
          </div>
          <div class="__cv-cats" id="__cv-cats">
            ${CATEGORIES.map(c => `<span class="__cv-cat" data-cat="${c}">${c}<span class="remove-cat">&times;</span></span>`).join("")}
            <span class="__cv-add-cat" id="__cv-add-cat">+</span>
            <input class="__cv-add-input" id="__cv-add-input" placeholder="new..." maxlength="20">
          </div>
        </div>
        <div class="__cv-bottom">
          <span class="__cv-hint">cmd + enter to save</span>
          <button class="__cv-save-btn" id="__cv-save">save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const noteInput = document.getElementById("__cv-note");
    const saveBtn = document.getElementById("__cv-save");
    const closeBtn = document.getElementById("__cv-close");
    const catsContainer = document.getElementById("__cv-cats");
    const editCatsBtn = document.getElementById("__cv-cats-edit");
    const addCatBtn = document.getElementById("__cv-add-cat");
    const addCatInput = document.getElementById("__cv-add-input");

    setTimeout(() => noteInput.focus(), 50);

    // category selection
    catsContainer.addEventListener("click", (e) => {
      const removeTgt = e.target.closest(".remove-cat");
      if (removeTgt && editingCats) {
        const catEl = removeTgt.parentElement;
        const name = catEl.dataset.cat;
        catEl.remove();
        const idx = CATEGORIES.indexOf(name);
        if (idx > -1) CATEGORIES.splice(idx, 1);
        saveCategories([...CATEGORIES]);
        if (selectedCategory === name) selectedCategory = "";
        return;
      }

      const cat = e.target.closest(".__cv-cat");
      if (!cat || editingCats) return;
      const wasActive = cat.classList.contains("active");
      catsContainer.querySelectorAll(".__cv-cat").forEach(c => c.classList.remove("active"));
      if (!wasActive) {
        cat.classList.add("active");
        selectedCategory = cat.dataset.cat;
      } else {
        selectedCategory = "";
      }
    });

    // edit categories mode
    editCatsBtn.addEventListener("click", () => {
      editingCats = !editingCats;
      editCatsBtn.textContent = editingCats ? "done" : "edit";
      catsContainer.querySelectorAll(".__cv-cat").forEach(c => {
        c.classList.toggle("editing", editingCats);
      });
      addCatBtn.classList.toggle("visible", editingCats);
      if (!editingCats) addCatInput.classList.remove("visible");
    });

    addCatBtn.addEventListener("click", () => {
      addCatBtn.classList.remove("visible");
      addCatInput.classList.add("visible");
      addCatInput.focus();
    });

    addCatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = addCatInput.value.trim().toLowerCase();
        if (val && !CATEGORIES.includes(val)) {
          CATEGORIES.push(val);
          saveCategories([...CATEGORIES]);
          const span = document.createElement("span");
          span.className = "__cv-cat editing";
          span.dataset.cat = val;
          span.innerHTML = `${escHtml(val)}<span class="remove-cat">&times;</span>`;
          catsContainer.insertBefore(span, addCatBtn);
        }
        addCatInput.value = "";
        addCatInput.classList.remove("visible");
        addCatBtn.classList.add("visible");
      }
      if (e.key === "Escape") {
        addCatInput.value = "";
        addCatInput.classList.remove("visible");
        addCatBtn.classList.add("visible");
      }
    });

    // dismiss
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSave();
      }
    };
    document.addEventListener("keydown", onKey);
    closeBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", doSave);

    function close() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      window.__clawdVaultInjected = false;
    }

    function doSave() {
      saveBtn.disabled = true;
      saveBtn.textContent = "saving...";
      const note = noteInput.value.trim();

      chrome.runtime.sendMessage({
        action: "vaultSave",
        data: { url, title, selectedText, note, category: selectedCategory }
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
