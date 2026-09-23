#!/usr/bin/env node
/**
 * Static check that the extension hangs together.
 *
 * There is no build step here, so nothing else would catch a manifest
 * pointing at a moved file, an import with a stale path, or a controller
 * reaching for an element ID that no longer exists in its page. Those are the
 * failures that only show up as a blank popup after you load the unpacked
 * extension, so they are worth catching from the command line.
 *
 *   npm run check
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] || process.cwd();
const problems = [];
const check = (file, why) => {
  if (!existsSync(path.join(ROOT, file))) problems.push(`${why}: missing ${file}`);
};

const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
check(manifest.background.service_worker, "manifest.background");
check(manifest.action.default_popup, "manifest.action");
check(manifest.options_page, "manifest.options_page");
for (const p of Object.values(manifest.action.default_icon)) check(p, "action icon");
for (const p of Object.values(manifest.icons)) check(p, "icons");

// Walk the module graph from both entry points.
const entries = [manifest.background.service_worker];
const htmlFiles = [manifest.action.default_popup, manifest.options_page];
const seen = new Set();
/** Each page and the controllers it loads, discovered rather than listed. */
const pageScripts = new Map();

for (const html of htmlFiles) {
  const dir = path.dirname(html);
  const src = readFileSync(path.join(ROOT, html), "utf8");
  for (const m of src.matchAll(/<link[^>]+href="([^"]+)"/g)) check(path.join(dir, m[1]), `${html} stylesheet`);
  const scripts = [];
  for (const m of src.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const resolved = path.join(dir, m[1]);
    check(resolved, `${html} script`);
    entries.push(resolved);
    scripts.push(resolved);
  }
  pageScripts.set(html, scripts);
  if (/on(click|change|load|input)=/.test(src)) problems.push(`${html}: inline event handler, blocked by the extension CSP`);
}

const walk = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(path.join(ROOT, file), "utf8");
  for (const m of src.matchAll(/^\s*import\s+[^'"]*from\s+"([^"]+)"/gm)) {
    const target = path.normalize(path.join(path.dirname(file), m[1]));
    if (!existsSync(path.join(ROOT, target))) problems.push(`${file}: unresolved import ${m[1]}`);
    else walk(target);
  }
  for (const m of src.matchAll(/getURL\("([^"]+)"\)/g)) check(m[1], `${file} runtime asset`);
};
entries.forEach(walk);

// Every element ID a controller looks up must exist in its page, and every
// ID in a page must be used by the controller that page loads. Which script
// belongs to which page comes from the page's own script tag, so renaming a
// controller cannot leave this check pointed at the old pair.
for (const [html, scripts] of pageScripts) {
  const page = readFileSync(path.join(ROOT, html), "utf8");
  const ids = new Set([...page.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const js = scripts.map((file) => readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  const named = scripts.join(", ") || "no script";

  for (const m of js.matchAll(/getElementById\("([^"]+)"\)/g)) {
    if (!ids.has(m[1])) problems.push(`${named}: #${m[1]} is not in ${html}`);
  }
  for (const id of ids) {
    if (!js.includes(`"${id}"`)) problems.push(`${html}: #${id} is never used by ${named}`);
  }
}

for (const f of ["data/filters.json", "data/config.json", "data/strings.json"]) {
  JSON.parse(readFileSync(path.join(ROOT, f), "utf8"));
}

console.log(`modules walked: ${seen.size}`);
if (problems.length) {
  problems.forEach((p) => console.error("  " + p));
  console.error(`FAILED (${problems.length})`);
  process.exit(1);
}
console.log("OK: manifest paths, module graph, page assets and element IDs all resolve");
