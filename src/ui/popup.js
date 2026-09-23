/**
 * The toolbar popup.
 *
 * Shows global state, the two counters and the per-site pause switch. It owns
 * no state of its own: everything is asked of the service worker on open and
 * re-read from its replies, because the worker is the only thing that knows
 * what is currently installed in declarativeNetRequest.
 */

import { MESSAGES } from "../core/constants.js";
import { domainFromUrl } from "../core/domains.js";
import { isWhitelisted } from "../core/whitelist.js";
import { loadStrings } from "../platform/resources.js";
import {
  getActiveTab,
  getBadgeText,
  openOptionsPage,
  reloadTab,
  sendMessage,
  versionLabel
} from "../platform/runtime.js";

const els = {
  globalToggle: document.getElementById("globalToggle"),
  globalStatusPill: document.getElementById("globalStatusPill"),
  statusText: document.getElementById("statusText"),
  totalBlocked: document.getElementById("totalBlocked"),
  tabBlocked: document.getElementById("tabBlocked"),
  siteToggle: document.getElementById("siteToggle"),
  currentDomain: document.getElementById("currentDomain"),
  siteStatusText: document.getElementById("siteStatusText"),
  openSettings: document.getElementById("openSettings"),
  resetStats: document.getElementById("resetStats"),
  viewDetails: document.getElementById("viewDetails"),
  footerStatus: document.getElementById("footerStatus"),
  appVersion: document.getElementById("appVersion")
};

/** What the popup last heard from the worker. */
const view = {
  adBlockingEnabled: false,
  /** @type {string[]} */
  whitelist: [],
  /** @type {string|null} Domain of the tab behind the popup. */
  currentDomain: null
};

/** @type {{shared: object, popup: object}} */
let strings;

/** Paints the global switch, its pill, the explanation and the footer. */
function renderGlobalStatus() {
  const on = view.adBlockingEnabled;

  els.globalToggle.checked = on;
  els.globalStatusPill.textContent = on ? strings.shared.enabled : strings.shared.disabled;
  els.globalStatusPill.classList.toggle("on", on);
  els.globalStatusPill.classList.toggle("off", !on);
  els.statusText.textContent = on ? strings.popup.protectionOn : strings.popup.protectionOff;
  els.footerStatus.textContent = on ? strings.popup.footerOn : strings.popup.footerOff;
}

/** Paints the per-site row for whichever tab the popup was opened over. */
function renderSiteStatus() {
  // Pages with no nameable domain (the new tab page, a local file) cannot be
  // whitelisted, so the switch is disabled rather than lying about its state.
  if (!view.currentDomain) {
    els.currentDomain.textContent = strings.popup.unknownSite;
    els.siteStatusText.textContent = strings.popup.siteUndetectable;
    els.siteToggle.disabled = true;
    return;
  }

  const paused = isWhitelisted(view.whitelist, view.currentDomain);

  els.siteToggle.disabled = false;
  els.currentDomain.textContent = view.currentDomain;
  // Checked means paused here: the switch reads as "pause on this site".
  els.siteToggle.checked = paused;
  els.siteStatusText.textContent = paused
    ? strings.popup.sitePaused
    : strings.popup.siteActive;
}

/** @param {number} count */
function renderTotalBlocked(count) {
  els.totalBlocked.textContent = count.toLocaleString();
}

/**
 * Shows how much this tab has had blocked since it last loaded.
 *
 * The worker keeps that number in memory and never sends it, so the badge it
 * already drew is where the popup reads it from. Anything unparseable, an
 * empty badge or the "OFF" label, means zero.
 */
async function renderTabBlocked() {
  const tab = await getActiveTab();
  if (!tab) {
    els.tabBlocked.textContent = "0";
    return;
  }

  const count = parseInt(await getBadgeText(tab.id), 10);
  els.tabBlocked.textContent = Number.isNaN(count) ? "0" : count.toString();
}

/** Reloads the tab behind the popup so changed rules apply to what it shows. */
async function reloadActiveTab() {
  const tab = await getActiveTab();
  if (tab) {
    await reloadTab(tab.id);
  }
}

async function onGlobalToggle() {
  const response = await sendMessage({ action: MESSAGES.TOGGLE_AD_BLOCKING });
  if (!response) {
    return;
  }
  view.adBlockingEnabled = !!response.adBlockingEnabled;
  renderGlobalStatus();
  await reloadActiveTab();
}

async function onSiteToggle() {
  if (!view.currentDomain) {
    return;
  }

  const response = await sendMessage({
    action: MESSAGES.TOGGLE_PAUSE_FOR_SITE,
    domain: view.currentDomain
  });
  if (!response || !response.success) {
    return;
  }

  view.whitelist = response.whitelist || [];
  renderSiteStatus();
  await reloadActiveTab();
}

async function onResetStats() {
  const response = await sendMessage({ action: MESSAGES.RESET_ADS_BLOCKED_COUNT });
  if (response && typeof response.adsBlockedCount === "number") {
    renderTotalBlocked(response.adsBlockedCount);
    els.tabBlocked.textContent = "0";
  }
}

async function init() {
  strings = await loadStrings();

  const settings = await sendMessage({ action: MESSAGES.GET_SETTINGS });
  if (!settings) {
    els.statusText.textContent = strings.popup.disconnected;
    return;
  }

  view.adBlockingEnabled = !!settings.adBlockingEnabled;
  view.whitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
  renderTotalBlocked(settings.adsBlockedCount || 0);
  renderGlobalStatus();
  renderTabBlocked();

  const tab = await getActiveTab();
  view.currentDomain = tab ? domainFromUrl(tab.url || "") : null;
  renderSiteStatus();
}

// Set before anything is awaited. The manifest is available synchronously,
// so the footer should never be briefly blank.
els.appVersion.textContent = versionLabel();

els.globalToggle.addEventListener("change", onGlobalToggle);
els.siteToggle.addEventListener("change", onSiteToggle);
els.openSettings.addEventListener("click", openOptionsPage);
els.viewDetails.addEventListener("click", openOptionsPage);
els.resetStats.addEventListener("click", onResetStats);

// Live total while the popup is open. The worker broadcasts on every blocked
// request; the per-tab number follows from the badge it drew at the same time.
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === MESSAGES.ADS_BLOCKED_UPDATED) {
    renderTotalBlocked(message.adsBlockedCount || 0);
    renderTabBlocked();
  }
});

init().catch((error) => {
  console.error("SunBlock popup failed to start", error);
});
