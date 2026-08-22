/*
 * Placement in the worst case: a Meet layout where nothing has rendered yet, so
 * there is no control to stack with.
 *
 * The button must wait rather than immediately float, because floating parks it
 * on top of Meet's own controls. Then, once something to dock beside appears, it
 * must move there.
 */
import { mount } from '../lib/ui.js';
import { chipGrid, peopleControl, toolbarAnchor } from '../lib/meet.js';

(function () {
  'use strict';

  /* Stand in for entrypoints/meet.content.js. */
  mount();

  var results = [];
  function check(ok, label) { results.push({ ok: !!ok, label: label }); }

  function finish() {
    var failed = results.filter(function (r) { return !r.ok; });
    var lines = results.map(function (r) { return (r.ok ? 'PASS ' : 'FAIL ') + r.label; });
    lines.push('');
    lines.push('RESULT ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
    document.getElementById('out').textContent = lines.join('\n');
    document.body.setAttribute('data-harness', failed.length ? 'fail' : 'pass');
  }

  function until(fn, timeoutMs) {
    var deadline = Date.now() + (timeoutMs || 15000);
    return new Promise(function (resolve) {
      (function tick() {
        var value;
        try { value = fn(); } catch (err) { value = null; }
        if (value) return resolve(value);
        if (Date.now() > deadline) return resolve(null);
        setTimeout(tick, 60);
      })();
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function host() { return document.getElementById('remove-bots-button-host'); }

  (async function run() {
    /*
     * Tile controls and a notification badge exist, but none of them is
     * something to dock beside, and with no chip there is no way to tell which
     * region is the chip grid.
     */
    check(!peopleControl() && !toolbarAnchor() && !chipGrid(),
      'scenario check: no dockable control exists at load');

    /* Well inside the grace period. */
    await sleep(1200);
    check(!host(), 'holds off instead of floating while it waits for an anchor');

    var floated = await until(host, 6000);
    check(!!floated, 'eventually appears rather than never showing up');
    if (!floated) return finish();

    check(host().parentElement === document.body, 'falls back to floating when nothing renders');
    var box = host().getBoundingClientRect();
    var style = getComputedStyle(host());
    check(style.position === 'fixed', 'floating placement is fixed to the viewport');
    check(box.bottom < window.innerHeight - 40 && box.top > window.innerHeight / 2,
      'floats low, clear of the header and a tile mute badge (top=' + Math.round(box.top) + ')');
    check(box.right > window.innerWidth / 2, 'floats to the right');

    /* The chip renders late; the button must move into its grid. */
    var moved = await until(function () {
      return host() && host().parentElement === harness.chipGrid();
    }, 12000);
    check(!!moved, 'relocates out of the corner into the chip grid when it appears');
    check(!!moved && host().parentElement !== document.body, 'no longer floating once docked');
    check(getComputedStyle(host()).position !== 'fixed', 'docked placement is in the flow');
    check(harness.panelOpens() === 0, 'none of this triggered a scan');

    finish();
  })();
})();
