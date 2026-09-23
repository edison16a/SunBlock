/**
 * The popup controller, run against a stubbed DOM.
 *
 * One file per controller: each is a module that runs its setup on import, so
 * two of them in one process would share a document.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { installDomStub, installPageChromeStub, settle } from "./helpers/dom-stub.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SETTINGS = {
  adBlockingEnabled: true,
  adsBlockedCount: 1234,
  whitelist: ["paused.example"]
};

const els = installDomStub("pages/popup.html");
const calls = installPageChromeStub((message) => {
  switch (message.action) {
    case "getSettings":
      return SETTINGS;
    case "toggleAdBlocking":
      return { adBlockingEnabled: false };
    case "togglePauseForSite":
      return { success: true, whitelist: [message.domain] };
    case "resetAdsBlockedCount":
      return { success: true, adsBlockedCount: 0 };
    default:
      return undefined;
  }
});

await import("../src/ui/popup.js");
await settle();

test("counters render from the worker's reply", () => {
  assert.equal(els.get("totalBlocked").textContent, (1234).toLocaleString());
  // The per-tab number is read back off the badge, because the worker holds
  // it in memory and never sends it.
  assert.equal(els.get("tabBlocked").textContent, "12");
});

test("the footer version comes from the manifest", () => {
  // It used to be typed into the markup of both pages and into
  // package.json. The manifest is the only copy Chrome reads.
  const { version } = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  assert.equal(els.get("appVersion").textContent, `v${version}`);
});

test("status copy comes from the data file", () => {
  assert.equal(els.get("globalStatusPill").textContent, "Enabled");
  assert.match(els.get("statusText").textContent, /^SunBlock is protecting/);
  assert.equal(els.get("footerStatus").textContent, "Real-time blocking active");
});

test("the current site is shown without its www", () => {
  assert.equal(els.get("currentDomain").textContent, "news.example.com");
  assert.equal(els.get("siteToggle").disabled, false);
  // The switch reads as "pause here", so unchecked means blocking is on.
  assert.equal(els.get("siteToggle").checked, false);
  assert.match(els.get("siteStatusText").textContent, /^SunBlock is active on this site/);
});

test("pausing the site tells the worker and reloads the tab", async () => {
  await els.get("siteToggle").fire("change");
  assert.ok(
    calls.some((c) => c.action === "togglePauseForSite" && c.domain === "news.example.com")
  );
  // Rules only apply to requests made after they are installed, so without
  // the reload the toggle would look like it did nothing.
  assert.ok(calls.some((c) => c.action === "reload" && c.tabId === 7));
});

test("both settings entry points open the options page", async () => {
  await els.get("openSettings").fire("click");
  await els.get("viewDetails").fire("click");
  assert.equal(calls.filter((c) => c.action === "openOptionsPage").length, 2);
});

test("resetting clears both counters", async () => {
  await els.get("resetStats").fire("click");
  assert.equal(els.get("totalBlocked").textContent, "0");
  assert.equal(els.get("tabBlocked").textContent, "0");
});
