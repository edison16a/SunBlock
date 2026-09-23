/**
 * Drives the real service worker against a fake chrome API.
 *
 * The unit tests cover the pure core. This one covers the wiring: that
 * listeners are registered, that rules reach declarativeNetRequest, that a
 * toggle and a per-site pause do what the popup expects, and that counting
 * follows the same decisions the rules make.
 *
 * It is one file on purpose. The worker is a module with state, so importing
 * it more than once in a process would share that state between tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { installChromeStub } from "./helpers/chrome-stub.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filters = JSON.parse(readFileSync(path.join(ROOT, "data/filters.json"), "utf8"));
const config = JSON.parse(readFileSync(path.join(ROOT, "data/config.json"), "utf8"));

const env = installChromeStub();
await import("../src/background/index.js");
await env.settle();

/** Fires the observer the way webRequest would. */
function request({ url, initiator = "https://news.example.com/", tabId = 1 }) {
  env.chrome.webRequest.onBeforeRequest.emit({ url, initiator, tabId });
}

const AD_URL = "https://ad.doubleclick.net/pixel.gif";
const PLAIN_URL = "https://news.example.com/article.js";

test("every listener the worker needs is registered", () => {
  // Manifest V3 kills the worker when it goes idle and revives it for the
  // next event, so a listener registered later than the first pass through
  // the file would miss the event that woke it.
  assert.equal(env.chrome.webRequest.onBeforeRequest.count, 1);
  assert.equal(env.chrome.runtime.onMessage.count, 1);
  assert.equal(env.chrome.storage.onChanged.count, 1);
  assert.equal(env.chrome.tabs.onRemoved.count, 1);
  assert.equal(env.chrome.tabs.onActivated.count, 1);
  assert.equal(env.chrome.tabs.onUpdated.count, 1);
});

test("startup installs one rule per filter", async () => {
  assert.equal(env.dynamicRules.size, filters.length);
  const [first] = [...env.dynamicRules.values()];
  assert.deepEqual(first.action, { type: "block" });
  assert.deepEqual(first.condition.resourceTypes, config.rules.resourceTypes);
});

test("blocking is on by default", async () => {
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adBlockingEnabled, true);
  assert.deepEqual(settings.whitelist, []);
});

test("a matching request is counted and badged", async () => {
  request({ url: AD_URL });
  await env.settle();

  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 1);
  assert.equal(env.badge.text.get(1), "1");
  assert.equal(env.badge.color.get(1), config.badge.blockedColor);
});

test("a request that matches nothing is not counted", async () => {
  request({ url: PLAIN_URL });
  await env.settle();
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 1);
});

test("a request with no initiator is not counted", async () => {
  // Browser originated traffic belongs to no site, so there is no whitelist
  // decision to make and nothing to attribute it to.
  env.chrome.webRequest.onBeforeRequest.emit({ url: AD_URL, tabId: 1 });
  await env.settle();
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 1);
});

test("pausing a site excludes it from every rule and stops counting it", async () => {
  const reply = await env.send({
    action: "togglePauseForSite",
    domain: "news.example.com"
  });
  await env.settle();

  assert.deepEqual(reply.whitelist, ["news.example.com"]);
  for (const rule of env.dynamicRules.values()) {
    assert.deepEqual(rule.condition.excludedInitiatorDomains, ["news.example.com"]);
  }

  request({ url: AD_URL });
  await env.settle();
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 1, "a paused site must not count");
});

test("resuming a site puts it back", async () => {
  const reply = await env.send({
    action: "togglePauseForSite",
    domain: "news.example.com"
  });
  await env.settle();
  assert.deepEqual(reply.whitelist, []);

  request({ url: AD_URL });
  await env.settle();
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 2);
});

test("pausing needs a domain", async () => {
  const reply = await env.send({ action: "togglePauseForSite" });
  assert.deepEqual(reply, { success: false });
});

test("turning blocking off removes every rule and stops counting", async () => {
  const reply = await env.send({ action: "toggleAdBlocking" });
  await env.settle();

  assert.equal(reply.adBlockingEnabled, false);
  assert.equal(env.dynamicRules.size, 0);
  assert.equal(env.stored.adBlockingEnabled, false);
  assert.equal(env.badge.text.get(1), config.badge.disabledText);

  request({ url: AD_URL });
  await env.settle();
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 2);
});

test("turning it back on reinstalls the rules", async () => {
  // Two rule installs race on every toggle, one from this message and one
  // from the storage change it causes. Overlapping installs would collide on
  // the IDs they are both adding, so this would end up short of a full set.
  const reply = await env.send({ action: "toggleAdBlocking" });
  await env.settle();

  assert.equal(reply.adBlockingEnabled, true);
  assert.equal(env.dynamicRules.size, filters.length);
});

test("a whitelist written by the options page reaches the rules", async () => {
  // The options page writes storage directly rather than messaging, so this
  // is the only path that tells the worker about it.
  await env.chrome.storage.local.set({ whitelist: ["other.example"] });
  await env.settle();

  for (const rule of env.dynamicRules.values()) {
    assert.deepEqual(rule.condition.excludedInitiatorDomains, ["other.example"]);
  }
  await env.chrome.storage.local.set({ whitelist: [] });
  await env.settle();
});

test("resetting statistics clears the total and the badges", async () => {
  const reply = await env.send({ action: "resetAdsBlockedCount" });
  await env.settle();

  assert.equal(reply.adsBlockedCount, 0);
  assert.equal(env.stored.adsBlockedCount, 0);
  assert.equal(env.badge.text.get(1), "");
});

test("a reload resets that tab's count", async () => {
  request({ url: AD_URL });
  await env.settle();
  assert.equal(env.badge.text.get(1), "1");

  env.chrome.tabs.onUpdated.emit(1, { status: "loading" });
  await env.settle();
  assert.equal(env.badge.text.get(1), "");

  // The all time total is not touched by a reload.
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 1);
});

test("counting a request for a tab that has closed does not throw", async () => {
  // The badge write rejects with 'No tab with id'. An unhandled rejection
  // here would surface as an error on ordinary browsing.
  request({ url: AD_URL, tabId: 999 });
  await env.settle();
  const settings = await env.send({ action: "getSettings" });
  assert.equal(settings.adsBlockedCount, 2, "the total still counts it");
});

test("a tab with no ID is skipped rather than painting the default badge", async () => {
  // Tab.id is optional, and chrome.action reads a call without one as "set
  // the badge every tab falls back to". So an ID-less tab in the query
  // result used to paint one tab's count across the whole toolbar.
  env.setTabs([{ id: 1, url: "https://news.example.com/" }, { url: "about:blank" }]);

  await env.send({ action: "resetAdsBlockedCount" });
  await env.settle();

  assert.equal(env.badge.global, null, "the default badge must be untouched");
  assert.equal(env.badge.text.get(1), "");

  env.setTabs([{ id: 1, url: "https://news.example.com/" }]);
});

test("an unknown message is ignored", async () => {
  const listener = env.chrome.runtime.onMessage.emit({ action: "nope" }, {}, () => {});
  assert.deepEqual(listener, [undefined]);
});
