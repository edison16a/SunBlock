/**
 * Pushing counter updates to whichever extension page is open.
 *
 * The popup and the options page both show the all time total, and both are
 * ordinary pages that cannot see the worker's memory. When the number moves
 * they get told.
 */

import { MESSAGES } from "../core/constants.js";
import { state } from "./store.js";

/** Tells any open page that the all time counter changed. */
export function broadcastAdsBlockedCount() {
  chrome.runtime.sendMessage({
    action: MESSAGES.ADS_BLOCKED_UPDATED,
    adsBlockedCount: state.adsBlockedCount
  });
}
