/**
 * Compiling blocking patterns into regular expressions.
 *
 * SunBlock blocks with declarativeNetRequest, which does the matching inside
 * Chrome and tells us nothing about what it blocked. To show a count we have
 * to match a second time ourselves, from a webRequest observer, using the
 * same patterns.
 *
 * The translation below is deliberately literal: `*` becomes `.*` and matches
 * across `/` and `.`. That looks too loose for a Chrome match pattern, but
 * these strings are not match patterns. They are declarativeNetRequest
 * `urlFilter` values, where `*` is exactly "any run of characters". Tightening
 * the regex would make the count disagree with what Chrome actually blocked.
 */

/**
 * Compiles one `urlFilter` string into an anchored, case insensitive RegExp.
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
export function compilePattern(pattern) {
  const escaped = pattern
    .replace(/\./g, "\\.")
    .replace(/\//g, "\\/")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

/**
 * @param {ReadonlyArray<string>} patterns
 * @returns {RegExp[]}
 */
export function compilePatterns(patterns) {
  return patterns.map(compilePattern);
}

/**
 * True when the URL matches at least one compiled pattern.
 *
 * Stops at the first hit. That is why duplicate entries in the filter list
 * never double counted a request.
 *
 * @param {string} url
 * @param {ReadonlyArray<RegExp>} compiled
 * @returns {boolean}
 */
export function matchesAnyPattern(url, compiled) {
  return compiled.some((regex) => regex.test(url));
}
