/**
 * The options page.
 *
 * Global switch and statistics mirror what the popup shows, and are asked of
 * the service worker the same way. The whitelist is different: this page
 * writes it straight to chrome.storage rather than messaging the worker. The
 * worker is listening for that change and reinstalls its rules when it
 * arrives, so there is one path in and no reply to wait for.
 */

import { MESSAGES, STORAGE_KEYS } from "../core/constants.js";
import { domainFromUrl, normalizeDomain } from "../core/domains.js";
import { addDomain, isWhitelisted, removeDomain } from "../core/whitelist.js";
import { loadStrings } from "../platform/resources.js";
import { getActiveTab, openTab, sendMessage } from "../platform/runtime.js";

const els = {
  globalToggle: document.getElementById("globalToggleSettings"),
  statsTotal: document.getElementById("statsTotal"),
  statsStatus: document.getElementById("statsStatus"),
  statsSubstatus: document.getElementById("statsSubstatus"),
  resetStats: document.getElementById("resetStatsSettings"),
  openTestPage: document.getElementById("openDashboardTab"),
  whitelistEmpty: document.getElementById("whitelistEmpty"),
  whitelistList: document.getElementById("whitelistList"),
  whitelistInput: document.getElementById("whitelistInput"),
  addWhitelist: document.getElementById("addWhitelistBtn"),
  addCurrentSite: document.getElementById("addCurrentSiteBtn")
};

/** What the page last heard from the worker. */
const view = {
  adBlockingEnabled: true,
  adsBlockedCount: 0,
  /** @type {string[]} */
  whitelist: []
};

/** @type {{shared: object, options: object}} */
let strings;

function renderStats() {
  const on = view.adBlockingEnabled;

  els.statsTotal.textContent = view.adsBlockedCount.toLocaleString();
  els.globalToggle.checked = on;
  els.statsStatus.textContent = on ? strings.shared.enabled : strings.shared.disabled;
  els.statsSubstatus.textContent = on
    ? strings.options.protectionOn
    : strings.options.protectionOff;
}

/**
 * Redraws the whitelist as a row of removable chips.
 *
 * Built with createElement and textContent rather than innerHTML: a domain
 * comes from whatever the user typed or whatever site they were on, and it
 * should never be able to turn into markup.
 */
function renderWhitelist() {
  els.whitelistList.innerHTML = "";

  const empty = !view.whitelist || view.whitelist.length === 0;
  els.whitelistEmpty.style.display = empty ? "block" : "none";
  els.whitelistList.style.display = empty ? "none" : "flex";
  if (empty) {
    return;
  }

  view.whitelist.forEach((domain) => {
    const chip = document.createElement("div");
    chip.className = "badge";

    const label = document.createElement("span");
    label.className = "badge-domain";
    label.textContent = domain;

    const remove = document.createElement("button");
    remove.className = "badge-remove";
    remove.textContent = strings.options.removeGlyph;
    remove.title = strings.options.removeFromWhitelist;
    remove.addEventListener("click", () => removeFromWhitelist(domain));

    chip.append(label, remove);
    els.whitelistList.append(chip);
  });
}

/**
 * Publishes a whitelist edit.
 *
 * The worker hears about it through chrome.storage.onChanged, so this is the
 * only write the page has to make.
 *
 * @param {string[]} whitelist
 */
function saveWhitelist(whitelist) {
  view.whitelist = whitelist;
  chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: whitelist });
  renderWhitelist();
}

/**
 * @param {string} raw Whatever was typed or read off the current tab.
 */
function addToWhitelist(raw) {
  const domain = normalizeDomain(raw);
  if (!domain) {
    // The hint replaces the placeholder so the box itself explains the
    // rejection, with no error line to dismiss.
    els.whitelistInput.value = "";
    els.whitelistInput.placeholder = strings.options.invalidDomainHint;
    return;
  }

  els.whitelistInput.value = "";
  // Adding one that is already listed writes nothing. The worker reinstalls
  // every rule on a whitelist change, so a no-op write is not free.
  if (!isWhitelisted(view.whitelist, domain)) {
    saveWhitelist(addDomain(view.whitelist, domain));
  }
}

/** @param {string} domain */
function removeFromWhitelist(domain) {
  saveWhitelist(removeDomain(view.whitelist, domain));
}

async function onGlobalToggle() {
  const response = await sendMessage({ action: MESSAGES.TOGGLE_AD_BLOCKING });
  if (!response) {
    return;
  }
  view.adBlockingEnabled = !!response.adBlockingEnabled;
  renderStats();
}

async function onResetStats() {
  const response = await sendMessage({ action: MESSAGES.RESET_ADS_BLOCKED_COUNT });
  if (response && typeof response.adsBlockedCount === "number") {
    view.adsBlockedCount = response.adsBlockedCount;
    renderStats();
  }
}

async function onAddCurrentSite() {
  const tab = await getActiveTab();
  if (!tab) {
    return;
  }
  const domain = domainFromUrl(tab.url);
  if (domain) {
    addToWhitelist(domain);
  }
}

async function init() {
  strings = await loadStrings();

  const settings = await sendMessage({ action: MESSAGES.GET_SETTINGS });
  if (!settings) {
    els.statsStatus.textContent = strings.options.statusUnavailable;
    els.statsSubstatus.textContent = strings.options.disconnected;
    return;
  }

  view.adBlockingEnabled = !!settings.adBlockingEnabled;
  view.adsBlockedCount = settings.adsBlockedCount || 0;
  view.whitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];

  renderStats();
  renderWhitelist();
}

els.globalToggle.addEventListener("change", onGlobalToggle);
els.resetStats.addEventListener("click", onResetStats);
els.openTestPage.addEventListener("click", () => openTab(strings.options.testPageUrl));
els.addWhitelist.addEventListener("click", () => addToWhitelist(els.whitelistInput.value));
els.addCurrentSite.addEventListener("click", onAddCurrentSite);

els.whitelistInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    // The input sits next to a button but in no form, so stop Enter from
    // doing anything other than adding the domain.
    event.preventDefault();
    addToWhitelist(els.whitelistInput.value);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === MESSAGES.ADS_BLOCKED_UPDATED) {
    view.adsBlockedCount = message.adsBlockedCount || 0;
    renderStats();
  }
});

init().catch((error) => {
  console.error("SunBlock options page failed to start", error);
});
