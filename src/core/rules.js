/**
 * Building declarativeNetRequest rules from the filter list.
 *
 * Kept separate from the code that installs them so the shape of a rule can
 * be asserted in a test without a browser.
 */

/**
 * @typedef {object} RuleOptions
 * @property {number} priority Rule priority. Every rule uses the same one,
 *   so relative order never decides a match.
 * @property {string[]} resourceTypes Request types the rule applies to.
 */

/**
 * Turns patterns into one block rule each.
 *
 * Rule IDs are the 1 based position in the list. declarativeNetRequest
 * requires positive integers and requires them unique, and a positional ID
 * gives both for free. It also means IDs shift when the list changes, which
 * is why the installer removes rules by the IDs currently registered rather
 * than assuming it knows them.
 *
 * `excludedInitiatorDomains` is what makes the per-site pause work: a rule
 * does not apply when the page making the request is on the whitelist.
 * Chrome matches subdomains too, so whitelisting `example.com` also pauses
 * blocking on `cdn.example.com`.
 *
 * @param {ReadonlyArray<string>} patterns
 * @param {RuleOptions} options
 * @param {ReadonlyArray<string>} whitelist Domains where blocking is paused.
 * @returns {object[]} rules ready for chrome.declarativeNetRequest
 */
export function buildBlockingRules(patterns, options, whitelist) {
  return patterns.map((urlFilter, index) => ({
    id: index + 1,
    priority: options.priority,
    action: { type: "block" },
    condition: {
      urlFilter,
      resourceTypes: options.resourceTypes,
      excludedInitiatorDomains: [...whitelist]
    }
  }));
}
