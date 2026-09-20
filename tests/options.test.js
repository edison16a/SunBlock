/** The options page controller, run against a stubbed DOM. */

import assert from "node:assert/strict";
import test from "node:test";

import { installDomStub, installPageChromeStub, settle } from "./helpers/dom-stub.js";

const els = installDomStub("pages/options.html");
const calls = installPageChromeStub((message) => {
  if (message.action === "getSettings") {
    return { adBlockingEnabled: true, adsBlockedCount: 1234, whitelist: ["paused.example"] };
  }
  if (message.action === "toggleAdBlocking") return { adBlockingEnabled: false };
  if (message.action === "resetAdsBlockedCount") return { success: true, adsBlockedCount: 0 };
  return undefined;
});

await import("../src/ui/options.js");
await settle();

test("statistics render from the worker's reply", () => {
  assert.equal(els.get("statsTotal").textContent, (1234).toLocaleString());
  assert.equal(els.get("statsStatus").textContent, "Enabled");
  assert.match(els.get("statsSubstatus").textContent, /^SunBlock is actively blocking/);
});

test("a non-empty whitelist replaces the empty state", () => {
  assert.equal(els.get("whitelistEmpty").style.display, "none");
  assert.equal(els.get("whitelistList").style.display, "flex");
});

test("a typed domain is cleaned up before it is stored", () => {
  els.get("whitelistInput").value = "https://WWW.Example.com/some/path";
  els.get("addWhitelistBtn").fire("click");

  const write = calls.findLast((c) => c.action === "storage.set");
  assert.ok(write.values.whitelist.includes("example.com"));
  assert.equal(els.get("whitelistInput").value, "");
});

test("input that cannot be a domain is refused through the placeholder", () => {
  const before = calls.filter((c) => c.action === "storage.set").length;
  els.get("whitelistInput").value = "nonsense";
  els.get("addWhitelistBtn").fire("click");

  assert.match(els.get("whitelistInput").placeholder, /^Enter a valid domain/);
  assert.equal(calls.filter((c) => c.action === "storage.set").length, before);
});

test("Enter in the box adds the domain", () => {
  let defaultPrevented = false;
  els.get("whitelistInput").value = "typed.example";
  els.get("whitelistInput").fire("keydown", {
    key: "Enter",
    preventDefault() {
      defaultPrevented = true;
    }
  });

  assert.equal(defaultPrevented, true);
  assert.ok(calls.findLast((c) => c.action === "storage.set").values.whitelist.includes("typed.example"));
});

test("adding the current site uses the tab's domain", async () => {
  await els.get("addCurrentSiteBtn").fire("click");
  assert.ok(calls.findLast((c) => c.action === "storage.set").values.whitelist.includes("news.example.com"));
});

test("the test page URL comes from the data file", async () => {
  await els.get("openDashboardTab").fire("click");
  assert.ok(calls.some((c) => c.action === "create" && c.url === "https://example.com"));
});

test("the Close link closes the page", async () => {
  // It used to be an inline onclick, which the extension CSP blocked.
  await els.get("closePage").fire("click", { preventDefault() {} });
  assert.equal(globalThis.window.closed, true);
});

test("toggling protection updates the status without touching the whitelist", async () => {
  const writes = calls.filter((c) => c.action === "storage.set").length;
  await els.get("globalToggleSettings").fire("change");
  assert.equal(els.get("statsStatus").textContent, "Disabled");
  assert.match(els.get("statsSubstatus").textContent, /^No requests are being blocked/);
  assert.equal(calls.filter((c) => c.action === "storage.set").length, writes);
});
