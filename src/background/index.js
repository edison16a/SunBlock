/**
 * Service worker entry point: listeners, and nothing else.
 *
 * Manifest V3 wakes this worker for an event and kills it again when it goes
 * idle, so every listener has to be registered on the first pass through the
 * file. Nothing may wait for data first, or Chrome will have delivered the
 * event before the listener exists.
 *
 * That is the whole reason this file holds no logic. Registration happens
 * here, synchronously; anything that needs loaded state waits on whenReady()
 * inside its own module.
 */

import { renderBadge } from "./badge.js";
import { countIfBlocked } from "./counter.js";
import { initialize, whenReady } from "./lifecycle.js";
import { handleMessage } from "./messaging.js";
import { forgetTab, resetTabCount } from "./store.js";
import { handleStorageChange } from "./sync.js";

chrome.runtime.onInstalled.addListener(() => {
  initialize();
});

chrome.runtime.onStartup.addListener(() => {
  initialize();
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

chrome.storage.onChanged.addListener(handleStorageChange);

chrome.runtime.onMessage.addListener(handleMessage);
