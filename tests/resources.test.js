/**
 * The data file loader.
 *
 * Worth testing on its own because the caching is load bearing: the worker
 * re-reads its state on install, on browser startup and on every wake, and
 * without the cache that is a fetch of the filter list each time.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Paths fetch was asked for, in order. */
const fetched = [];
/** Paths that should fail once before succeeding. */
const failOnce = new Set();

globalThis.chrome = { runtime: { getURL: (file) => `stub://extension/${file}` } };
globalThis.fetch = async (url) => {
  const file = String(url).replace("stub://extension/", "");
  fetched.push(file);
  if (failOnce.has(file)) {
    failOnce.delete(file);
    return { ok: false, status: 503, json: async () => ({}) };
  }
  return { ok: true, json: async () => JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) };
};

const { loadConfig, loadFilters, loadStrings } = await import("../src/platform/resources.js");

test("each loader returns its own file", async () => {
  const [filters, config, strings] = await Promise.all([
    loadFilters(),
    loadConfig(),
    loadStrings()
  ]);
  assert.ok(Array.isArray(filters) && filters.length > 0);
  assert.equal(typeof config.rules.priority, "number");
  assert.equal(typeof strings.shared.enabled, "string");
});

test("a file is fetched once however often it is asked for", async () => {
  const before = fetched.filter((f) => f === "data/filters.json").length;
  await Promise.all([loadFilters(), loadFilters(), loadFilters()]);
  assert.equal(fetched.filter((f) => f === "data/filters.json").length, before);
});

test("the filter list keeps file order", async () => {
  // Rule IDs are positions in this array, so a loader that sorted or
  // deduplicated on the way in would renumber every rule.
  const onDisk = JSON.parse(readFileSync(path.join(ROOT, "data/filters.json"), "utf8"));
  assert.deepEqual(await loadFilters(), onDisk);
});

test("a failed read is not cached, so the next call retries", async () => {
  // A transient failure must not poison every later read for the life of the
  // worker, which is what caching the rejected promise would do.
  const { loadFilters: freshLoad } = await import("../src/platform/resources.js?retry");
  failOnce.add("data/filters.json");

  await assert.rejects(freshLoad(), /could not read data\/filters\.json: 503/);

  const recovered = await freshLoad();
  assert.ok(Array.isArray(recovered));
});
