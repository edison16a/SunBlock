/**
 * Checks on the files in data/.
 *
 * These are the files someone edits to add a tracker or reword a line, with
 * no code change and no review from a type checker. The tests stand in for
 * that: a malformed entry should fail here rather than in a browser.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { compilePattern } from "../src/core/patterns.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

const filters = read("data/filters.json");
const config = read("data/config.json");
const strings = read("data/strings.json");

test("filters.json is a non-empty list of strings", () => {
  assert.ok(Array.isArray(filters));
  assert.ok(filters.length > 0);
  for (const pattern of filters) {
    assert.equal(typeof pattern, "string", `not a string: ${JSON.stringify(pattern)}`);
    assert.ok(pattern.trim().length > 0, "empty pattern");
  }
});

test("every filter is a usable urlFilter", () => {
  for (const pattern of filters) {
    assert.ok(pattern.includes("://"), `no scheme separator: ${pattern}`);
    // declarativeNetRequest rejects a urlFilter with non ASCII characters,
    // and the whole rule set goes with it.
    assert.ok(/^[\x20-\x7e]+$/.test(pattern), `non ASCII: ${pattern}`);
    assert.ok(!/\s/.test(pattern), `whitespace: ${pattern}`);
  }
});

test("no filter is listed twice", () => {
  // A duplicate costs a rule out of Chrome's dynamic rule budget and blocks
  // nothing extra.
  const seen = new Set();
  const duplicates = filters.filter((p) => (seen.has(p) ? true : (seen.add(p), false)));
  assert.deepEqual(duplicates, []);
});

test("every filter compiles and matches its own shape", () => {
  // Fills each wildcard with a character and checks the pattern still
  // matches, which catches an entry that can never match anything.
  for (const pattern of filters) {
    const regex = compilePattern(pattern);
    assert.ok(regex.test(pattern.replaceAll("*", "x")), `matches nothing: ${pattern}`);
  }
});

test("config.json carries the storage defaults the worker falls back to", () => {
  assert.equal(typeof config.defaults.adBlockingEnabled, "boolean");
  assert.equal(typeof config.defaults.adsBlockedCount, "number");
  assert.ok(Array.isArray(config.defaults.whitelist));
});

test("config.json describes valid rules", () => {
  assert.ok(Number.isInteger(config.rules.priority) && config.rules.priority > 0);
  assert.ok(config.rules.resourceTypes.length > 0);
  const known = new Set([
    "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
    "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket",
    "webtransport", "webbundle", "other"
  ]);
  for (const type of config.rules.resourceTypes) {
    assert.ok(known.has(type), `not a declarativeNetRequest resource type: ${type}`);
  }
});

test("badge colours are hex, which is what chrome.action expects", () => {
  assert.match(config.badge.blockedColor, /^#[0-9a-f]{6}$/i);
  assert.match(config.badge.disabledColor, /^#[0-9a-f]{6}$/i);
  assert.ok(config.badge.disabledText.length > 0);
});

/** Every `strings.section.key` the controllers read. */
function referencedStringKeys() {
  const sources = ["src/ui/popup.js", "src/ui/options.js"]
    .map((file) => readFileSync(path.join(ROOT, file), "utf8"))
    .join("\n");
  return new Set(
    [...sources.matchAll(/strings\.(shared|popup|options)\.([A-Za-z]+)/g)].map(
      (match) => `${match[1]}.${match[2]}`
    )
  );
}

test("every string the pages ask for exists", () => {
  for (const key of referencedStringKeys()) {
    const [section, name] = key.split(".");
    assert.ok(name in strings[section], `strings.json is missing ${key}`);
  }
});

test("no string in the file is unused", () => {
  // An orphan here is copy someone edited expecting it to show up somewhere.
  const referenced = referencedStringKeys();
  for (const [section, entries] of Object.entries(strings)) {
    for (const name of Object.keys(entries)) {
      assert.ok(referenced.has(`${section}.${name}`), `nothing reads ${section}.${name}`);
    }
  }
});
