import assert from "node:assert/strict";
import test from "node:test";

import { domainFromUrl, normalizeDomain } from "../src/core/domains.js";

test("domainFromUrl strips www so both spellings whitelist the same site", () => {
  assert.equal(domainFromUrl("https://www.example.com/page"), "example.com");
  assert.equal(domainFromUrl("https://example.com/page"), "example.com");
});

test("domainFromUrl keeps other subdomains", () => {
  assert.equal(domainFromUrl("https://news.example.com/"), "news.example.com");
  // Only a leading www. goes. This one is part of the name.
  assert.equal(domainFromUrl("https://wwwx.example.com/"), "wwwx.example.com");
});

test("domainFromUrl returns null for anything unparseable", () => {
  assert.equal(domainFromUrl(""), null);
  assert.equal(domainFromUrl("not a url"), null);
  assert.equal(domainFromUrl(undefined), null);
});

test("domainFromUrl returns an empty host rather than null for about:blank", () => {
  // The counter relies on this: only an unparseable initiator is skipped, a
  // parseable one with no host is still counted, because the blocking rules
  // treat it the same way.
  assert.equal(domainFromUrl("about:blank"), "");
});

test("normalizeDomain accepts what people actually paste", () => {
  assert.equal(normalizeDomain("  Example.COM  "), "example.com");
  assert.equal(normalizeDomain("https://www.example.com/some/path"), "example.com");
  assert.equal(normalizeDomain("http://example.com"), "example.com");
  assert.equal(normalizeDomain("example.com/path"), "example.com");
  assert.equal(normalizeDomain("www.example.com"), "example.com");
});

test("normalizeDomain rejects input that cannot be a domain", () => {
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain("   "), null);
  assert.equal(normalizeDomain(null), null);
  // No dot, so it is a search term or a typo rather than a host.
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain("www."), null);
});

test("normalizeDomain and domainFromUrl agree on the same site", () => {
  // The popup derives the domain from a tab URL and the options page from
  // typed text. They have to produce the same string or the per-site switch
  // and the whitelist stop referring to the same site.
  const fromTab = domainFromUrl("https://www.example.com/watch?v=1");
  const typed = normalizeDomain("www.example.com/watch");
  assert.equal(fromTab, typed);
});
