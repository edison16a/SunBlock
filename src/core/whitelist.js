/**
 * Whitelist edits, as pure functions over an array of domains.
 *
 * Every function returns a new array instead of mutating. The whitelist is
 * held in three places at once (the service worker's memory, storage, and
 * whichever page is open), and returning a fresh array makes it obvious that
 * the caller has to publish the result rather than assume everyone saw the
 * change.
 */

/**
 * @param {ReadonlyArray<string>} whitelist
 * @param {string} domain
 * @returns {boolean}
 */
export function isWhitelisted(whitelist, domain) {
  return whitelist.includes(domain);
}

/**
 * Adds a domain, ignoring one that is already there.
 *
 * @param {ReadonlyArray<string>} whitelist
 * @param {string} domain
 * @returns {string[]}
 */
export function addDomain(whitelist, domain) {
  return whitelist.includes(domain) ? [...whitelist] : [...whitelist, domain];
}

/**
 * @param {ReadonlyArray<string>} whitelist
 * @param {string} domain
 * @returns {string[]}
 */
export function removeDomain(whitelist, domain) {
  return whitelist.filter((entry) => entry !== domain);
}

/**
 * Adds the domain if absent, removes it if present.
 *
 * This backs the popup's per-site switch, where one control means both
 * "pause here" and "resume here".
 *
 * @param {ReadonlyArray<string>} whitelist
 * @param {string} domain
 * @returns {string[]}
 */
export function toggleDomain(whitelist, domain) {
  return whitelist.includes(domain)
    ? removeDomain(whitelist, domain)
    : addDomain(whitelist, domain);
}
