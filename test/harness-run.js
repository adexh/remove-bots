/*
 * Drives the real in-page UI against the captured Meet DOM: mounts the button,
 * opens the panel, and clicks Remove, exactly as a user would.
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

  function buttonHost() { return document.getElementById('remove-bots-button-host'); }
  function trigger() {
    var host = buttonHost();
    return host && host.shadowRoot ? host.shadowRoot.querySelector('button') : null;
  }
  function panel() {
    var host = document.getElementById('remove-bots-panel-host');
    return host && host.shadowRoot ? host.shadowRoot.querySelector('.panel') : null;
  }
  function rows() {
    var p = panel();
    return p ? Array.prototype.slice.call(p.querySelectorAll('.row')) : [];
  }
  /* The bot list is the panel's own <ul>; humans live inside the <details>. */
  function botRows() {
    return rows().filter(function (row) { return !row.closest('details'); });
  }
  function botRowKeys() {
    return botRows().map(function (row) { return (row.getAttribute('data-id') || '').slice(-3); });
  }
  function rowFor(key) {
    return rows().filter(function (row) {
      return (row.getAttribute('data-id') || '').slice(-3) === key;
    })[0] || null;
  }
  function textOf(node, selector) {
    var found = node && node.querySelector(selector);
    return found ? found.textContent.trim() : '';
  }
  function summary() { return textOf(panel(), '.summary'); }

  (async function run() {
    /* ---- mount ---- */
    var mounted = await until(trigger, 9000);
    check(!!mounted, 'button mounts itself into the page');
    if (!mounted) return finish();

    /* Meet's header renders late, so the button may first stack with the call
     * controls. What must never happen is floating on top of them. */
    check(buttonHost().parentElement !== document.body,
      'stacks with existing controls rather than floating over the page');

    var celled = await until(function () {
      return buttonHost() && buttonHost().parentElement === harness.chipGrid();
    }, 9000);
    check(!!celled, 'takes a cell in the chip grid once Meet renders the header');
    if (!celled) return finish();

    /* Meet's own chips are .CvJr8b cells; ours must be a sibling of those, not
     * a node inside one, or Meet's animation and re-renders own it. */
    check(!buttonHost().closest('.CvJr8b'),
      'a cell of its own, not buried inside one of Meet\'s chips');

    var hostBox = buttonHost().getBoundingClientRect();
    var chipBox = harness.peopleChip().getBoundingClientRect();
    check(hostBox.width >= 60 && hostBox.height >= 20,
      'the cell sizes itself to the button (' +
      Math.round(hostBox.width) + 'x' + Math.round(hostBox.height) + ')');
    check(hostBox.left >= chipBox.right - 1,
      'lands after the participant chip rather than on top of it');
    check(hostBox.right <= window.innerWidth + 1 && hostBox.top >= 0,
      'stays on screen (right=' + Math.round(hostBox.right) + ' of ' + window.innerWidth + ')');
    check(harness.panelOpens() === 0,
      'mounting does NOT open the People panel or scan (opens=' + harness.panelOpens() + ')');
    check(!panel(), 'no panel until the button is clicked');
    check(harness.strayClicks().length === 0,
      'mounting clicks nothing (' + (harness.strayClicks().join('; ') || 'none') + ')');

    /* ---- open ---- */
    mounted.click();
    var opened = await until(function () {
      return panel() && !/Scanning/.test(summary()) ? panel() : null;
    });
    check(!!opened, 'clicking the button opens the panel and finishes a scan');
    if (!opened) return finish();

    check(harness.panelOpens() === 1,
      'the scan opened the People panel itself, once (opens=' + harness.panelOpens() + ')');
    check(harness.strayClicks().length === 0,
      'found it without clicking Chat/Tools/Host controls/legacy/the header badge ('
      + (harness.strayClicks().join('; ') || 'none') + ')');
    check(/3 bots found/.test(summary()), 'summary reports 3 bots: "' + summary() + '"');
    check(!panel().querySelector('.notice.warn'),
      'no not-the-host warning: our own row carries the host badge');
    check(!panel().querySelector('.primary').disabled, 'Remove is live for a host');
    var hideButton = panel().querySelector('.foot .secondary');
    check(!!hideButton && /Hide/.test(hideButton.textContent) &&
      /beta/i.test(textOf(hideButton, 'sup')),
      'Hide (Beta) is offered to a host too, beside Remove');

    check(!!rowFor('114') && !!rowFor('115') && !!rowFor('117'), 'all three bots are listed');

    /* ---- your own bots get top billing ---- */
    var heads = panel().querySelectorAll('.section-head');
    check(heads.length === 2 && /Your bots/.test(heads[0].textContent) &&
      /Other bots/.test(heads[1].textContent),
      'the list splits into "Your bots" and "Other bots"');
    function inSection(head, row) {
      return !!(row && head &&
        (head.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        (heads.length < 2 || head === heads[1] ||
          (row.compareDocumentPosition(heads[1]) & Node.DOCUMENT_POSITION_FOLLOWING)));
    }
    check(inSection(heads[0], rowFor('114')) && inSection(heads[0], rowFor('115')),
      "Adesh's own notetakers sit under Your bots");
    check(inSection(heads[1], rowFor('117')),
      "and Sarah (Notes), someone else's, under Other bots");
    check(textOf(rowFor('114'), '.row-name').indexOf("Adesh's Fathom Notetaker") === 0,
      'possessive bot name rendered clean: "' + textOf(rowFor('114'), '.row-name') + '"');
    check(textOf(rowFor('114'), '.tag') === 'known bot', 'Fathom tagged as a known bot');
    check(textOf(rowFor('117'), '.tag') === 'likely bot', 'Sarah (Notes) tagged as a likely bot');
    check(/guest, no account/.test(textOf(rowFor('114'), '.row-why')),
      'anonymous guest surfaced: "' + textOf(rowFor('114'), '.row-why') + '"');

    var boxes = ['114', '115', '117'].map(function (key) {
      var row = rowFor(key);
      return row && row.querySelector('input').checked;
    });
    check(boxes.every(Boolean), 'every bot starts ticked');
    check(botRowKeys().indexOf('116') === -1 && botRowKeys().length === 3,
      'the bot list holds only the 3 bots (' + botRowKeys().join(', ') + ')');
    check(!!rowFor('116') && !!rowFor('116').closest('details'),
      'the human is listed, but behind the others section');

    var others = panel().querySelector('details summary');
    check(others && /2 other participants/.test(others.textContent),
      'self and human are behind "other participants": "' + (others && others.textContent) + '"');

    var badge = buttonHost().shadowRoot.querySelector('.count');
    check(badge && badge.textContent === '3', 'button badge shows the bot count');

    var removeButton = panel().querySelector('.primary');
    check(removeButton && /Remove 3 bots/.test(removeButton.textContent),
      'action button names the count: "' + (removeButton && removeButton.textContent.trim()) + '"');

    /* ---- untick one, then remove ---- */
    rowFor('117').querySelector('input').click();
    await until(function () { return /Remove 2 bots/.test(panel().querySelector('.primary').textContent); }, 3000);
    check(/Remove 2 bots/.test(panel().querySelector('.primary').textContent),
      'unticking a bot updates the action button');

    panel().querySelector('.primary').click();
    var settled = await until(function () {
      return /removed|failed/.test(summary()) && !/Removing/.test(summary()) ? true : null;
    }, 30000);
    check(!!settled, 'removal run completes: "' + summary() + '"');

    check(/2 bots removed/.test(summary()), 'summary reports both removals: "' + summary() + '"');
    check(textOf(rowFor('114'), '.row-status') === 'removed',
      'Fathom row shows removed (confirm overlay with no role="dialog")');
    check(textOf(rowFor('115'), '.row-status') === 'removed',
      'Otter row shows removed (no confirmation step)');
    check(textOf(rowFor('117'), '.row-status') === '',
      'the unticked bot was left alone');

    var left = harness.remaining();
    check(left.indexOf('114') === -1 && left.indexOf('115') === -1, 'both bots gone from the roster');
    check(left.indexOf('113') !== -1 && left.indexOf('116') !== -1 && left.indexOf('117') !== -1,
      'self, human and the unticked bot remain (roster: ' + left.join(', ') + ')');
    check(harness.portals() === 0, 'no menu or confirm overlay left open');
    check(harness.strayClicks().length === 0,
      'never clicked a decoy or a disabled control (' + (harness.strayClicks().join('; ') || 'none') + ')');

    /* ---- dismiss ---- */
    document.body.click();
    var closed = await until(function () { return panel() ? null : true; }, 3000);
    check(!!closed, 'clicking outside closes the panel');
    check(!!trigger(), 'the button survives closing');

    /* ---- survives Meet re-rendering its header ---- */
    buttonHost().remove();
    var remounted = await until(trigger, 5000);
    check(!!remounted, 'button remounts itself after Meet drops it from the DOM');
    check(harness.panelOpens() === 1,
      'remounting does not trigger another scan (opens=' + harness.panelOpens() + ')');

    /* ---- a grid that will not give the cell any room ---- */
    harness.squashGrid();
    buttonHost().remove();
    var fellBack = await until(function () {
      var host = buttonHost();
      return host && host.parentElement !== harness.chipGrid() ? host : null;
    }, 6000);
    check(!!fellBack, 'gives up on the grid when the cell comes out with no room');
    if (!fellBack) return finish();
    check(fellBack.parentElement !== document.body,
      'and stacks with the chip rather than floating over the page');
    check(fellBack.getBoundingClientRect().width >= 60,
      'the fallback button is its full size (' +
      Math.round(fellBack.getBoundingClientRect().width) + 'px)');
    check(!!trigger(), 'and is still clickable');

    finish();
  })();
})();
