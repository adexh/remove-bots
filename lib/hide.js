/*
 * Hiding bot tiles from this user's own view, for when removing them is not
 * on offer.
 *
 * The mechanism is one injected stylesheet keyed on data-participant-id, not
 * an inline style on the tile node: Meet re-renders tiles freely, and a fresh
 * node keeps the attribute, so the CSS keeps applying where an inline style
 * would be lost with the node it was written on. The selector text itself is
 * Meet knowledge and lives in meet.hideTilesCss(); this module only owns the
 * <style> element's lifecycle and the current set of hidden ids.
 *
 * Nothing here touches the DOM at import time, so the module stays importable
 * from Node for tests.
 */
import * as meet from './meet.js';

var STYLE_ID = 'remove-bots-hidden-tiles';

var hidden = new Set();

function styleElement() {
  return document.getElementById(STYLE_ID);
}

/**
 * Hide exactly these participants' tiles, replacing whatever was hidden
 * before. An empty list removes the stylesheet entirely, so leaving the
 * feature unused costs the page nothing.
 */
function apply(ids) {
  hidden = new Set(ids);

  var element = styleElement();
  if (!hidden.size) {
    if (element) element.remove();
    return;
  }

  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(element);
  }
  element.textContent = meet.hideTilesCss(Array.from(hidden));
}

function hiddenIds() {
  return Array.from(hidden);
}

function isHidden(id) {
  return hidden.has(id);
}

/** Undo everything, for when the extension reloads or updates mid-call. */
function clear() {
  hidden = new Set();
  var element = styleElement();
  if (element) element.remove();
}

export { apply, hiddenIds, isHidden, clear };
