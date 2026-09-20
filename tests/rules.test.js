import assert from "node:assert/strict";
import test from "node:test";

import { buildBlockingRules } from "../src/core/rules.js";

const OPTIONS = { priority: 1, resourceTypes: ["script", "image"] };

test("one rule per pattern, with 1 based IDs", () => {
  // declarativeNetRequest requires positive integers, so the index will not
  // do on its own.
  const rules = buildBlockingRules(["*://a.com/*", "*://b.com/*"], OPTIONS, []);
  assert.deepEqual(rules.map((rule) => rule.id), [1, 2]);
  assert.deepEqual(rules.map((rule) => rule.condition.urlFilter), [
    "*://a.com/*",
    "*://b.com/*"
  ]);
});

test("every rule blocks, at the configured priority and resource types", () => {
  const [rule] = buildBlockingRules(["*://a.com/*"], OPTIONS, []);
  assert.deepEqual(rule.action, { type: "block" });
  assert.equal(rule.priority, 1);
  assert.deepEqual(rule.condition.resourceTypes, ["script", "image"]);
});

test("the whitelist becomes excludedInitiatorDomains on every rule", () => {
  // This is the whole of the per-site pause: a rule simply does not apply
  // when the page making the request is listed.
  const rules = buildBlockingRules(["*://a.com/*", "*://b.com/*"], OPTIONS, ["x.com"]);
  for (const rule of rules) {
    assert.deepEqual(rule.condition.excludedInitiatorDomains, ["x.com"]);
  }
});

test("an empty whitelist excludes nobody", () => {
  const [rule] = buildBlockingRules(["*://a.com/*"], OPTIONS, []);
  assert.deepEqual(rule.condition.excludedInitiatorDomains, []);
});

test("rules do not alias the caller's whitelist", () => {
  // The rules outlive the call. Sharing the array would let a later edit
  // change rules that were already handed to Chrome.
  const whitelist = ["x.com"];
  const [rule] = buildBlockingRules(["*://a.com/*"], OPTIONS, whitelist);
  whitelist.push("y.com");
  assert.deepEqual(rule.condition.excludedInitiatorDomains, ["x.com"]);
});

test("no patterns means no rules", () => {
  assert.deepEqual(buildBlockingRules([], OPTIONS, []), []);
});
