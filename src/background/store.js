/**
 * The service worker's state, and the only place that writes storage.
 *
 * A Manifest V3 service worker is evicted whenever the browser feels like it,
 * so none of this survives. Everything the user set (the global switch, the
 * whitelist, the all time counter) is read back from chrome.storage on every
 * wake. The per-tab counts are deliberately not persisted: they count what a
 * page load pulled in, and a page load outlives neither.
 *
 * Nothing here touches declarativeNetRequest or the badge. Callers apply
 * those effects, which keeps this module free of the rest of the worker and
 * keeps the module graph acyclic.
 */

import { compilePatterns } from "../core/patterns.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { loadConfig, loadFilters } from "../platform/resources.js";

/**
 * Live state. Read it directly, change it only through the setters below so
 * that memory and storage cannot drift apart.
 */
export const state = {
  /** @type {boolean} Global switch. */
  adBlockingEnabled: true,
  /** @type {number} All time blocked requests. */
  adsBlockedCount: 0,
  /** @type {string[]} Domains where blocking is paused. */
  whitelist: [],
  /** @type {string[]} Blocked URL patterns, in file order. */
  filters: [],
  /** @type {RegExp[]} The same patterns, compiled for the counter. */
  compiled: [],
  /** @type {object|null} data/config.json, once loaded. */
  config: null,
  /** @type {Map<number, number>} Blocked requests per tab, since its last load. */
  perTab: new Map()
};

/**
 * Loads the data files and the stored settings into memory.
 *
 * Safe to call repeatedly: it runs on worker start, on install and on browser
 * startup, and each run simply re-reads the current values.
 *
 * @returns {Promise<void>}
 */
export async function hydrate() {
  const [config, filters] = await Promise.all([loadConfig(), loadFilters()]);
  state.config = config;
  state.filters = filters;
  state.compiled = compilePatterns(filters);

  const { defaults } = config;
  const stored = await chrome.storage.local.get(defaults);

  // Guard each value rather than trusting storage. A half written or hand
  // edited entry should fall back to the default instead of producing a
  // whitelist that is not an array. The fallbacks come from config.defaults,
  // the same values the get() call above asks for, so the defaults are
  // written down once instead of once per line.
  state.adBlockingEnabled =
    typeof stored.adBlockingEnabled === "boolean"
      ? stored.adBlockingEnabled
      : defaults.adBlockingEnabled;
  state.adsBlockedCount = stored.adsBlockedCount || defaults.adsBlockedCount;
  // Copied, not aliased: the parsed config is cached for the life of the
  // worker, and handing out its array would let a later edit change the
  // default itself.
  state.whitelist = Array.isArray(stored.whitelist)
    ? stored.whitelist
    : [...defaults.whitelist];
}

/** Rule options from data/config.json, for the rule builder. */
export function ruleOptions() {
  return state.config.rules;
}

/** Badge colours and text from data/config.json. */
export function badgeOptions() {
  return state.config.badge;
}

/**
 * @param {boolean} value
 * @returns {Promise<void>}
 */
export function setAdBlockingEnabled(value) {
  state.adBlockingEnabled = value;
  return chrome.storage.local.set({ [STORAGE_KEYS.AD_BLOCKING_ENABLED]: value });
}

/**
 * @param {string[]} whitelist
 * @returns {Promise<void>}
 */
export function setWhitelist(whitelist) {
  state.whitelist = whitelist;
  return chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: whitelist });
}

/**
 * @param {number} count
 * @returns {Promise<void>}
 */
export function setAdsBlockedCount(count) {
  state.adsBlockedCount = count;
  return chrome.storage.local.set({ [STORAGE_KEYS.ADS_BLOCKED_COUNT]: count });
}

/**
 * Adds one to the all time counter and persists it.
 *
 * @returns {Promise<void>}
 */
export function incrementAdsBlockedCount() {
  return setAdsBlockedCount(state.adsBlockedCount + 1);
}

/**
 * Adds one to a tab's count.
 *
 * @param {number} tabId
 * @returns {number} the new count
 */
export function incrementTabCount(tabId) {
  const next = (state.perTab.get(tabId) || 0) + 1;
  state.perTab.set(tabId, next);
  return next;
}

/**
 * @param {number} tabId
 * @returns {number}
 */
export function tabCount(tabId) {
  return state.perTab.get(tabId) || 0;
}

/** Sets a tab's count to zero, for when that tab starts loading again. */
export function resetTabCount(tabId) {
  state.perTab.set(tabId, 0);
}

/** Drops a closed tab, so the map does not grow for the worker's lifetime. */
export function forgetTab(tabId) {
  state.perTab.delete(tabId);
}

/** Clears every tab's count, for when blocking is toggled or stats are reset. */
export function resetAllTabCounts() {
  state.perTab.clear();
}

/**
 * The configured default for a storage key.
 *
 * @param {string} key
 * @param {*} whileUnloaded what to use before the config file has loaded,
 *   which is possible because storage events can arrive mid hydrate.
 */
function defaultFor(key, whileUnloaded) {
  return state.config ? state.config.defaults[key] : whileUnloaded;
}

/**
 * Adopts values that some other context wrote to storage.
 *
 * The options page writes the whitelist directly, so the worker learns about
 * it here rather than through a message. The worker's own writes come back
 * through this path too, which is harmless: it is being told a value it
 * already holds.
 *
 * A removed key also arrives here, as a change with no newValue, which is
 * what chrome.storage.local.clear() produces. The blocking flag used to take
 * that undefined straight into memory and read as false, so clearing storage
 * turned protection off and removed every rule, while storage itself said
 * nothing and therefore meant "on by default". The two only agreed again
 * after a restart. All three keys now fall back to the configured default,
 * which is what a fresh read of empty storage would have given.
 *
 * @param {Record<string, chrome.storage.StorageChange>} changes
 * @returns {{enabled: boolean, whitelist: boolean, count: boolean}} which
 *   values moved, so the caller knows what to re-apply.
 */
export function adoptStorageChanges(changes) {
  const changed = { enabled: false, whitelist: false, count: false };

  const enabled = changes[STORAGE_KEYS.AD_BLOCKING_ENABLED];
  if (enabled) {
    state.adBlockingEnabled =
      typeof enabled.newValue === "boolean"
        ? enabled.newValue
        : defaultFor("adBlockingEnabled", state.adBlockingEnabled);
    changed.enabled = true;
  }

  const whitelist = changes[STORAGE_KEYS.WHITELIST];
  if (whitelist) {
    state.whitelist = Array.isArray(whitelist.newValue)
      ? whitelist.newValue
      : [...defaultFor("whitelist", [])];
    changed.whitelist = true;
  }

  const count = changes[STORAGE_KEYS.ADS_BLOCKED_COUNT];
  if (count) {
    state.adsBlockedCount =
      count.newValue || defaultFor("adsBlockedCount", 0);
    changed.count = true;
  }

  return changed;
}
