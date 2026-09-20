/**
 * Pushing counter updates to whichever extension page is open.
 *
 * The popup and the options page both show the all time total, and both are
 * ordinary pages that cannot see the worker's memory. When the number moves
 * they get told.
 */

import { MESSAGES } from "../core/constants.js";
import { state } from "./store.js";

/**
 * Tells any open page that the all time counter changed.
 *
 * Nobody listening is the normal case, not an error. This fires on every
 * blocked request, and most of the time neither the popup nor the options
 * page is open. sendMessage rejects with "Receiving end does not exist" in
 * that situation, and without this catch each rejection went unhandled and
 * was logged as an error in the worker, hundreds of times a page load.
 */
export function broadcastAdsBlockedCount() {
  chrome.runtime
    .sendMessage({
      action: MESSAGES.ADS_BLOCKED_UPDATED,
      adsBlockedCount: state.adsBlockedCount
    })
    .catch(() => {});
}
