/**
 * The worker's store: what it reads at startup, and how it adopts changes
 * made somewhere else.
 *
 * Both paths decide what the worker believes about a value that may be
 * missing or malformed, and getting that wrong turns blocking off without
 * anything saying so.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(path.join(ROOT, "data/config.json"), "utf8"));

/** What chrome.storage.local.get will answer with, on top of the defaults. */
let storedValues = {};

globalThis.chrome = {
  runtime: { getURL: (file) => `stub://${file}` },
  storage: {
    local: {
      async get(defaults) {
        return { ...defaults, ...storedValues };
      },
      async set() {}
    }
  }
};
globalThis.fetch = async (url) => ({
  ok: true,
  json: async () => JSON.parse(readFileSync(path.join(ROOT, String(url).replace("stub://", "")), "utf8"))
});

const {
  adoptStorageChanges,
  forgetTab,
  hydrate,
  incrementTabCount,
  resetAllTabCounts,
  resetTabCount,
  state,
  tabCount
} = await import("../src/background/store.js");

test("hydrate loads the data files and the stored settings", async () => {
  storedValues = { adBlockingEnabled: false, adsBlockedCount: 42, whitelist: ["a.com"] };
  await hydrate();

  assert.equal(state.adBlockingEnabled, false);
  assert.equal(state.adsBlockedCount, 42);
  assert.deepEqual(state.whitelist, ["a.com"]);
  assert.equal(state.filters.length, state.compiled.length);
  assert.ok(state.filters.length > 0);
});

test("hydrate falls back to the configured defaults for malformed values", async () => {
  // Storage is editable by hand and can be left half written. A whitelist
  // that is not an array would break every rule build after it.
  storedValues = { adBlockingEnabled: "yes", adsBlockedCount: undefined, whitelist: "a.com" };
  await hydrate();

  assert.equal(state.adBlockingEnabled, CONFIG.defaults.adBlockingEnabled);
  assert.equal(state.adsBlockedCount, CONFIG.defaults.adsBlockedCount);
  assert.deepEqual(state.whitelist, CONFIG.defaults.whitelist);
});

test("the default whitelist is copied, not shared with the config", async () => {
  storedValues = { whitelist: undefined };
  await hydrate();
  state.whitelist.push("mutated.example");

  await hydrate();
  assert.deepEqual(state.whitelist, [], "a later hydrate must not see the mutation");
});

test("adoptStorageChanges takes values written elsewhere", () => {
  const changed = adoptStorageChanges({
    whitelist: { newValue: ["b.com"] },
    adsBlockedCount: { newValue: 7 }
  });

  assert.deepEqual(state.whitelist, ["b.com"]);
  assert.equal(state.adsBlockedCount, 7);
  assert.deepEqual(changed, { enabled: false, whitelist: true, count: true });
});

test("a removed key falls back to its default instead of reading as off", () => {
  // This is what chrome.storage.local.clear() delivers: a change per key,
  // each with an oldValue and no newValue. Taking that undefined into the
  // blocking flag turned protection off and removed every rule, while empty
  // storage means on by default.
  state.adBlockingEnabled = true;
  const changed = adoptStorageChanges({
    adBlockingEnabled: { oldValue: true },
    whitelist: { oldValue: ["b.com"] },
    adsBlockedCount: { oldValue: 7 }
  });

  assert.equal(state.adBlockingEnabled, CONFIG.defaults.adBlockingEnabled);
  assert.deepEqual(state.whitelist, CONFIG.defaults.whitelist);
  assert.equal(state.adsBlockedCount, CONFIG.defaults.adsBlockedCount);
  assert.deepEqual(changed, { enabled: true, whitelist: true, count: true });
});

test("a change set that mentions nothing of ours changes nothing", () => {
  state.adBlockingEnabled = false;
  const changed = adoptStorageChanges({ somethingElse: { newValue: 1 } });

  assert.equal(state.adBlockingEnabled, false);
  assert.deepEqual(changed, { enabled: false, whitelist: false, count: false });
});

test("per-tab counts add up, reset and are forgotten", () => {
  resetAllTabCounts();
  assert.equal(tabCount(5), 0, "a tab nobody has counted for is zero, not undefined");

  incrementTabCount(5);
  incrementTabCount(5);
  assert.equal(tabCount(5), 2);

  // A reload zeroes the tab, a close drops it entirely. Both read back as
  // zero, but only one leaves an entry behind for the worker's lifetime.
  resetTabCount(5);
  assert.equal(tabCount(5), 0);
  assert.equal(state.perTab.has(5), true);

  forgetTab(5);
  assert.equal(state.perTab.has(5), false);
  assert.equal(tabCount(5), 0);
});
