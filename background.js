// SunBlock background script (service worker)

// --- Global state ---

let adBlockingEnabled = true;
let adsBlockedCount = 0;
let whitelist = []; // list of domains where blocking is paused
let compiledFilters = [];
let currentRuleIds = [];
let adsBlockedPerTab = {};

// Original URL filters (kept intact, only moved out so they can be reused)
const URL_FILTERS = [
  "*://*.doubleclick.net/*",
  "*://*.googleadservices.com/*",
  "*://*.zedo.com/*",
  "*://*.adservice.google.com/*",
  "*://*.googlesyndication.com/*",
  "*://*.analytics.google.com/*",
  "*://*.google-analytics.com/*",
  "*://*.hotjar.com/*",
  "*://*.ads.youtube.com/*",
  "*://*.ad.youtube.com/*",
  "*://*/*cookie_notice*",
  "*://*/*cookie-policy*",
  "*://*.amazon-adsystem.com/*",
  "*://*.aaxads.com/*",
  "*://*.mads.amazon-adsystem.com/*",
  "*://*.ads-twitter.com/*",
  "*://*.ads-api.reddit.com/*",
  "*://*.ads.linkedin.com/*",
  "*://*.ads.reddit.com/*",
  "*://*.connect.facebook.net/*",
  "*://*.adtechus.com/*",
  "*://*.bidswitch.net/*",
  "*://*.pubmatic.com/*",
  "*://*.rubiconproject.com/*",
  "*://*.openx.net/*",
  "*://*.adnxs.com/*",
  "*://*.taboola.com/*",
  "*://*.criteo.com/*",
  "*://*.quantserve.com/*",
  "*://*.scorecardresearch.com/*",
  "*://*.mathtag.com/*",
  "*://*.rlcdn.com/*",
  "*://*.ib.adnxs.com/*",
  "*://*.contextweb.com/*",
  "*://*.advertising.com/*",
  "*://*.yldbt.com/*",
  "*://*.tracking.klick2contact.com/*",
  "*://*.tealium.com/*",
  "*://*.webtrends.com/*",
  "*://*.krxd.net/*",
  "*://*.bizographics.com/*",
  "*://*.bizographicscdn.com/*",
  "*://*.outbrain.com/*",
  "*://*.adcolony.com/*",
  "*://*.media.net/*",
  "*://*.googleanalytics.com/*",
  "*://*.mouseflow.com/*",
  "*://*.freshmarketer.com/*",
  "*://*.luckyorange.com/*",
  "*://pixel.facebook.com/*",
  "*://an.facebook.com/*",
  "*://analytics.pointdrive.linkedin.com/*",
  "*://ads.pinterest.com/*",
  "*://analytics.pinterest.com/*",
  "*://ads.tiktok.com/*",
  "*://analytics.tiktok.com/*",
  "*://ads-api.tiktok.com/*",
  "*://events.reddit.com/*",
  "*://events.redditmedia.com/*",
  "*://ads.yahoo.com/*",
  "*://analytics.yahoo.com/*",
  "*://samsungads.com/*",
  "*://adtago.s3.amazonaws.com/*",
  "*://analyticsengine.s3.amazonaws.com/*",
  "*://analytics.s3.amazonaws.com/*",
  "*://advice-ads.s3.amazonaws.com/*",
  "*://*.luckyorange.net/*",
  "*://stats.wp.com/*",
  "*://notify.bugsnag.com/*",
  "*://sessions.bugsnag.com/*",
  "*://api.bugsnag.com/*",
  "*://app.bugsnag.com/*",
  "*://browser.sentry-cdn.com/*",
  "*://app.getsentry.com/*",
  "*://extmaps-api.yandex.net/*",
  "*://appmetrica.yandex.ru/*",
  "*://adfstat.yandex.ru/*",
  "*://metrika.yandex.ru/*",
  "*://offerwall.yandex.net/*",
  "*://adfox.yandex.ru/*",
  "*://auction.unityads.unity3d.com/*",
  "*://webview.unityads.unity3d.com/*",
  "*://config.unityads.unity3d.com/*",
  "*://adserver.unityads.unity3d.com/*",
  "*://iot-eu-logser.realme.com/*",
  "*://iot-logser.realme.com/*",
  "*://bdapi-ads.realmemobile.com/*",
  "*://bdapi-in-ads.realmemobile.com/*",
  "*://api.ad.xiaomi.com/*",
  "*://data.mistat.xiaomi.com/*",
  "*://data.mistat.india.xiaomi.com/*",
  "*://data.mistat.rus.xiaomi.com/*",
  "*://sdkconfig.ad.xiaomi.com/*",
  "*://sdkconfig.ad.intl.xiaomi.com/*",
  "*://tracking.rus.miui.com/*",
  "*://adsfs.oppomobile.com/*",
  "*://adx.ads.oppomobile.com/*",
  "*://ck.ads.oppomobile.com/*",
  "*://data.ads.oppomobile.com/*",
  "*://metrics.data.hicloud.com/*",
  "*://metrics2.data.hicloud.com/*",
  "*://grs.hicloud.com/*",
  "*://logservice.hicloud.com/*",
  "*://logservice1.hicloud.com/*",
  "*://logbak.hicloud.com/*",
  "*://click.oneplus.cn/*",
  "*://open.oneplus.net/*",
  "*://samsungads.com/*",
  "*://smetrics.samsung.com/*",
  "*://nmetrics.samsung.com/*",
  "*://samsung-com.112.2o7.net/*",
  "*://analytics-api.samsunghealthcn.com/*",
  "*://iadsdk.apple.com/*",
  "*://metrics.icloud.com/*",
  "*://metrics.mzstatic.com/*",
  "*://api-adservices.apple.com/*",
  "*://books-analytics-events.apple.com/*",
  "*://weather-analytics-events.apple.com/*",
  "*://notes-analytics-events.apple.com/*",
  "*://ads-api.twitter.com/*",
  "*://log.pinterest.com/*",
  "*://trk.pinterest.com/*",
  "*://ads-sg.tiktok.com/*",
  "*://analytics-sg.tiktok.com/*",
  "*://business-api.tiktok.com/*",
  "*://ads.tiktok.com/*",
  "*://log.byteoversea.com/*",
  "*://geo.yahoo.com/*",
  "*://udc.yahoo.com/*",
  "*://udcm.yahoo.com/*",
  "*://analytics.query.yahoo.com/*",
  "*://partnerads.ysm.yahoo.com/*",
  "*://log.fc.yahoo.com/*",
  "*://gemini.yahoo.com/*",
  "*://adtech.yahooinc.com/*",
  "*://ads.facebook.com/*",
  "*://advertising.twitter.com/*",
  "*://ads-dev.pinterest.com/*",
  "*://d.reddit.com/*",
  "*://affiliationjs.s3.amazonaws.com/*",
  "*://advertising-api-eu.amazon.com/*",
  "*://securemetrics.apple.com/*",
  "*://supportmetrics.apple.com/*",
  "*://config.samsungads.com/*"
];

// --- Initialization ---

loadInitialState();

chrome.runtime.onInstalled.addListener(() => {
  loadInitialState();
});

chrome.runtime.onStartup.addListener(() => {
  loadInitialState();
});

// Load state from storage, compile filters, and update rules
function loadInitialState() {
  chrome.storage.local.get(
    {
      adBlockingEnabled: true,
      adsBlockedCount: 0,
      whitelist: []
    },
    (result) => {
      adBlockingEnabled = typeof result.adBlockingEnabled === "boolean" ? result.adBlockingEnabled : true;
      adsBlockedCount = result.adsBlockedCount || 0;
      whitelist = Array.isArray(result.whitelist) ? result.whitelist : [];

      compileFilters();
      updateAdBlockingRules();
      updateBadgeForAllTabs();
    }
  );
}

// Recompile URL filter patterns into regular expressions for counting
function compileFilters() {
  compiledFilters = URL_FILTERS.map((pattern) => {
    // Convert Chrome-style pattern "*://*.domain.com/*" into a RegExp
    let escaped = pattern
      .replace(/\./g, "\\.")
      .replace(/\//g, "\\/")
      .replace(/\*/g, ".*");
    return new RegExp("^" + escaped + "$", "i");
  });
}

// --- Declarative Net Request rules ---

function updateAdBlockingRules() {
  const resourceTypes = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "other"
  ];

  const rules = URL_FILTERS.map((urlFilter, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: urlFilter,
      resourceTypes: resourceTypes,
      // Pause on whitelisted domains
      excludedInitiatorDomains: whitelist
    }
  }));

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: currentRuleIds,
      addRules: adBlockingEnabled ? rules : []
    },
    () => {
      currentRuleIds = adBlockingEnabled ? rules.map((r) => r.id) : [];
    }
  );
}

// --- WebRequest listener for counting blocked ads ---

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!adBlockingEnabled) {
      return;
    }

    const initiator = details.initiator || details.documentUrl;
    if (!initiator) {
      return;
    }

    let domain;
    try {
      domain = new URL(initiator).hostname.replace(/^www\./, "");
    } catch (e) {
      return;
    }

    if (whitelist.includes(domain)) {
      // Blocking paused on this site
      return;
    }

    if (matchesAnyFilter(details.url)) {
      incrementBlockedCount(details.tabId);
    }
  },
  { urls: ["<all_urls>"] },
  [] // Not blocking, just observing
);

function matchesAnyFilter(url) {
  for (const regex of compiledFilters) {
    if (regex.test(url)) {
      return true;
    }
  }
  return false;
}

function incrementBlockedCount(tabId) {
  adsBlockedCount += 1;
  chrome.storage.local.set({ adsBlockedCount });

  // Per-tab stats for badge
  if (typeof tabId === "number" && tabId >= 0) {
    adsBlockedPerTab[tabId] = (adsBlockedPerTab[tabId] || 0) + 1;
    updateBadgeForTab(tabId);
  }

  // Notify popup if it is open
  chrome.runtime.sendMessage({
    action: "adsBlockedUpdated",
    adsBlockedCount
  });
}

// --- Badge handling ---

function updateBadgeForTab(tabId) {
  if (!adBlockingEnabled) {
    chrome.action.setBadgeText({ tabId, text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#777777" });
    return;
  }

  const count = adsBlockedPerTab[tabId] || 0;
  if (count === 0) {
    chrome.action.setBadgeText({ tabId, text: "" });
  } else {
    chrome.action.setBadgeText({ tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#f5a623" }); // golden
  }
}

function updateBadgeForAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      updateBadgeForTab(tab.id);
    });
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  delete adsBlockedPerTab[tabId];
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    // Reset per-tab counter when tab reloads
    adsBlockedPerTab[tabId] = 0;
    updateBadgeForTab(tabId);
  }
});

// --- Storage change sync ---

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.adBlockingEnabled) {
    adBlockingEnabled = changes.adBlockingEnabled.newValue;
    updateAdBlockingRules();
    adsBlockedPerTab = {};
    updateBadgeForAllTabs();
  }

  if (changes.whitelist) {
    whitelist = changes.whitelist.newValue || [];
    updateAdBlockingRules();
  }

  if (changes.adsBlockedCount) {
    adsBlockedCount = changes.adsBlockedCount.newValue || 0;
  }
});

// --- Message handling (popup & options) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAdBlockingStatus") {
    sendResponse({ adBlockingEnabled, adsBlockedCount });
    return;
  }

  if (request.action === "toggleAdBlocking") {
    adBlockingEnabled = !adBlockingEnabled;
    chrome.storage.local.set({ adBlockingEnabled }, () => {
      updateAdBlockingRules();
      adsBlockedPerTab = {};
      updateBadgeForAllTabs();
      sendResponse({ adBlockingEnabled });
    });
    return true; // async
  }

  if (request.action === "getSettings") {
    sendResponse({ adBlockingEnabled, adsBlockedCount, whitelist });
    return;
  }

  if (request.action === "togglePauseForSite") {
    const domain = request.domain;
    if (!domain) {
      sendResponse({ success: false });
      return;
    }

    const index = whitelist.indexOf(domain);
    if (index === -1) {
      whitelist.push(domain);
    } else {
      whitelist.splice(index, 1);
    }

    chrome.storage.local.set({ whitelist }, () => {
      updateAdBlockingRules();
      sendResponse({ success: true, whitelist });
    });

    return true; // async
  }

  if (request.action === "resetAdsBlockedCount") {
    adsBlockedCount = 0;
    chrome.storage.local.set({ adsBlockedCount }, () => {
      adsBlockedPerTab = {};
      updateBadgeForAllTabs();
      chrome.runtime.sendMessage({
        action: "adsBlockedUpdated",
        adsBlockedCount
      });
      sendResponse({ success: true, adsBlockedCount });
    });
    return true; // async
  }
});
