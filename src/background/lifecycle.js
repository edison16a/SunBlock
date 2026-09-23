/**
 * Worker startup, and the promise the rest of the worker waits on.
 *
 * Manifest V3 evicts the service worker when it goes idle and revives it for
 * the next event, so "has this worker loaded its state yet" is a question
 * every handler has to be able to ask. This module owns the answer.
 *
 * It lives apart from the listener registrations so that both the listeners
 * and the message router can reach it. The router used to be handed a
 * whenReady function as an argument, purely because this code sat in the file
 * that registered listeners.
 */

import { renderAllBadges } from "./badge.js";
import { applyRules } from "./rule-engine.js";
import { hydrate } from "./store.js";

/**
 * Resolves once the data files and stored settings are loaded.
 *
 * Declared before it is assigned, because initialize() assigns it and is
 * called during this module's own evaluation.
 *
 * @type {Promise<void>}
 */
let ready;

/**
 * Loads everything the worker needs and puts the current settings into
 * effect. Runs on worker start, on install and on browser startup.
 *
 * Failures are logged and swallowed rather than left as a rejected promise.
 * A rejection here would be reported once and then silently stall every
 * handler waiting on it.
 *
 * @returns {Promise<void>}
 */
export function initialize() {
  ready = hydrate()
    .then(() => {
      applyRules();
      return renderAllBadges();
    })
    .catch((error) => {
      console.error("SunBlock could not initialise", error);
    });
  return ready;
}

/**
 * The promise handlers await before touching loaded state.
 *
 * @returns {Promise<void>}
 */
export function whenReady() {
  return ready;
}

// Start as soon as the worker is evaluated. Waking for an event and reading
// state are the same trip, so there is nothing to wait for.
initialize();
