/**
 * Answering the popup and the options page.
 *
 * One router, one place to see the whole protocol. Two rules govern the shape
 * of everything here:
 *
 * 1. The listener must not be an async function. Chrome reads a returned
 *    value as "this is the reply", and a Promise is not a reply. Handlers
 *    that answer later return the literal `true` instead and call
 *    sendResponse when they are done.
 * 2. A handler that changes state persists it before replying, so a page that
 *    re-reads settings straight after cannot see the old value.
 * 3. A handler that installs rules waits on whenReady(), because a message
 *    can be what woke the worker, before it has read anything.
 */

import { MESSAGES } from "../core/constants.js";
import { toggleDomain } from "../core/whitelist.js";
import { renderAllBadges } from "./badge.js";
import { broadcastAdsBlockedCount } from "./broadcast.js";
import { whenReady } from "./lifecycle.js";
import { applyRules } from "./rule-engine.js";
import {
  resetAllTabCounts,
  setAdBlockingEnabled,
  setAdsBlockedCount,
  setWhitelist,
  state
} from "./store.js";

/**
 * Routes one message.
 *
 * @param {{action: string, domain?: string}} request
 * @param {chrome.runtime.MessageSender} _sender
 * @param {(response: any) => void} sendResponse
 * @returns {boolean|undefined} true when the reply is sent asynchronously.
 */
export function handleMessage(request, _sender, sendResponse) {
  switch (request.action) {
    case MESSAGES.GET_AD_BLOCKING_STATUS:
      sendResponse({
        adBlockingEnabled: state.adBlockingEnabled,
        adsBlockedCount: state.adsBlockedCount
      });
      return undefined;

    case MESSAGES.GET_SETTINGS:
      sendResponse({
        adBlockingEnabled: state.adBlockingEnabled,
        adsBlockedCount: state.adsBlockedCount,
        whitelist: state.whitelist
      });
      return undefined;

    case MESSAGES.TOGGLE_AD_BLOCKING:
      whenReady()
        .then(() => setAdBlockingEnabled(!state.adBlockingEnabled))
        .then(() => {
          applyRules();
          // The per-tab totals describe what the old rules caught, so they
          // mean nothing once the rules change.
          resetAllTabCounts();
          renderAllBadges();
          sendResponse({ adBlockingEnabled: state.adBlockingEnabled });
        });
      return true;

    case MESSAGES.TOGGLE_PAUSE_FOR_SITE: {
      const domain = request.domain;
      if (!domain) {
        sendResponse({ success: false });
        return undefined;
      }
      whenReady()
        .then(() => setWhitelist(toggleDomain(state.whitelist, domain)))
        .then(() => {
          applyRules();
          sendResponse({ success: true, whitelist: state.whitelist });
        });
      return true;
    }

    case MESSAGES.RESET_ADS_BLOCKED_COUNT:
      whenReady()
        .then(() => setAdsBlockedCount(0))
        .then(() => {
          resetAllTabCounts();
          renderAllBadges();
          broadcastAdsBlockedCount();
          sendResponse({ success: true, adsBlockedCount: state.adsBlockedCount });
        });
      return true;

    default:
      return undefined;
  }
}
