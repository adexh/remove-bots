/*
 * Generic DOM helpers. Nothing in here knows anything about Google Meet, so it
 * should not need to change when Meet does. Meet-specific knowledge lives in
 * meet.js.
 * Framework-agnostic: plain DOM only, so it runs in a browser and imports
 * cleanly in Node for tests.
 */

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Poll until fn returns something truthy, then resolve with it.
 * Rejects on timeout, so callers can distinguish "not yet" from "never".
 */
function waitFor(fn, options) {
  var opts = options || {};
  var timeout = opts.timeout || 6000;
  var interval = opts.interval || 100;
  var deadline = Date.now() + timeout;

  return new Promise(function (resolve, reject) {
    (function tick() {
      var value;
      try {
        value = fn();
      } catch (err) {
        value = null;
      }
      if (value) return resolve(value);
      if (Date.now() >= deadline) return reject(new Error('timeout'));
      setTimeout(tick, interval);
    })();
  });
}

/** Collapsed, trimmed textContent. */
function text(node) {
  return (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
}

/**
 * Text of every descendant that has no element children of its own.
 *
 * Needed because textContent concatenates sibling labels with no separator:
 * a row reading "Ada Lovelace", "Visitor", "devices" comes out as
 * "Ada LovelaceVisitordevices", where no \b-anchored pattern can match. Going
 * leaf by leaf keeps the labels apart.
 */
function leafTexts(node, selector) {
  var out = [];
  Array.prototype.forEach.call(node.querySelectorAll(selector || 'span, div, i'), function (child) {
    if (child.children.length) return;
    var value = text(child);
    if (value) out.push(value);
  });
  return out;
}

function isVisible(node) {
  if (!node) return false;
  if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return false;
  var rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function dispatchMouse(node, types) {
  types.forEach(function (type) {
    var Ctor = type.indexOf('pointer') === 0 && PointerEvent ? PointerEvent : MouseEvent;
    node.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  });
}

/** Fake a real pointer arriving, which is what reveals hover-only controls. */
function hover(node) {
  dispatchMouse(node, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']);
}

/**
 * Click through the full event sequence, not just .click().
 *
 * Meet binds handlers via jsaction and some controls react to the pointer
 * sequence rather than the synthesised click.
 */
function click(node) {
  node.scrollIntoView({ block: 'center', inline: 'nearest' });
  hover(node);
  dispatchMouse(node, ['pointerdown', 'mousedown', 'pointerup', 'mouseup']);
  node.click();
}

function sendKey(target, key, code, keyCode, modifiers) {
  ['keydown', 'keyup'].forEach(function (type) {
    var init = {
      key: key, code: code, keyCode: keyCode, which: keyCode,
      bubbles: true, cancelable: true
    };
    if (modifiers) {
      Object.keys(modifiers).forEach(function (name) { init[name] = modifiers[name]; });
    }
    target.dispatchEvent(new KeyboardEvent(type, init));
  });
}

function pressEscape() {
  var targets = [document.activeElement, document].filter(Boolean);
  targets.forEach(function (target) {
    sendKey(target, 'Escape', 'Escape', 27);
  });
}

/**
 * The name a screen reader would announce.
 *
 * aria-label is only half of it: Meet's participants control has no
 * aria-label at all and is named through aria-labelledby pointing at a
 * visually hidden span, so an aria-label-only lookup cannot find it.
 */
function accessibleName(node) {
  if (!node || !node.getAttribute) return '';

  var label = node.getAttribute('aria-label');
  if (label) return label.trim();

  var ref = node.getAttribute('aria-labelledby');
  if (ref) {
    var parts = ref.split(/\s+/).map(function (id) {
      var target = document.getElementById(id);
      return target ? text(target) : '';
    }).filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return '';
}

/**
 * Walk up to something that actually handles a click.
 *
 * A matched text label is usually an inert inner span; the handler sits on an
 * ancestor carrying role, tabindex, or a jsaction binding.
 */
function clickableAncestor(node, maxDepth) {
  var depth = maxDepth || 6;
  var el = node;
  for (var i = 0; i < depth && el && el !== document.body; i++) {
    var role = el.getAttribute && el.getAttribute('role');
    if (el.tagName === 'BUTTON' ||
        role === 'menuitem' || role === 'button' ||
        (el.hasAttribute && el.hasAttribute('jsaction')) ||
        (el.getAttribute && el.getAttribute('tabindex') !== null)) {
      return el;
    }
    el = el.parentElement;
  }
  return node;
}

/** Unique nodes by attribute value, preserving document order. */
function dedupeBy(nodes, attribute) {
  var seen = Object.create(null);
  var out = [];
  Array.prototype.forEach.call(nodes, function (node) {
    var key = node.getAttribute(attribute);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(node);
  });
  return out;
}

export {
  sleep, waitFor, text, leafTexts, isVisible, hover, click, sendKey, pressEscape,
  accessibleName, clickableAncestor, dedupeBy
};
