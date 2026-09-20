/**
 * Installing the blocking rules in declarativeNetRequest.
 *
 * Dynamic rules are how SunBlock blocks: Chrome matches them itself, before
 * the request leaves the browser, and the extension never sees the traffic.
 * That is also why the rules have to be reinstalled whenever the global
 * switch or the whitelist changes, since both are baked into the rule set.
 */

import { buildBlockingRules } from "../core/rules.js";
import { ruleOptions, state } from "./store.js";

/**
 * Serializes installs.
 *
 * Several things can ask for a reinstall at once. Toggling protection, for
 * instance, triggers one from the message handler and another from the
 * storage change the same write produces. Two overlapping installs would
 * both read the rule set, then both try to add the same IDs, and the second
 * would be rejected for duplicates.
 *
 * @type {Promise<void>}
 */
let pending = Promise.resolve();

/**
 * Rebuilds the rule set from current state and installs it.
 *
 * Turning blocking off installs no rules at all rather than leaving disabled
 * ones behind, so there is nothing for Chrome to match against.
 *
 * @returns {Promise<void>} resolves when this install has finished
 */
export function applyRules() {
  pending = pending.then(install).catch((error) => {
    console.error("SunBlock could not update its blocking rules", error);
  });
  return pending;
}

/**
 * Replaces whatever is registered with a freshly built rule set.
 *
 * Removal works from the IDs Chrome reports, not from the IDs this worker
 * remembers installing. Dynamic rules outlive the service worker and the
 * browser session, while the worker's memory does not, so after a restart it
 * remembered nothing and asked Chrome to add rule 1 while rule 1 was already
 * registered. Chrome rejects the whole call for a duplicate ID, which meant
 * the first rule update after every browser restart silently did nothing,
 * with the error left unread in runtime.lastError.
 */
async function install() {
  const rules = buildBlockingRules(state.filters, ruleOptions(), state.whitelist);
  const registered = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: registered.map((rule) => rule.id),
    addRules: state.adBlockingEnabled ? rules : []
  });
}
