// settings.js
(function() {
  const DEFAULT_API_URL = "http://100.119.198.102:9877";
  
  const apiUrlInput = document.getElementById("api-url");
  const saveBtn = document.getElementById("save-btn");
  const status = document.getElementById("status");
  
  // load saved URL
  chrome.storage.local.get({ vaultApiUrl: DEFAULT_API_URL }, (r) => {
    apiUrlInput.value = r.vaultApiUrl || DEFAULT_API_URL;
  });
  
  // test connection
  async function testConnection(url) {
    try {
      const resp = await fetch(url + "/api/health");
      const data = await resp.json();
      return data.ok === true;
    } catch (e) {
      return false;
    }
  }
  
  // save handler
  saveBtn.addEventListener("click", async () => {
    const url = apiUrlInput.value.trim();
    if (!url) {
      status.textContent = "enter a URL";
      status.className = "status error";
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = "testing...";
    
    // test connection
    const ok = await testConnection(url);
    
    if (ok) {
      chrome.storage.local.set({ vaultApiUrl: url }, () => {
        status.textContent = "saved!";
        status.className = "status ok";
        saveBtn.textContent = "save";
        saveBtn.disabled = false;
      });
    } else {
      status.textContent = "could not connect to server";
      status.className = "status error";
      saveBtn.textContent = "save";
      saveBtn.disabled = false;
    }
  });
})();
