// vault panel — injected into page on double-click
// shows popup.html as an iframe overlay on the right side

if (!window.__cvPanelLoaded) {
  window.__cvPanelLoaded = true;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggleVaultPanel") {
      const existing = document.getElementById("__cv-panel");
      if (existing) {
        existing.remove();
        return;
      }

      const panel = document.createElement("div");
      panel.id = "__cv-panel";
      panel.innerHTML = `
        <style>
          #__cv-panel {
            position: fixed; top: 0; right: 0; z-index: 2147483647;
            width: 380px; height: 100vh;
            background: #0a0a0a; border-left: 1px solid rgba(255,255,255,0.06);
            box-shadow: -8px 0 32px rgba(0,0,0,0.5);
            animation: __cv-slide 0.15s ease;
            display: flex; flex-direction: column;
          }
          @keyframes __cv-slide { from { transform: translateX(100%) } to { transform: translateX(0) } }
          #__cv-panel-header {
            padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #161616;
          }
          #__cv-panel-header span { color: #fff; font-family: 'SF Mono',Consolas,monospace; font-size: 11px; letter-spacing: 1px; }
          #__cv-panel-close {
            background: none; border: none; color: #555; font-size: 16px; cursor: pointer;
            font-family: 'SF Mono',Consolas,monospace; padding: 0; line-height: 1;
          }
          #__cv-panel-close:hover { color: #fff; }
          #__cv-panel iframe {
            flex: 1; width: 100%; border: none; background: #0a0a0a;
          }
        </style>
        <div id="__cv-panel-header">
          <span>clawd vault</span>
          <button id="__cv-panel-close">&times;</button>
        </div>
        <iframe src="${chrome.runtime.getURL('popup.html')}"></iframe>
      `;
      document.body.appendChild(panel);

      document.getElementById("__cv-panel-close").addEventListener("click", () => {
        panel.style.animation = "none";
        panel.style.transform = "translateX(100%)";
        panel.style.transition = "transform 0.15s ease";
        setTimeout(() => panel.remove(), 150);
      });
    }
  });
}
