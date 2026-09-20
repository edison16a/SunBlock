/**
 * Just enough DOM and chrome to run the two page controllers in Node.
 *
 * The controllers are thin, but they are where a wrong element ID or a
 * missing string shows up as a blank panel rather than an exception, so it is
 * worth running them somewhere that fails loudly.
 *
 * Elements are keyed by the IDs in the real page file. Nothing is faked that
 * the controllers do not touch.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function makeElement(id) {
  return {
    id,
    textContent: "",
    value: "",
    placeholder: "",
    title: "",
    checked: false,
    disabled: false,
    innerHTML: "",
    className: "",
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    /** @type {Record<string, Function[]>} */
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    /** Fires a listener the way a click or a change would. */
    fire(type, event = {}) {
      return Promise.all((this.listeners[type] || []).map((fn) => fn(event)));
    },
    append() {},
    appendChild() {}
  };
}

/**
 * Builds a document containing exactly the IDs the given page declares, so a
 * controller asking for one that is not there gets null and fails.
 *
 * @param {string} pageFile for example "pages/popup.html"
 */
export function installDomStub(pageFile) {
  const html = readFileSync(path.join(ROOT, pageFile), "utf8");
  const elements = new Map(
    [...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], makeElement(match[1])])
  );

  globalThis.document = {
    getElementById: (id) => elements.get(id) ?? null,
    createElement: (tag) => makeElement(tag)
  };
  globalThis.window = { closed: false, close() { globalThis.window.closed = true; } };

  return elements;
}

/**
 * The chrome surface the pages use, recording everything it was asked to do.
 *
 * @param {(message: object) => any} reply what the service worker answers
 */
export function installPageChromeStub(reply) {
  const calls = [];

  globalThis.chrome = {
    runtime: {
      getURL: (file) => path.join(ROOT, file),
      onMessage: { addListener() {} },
      async sendMessage(message) {
        calls.push(message);
        return reply(message);
      },
      openOptionsPage() {
        calls.push({ action: "openOptionsPage" });
      }
    },
    tabs: {
      async query() {
        return [{ id: 7, url: "https://www.news.example.com/article" }];
      },
      async reload(tabId) {
        calls.push({ action: "reload", tabId });
      },
      async create({ url }) {
        calls.push({ action: "create", url });
      }
    },
    action: {
      async getBadgeText() {
        return "12";
      }
    },
    storage: {
      local: {
        set(values) {
          calls.push({ action: "storage.set", values });
        }
      }
    }
  };

  globalThis.fetch = async (file) => ({
    ok: true,
    json: async () => JSON.parse(readFileSync(String(file), "utf8"))
  });

  return calls;
}

/** Lets the controller's promises settle. */
export function settle() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
