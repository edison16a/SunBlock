<p align="center">
  <img src="assets/brand/sunblock.svg" width="72" alt="" />
</p>

<h1 align="center">SunBlock</h1>

<p align="center">
  A simple ad blocker with a 92% success rate.
  <br />
  <a href="https://chromewebstore.google.com/detail/sunblock/dokdhfglhjcdfjblneeaglmhbchkkafk">Install it from the Chrome Web Store</a>
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-f5b400" />
  <img alt="Platforms: Chrome, Edge, Brave" src="https://img.shields.io/badge/platforms-chrome%20%7C%20edge%20%7C%20brave-f5b400" />
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-zero-f5b400" />
</p>

## Screenshots

<p align="center">
  <img width="100%" alt="SunBlock, screenshot 1" src="https://github.com/user-attachments/assets/9cef19af-05fe-4950-a6fb-869e593448ea" />
</p>

<table>
  <tr>
    <td width="50%">
      <img width="100%" alt="SunBlock, screenshot 2" src="https://github.com/user-attachments/assets/1bf593d9-a8e0-4823-bc88-0b968d6b2795" />
    </td>
    <td width="50%">
      <!-- Drop the next screenshot in here. -->
    </td>
  </tr>
</table>

SunBlock is a Chrome extension that blocks ads and trackers, keeps a count of
what it stopped, and lets you pause it on any site you want to support or that
breaks without its ads.

## How it works

Blocking is done by Chrome, not by the extension. SunBlock turns each entry in
its filter list into a declarativeNetRequest rule, and Chrome drops matching
requests before they leave the browser. The extension never sees your traffic.

That has one consequence worth knowing about: Chrome does not report back what
it blocked. To show a number, SunBlock watches the same requests through a read
only webRequest observer and applies the same patterns a second time. Removing
that observer would change the count, not the blocking.

Pausing a site works by listing its domain in `excludedInitiatorDomains` on
every rule, so the rules stop applying to pages on that domain. Subdomains are
covered too: pausing `example.com` also pauses `cdn.example.com`.

## Adding a blocked domain

Edit `data/filters.json` and add one pattern to the list. No code changes, no
build step:

```json
"*://*.tracker.example/*"
```

The patterns are declarativeNetRequest `urlFilter` values, where `*` means any
run of characters. `*://*.example.com/*` covers the domain and its subdomains
over both http and https.

Run `npm test` afterwards. It checks that every pattern is unique, ASCII only,
and able to match something, which is the sort of mistake that otherwise shows
up as a tracker quietly not being blocked.

The other two data files work the same way. `data/config.json` holds the
storage defaults, the request types rules apply to, and the badge colours.
`data/strings.json` holds every line of text the popup and the options page
write into the page.

## Layout

```
manifest.json          Extension manifest
data/                  Filter list, configuration and UI copy, read at runtime
pages/                 Popup and options page markup
styles/                Stylesheets, with shared colours in tokens.css
src/core/              Pure logic: patterns, domains, rules, whitelist
src/platform/          Thin wrappers over the chrome APIs
src/background/        Service worker: startup, store, rules, counter, badge
src/ui/                Popup and options page controllers
tests/                 node:test suite
tools/                 Extraction and checking scripts
```

`src/core` is where the logic lives, and it knows nothing about Chrome, so it
can be tested directly. Everything that does touch a chrome API goes through
`src/platform` or lives in `src/background`. `src/background/index.js` only
registers listeners: Manifest V3 kills the worker between events and revives
it for the next one, so a listener registered any later than the first pass
through that file would miss the event that woke it.

## Releasing

Bump `version` in `manifest.json`. That is the only copy. Both pages read the
label they show from `chrome.runtime.getManifest()`, and `package.json` has no
version because the package is never published.

## Development

Load it: open `chrome://extensions`, turn on Developer mode, choose "Load
unpacked" and pick this directory. There is no build step.

```
npm test        # core logic, data files, worker and page controllers
npm run check   # manifest paths, imports, page assets, element IDs
```

`npm run check` exists because nothing else would catch a manifest pointing at
a moved file or a controller reaching for an element ID that is no longer in
its page. Those only show up as a blank popup otherwise.
