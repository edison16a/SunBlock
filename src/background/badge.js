/**
 * The number on the toolbar icon.
 *
 * The badge is per tab, and it is also the only place the per-tab count is
 * published: the worker keeps that number in memory, so the popup reads the
 * badge back rather than asking for a count that may not exist any more.
 */

import { badgeOptions, state, tabCount } from "./store.js";

/**
 * Draws one tab's badge.
 *
 * Three states: blocking off shows the configured "OFF" text in grey, a tab
 * with nothing blocked yet shows no badge at all rather than a zero, and
 * anything else shows the count.
 *
 * @param {number} tabId
 */
export function renderBadge(tabId) {
  const badge = badgeOptions();

  if (!state.adBlockingEnabled) {
    chrome.action.setBadgeText({ tabId, text: badge.disabledText });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badge.disabledColor });
    return;
  }

  const count = tabCount(tabId);
  if (count === 0) {
    chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  chrome.action.setBadgeText({ tabId, text: String(count) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.blockedColor });
}

/**
 * Redraws every open tab, for changes that affect all of them at once such as
 * the global switch or a statistics reset.
 *
 * @returns {Promise<void>}
 */
export async function renderAllBadges() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => renderBadge(tab.id));
}
