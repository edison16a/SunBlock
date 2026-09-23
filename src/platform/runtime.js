/**
 * Promise shaped wrappers over the chrome APIs the two pages use.
 *
 * Manifest V3 returns promises from these APIs, but the callback style was
 * left over from V2 and each call site re-invented the same "did I get an
 * answer" check. Wrapping them once keeps the controllers readable and puts
 * the awkward cases in one place.
 */

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

/**
 * Opens the extension's options page.
 *
 * There used to be a window.open fallback here for the case where
 * openOptionsPage was missing. It cannot be missing: Chrome defines it
 * whenever the manifest declares an options page, which this one does.
 * Checked against Chrome 141 with the extension loaded, where
 * typeof chrome.runtime.openOptionsPage is "function". The fallback also
 * carried the only second copy of the options page path.
 */
export function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}

/**
 * @param {string} url
 * @returns {Promise<chrome.tabs.Tab>}
 */
export function openTab(url) {
  return chrome.tabs.create({ url });
}

/**
 * The version label both pages show in their footer.
 *
 * Read from the manifest rather than written into each page, so a release
 * means bumping one number. It used to be typed into the popup markup, the
 * options markup and package.json, and nothing kept the four copies honest.
 *
 * @returns {string} for example "v2.0"
 */
export function versionLabel() {
  return `v${chrome.runtime.getManifest().version}`;
}
