import assert from "node:assert/strict";
import test from "node:test";

import { addDomain, isWhitelisted, removeDomain, toggleDomain } from "../src/core/whitelist.js";

test("addDomain appends", () => {
  assert.deepEqual(addDomain(["a.com"], "b.com"), ["a.com", "b.com"]);
});

test("addDomain ignores one that is already listed", () => {
  assert.deepEqual(addDomain(["a.com"], "a.com"), ["a.com"]);
});

test("removeDomain removes every copy and leaves the rest alone", () => {
  assert.deepEqual(removeDomain(["a.com", "b.com", "a.com"], "a.com"), ["b.com"]);
  assert.deepEqual(removeDomain(["a.com"], "c.com"), ["a.com"]);
});

test("toggleDomain adds when absent and removes when present", () => {
  assert.deepEqual(toggleDomain([], "a.com"), ["a.com"]);
  assert.deepEqual(toggleDomain(["a.com"], "a.com"), []);
});

test("nothing mutates its input", () => {
  // The same list is held by the worker, by storage and by the open page. An
  // in place edit would change one holder's copy without telling the others.
  const original = ["a.com"];
  addDomain(original, "b.com");
  removeDomain(original, "a.com");
  toggleDomain(original, "a.com");
  assert.deepEqual(original, ["a.com"]);
});

test("isWhitelisted is an exact match, not a suffix match", () => {
  // Subdomain coverage is Chrome's job: excludedInitiatorDomains already
  // matches subdomains of every entry.
  assert.equal(isWhitelisted(["example.com"], "example.com"), true);
  assert.equal(isWhitelisted(["example.com"], "notexample.com"), false);
});
