/**
 * Promise shaped wrappers over the chrome APIs the two pages use.
 *
 * Manifest V3 returns promises from these APIs, but the callback style was
 * left over from V2 and each call site re-invented the same "did I get an
 * answer" check. Wrapping them once keeps the controllers readable and puts
 * the awkward cases in one place.
 */

/** The options page, relative to the extension root. */
export const OPTIONS_PAGE = "pages/options.html";

/**
 * Sends a message to the service worker and resolves with its reply.
 *
 * Resolves with undefined instead of rejecting when nothing answers. That is
 * a real state, not a bug: the worker can be mid-restart when a page opens,
 * and both pages already render a "cannot reach the service worker" message
 * for it.
 *
 * @param {object} message
 * @returns {Promise<any|undefined>}
 */
export async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return undefined;
  }
}

/**
 * The tab the user is looking at, or null if there is not one.
 *
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
export async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

/**
 * Reloads a tab so new blocking rules take effect on the page in front of the
 * user. Rules only apply to requests made after they are installed, so
 * without this a toggle looks like it did nothing.
 *
 * @param {number} tabId
 * @returns {Promise<void>}
 */
export async function reloadTab(tabId) {
  await chrome.tabs.reload(tabId);
}

/**
 * Reads a tab's badge text.
 *
 * The popup uses this to show the per-tab count. The worker keeps that number
 * in memory only, so the badge it already rendered is the one place a page
 * can read it back from.
 *
 * @param {number} tabId
 * @returns {Promise<string>}
 */
export function getBadgeText(tabId) {
  return chrome.action.getBadgeText({ tabId });
}

/** Opens the extension's options page. */
export function openOptionsPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL(OPTIONS_PAGE));
  }
}

/**
 * @param {string} url
 * @returns {Promise<chrome.tabs.Tab>}
 */
export function openTab(url) {
  return chrome.tabs.create({ url });
}
