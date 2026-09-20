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
    setText(tabId, badge.disabledText);
    setColor(tabId, badge.disabledColor);
    return;
  }

  const count = tabCount(tabId);
  if (count === 0) {
    setText(tabId, "");
    return;
  }

  setText(tabId, String(count));
  setColor(tabId, badge.blockedColor);
}

/**
 * Drawing on a tab that has gone is not an error worth reporting.
 *
 * A request can finish, and be counted, after the tab that made it was
 * closed. The badge call then rejects with "No tab with id", which nothing
 * handled, so ordinary browsing produced unhandled rejections in the worker.
 * There is nothing to do about it: the tab is gone, and so is its badge.
 */
function ignoreClosedTab() {}

/** @param {number} tabId @param {string} text */
function setText(tabId, text) {
  chrome.action.setBadgeText({ tabId, text }).catch(ignoreClosedTab);
}

/** @param {number} tabId @param {string} color */
function setColor(tabId, color) {
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(ignoreClosedTab);
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
