/**
 * Keeping the worker in step with storage written somewhere else.
 *
 * The options page edits the whitelist by writing storage directly rather
 * than messaging the worker, so this listener is the only thing that tells
 * the worker about it. The worker's own writes come back through here too,
 * which is why a single toggle produces two rule installs. That is harmless
 * (the second install is identical) and the rule engine serializes them.
 */

import { STORAGE_AREA } from "../core/constants.js";
import { renderAllBadges } from "./badge.js";
import { whenReady } from "./lifecycle.js";
import { applyRules } from "./rule-engine.js";
import { adoptStorageChanges, resetAllTabCounts } from "./store.js";

/**
 * Adopts changed values and re-applies whatever they affect.
 *
 * @param {Record<string, chrome.storage.StorageChange>} changes
 * @param {string} areaName
 */
export function handleStorageChange(changes, areaName) {
  // sync and session carry nothing of ours. Reacting to them would apply a
  // value the worker never wrote.
  if (areaName !== STORAGE_AREA) {
    return;
  }

  const changed = adoptStorageChanges(changes);

  if (changed.enabled) {
    whenReady().then(() => {
      applyRules();
      // The per-tab totals describe what the old rules caught, so they mean
      // nothing once the rules change.
      resetAllTabCounts();
      renderAllBadges();
    });
  }

  if (changed.whitelist) {
    whenReady().then(() => applyRules());
  }
}
