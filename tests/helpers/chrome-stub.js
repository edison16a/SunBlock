/**
 * A small fake of the chrome APIs the service worker uses.
 *
 * Enough to load the real worker in Node and drive it: storage that notifies
 * listeners the way the real one does (including notifying the writer, which
 * is what makes the worker apply its rules twice per toggle), a dynamic rule
 * set that rejects duplicate IDs the way Chrome does, and recorded badge
 * calls.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A listener list shaped like a chrome event. */
function event() {
  const listeners = [];
  return {
    addListener: (fn) => listeners.push(fn),
    emit: (...args) => listeners.map((fn) => fn(...args)),
    get count() {
      return listeners.length;
    }
  };
}

export function installChromeStub() {
  const stored = {};
  const onChanged = event();
  // `global` is what chrome.action calls the default badge: the one a call
  // with no tabId sets, which every tab without its own badge then shows.
  const badge = { text: new Map(), color: new Map(), global: null };
  /** @type {Map<number, object>} */
  const dynamicRules = new Map();
  let tabs = [{ id: 1, url: "https://news.example.com/" }];

  const chrome = {
    runtime: {
      onInstalled: event(),
      onStartup: event(),
      onMessage: event(),
      getURL: (file) => `stub://extension/${file}`,
      // Nothing is listening in these tests, which is the normal case for a
      // broadcast and must not produce an unhandled rejection.
      sendMessage: () => Promise.reject(new Error("Receiving end does not exist"))
    },
    storage: {
      local: {
        async get(defaults) {
          const result = { ...defaults };
          for (const key of Object.keys(defaults)) {
            if (key in stored) result[key] = stored[key];
          }
          return result;
        },
        async set(values) {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: stored[key], newValue: value };
            stored[key] = value;
          }
          // The real API notifies every context, the writer included.
          onChanged.emit(changes, "local");
        }
      },
      onChanged
    },
    declarativeNetRequest: {
      async getDynamicRules() {
        return [...dynamicRules.values()];
      },
      async updateDynamicRules({ removeRuleIds = [], addRules = [] }) {
        removeRuleIds.forEach((id) => dynamicRules.delete(id));
        for (const rule of addRules) {
          if (dynamicRules.has(rule.id)) {
            throw new Error(`Rule with id ${rule.id} does not have a unique ID`);
          }
          dynamicRules.set(rule.id, rule);
        }
      }
    },
    webRequest: { onBeforeRequest: event() },
    tabs: {
      async query() {
        return tabs;
      },
      onRemoved: event(),
      onActivated: event(),
      onUpdated: event()
    },
    action: {
      async setBadgeText({ tabId, text }) {
        // Chrome does not reject a missing tabId, it applies the value to
        // the default badge. Faked faithfully so a test can catch code that
        // leaks an undefined tab ID into here.
        if (tabId === undefined) {
          badge.global = text;
          return;
        }
        if (!tabs.some((tab) => tab.id === tabId)) {
          throw new Error(`No tab with id: ${tabId}`);
        }
        badge.text.set(tabId, text);
      },
      async setBadgeBackgroundColor({ tabId, color }) {
        badge.color.set(tabId, color);
      }
    }
  };

  globalThis.chrome = chrome;
  globalThis.fetch = async (url) => {
    const file = String(url).replace("stub://extension/", "");
    const body = await readFile(path.join(ROOT, file), "utf8");
    return { ok: true, json: async () => JSON.parse(body) };
  };

  return {
    chrome,
    stored,
    badge,
    dynamicRules,
    setTabs: (next) => {
      tabs = next;
    },
    /** Sends a message the way a page would and resolves with the reply. */
    send(message) {
      return new Promise((resolve) => {
        chrome.runtime.onMessage.emit(message, {}, resolve);
      });
    },
    /** Lets the worker's queued async work settle. */
    async settle() {
      for (let i = 0; i < 50; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  };
}
