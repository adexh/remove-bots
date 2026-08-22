/*
 * Test double for Google Meet, built from a DOM capture of a real call
 * (Aug 2026 Meet build). Structure, class names, roles, icon-font text and
 * label wording are copied from that capture rather than invented:
 *
 *  - With the People panel closed, [data-participant-id] matches only video
 *    tiles (div.oZRSLe). No [role="listitem"] exists at all.
 *  - There is NO People button in the bottom toolbar. The control is the
 *    participant-count chip in the top-right header: a div[role="button"] with
 *    NO aria-label, named through aria-labelledby.
 *  - The bottom toolbar holds Chat / Meeting tools / Host controls, which must
 *    never be clicked by mistake.
 *  - Roster rows share one class ("cxdMu KV1GEc") for humans and bots, so
 *    aria-label is the only clean name source.
 *  - The row menu mounts into an ATTRIBUTE-LESS <div> directly under <body>,
 *    four levels above a <ul role="menu"> of <li role="menuitem">.
 *  - Menu entry text carries the icon-font word: "remove_circle_outline\n
 *    Remove from the call".
 *
 * Meet's confirmation step could not be captured, so the two bots here model
 * both possibilities: one confirms through an overlay with NO role="dialog",
 * the other is removed immediately.
 */
(function () {
  'use strict';

  /*
   * "Bare" mode models the worst case for placement: a Meet layout where
   * neither the header chip nor the call controls have rendered yet, so there
   * is nothing at all to dock beside. Set by test/fake-meet-bare.html.
   */
  var BARE = !!window.__BARE__;
  var CHIP_DELAY_MS = BARE ? 4000 : 3000;

  var SPACE = 'spaces/KEi-HMinAxkB/devices/';

  var PEOPLE = [
    { key: '113', name: 'Adesh Tamrakar', self: true, host: true, tile: true },
    { key: '114', name: "Adesh's Fathom Notetaker", visitor: true, tile: true, video: true, confirm: 'overlay' },
    { key: '115', name: "Adesh's Otter.ai Notetaker", visitor: true, confirm: 'none' },
    { key: '116', name: 'Ada Lovelace' },
    { key: '117', name: 'Sarah (Notes)', visitor: true, noRemove: true }
  ];

  PEOPLE.forEach(function (person) { person.id = SPACE + person.key; });

  var strayClicks = [];
  var panelOpens = 0;
  var app = document.getElementById('app');

  /* ---------- video tiles: the only thing present before the panel opens ---------- */

  var tileWrap = document.createElement('div');
  tileWrap.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
  app.appendChild(tileWrap);

  PEOPLE.filter(function (p) { return p.tile; }).forEach(function (person) {
    var tile = document.createElement('div');
    tile.className = 'oZRSLe';
    tile.setAttribute('data-participant-id', person.id);
    tile.style.cssText = 'width:160px;height:90px;border:1px solid #999;font-size:11px';

    if (person.video) {
      var video = document.createElement('video');
      video.style.cssText = 'width:40px;height:24px';
      tile.appendChild(video);
    }

    /* Real tiles repeat the name and append icon-font words. */
    ['frame_person', 'Reframe', 'visual_effects', 'Backgrounds and effects'].forEach(function (word) {
      if (!person.self) return;
      var glyph = document.createElement('button');
      glyph.textContent = word;
      glyph.addEventListener('click', function () { strayClicks.push('tile-button ' + word); });
      tile.appendChild(glyph);
    });

    [person.name, person.name, 'devices'].forEach(function (word) {
      var span = document.createElement('span');
      span.textContent = word;
      tile.appendChild(span);
    });
    tileWrap.appendChild(tile);
  });

  /* ---------- top-right chip grid: the People control and its near-miss ---------- */

  /*
   * From the capture: a role="region" grid, "Call feature notifications and
   * actions", holding the participant-count chip and the call-feature
   * notification badges. Its cells are placed by hand on one row, in a sparse
   * template addressed with column lines counted back from the end
   * (grid-area: 1 / -6 and friends), so a feature keeps its slot whether or
   * not its neighbours are showing. Empty tracks collapse, hidden cells take
   * no room, and a chip is free to be wider than its own track.
   */
  var grid = document.createElement('div');
  grid.className = 'P9KVBf Y2Syxf';
  grid.setAttribute('role', 'region');
  grid.setAttribute('aria-label', 'Call feature notifications and actions');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(123,auto);justify-content:end;' +
    'align-items:center;height:40px;margin-bottom:12px';

  /*
   * One cell of that grid, with the chip buried inside it the way Meet buries
   * it: a tooltip wrapper, a jsshadow span and a jsslot div before the
   * div[jsname="ocqpFe"][role="button"] that actually gets clicked. Anything
   * inserted next to that node is inside Meet's own tooltip slot, which is
   * what a cell of our own avoids.
   */
  function chipCell(column, label, onClick) {
    var cell = document.createElement('div');
    cell.className = 'CvJr8b';
    cell.style.cssText = 'grid-area: 1 / ' + column + ';opacity:1';

    var tooltipWrap = document.createElement('span');
    tooltipWrap.setAttribute('data-is-tooltip-wrapper', 'true');
    var shadowWrap = document.createElement('span');
    shadowWrap.setAttribute('jsshadow', '');
    var slot = document.createElement('div');
    slot.setAttribute('jsslot', '');

    var hiddenLabel = document.createElement('span');
    hiddenLabel.id = 'label-' + label.replace(/\W+/g, '-');
    hiddenLabel.textContent = label;
    hiddenLabel.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';

    var control = document.createElement('div');
    control.setAttribute('animatable', '');
    control.setAttribute('jsname', 'ocqpFe');
    control.className = 'JgybGf';
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
    control.setAttribute('aria-haspopup', 'dialog');
    control.setAttribute('aria-expanded', 'false');
    control.setAttribute('aria-labelledby', hiddenLabel.id);
    control.style.cssText = 'width:70px;height:32px;border:1px solid #999;cursor:pointer';
    control.appendChild(hiddenLabel);
    control.addEventListener('click', onClick);

    slot.appendChild(control);
    shadowWrap.appendChild(slot);
    tooltipWrap.appendChild(shadowWrap);
    cell.appendChild(tooltipWrap);
    return { cell: cell, control: control };
  }

  /*
   * "External participants joined": a badge whose name contains
   * "participants", which announces a popup like the chip does, and which is
   * earlier in document order. Clicking it opens nothing.
   */
  var badge = chipCell(-123, 'External participants joined', function () {
    strayClicks.push('header badge External participants joined');
  });
  grid.appendChild(badge.cell);

  var people = chipCell(-6, 'People', openPanel);
  var chip = people.control;
  var count = document.createElement('div');
  count.className = 'fdZ55';
  count.textContent = String(PEOPLE.length);
  chip.appendChild(count);

  app.appendChild(grid);

  /*
   * Meet builds its header a beat after the page loads, so on a cold load
   * there is no chip yet - and so no way to tell which region is the chip
   * grid. Delaying it here exercises the wait-then-relocate path instead of
   * pretending the anchor is there from the start.
   */
  setTimeout(function () { grid.appendChild(people.cell); }, CHIP_DELAY_MS);

  /* ---------- bottom toolbar: decoys that must not be clicked ---------- */

  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:6px;margin-bottom:12px';
  (BARE ? [] : [['Chat with everyone', 'chat'], ['Meeting tools', 'apps'], ['Host controls', 'lock_person']])
    .forEach(function (pair) {
      var button = document.createElement('button');
      button.setAttribute('aria-label', pair[0]);
      button.textContent = pair[1];
      button.style.cssText = 'height:32px';
      /* Meet's chat panel button also announces a popup, and its label
       * contains "everyone", so it is a genuine near-miss for the People
       * lookup. */
      if (pair[0] === 'Chat with everyone') button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', function () { strayClicks.push('toolbar ' + pair[0]); });
      toolbar.appendChild(button);
    });
  /*
   * A dead control whose name genuinely matches "People": Meet surfaces
   * participant wording in more than one place, and only the real chip
   * announces a popup. Placed before the chip so a lookup that takes the first
   * plausible match, instead of preferring aria-haspopup, opens nothing.
   */
  var legacy = document.createElement('button');
  legacy.setAttribute('aria-label', 'Participants');
  if (BARE) legacy.setAttribute('hidden', 'hidden');
  legacy.textContent = 'group';
  legacy.style.cssText = 'height:32px';
  legacy.addEventListener('click', function () { strayClicks.push('legacy Participants'); });
  toolbar.appendChild(legacy);

  app.appendChild(toolbar);
  /* Put the decoys BEFORE the real chip in document order, so a lookup that
   * merely takes the first plausible match picks the wrong control. */
  app.insertBefore(toolbar, grid);

  /* ---------- roster panel: created lazily, only when the chip is clicked ---------- */

  var panel = null;

  function openPanel() {
    if (panel) return;
    panelOpens++;
    chip.setAttribute('aria-expanded', 'true');
    panel = document.createElement('div');
    panel.setAttribute('data-panel', 'people');
    panel.style.cssText = 'width:340px;border:1px solid #ccc;padding:6px';
    PEOPLE.forEach(function (person) { panel.appendChild(buildRow(person)); });
    app.appendChild(panel);
  }

  function buildRow(person) {
    var row = document.createElement('div');
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-label', person.name);
    row.className = 'cxdMu KV1GEc';
    row.setAttribute('jscontroller', 'ZHOeze');
    row.setAttribute('data-participant-id', person.id);
    row.setAttribute('data-scroll-target', person.id);
    row.style.cssText = 'display:flex;align-items:center;gap:6px;height:40px;width:320px;font-size:11px';

    var name = document.createElement('span');
    name.textContent = person.name;
    row.appendChild(name);

    if (person.self) {
      ['(You)', 'Meeting host'].forEach(function (word) {
        var chipSpan = document.createElement('span');
        chipSpan.textContent = word;
        row.appendChild(chipSpan);
      });
    }
    if (person.visitor) {
      ['domain_disabled', 'Visitor'].forEach(function (word) {
        var badge = document.createElement('span');
        badge.textContent = word;
        row.appendChild(badge);
      });
    }
    var devices = document.createElement('span');
    devices.textContent = 'devices';
    row.appendChild(devices);

    if (person.visitor) {
      /* Disabled mute button, innerText is empty. */
      var mute = document.createElement('button');
      mute.className = 'VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ T08Bz';
      mute.setAttribute('aria-label', "You can't unmute someone else");
      mute.disabled = true;
      mute.style.cssText = 'width:28px;height:28px';
      mute.addEventListener('click', function () { strayClicks.push('mute ' + person.key); });
      row.appendChild(mute);
    }

    var more = document.createElement('button');
    more.className = 'VYBDae-Bz112c-LgbsSe hk9qKe t2FmWe mcyM9d';
    more.setAttribute('jscontroller', 'PIVayb');
    more.setAttribute('jsname', 'YEvVxd');
    more.setAttribute('aria-label', 'More actions');
    more.setAttribute('role', 'button');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-haspopup', 'menu');
    more.textContent = 'more_vert';
    more.style.cssText = 'width:28px;height:28px';
    more.addEventListener('click', function () { openRowMenu(person); });
    row.appendChild(more);

    return row;
  }

  function rowOf(id) {
    return panel ? panel.querySelector('[data-participant-id="' + CSS.escape(id) + '"]') : null;
  }

  /* ---------- row menu: portal into an attribute-less div under <body> ---------- */

  function clearPortals() {
    Array.prototype.slice.call(document.body.children).forEach(function (node) {
      if (node.hasAttribute && node.hasAttribute('data-portal')) node.remove();
    });
  }

  function openRowMenu(person) {
    clearPortals();

    /* Direct child of <body> with ZERO attributes, exactly as captured. The
     * data-portal marker below is on it only so the harness can clean up; it is
     * added after the extension-visible structure is built. */
    var portal = document.createElement('div');
    var floater = document.createElement('div');
    floater.className = 'tB5Jxf-xl07Ob-XxIAqe pQJqJb s8FnCf wBdOg P9KVBf O68mGe-xl07Ob';
    floater.style.cssText = 'position:fixed;top:20px;right:20px;width:260px;background:#fff;border:1px solid #666';
    var inner = document.createElement('div');
    inner.setAttribute('jsname', 'SDSjce');
    inner.className = 'tB5Jxf-xl07Ob-S5Cmsd';

    var menu = document.createElement('ul');
    menu.className = 'aqdrmf-rymPhb O68mGe-hqgu2c';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('tabindex', '-1');
    menu.setAttribute('data-list-type', 'MENU');
    menu.setAttribute('jsname', 'rymPhb');
    menu.setAttribute('aria-label', 'More actions');

    var entries = [
      ['keep', 'Pin to the screen'],
      ['link', 'Ask to pair your tiles'],
      ['videocam_off', "Don't watch"]
    ];
    if (!person.noRemove) entries.push(['remove_circle_outline', 'Remove from the call']);

    entries.forEach(function (pair) {
      var li = document.createElement('li');
      li.className = 'aqdrmf-rymPhb-ibnC6b mgUzuf zLCWcc';
      li.setAttribute('role', 'menuitem');
      li.setAttribute('tabindex', '-1');
      li.setAttribute('jsname', 'BUtajd');
      li.setAttribute('aria-label', pair[1]);
      li.style.cssText = 'height:30px;line-height:30px;padding:0 8px;list-style:none';

      var glyph = document.createElement('i');
      glyph.className = 'google-material-icons';
      glyph.textContent = pair[0];
      li.appendChild(glyph);

      var outer = document.createElement('span');
      outer.className = 'aqdrmf-rymPhb-Gtdoyb';
      var inner2 = document.createElement('span');
      inner2.className = 'aqdrmf-rymPhb-fpDzbe-fmcmS';
      inner2.setAttribute('jsname', 'K4r5Ff');
      inner2.textContent = pair[1];
      outer.appendChild(inner2);
      li.appendChild(outer);

      li.addEventListener('click', function () {
        clearPortals();
        if (pair[1] !== 'Remove from the call') return;
        if (person.confirm === 'overlay') askConfirm(person);
        else drop(person.id);
      });
      menu.appendChild(li);
    });

    /* Hidden zero-size submenu, also role="menu". */
    var sub = document.createElement('ul');
    sub.setAttribute('role', 'menu');
    sub.setAttribute('aria-label', 'Pin to the screen');
    sub.style.cssText = 'width:0;height:0;overflow:hidden';
    ['For myself only', 'For everyone'].forEach(function (word) {
      var li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      li.textContent = word;
      sub.appendChild(li);
    });
    menu.appendChild(sub);

    inner.appendChild(menu);
    floater.appendChild(inner);
    portal.appendChild(floater);
    document.body.appendChild(portal);
    portal.setAttribute('data-portal', 'menu');
  }

  /* Confirmation with NO role="dialog", also portalled under <body>. */
  function askConfirm(person) {
    var portal = document.createElement('div');
    var box = document.createElement('div');
    box.className = 'zSraLe';
    box.style.cssText = 'position:fixed;top:140px;left:40px;width:300px;height:130px;background:#fff;border:1px solid #333';

    var heading = document.createElement('h2');
    heading.textContent = 'Remove ' + person.name + ' from the call?';
    box.appendChild(heading);

    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'width:80px;height:30px';
    cancel.addEventListener('click', function () { clearPortals(); });
    box.appendChild(cancel);

    var confirm = document.createElement('button');
    confirm.textContent = 'Remove';
    confirm.style.cssText = 'width:80px;height:30px';
    confirm.addEventListener('click', function () {
      clearPortals();
      setTimeout(function () { drop(person.id); }, 200);
    });
    box.appendChild(confirm);

    portal.appendChild(box);
    document.body.appendChild(portal);
    portal.setAttribute('data-portal', 'confirm');
  }

  function drop(id) {
    var row = rowOf(id);
    if (row) row.remove();
    var tile = tileWrap.querySelector('[data-participant-id="' + CSS.escape(id) + '"]');
    if (tile) tile.remove();
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') clearPortals();
  });

  /* ---------- chrome.* test double ---------- */

  var messageListeners = [];
  var connectListeners = [];

  function makePort(name) {
    var onMessage = [];
    var onDisconnect = [];
    return {
      name: name,
      peer: null,
      onMessage: { addListener: function (fn) { onMessage.push(fn); } },
      onDisconnect: { addListener: function (fn) { onDisconnect.push(fn); } },
      postMessage: function (message) {
        var peer = this.peer;
        setTimeout(function () { peer._deliver(message); }, 0);
      },
      disconnect: function () {
        var peer = this.peer;
        setTimeout(function () { peer._closed(); }, 0);
      },
      _deliver: function (message) { onMessage.slice().forEach(function (fn) { fn(message); }); },
      _closed: function () { onDisconnect.slice().forEach(function (fn) { fn(); }); }
    };
  }

  var sentMessages = [];

  window.chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener: function (fn) { messageListeners.push(fn); } },
      onConnect: { addListener: function (fn) { connectListeners.push(fn); } },
      sendMessage: function (message) { sentMessages.push(message); }
    },
    storage: {
      sync: { get: function (defaults, callback) { setTimeout(function () { callback(defaults); }, 0); } }
    }
  };

  window.harness = {
    people: PEOPLE,
    idOf: function (key) { return SPACE + key; },
    panelOpens: function () { return panelOpens; },
    panelExists: function () { return !!panel; },
    strayClicks: function () { return strayClicks.slice(); },
    remaining: function () {
      return panel ? Array.prototype.map.call(panel.querySelectorAll('[data-participant-id]'), function (n) {
        return n.getAttribute('data-participant-id').slice(-3);
      }) : [];
    },
    portals: function () { return document.querySelectorAll('[data-portal]').length; },
    sentMessages: function () { return sentMessages.slice(); },
    peopleChip: function () { return chip; },
    chipGrid: function () { return grid; },
    /* The one thing a cell in Meet's grid cannot survive: a template that
     * gives our track no width at all. */
    squashGrid: function () { grid.style.gridAutoColumns = '0'; },
    headerBadge: function () { return badge.control; },
    send: function (message) {
      return new Promise(function (resolve) {
        for (var i = 0; i < messageListeners.length; i++) {
          if (messageListeners[i](message, {}, resolve) === true) return;
        }
      });
    },
    connect: function () {
      var client = makePort('remove-bots');
      var server = makePort('remove-bots');
      client.peer = server;
      server.peer = client;
      connectListeners.slice().forEach(function (fn) { fn(server); });
      return client;
    }
  };
})();
