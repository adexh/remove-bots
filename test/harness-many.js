/*
 * A crowded meeting: 50 notetakers plus the usual cast.
 *
 * Checks the two things that only matter at this size: the list scrolls without
 * pushing the Remove button off the panel, and the search box narrows it down.
 * Run with --show to look at it.
 */
import { mount } from '../lib/ui.js';

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

  function shadow(id) {
    var host = document.getElementById(id);
    return host && host.shadowRoot ? host.shadowRoot : null;
  }
  function trigger() {
    var root = shadow('remove-bots-button-host');
    return root ? root.querySelector('button') : null;
  }
  function panel() {
    var root = shadow('remove-bots-panel-host');
    return root ? root.querySelector('.panel') : null;
  }
  function scroller() { return panel() && panel().querySelector('.scroll'); }
  function search() { return panel() && panel().querySelector('.search input'); }
  function botRows() {
    if (!panel()) return [];
    return Array.prototype.slice.call(panel().querySelectorAll('.row')).filter(function (row) {
      return !row.closest('details');
    });
  }
  function names() {
    return botRows().map(function (row) {
      return row.querySelector('.row-name').textContent;
    });
  }
  function selectedCount() {
    var label = panel() && panel().querySelector('.list-head .muted');
    var found = label && /^(\d+) selected/.exec(label.textContent);
    return found ? Number(found[1]) : -1;
  }

  /* React renders on a microtask; give the DOM a beat to catch up. */
  function settle() { return new Promise(function (r) { setTimeout(r, 120); }); }

  function type(input, value) {
    /* React listens for the native input event, not .value assignment. */
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  (async function run() {
    var button = await until(trigger, 9000);
    check(!!button, 'button mounts in a crowded meeting');
    if (!button) return finish();

    button.click();
    var opened = await until(function () {
      return panel() && !/Scanning/.test(panel().querySelector('.summary').textContent)
        ? panel() : null;
    }, 30000);
    check(!!opened, 'panel opens and the scan finishes');
    if (!opened) return finish();

    var total = botRows().length;
    check(total >= 50, 'lists all the bots it found (' + total + ' rows)');
    check(/5[0-9] bots found/.test(panel().querySelector('.summary').textContent),
      'summary counts them: "' + panel().querySelector('.summary').textContent + '"');

    /* ---- scrolling ---- */
    check(!!scroller(), 'the list sits in its own scroll region');
    var box = panel().getBoundingClientRect();
    check(box.height <= window.innerHeight * 0.72,
      'panel stays within its max height (' + Math.round(box.height) + 'px)');
    check(scroller().scrollHeight > scroller().clientHeight + 20,
      'the list overflows and therefore scrolls (' + scroller().scrollHeight + ' > ' +
      scroller().clientHeight + ')');

    check(box.bottom <= window.innerHeight && box.top >= 0,
      'panel fits on screen (top ' + Math.round(box.top) + ', bottom ' +
      Math.round(box.bottom) + ' of ' + window.innerHeight + ')');

    var foot = panel().querySelector('.foot').getBoundingClientRect();
    check(foot.bottom <= box.bottom + 1 && foot.height > 0,
      'the Remove button stays inside the panel, not scrolled away');
    var head = panel().querySelector('.head').getBoundingClientRect();
    check(head.top >= box.top - 1, 'the header stays put too');

    scroller().scrollTop = scroller().scrollHeight;
    await settle();
    check(scroller().scrollTop > 0, 'the list actually scrolls when asked');
    var footAfter = panel().querySelector('.foot').getBoundingClientRect();
    check(Math.abs(footAfter.bottom - foot.bottom) < 2,
      'scrolling the list does not move the footer');

    /* ---- search ---- */
    check(!!search(), 'a search box appears once the list is long');
    if (!search()) return finish();

    var before = selectedCount();
    check(before >= 50, 'every bot starts ticked (' + before + ' selected)');

    type(search(), 'otter');
    await settle();
    var filtered = names();
    check(filtered.length > 0 && filtered.length < total,
      'searching narrows the list (' + filtered.length + ' of ' + total + ')');
    check(filtered.every(function (name) { return /otter/i.test(name); }),
      'every remaining row matches the query');
    check(selectedCount() === before, 'filtering does not change what is selected');

    var note = panel().querySelector('.hidden-note');
    check(!!note && /hidden by search/.test(note.textContent),
      'warns that some ticked bots are hidden: "' + (note && note.textContent.trim()) + '"');

    /* Unticking "All" must apply to the filtered rows only. */
    var visible = filtered.length;
    panel().querySelector('.check-all input').click();
    await settle();
    check(selectedCount() === before - visible,
      '"All" applies to the search results, not the whole list (' +
      selectedCount() + ' left of ' + before + ')');

    type(search(), 'nothing matches this');
    await settle();
    check(botRows().length === 0 && !!panel().querySelector('.empty'),
      'an empty result says so rather than looking broken');

    type(search(), '');
    await settle();
    check(botRows().length === total, 'clearing the search restores every row');

    finish();
  })();
})();
