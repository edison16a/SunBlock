/**
 * Turning URLs and typed input into the one domain shape SunBlock stores.
 *
 * The whitelist holds bare hostnames with any leading `www.` removed, for
 * example `example.com`. Every producer has to agree on that shape or the
 * popup's per-site toggle and the options page's list stop referring to the
 * same site. The three copies of this logic that used to live in
 * background.js, popup.js and options.js are now this module.
 */

/**
 * Reduces a URL to its storable domain.
 *
 * Returns null rather than throwing, because callers feed it whatever the
 * browser handed them: a tab URL that may be `chrome://newtab`, or a request
 * initiator that may be absent entirely. "Not a site we can name" is a normal
 * outcome, not an error.
 *
 * @param {string|undefined|null} url
 * @returns {string|null}
 */
export function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Cleans up a domain a person typed into the options page.
 *
 * Accepts what people actually paste: a full URL, a host with a path, mixed
 * case, stray whitespace. Rejects anything without a dot, which catches the
 * common slips (an empty box, a search term, a bare `localhost`) without
 * pretending to be a real hostname validator.
 *
 * @param {string|undefined|null} input
 * @returns {string|null} the storable domain, or null if it cannot be one
 */
export function normalizeDomain(input) {
  if (!input) return null;

  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      // Leave the raw text alone and let the path and www steps below try.
    }
  }

  if (value.includes("/")) {
    value = value.split("/")[0];
  }

  value = value.replace(/^www\./, "");

  if (!value || !value.includes(".")) {
    return null;
  }

  return value;
}
