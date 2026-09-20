/**
 * Service worker entry point: listeners in, effects out.
 *
 * Manifest V3 wakes this worker for an event and kills it again when it goes
 * idle, so every listener has to be registered on the first pass through the
 * file. Nothing may wait for data first, or Chrome will have delivered the
 * event before the listener exists.
 *
 * That is why the file reads the way it does: registration is synchronous,
 * and anything that needs the data files or stored settings waits on
 * `whenReady()` inside its handler instead.
 */

import { STORAGE_AREA } from "../core/constants.js";
import { renderAllBadges, renderBadge } from "./badge.js";
import { countIfBlocked } from "./counter.js";
import { handleMessage } from "./messaging.js";
import { applyRules } from "./rule-engine.js";
import {
  adoptStorageChanges,
  forgetTab,
  hydrate,
  resetAllTabCounts,
  resetTabCount
} from "./store.js";

/** @type {Promise<void>} Resolves once the worker has its state. */
let ready = initialize();

/**
 * Loads everything the worker needs and puts the current settings into
 * effect. Runs on worker start, on install and on browser startup.
 *
 * Failures are logged and swallowed rather than left as a rejected promise:
 * a rejection here would be reported once and then silently stall every
 * handler that waits on it.
 */
function initialize() {
  return hydrate()
    .then(() => {
      applyRules();
      return renderAllBadges();
    })
    .catch((error) => {
      console.error("SunBlock could not initialise", error);
    });
}

/** @returns {Promise<void>} */
function whenReady() {
  return ready;
}

chrome.runtime.onInstalled.addListener(() => {
  ready = initialize();
});

chrome.runtime.onStartup.addListener(() => {
  ready = initialize();
});

// Read only observer. It does not block anything, it only counts what the
// declarative rules already blocked.
chrome.webRequest.onBeforeRequest.addListener(countIfBlocked, { urls: ["<all_urls>"] }, []);

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetTab(tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  whenReady().then(() => renderBadge(activeInfo.tabId));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // A reload starts a fresh page, so its count starts again from zero.
  if (changeInfo.status === "loading") {
    resetTabCount(tabId);
    whenReady().then(() => renderBadge(tabId));
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== STORAGE_AREA) {
    return;
  }

  const changed = adoptStorageChanges(changes);

  if (changed.enabled) {
    whenReady().then(() => {
      applyRules();
      resetAllTabCounts();
      renderAllBadges();
    });
  }

  if (changed.whitelist) {
    whenReady().then(() => applyRules());
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
  handleMessage(request, sender, sendResponse, whenReady)
);
