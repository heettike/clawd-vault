const urlInput = document.getElementById("url");
const tokenInput = document.getElementById("token");
const saveButton = document.getElementById("save");
const status = document.getElementById("status");

chrome.storage.sync.get(["gatewayUrl", "gatewayToken"], ({ gatewayUrl, gatewayToken }) => {
  if (gatewayUrl) urlInput.value = gatewayUrl;
  if (gatewayToken) tokenInput.value = gatewayToken;
});

saveButton.addEventListener("click", () => {
  const gatewayUrl = urlInput.value.trim().replace(/\/+$/, "");
  const gatewayToken = tokenInput.value.trim();

  if (!gatewayUrl) {
    status.textContent = "gateway url required";
    status.style.color = "#ff4444";
    return;
  }

  chrome.storage.sync.set({ gatewayUrl, gatewayToken }, () => {
    status.textContent = "saved";
    status.style.color = "#fff";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
});
