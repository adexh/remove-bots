/*
 * The same call from a guest's seat: our row has no host badge, someone else's
 * does, there is no Host controls button, and no row menu offers a remove
 * entry.
 *
 * What is being checked is that the panel says so before the run rather than
 * after it: Remove is held back with an explanation, and only a deliberate
 * "Try anyway" hands the click to Meet - because a guest CAN remove people in
 * a call with host management turned off, and the extension does not get to
 * decide that on Meet's behalf.
 */
import { mount } from '../lib/ui.js';
import * as meet from '../lib/meet.js';

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

  function trigger() {
    var host = document.getElementById('remove-bots-button-host');
    return host && host.shadowRoot ? host.shadowRoot.querySelector('button') : null;
  }
  function panel() {
    var host = document.getElementById('remove-bots-panel-host');
    return host && host.shadowRoot ? host.shadowRoot.querySelector('.panel') : null;
  }
  function textOf(node, selector) {
    var found = node && node.querySelector(selector);
    return found ? found.textContent.trim() : '';
  }
  function summary() { return textOf(panel(), '.summary'); }
  function warning() { return panel() && panel().querySelector('.notice.warn'); }
  function removeButton() { return panel() && panel().querySelector('.primary'); }
  function rowFor(key) {
    var p = panel();
    if (!p) return null;
    return Array.prototype.filter.call(p.querySelectorAll('.row'), function (row) {
      return (row.getAttribute('data-id') || '').slice(-3) === key;
    })[0] || null;
  }
  /* A chip by its wording, because the warn block holds more than one. */
  function chipIn(node, pattern) {
    if (!node) return null;
    return Array.prototype.filter.call(node.querySelectorAll('.chip'), function (chip) {
      return pattern.test(chip.textContent);
    })[0] || null;
  }
  function tileOf(key) {
    return document.querySelector('.oZRSLe[data-participant-id="' + CSS.escape(harness.idOf(key)) + '"]');
  }
  function tileHidden(key) {
    var tile = tileOf(key);
    return !!tile && getComputedStyle(tile).display === 'none';
  }
  function hideStyle() { return document.getElementById('remove-bots-hidden-tiles'); }
  function hiddenNotice() {
    var p = panel();
    if (!p) return null;
    return Array.prototype.filter.call(p.querySelectorAll('.notice:not(.warn)'), function (node) {
      return /hidden/i.test(node.textContent);
    })[0] || null;
  }

  (async function run() {
    var mounted = await until(trigger, 9000);
    check(!!mounted, 'button mounts itself into the page');
    if (!mounted) return finish();

    mounted.click();
    var opened = await until(function () {
      return panel() && !/Scanning/.test(summary()) ? panel() : null;
    });
    check(!!opened, 'clicking the button opens the panel and finishes a scan');
    if (!opened) return finish();

    /* ---- the verdict, read straight off the adapter ---- */
    var verdict = meet.hostRole();
    check(verdict.role === 'guest', 'hostRole() reads the call as a guest seat (' + verdict.role + ')');
    check(!meet.hostControl(), 'no Host controls button to be found');
    check(meet.isHost(meet.findRow(harness.idOf('116'))),
      "the badge on someone else's row is recognised");
    check(!meet.isHost(meet.findRow(harness.idOf('113'))),
      'and our own unbadged row is not');

    /* ---- what the panel does with it ---- */
    check(/3 bots found/.test(summary()), 'still lists the bots: "' + summary() + '"');
    check(!!warning(), 'warns that removal will probably be refused');
    check(/not the host/.test(warning() ? warning().textContent : ''),
      'the warning says why: "' + (warning() ? warning().textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '') + '"');
    check(!!removeButton() && removeButton().disabled,
      'Remove is held back rather than firing off doomed clicks');
    check(!!rowFor('114') && rowFor('114').querySelector('input').checked,
      'the bots are still ticked, so one click is enough after the override');

    /* ---- hiding tiles from this seat's own view ---- */
    var hideChip = chipIn(warning(), /Hide their tiles/i);
    check(!!hideChip, 'the warning also offers to hide the tiles instead');
    if (hideChip) {
      hideChip.click();

      var hidden = await until(function () { return tileHidden('114') ? true : null; }, 4000);
      check(!!hidden, "hiding turns the bot's main-view tile off (display: none)");
      check(!!tileOf('113') && getComputedStyle(tileOf('113')).display !== 'none',
        'our own tile is left alone');

      var rosterRow = meet.findRow(harness.idOf('114'));
      check(!!rosterRow && getComputedStyle(rosterRow).display !== 'none',
        'the roster row for the hidden bot is untouched');

      /* A framework page re-renders: the rule is keyed on the participant id
       * attribute, so the same id on a freshly attached node must stay hidden. */
      var tile = tileOf('114');
      var tileParent = tile && tile.parentNode;
      if (tile && tileParent) {
        tile.remove();
        tileParent.appendChild(tile);
      }
      check(tileHidden('114'), 'a re-rendered tile with the same id stays hidden');

      var noted = await until(hiddenNotice, 4000);
      check(!!noted, 'the panel says tiles are hidden: "' +
        (noted ? noted.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '') + '"');

      var showAgain = chipIn(noted, /Show them again/i);
      check(!!showAgain, 'and offers "Show them again"');
      if (showAgain) {
        showAgain.click();
        var restored = await until(function () {
          return !tileHidden('114') && !hideStyle() ? true : null;
        }, 4000);
        check(!!restored, 'showing again restores the tile and removes the injected stylesheet');
      }
    }

    /* ---- the override ---- */
    var anyway = chipIn(warning(), /Try anyway/i);
    check(!!anyway && /Try anyway/.test(anyway.textContent), 'offers "Try anyway"');
    if (!anyway) return finish();
    anyway.click();

    var unlocked = await until(function () {
      return removeButton() && !removeButton().disabled ? true : null;
    }, 4000);
    check(!!unlocked, 'clicking it hands the decision back to the user');
    check(!warning(), 'and the warning stands down');

    /* ---- and the run that follows reports honestly ---- */
    removeButton().click();
    var settled = await until(function () {
      return /removed|failed/.test(summary()) && !/Removing/.test(summary()) ? true : null;
    }, 45000);
    check(!!settled, 'the run completes instead of hanging: "' + summary() + '"');
    check(/3 failed/.test(summary()), 'every removal is reported as failed: "' + summary() + '"');
    check(/No remove option/.test(textOf(rowFor('114'), '.row-why')),
      'the row says what Meet did: "' + textOf(rowFor('114'), '.row-why') + '"');

    var left = harness.remaining();
    check(left.length === harness.people.length,
      'nobody left the meeting (roster: ' + left.join(', ') + ')');
    check(harness.portals() === 0, 'no menu left open behind it');
    check(harness.strayClicks().length === 0,
      'never clicked a decoy or a disabled control (' + (harness.strayClicks().join('; ') || 'none') + ')');

    finish();
  })();
})();
