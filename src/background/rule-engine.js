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

/** IDs of the rules this worker installed, so they can be removed again. */
let currentRuleIds = [];

/**
 * Rebuilds the rule set from current state and installs it.
 *
 * Turning blocking off installs no rules at all rather than leaving disabled
 * ones behind, so there is nothing for Chrome to match against.
 */
export function applyRules() {
  const rules = buildBlockingRules(state.filters, ruleOptions(), state.whitelist);

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: currentRuleIds,
      addRules: state.adBlockingEnabled ? rules : []
    },
    () => {
      currentRuleIds = state.adBlockingEnabled ? rules.map((rule) => rule.id) : [];
    }
  );
}
