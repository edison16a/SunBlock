document.addEventListener("DOMContentLoaded", () => {
  const globalToggle = document.getElementById("globalToggleSettings");
  const statsTotal = document.getElementById("statsTotal");
  const statsStatus = document.getElementById("statsStatus");
  const statsSubstatus = document.getElementById("statsSubstatus");
  const resetStatsBtn = document.getElementById("resetStatsSettings");
  const openDashboardTabBtn = document.getElementById("openDashboardTab");

  const whitelistContainer = document.getElementById("whitelistContainer");
  const whitelistEmpty = document.getElementById("whitelistEmpty");
  const whitelistList = document.getElementById("whitelistList");
  const whitelistInput = document.getElementById("whitelistInput");
  const addWhitelistBtn = document.getElementById("addWhitelistBtn");
  const addCurrentSiteBtn = document.getElementById("addCurrentSiteBtn");

  let adBlockingEnabled = true;
  let adsBlockedCount = 0;
  let whitelist = [];

  function renderStats() {
    statsTotal.textContent = adsBlockedCount.toLocaleString();
    globalToggle.checked = adBlockingEnabled;

    if (adBlockingEnabled) {
      statsStatus.textContent = "Enabled";
      statsSubstatus.textContent = "SunBlock is actively blocking ads and trackers.";
    } else {
      statsStatus.textContent = "Disabled";
      statsSubstatus.textContent = "No requests are being blocked. Turn protection back on when ready.";
    }
  }

  function renderWhitelist() {
    whitelistList.innerHTML = "";

    if (!whitelist || whitelist.length === 0) {
      whitelistEmpty.style.display = "block";
      whitelistList.style.display = "none";
      return;
    }

    whitelistEmpty.style.display = "none";
    whitelistList.style.display = "flex";

    whitelist.forEach((domain) => {
      const badge = document.createElement("div");
      badge.className = "badge";

      const domainSpan = document.createElement("span");
      domainSpan.className = "badge-domain";
      domainSpan.textContent = domain;

      const removeBtn = document.createElement("button");
      removeBtn.className = "badge-remove";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove from whitelist";
      removeBtn.addEventListener("click", () => {
        removeDomainFromWhitelist(domain);
      });

      badge.appendChild(domainSpan);
      badge.appendChild(removeBtn);
      whitelistList.appendChild(badge);
    });
  }

  function normaliseDomain(input) {
    if (!input) return null;
    let trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    // Strip protocol
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const url = new URL(trimmed);
        trimmed = url.hostname;
      } catch (e) {
        // fall back
      }
    }

    // Remove path if any
    if (trimmed.includes("/")) {
      trimmed = trimmed.split("/")[0];
    }

    // Remove common www
    trimmed = trimmed.replace(/^www\./, "");

    // Very basic validation
    if (!trimmed || !trimmed.includes(".")) {
      return null;
    }

    return trimmed;
  }

  function addDomainToWhitelist(raw) {
    const domain = normaliseDomain(raw);
    if (!domain) {
      whitelistInput.value = "";
      whitelistInput.placeholder = "Enter a valid domain (e.g. example.com)";
      return;
    }

    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      chrome.storage.local.set({ whitelist });
    }

    whitelistInput.value = "";
    renderWhitelist();
  }

  function removeDomainFromWhitelist(domain) {
    whitelist = whitelist.filter((d) => d !== domain);
    chrome.storage.local.set({ whitelist });
    renderWhitelist();
  }

  // Initial load from background / storage
  chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
    if (!response) {
      statsStatus.textContent = "Unavailable";
      statsSubstatus.textContent = "Could not connect to SunBlock service worker.";
      return;
    }

    adBlockingEnabled = !!response.adBlockingEnabled;
    adsBlockedCount = response.adsBlockedCount || 0;
    whitelist = Array.isArray(response.whitelist) ? response.whitelist : [];

    renderStats();
    renderWhitelist();
  });

  // Global toggle
  globalToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({ action: "toggleAdBlocking" }, (response) => {
      if (!response) {
        return;
      }
      adBlockingEnabled = !!response.adBlockingEnabled;
      renderStats();
    });
  });

  // Reset statistics
  resetStatsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "resetAdsBlockedCount" }, (response) => {
      if (response && typeof response.adsBlockedCount === "number") {
        adsBlockedCount = response.adsBlockedCount;
        renderStats();
      }
    });
  });

  // Open simple test page in new tab
  openDashboardTabBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://example.com" });
  });

  // Add user-entered whitelist domain
  addWhitelistBtn.addEventListener("click", () => {
    addDomainToWhitelist(whitelistInput.value);
  });

  whitelistInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDomainToWhitelist(whitelistInput.value);
    }
  });

  // Add current site to whitelist
  addCurrentSiteBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return;
      const tab = tabs[0];
      let domain = null;

      try {
        const url = new URL(tab.url);
        domain = url.hostname.replace(/^www\./, "");
      } catch (e) {
        domain = null;
      }

      if (domain) {
        addDomainToWhitelist(domain);
      }
    });
  });

  // Live updates from background for stats
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "adsBlockedUpdated") {
      adsBlockedCount = message.adsBlockedCount || 0;
      renderStats();
    }
  });
});
