/**
 * The vocabulary shared by the service worker, the popup and the options page.
 *
 * These strings used to be typed out at both ends of every exchange, so a
 * typo in one place silently produced a message nobody answered. Importing
 * them from here means a wrong name is a missing export instead.
 */

/** Actions carried on `chrome.runtime.sendMessage({ action })`. */
export const MESSAGES = Object.freeze({
  /** Request: flip global blocking. Answered after the write lands. */
  TOGGLE_AD_BLOCKING: "toggleAdBlocking",
  /** Request: global state plus the whitelist. Answered synchronously. */
  GET_SETTINGS: "getSettings",
  /** Request: add or remove one domain from the whitelist. */
  TOGGLE_PAUSE_FOR_SITE: "togglePauseForSite",
  /** Request: zero the all time counter. */
  RESET_ADS_BLOCKED_COUNT: "resetAdsBlockedCount",
  /** Broadcast: the all time counter moved. Sent to whichever page is open. */
  ADS_BLOCKED_UPDATED: "adsBlockedUpdated"
});

/**
 * Keys in `chrome.storage.local`.
 *
 * Everything lives in the local area, never sync: the blocked counter is
 * written on every blocked request and would blow through the sync write
 * quota within seconds.
 */
export const STORAGE_KEYS = Object.freeze({
  AD_BLOCKING_ENABLED: "adBlockingEnabled",
  ADS_BLOCKED_COUNT: "adsBlockedCount",
  WHITELIST: "whitelist"
});

/** The storage area name as it arrives in `chrome.storage.onChanged`. */
export const STORAGE_AREA = "local";
