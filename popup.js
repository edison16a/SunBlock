let adBlockingEnabled = false;

document.addEventListener("DOMContentLoaded", () => {
  const globalToggle = document.getElementById("globalToggle");
  const globalStatusPill = document.getElementById("globalStatusPill");
  const statusText = document.getElementById("statusText");
  const totalBlockedEl = document.getElementById("totalBlocked");
  const tabBlockedEl = document.getElementById("tabBlocked");
  const siteToggle = document.getElementById("siteToggle");
  const currentDomainEl = document.getElementById("currentDomain");
  const siteStatusText = document.getElementById("siteStatusText");
  const openSettingsBtn = document.getElementById("openSettings");
  const resetStatsBtn = document.getElementById("resetStats");
  const viewDetailsBtn = document.getElementById("viewDetails");
  const footerStatus = document.getElementById("footerStatus");

  let currentDomain = null;
  let whitelist = [];
  let tabBlockedCount = 0;

  // Helper: update global status UI
  function updateGlobalStatusUI() {
    globalToggle.checked = adBlockingEnabled;

    if (adBlockingEnabled) {
      globalStatusPill.textContent = "Enabled";
      globalStatusPill.classList.remove("off");
      globalStatusPill.classList.add("on");
      statusText.textContent = "SunBlock is protecting this browser from ads and trackers in real time.";
      footerStatus.textContent = "Real-time blocking active";
    } else {
      globalStatusPill.textContent = "Disabled";
      globalStatusPill.classList.remove("on");
      globalStatusPill.classList.add("off");
      statusText.textContent = "SunBlock is currently disabled. Turn it back on to block ads and trackers.";
      footerStatus.textContent = "Protection paused globally";
    }
  }

  // Helper: update per-site status
  function updateSiteStatusUI() {
    if (!currentDomain) {
      currentDomainEl.textContent = "Unknown site";
      siteStatusText.textContent = "Unable to detect the current site.";
      siteToggle.disabled = true;
      return;
    }

    siteToggle.disabled = false;
    currentDomainEl.textContent = currentDomain;

    const isPaused = whitelist.includes(currentDomain);

    siteToggle.checked = isPaused;

    if (isPaused) {
      siteStatusText.textContent =
        "SunBlock is paused on this site. Requests from this domain will not be blocked.";
    } else {
      siteStatusText.textContent =
        "SunBlock is active on this site. Ads and trackers from this page are blocked.";
    }
  }

  // Helper: request per-tab stats from background via badge (approximate)
  function loadTabBlocked() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) {
        tabBlockedEl.textContent = "0";
        return;
      }
      const tab = tabs[0];

      // We do not have direct access to the internal per-tab counter,
      // but the badge text is derived from it. Use that as a proxy.
      chrome.action.getBadgeText({ tabId: tab.id }, (text) => {
        const num = parseInt(text, 10);
        if (!isNaN(num)) {
          tabBlockedCount = num;
          tabBlockedEl.textContent = num.toString();
        } else {
          tabBlockedCount = 0;
          tabBlockedEl.textContent = "0";
        }
      });
    });
  }

  // Initial data load from background
  chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
    if (!response) {
      statusText.textContent = "Unable to connect to SunBlock service worker.";
      return;
    }

    adBlockingEnabled = !!response.adBlockingEnabled;
    whitelist = Array.isArray(response.whitelist) ? response.whitelist : [];
    const count = response.adsBlockedCount || 0;
    totalBlockedEl.textContent = count.toLocaleString();

    updateGlobalStatusUI();
    loadTabBlocked();

    // Resolve current domain
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) {
        currentDomain = null;
        updateSiteStatusUI();
        return;
      }
      const urlString = tabs[0].url || "";
      try {
        const url = new URL(urlString);
        currentDomain = url.hostname.replace(/^www\./, "");
      } catch (e) {
        currentDomain = null;
      }
      updateSiteStatusUI();
    });
  });

  // Listener: Global toggle change
  globalToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({ action: "toggleAdBlocking" }, (response) => {
      if (!response) {
        return;
      }
      adBlockingEnabled = !!response.adBlockingEnabled;
      updateGlobalStatusUI();

      // Reload current tab so rules apply immediately
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  });

  // Listener: Site toggle change (pause / resume on this site)
  siteToggle.addEventListener("change", () => {
    if (!currentDomain) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "togglePauseForSite",
        domain: currentDomain
      },
      (response) => {
        if (!response || !response.success) {
          return;
        }
        whitelist = response.whitelist || [];
        updateSiteStatusUI();

        // Reload current tab to apply new whitelist state
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      }
    );
  });

  // Listener: open settings
  openSettingsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });

  // Listener: reset statistics
  resetStatsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "resetAdsBlockedCount" }, (response) => {
      if (response && typeof response.adsBlockedCount === "number") {
        totalBlockedEl.textContent = response.adsBlockedCount.toLocaleString();
        tabBlockedEl.textContent = "0";
      }
    });
  });

  // Listener: "view details" (also opens settings)
  viewDetailsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });

  // Live updates from background (global counter)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "adsBlockedUpdated") {
      const count = message.adsBlockedCount || 0;
      totalBlockedEl.textContent = count.toLocaleString();
      // Tab count will catch up via badge; refresh it
      loadTabBlocked();
    }
  });
});
