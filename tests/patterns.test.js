import assert from "node:assert/strict";
import test from "node:test";

import { compilePattern, compilePatterns, matchesAnyPattern } from "../src/core/patterns.js";

test("a host pattern matches that host and its subdomains", () => {
  const regex = compilePattern("*://*.doubleclick.net/*");
  assert.ok(regex.test("https://ad.doubleclick.net/pixel.gif"));
  assert.ok(regex.test("http://static.g.doubleclick.net/a/b/c"));
  assert.ok(!regex.test("https://example.com/about"));
});

test("an exact host pattern does not match a lookalike domain", () => {
  const regex = compilePattern("*://ads.pinterest.com/*");
  assert.ok(regex.test("https://ads.pinterest.com/v3"));
  assert.ok(!regex.test("https://pinterest.com/v3"));
});

test("matching ignores case, since hosts are case insensitive", () => {
  const regex = compilePattern("*://*.criteo.com/*");
  assert.ok(regex.test("HTTPS://WIDGET.CRITEO.COM/Track"));
});

test("the pattern is anchored at both ends", () => {
  const regex = compilePattern("*://*.hotjar.com/*");
  assert.equal(regex.source.startsWith("^"), true);
  assert.equal(regex.source.endsWith("$"), true);
});

test("a path pattern matches anywhere in the URL", () => {
  // These strings are declarativeNetRequest urlFilter values, where * means
  // any run of characters and is free to cross / and . That is why this one
  // catches the substring wherever it turns up.
  const regex = compilePattern("*://*/*cookie_notice*");
  assert.ok(regex.test("https://news.example.com/assets/cookie_notice.js"));
  assert.ok(regex.test("https://news.example.com/x?src=cookie_notice&v=2"));
  assert.ok(!regex.test("https://news.example.com/assets/main.js"));
});

test("dots in a pattern are literal, not wildcards", () => {
  const regex = compilePattern("*://*.openx.net/*");
  assert.ok(!regex.test("https://openxXnet.example.com/a"));
});

test("matchesAnyPattern stops at the first match", () => {
  const compiled = compilePatterns(["*://*.zedo.com/*", "*://*.taboola.com/*"]);
  assert.equal(matchesAnyPattern("https://c.zedo.com/a.js", compiled), true);
  assert.equal(matchesAnyPattern("https://example.com/a.js", compiled), false);
});

test("an empty pattern list matches nothing", () => {
  // The worker starts with no compiled patterns and only fills them once the
  // data file has loaded. Until then nothing may be counted as blocked.
  assert.equal(matchesAnyPattern("https://ads.example.com/x", []), false);
});
