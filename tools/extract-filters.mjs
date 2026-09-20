#!/usr/bin/env node
/**
 * Pulls the blocked URL patterns out of the legacy background.js literal and
 * writes them to data/filters.json.
 *
 * Why this exists: the list is 144 entries long. Copying it by hand is how you
 * end up with a silently dropped or mistyped pattern that nobody notices until
 * a tracker stops being blocked. The extraction is scripted so it can be
 * re-run, and so `--check` can prove the data file still matches the source it
 * came from.
 *
 * The legacy file no longer exists in the working tree. Read it from git:
 *
 *   git show <commit>:background.js > /tmp/legacy.js
 *   node tools/extract-filters.mjs /tmp/legacy.js
 *   node tools/extract-filters.mjs /tmp/legacy.js --check
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(REPO_ROOT, "data", "filters.json");

/**
 * Reads the `const URL_FILTERS = [ ... ];` array out of a source file.
 *
 * The array holds nothing but double quoted string literals, so slicing the
 * bracketed region and handing it to JSON.parse is exact. A regex over the
 * whole file would also pick up the example pattern that sits in a comment,
 * which is why the region is bounded first.
 */
function extractPatterns(source) {
  const start = source.indexOf("const URL_FILTERS = [");
  if (start === -1) {
    throw new Error("no `const URL_FILTERS = [` declaration in the source file");
  }
  const open = source.indexOf("[", start);
  const close = source.indexOf("];", open);
  if (close === -1) {
    throw new Error("unterminated URL_FILTERS array");
  }
  const literal = source.slice(open, close + 1);
  const patterns = JSON.parse(stripComments(literal));
  if (!Array.isArray(patterns) || patterns.some((p) => typeof p !== "string")) {
    throw new Error("URL_FILTERS is not an array of strings");
  }
  return patterns;
}

/** Drops `//` line comments so the array literal becomes valid JSON. */
function stripComments(literal) {
  return literal
    .split("\n")
    .map((line) => {
      const marker = line.indexOf("//");
      // Only strip a `//` that is not inside a quoted pattern such as "*://".
      if (marker !== -1 && line.slice(0, marker).split('"').length % 2 === 1) {
        return line.slice(0, marker);
      }
      return line;
    })
    .join("\n")
    .replace(/,(\s*])/, "$1");
}

/** Serializes one pattern per line, the shape a human edits by hand. */
function render(patterns) {
  return `${JSON.stringify(patterns, null, 2)}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const sourcePath = args.find((arg) => !arg.startsWith("--"));
  if (!sourcePath) {
    console.error("usage: extract-filters.mjs <legacy-background.js> [--check]");
    process.exit(2);
  }

  const patterns = extractPatterns(readFileSync(sourcePath, "utf8"));
  const rendered = render(patterns);

  if (check) {
    const current = readFileSync(OUTPUT, "utf8");
    const currentPatterns = JSON.parse(current);
    const missing = patterns.filter((p) => !currentPatterns.includes(p));
    const extra = currentPatterns.filter((p) => !patterns.includes(p));
    const sameOrder = JSON.stringify(patterns) === JSON.stringify(currentPatterns);
    console.log(`source patterns:      ${patterns.length}`);
    console.log(`data/filters.json:    ${currentPatterns.length}`);
    console.log(`missing from data:    ${missing.length}${missing.length ? ` (${missing.join(", ")})` : ""}`);
    console.log(`not in source:        ${extra.length}${extra.length ? ` (${extra.join(", ")})` : ""}`);
    console.log(`identical sequence:   ${sameOrder}`);
    if (missing.length || extra.length) {
      console.error("MISMATCH");
      process.exit(1);
    }
    console.log("OK: data/filters.json holds exactly the source patterns");
    return;
  }

  writeFileSync(OUTPUT, rendered);
  console.log(`wrote ${patterns.length} patterns to ${path.relative(REPO_ROOT, OUTPUT)}`);
}

main();
