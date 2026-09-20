/**
 * Counting what was blocked.
 *
 * declarativeNetRequest does the blocking inside Chrome and reports nothing
 * back, so the only way to show a number is to watch the same requests from a
 * webRequest observer and apply the same matching a second time. The observer
 * is read only: it never returns a blocking response, and removing it would
 * not change what gets blocked, only what gets counted.
 *
 * Because it re-derives the decision, the checks below have to mirror the
 * rule conditions exactly. Global switch first, then the whitelist (which is
 * `excludedInitiatorDomains` on every rule), then the patterns.
 */

import { domainFromUrl } from "../core/domains.js";
import { matchesAnyPattern } from "../core/patterns.js";
import { isWhitelisted } from "../core/whitelist.js";
import { renderBadge } from "./badge.js";
import { broadcastAdsBlockedCount } from "./broadcast.js";
import { incrementAdsBlockedCount, incrementTabCount, state } from "./store.js";

/**
 * Handles one observed request.
 *
 * @param {chrome.webRequest.WebRequestBodyDetails} details
 */
export function countIfBlocked(details) {
  if (!state.adBlockingEnabled) {
    return;
  }

  // `initiator` is the page that asked for the resource. It is absent on
  // requests the browser makes for itself, which belong to no site and are
  // not counted. documentUrl is the fallback for frames that report one.
  const initiator = details.initiator || details.documentUrl;
  if (!initiator) {
    return;
  }

  const domain = domainFromUrl(initiator);
  // Only an unparseable initiator is skipped. A parseable URL with no host,
  // such as about:blank, yields an empty domain and is still counted, which
  // is what the rules do with it too.
  if (domain === null) {
    return;
  }

  if (isWhitelisted(state.whitelist, domain)) {
    return;
  }

  if (matchesAnyPattern(details.url, state.compiled)) {
    recordBlockedRequest(details.tabId);
  }
}

/**
 * Records one blocked request against the all time total and its tab.
 *
 * @param {number} tabId webRequest reports -1 for requests with no tab.
 */
function recordBlockedRequest(tabId) {
  incrementAdsBlockedCount();

  if (typeof tabId === "number" && tabId >= 0) {
    incrementTabCount(tabId);
    renderBadge(tabId);
  }

  broadcastAdsBlockedCount();
}
