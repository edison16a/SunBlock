/**
 * Reading the JSON files in data/ at runtime.
 *
 * The filter list, the blocking configuration and the UI copy ship as data
 * files so that adding a tracker or rewording a status line does not mean
 * editing a script. They are fetched from the extension's own package, which
 * needs no host permission and no web_accessible_resources entry: an
 * extension page and its service worker may always read their own files.
 *
 * Results are cached because the service worker reloads state on install, on
 * browser startup and on every wake, and the files cannot change while the
 * extension is running.
 */

/** @type {Map<string, Promise<unknown>>} */
const cache = new Map();

/**
 * @param {string} path Package relative path, for example "data/config.json".
 * @returns {Promise<any>}
 */
function loadJson(path) {
  if (!cache.has(path)) {
    const pending = fetch(chrome.runtime.getURL(path)).then((response) => {
      if (!response.ok) {
        throw new Error(`could not read ${path}: ${response.status}`);
      }
      return response.json();
    });
    // Do not cache a rejection: a transient failure should not poison every
    // later read for the lifetime of the worker.
    pending.catch(() => cache.delete(path));
    cache.set(path, pending);
  }
  return cache.get(path);
}

/**
 * The blocked URL patterns, in file order. Rule IDs are derived from that
 * order, so it matters that this is not sorted or deduplicated on the way in.
 *
 * @returns {Promise<string[]>}
 */
export function loadFilters() {
  return loadJson("data/filters.json");
}

/**
 * Storage defaults, rule options and badge colours.
 *
 * @returns {Promise<{defaults: object, rules: object, badge: object}>}
 */
export function loadConfig() {
  return loadJson("data/config.json");
}

/**
 * User visible copy for the popup and the options page.
 *
 * @returns {Promise<{shared: object, popup: object, options: object}>}
 */
export function loadStrings() {
  return loadJson("data/strings.json");
}
