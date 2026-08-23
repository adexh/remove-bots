/*
 * Wires the captured Meet page (test/meet-real-body.html) into a working fake
 * call, for test/fake-meet-manual.html.
 *
 * Where harness-stub.js BUILDS a plain-looking Meet out of nothing, this one
 * ADOPTS a real page: the tiles, header chips and toolbar are Meet's own
 * captured markup, pixel-styled by test/meet-real.css. Only what the capture
 * cannot contain is added: roster rows (the People panel was closed when the
 * page was saved, so Meet had rendered none), the row menus, and the confirm
 * step, all built with the class names and structure recorded from the live
 * panel in harness-stub.js.
 *
 * Same cast and the same scenario globals as the stub: __MANY__, __GUEST__,
 * __BARE__. No module syntax, so the page opens over file:// with no build.
 */
(function () {
  'use strict';

  var GUEST = !!window.__GUEST__;
  var BARE = !!window.__BARE__;
  var MANY = Number(window.__MANY__) || 0;

  var SPACE = 'spaces/KEi-HMinAxkB/devices/';

  var PEOPLE = [
    { key: '113', name: 'Adesh Tamrakar', self: true, host: !GUEST, tile: '193' },
    { key: '114', name: "Adesh's Fathom Notetaker", visitor: true, tile: '195', confirm: 'overlay' },
    { key: '115', name: "Adesh's Otter.ai Notetaker", visitor: true, confirm: 'none' },
    { key: '116', name: 'Ada Lovelace', host: GUEST, tile: '194' },
    { key: '117', name: 'Sarah (Notes)', visitor: true, noRemove: true }
  ];

  if (MANY) {
    var VENDORS = [
      "Adesh's Otter.ai Notetaker", 'Fireflies.ai Notetaker', 'Fathom Notetaker',
      'Read AI Notetaker', 'tl;dv recorder', 'Avoma Assistant', 'Gong.io Notetaker',
      'Spinach.io', 'Sembly AI', 'Circleback Notetaker', 'MeetGeek.ai',
      'Supernormal Notetaker', 'Fellow.app', 'Sybill AI', 'Bluedot recorder',
      'Colibri.ai', 'Airgram', 'Noota', 'Grain', 'Laxis', 'Wudpecker',
      'Scribbl', 'Rewatch', 'Vowel', 'Clari Copilot'
    ];
    for (var n = 0; n < MANY; n++) {
      PEOPLE.push({
        key: String(200 + n),
        name: VENDORS[n % VENDORS.length] + ' ' + (Math.floor(n / VENDORS.length) + 1),
        visitor: true
      });
    }
  }

  PEOPLE.forEach(function (person) { person.id = SPACE + person.key; });

  /* ---------- adopting the captured tiles ---------- */

  /*
   * The capture holds three real tiles: Adesh's self view (193), Adesh through
   * the remote camera (194) and the Fathom bot (195). The remote-camera tile
   * is renamed to play Ada Lovelace, so the cast has a human who is not you,
   * and every tile's participant id is rewritten onto the cast's ids so the
   * two DOM sources agree about who is in the call.
   */
  function renameTextIn(root, from, to) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (node.nodeValue.indexOf(from) !== -1) {
        node.nodeValue = node.nodeValue.split(from).join(to);
      }
    }
    var all = root.querySelectorAll('[aria-label]');
    for (var i = 0; i < all.length; i++) {
      var label = all[i].getAttribute('aria-label');
      if (label.indexOf(from) !== -1) all[i].setAttribute('aria-label', label.split(from).join(to));
    }
  }

  function adoptTiles() {
    PEOPLE.forEach(function (person) {
      if (!person.tile) return;
      var tile = document.querySelector('[data-participant-id="' + SPACE + person.tile + '"]');
      if (!tile) return;
      ['data-participant-id', 'data-requested-participant-id', 'data-tile-media-id']
        .forEach(function (attr) {
          if (tile.hasAttribute(attr)) tile.setAttribute(attr, person.id);
        });
      if (person.key === '116') renameTextIn(tile, 'Adesh Tamrakar', person.name);
      person.tileNode = tile;
    });
  }

  /* ---------- the header chip ---------- */

  /* The chip whose hidden label reads "People", never the "External
   * participants joined" badge that is built the same way. */
  function peopleChip() {
    var chips = document.querySelectorAll('[jsname="ocqpFe"][role="button"]');
    for (var i = 0; i < chips.length; i++) {
      var ref = chips[i].getAttribute('aria-labelledby');
      var label = ref && document.getElementById(ref.split(/\s+/)[0]);
      if (label && /^people\b/i.test(label.textContent.trim())) return chips[i];
    }
    return null;
  }

  function refreshCount() {
    var chip = peopleChip();
    if (!chip) return;
    var badge = chip.querySelector('.fdZ55');
    if (!badge) return;
    /* The badge nests its number; replace the deepest text with the count. */
    var walker = document.createTreeWalker(badge, NodeFilter.SHOW_TEXT);
    var numeric = null;
    while (walker.nextNode()) {
      if (/^\s*\d+\s*$/.test(walker.currentNode.nodeValue)) numeric = walker.currentNode;
    }
    var count = String(PEOPLE.filter(function (p) { return !p.gone; }).length);
    if (numeric) numeric.nodeValue = count;
    else badge.appendChild(document.createTextNode(count));
  }

  /* ---------- the People panel ---------- */

  var panel = null;
  var panelOpens = 0;

  function openPanel() {
    var chip = peopleChip();
    if (panel) {
      panel.remove();
      panel = null;
      if (chip) chip.setAttribute('aria-expanded', 'false');
      return;
    }
    panelOpens++;
    if (chip) chip.setAttribute('aria-expanded', 'true');

    panel = document.createElement('div');
    panel.className = 'rb-people';
    panel.setAttribute('data-panel', 'people');

    var head = document.createElement('div');
    head.className = 'rb-people-head';
    var title = document.createElement('h2');
    title.textContent = 'People';
    head.appendChild(title);
    var close = document.createElement('button');
    close.className = 'rb-people-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', openPanel);
    head.appendChild(close);
    panel.appendChild(head);

    var section = document.createElement('div');
    section.className = 'rb-people-section';
    section.textContent = 'In call';
    panel.appendChild(section);

    var list = document.createElement('div');
    list.setAttribute('role', 'list');
    list.className = 'rb-people-list';
    PEOPLE.forEach(function (person) {
      if (!person.gone) list.appendChild(buildRow(person));
    });
    panel.appendChild(list);

    document.body.appendChild(panel);
  }

  /*
   * A roster row, structured the way the live panel builds them: one class for
   * humans and bots alike, the name in the row's aria-label, badges and the
   * icon-font glyph words as sibling leaf spans, and the overflow button
   * carrying more_vert as its text.
   */
  function buildRow(person) {
    var row = document.createElement('div');
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-label', person.name);
    /* These row classes are safe to wear with meet-real.css loaded, unlike
     * the menu classes: they carry no animation state, and keeping them means
     * the rows read as Meet's own to both the stylesheet and the extension. */
    row.className = 'cxdMu KV1GEc';
    row.setAttribute('jscontroller', 'ZHOeze');
    row.setAttribute('data-participant-id', person.id);
    row.setAttribute('data-scroll-target', person.id);

    var avatar = document.createElement('span');
    avatar.className = 'rb-avatar';
    avatar.textContent = (person.name.replace(/^Adesh's /, '').charAt(0) || '?').toUpperCase();
    row.appendChild(avatar);

    var body = document.createElement('span');
    body.className = 'rb-row-name';
    var name = document.createElement('span');
    name.textContent = person.name;
    body.appendChild(name);

    var badges = [];
    if (person.self) badges.push('(You)');
    if (person.host) badges.push('Meeting host');
    if (person.visitor) badges.push('Visitor');
    badges.forEach(function (word) {
      var chipSpan = document.createElement('span');
      chipSpan.className = 'rb-badge';
      chipSpan.textContent = word;
      body.appendChild(chipSpan);
    });
    row.appendChild(body);

    if (person.visitor) {
      var glyph = document.createElement('span');
      glyph.className = 'google-material-icons rb-glyph';
      glyph.textContent = 'domain_disabled';
      row.appendChild(glyph);
    }
    var devices = document.createElement('span');
    devices.className = 'google-material-icons rb-glyph';
    devices.textContent = 'devices';
    row.appendChild(devices);

    if (person.visitor) {
      var mute = document.createElement('button');
      mute.className = 'VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ T08Bz rb-iconbtn';
      mute.setAttribute('aria-label', "You can't unmute someone else");
      mute.disabled = true;
      mute.textContent = 'mic_off';
      row.appendChild(mute);
    }

    var more = document.createElement('button');
    more.className = 'VYBDae-Bz112c-LgbsSe hk9qKe t2FmWe mcyM9d rb-iconbtn';
    more.setAttribute('jsname', 'YEvVxd');
    more.setAttribute('aria-label', 'More actions');
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.textContent = 'more_vert';
    more.addEventListener('click', function (event) {
      event.stopPropagation();
      openRowMenu(person, more);
    });
    row.appendChild(more);

    return row;
  }

  /* ---------- row menu and confirm, portalled like Meet's ---------- */

  function clearPortals() {
    Array.prototype.slice.call(document.body.children).forEach(function (node) {
      if (node.hasAttribute && node.hasAttribute('data-portal')) node.remove();
    });
  }

  function openRowMenu(person, anchor) {
    clearPortals();

    var portal = document.createElement('div');
    var floater = document.createElement('div');
    /* Structure and roles as Meet portals them, but NOT Meet's own menu
     * classes: with meet-real.css loaded those carry the closed state of
     * Meet's animation (zero size until opened), so a menu wearing them
     * never becomes visible. The rb-menu styles play the open state. */
    floater.className = 'rb-menu';
    var box = anchor.getBoundingClientRect();
    floater.style.position = 'fixed';
    floater.style.top = Math.min(box.bottom + 4, window.innerHeight - 220) + 'px';
    floater.style.right = Math.max(window.innerWidth - box.right, 8) + 'px';

    var inner = document.createElement('div');
    inner.setAttribute('jsname', 'SDSjce');
    inner.className = 'tB5Jxf-xl07Ob-S5Cmsd';

    var menu = document.createElement('ul');
    menu.className = 'rb-menu-list';
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
    /* Meet simply leaves the entry out for someone who cannot remove. */
    if (!person.noRemove && !GUEST) entries.push(['remove_circle_outline', 'Remove from the call']);

    entries.forEach(function (pair) {
      var li = document.createElement('li');
      li.className = 'rb-menu-item';
      li.setAttribute('role', 'menuitem');
      li.setAttribute('tabindex', '-1');
      li.setAttribute('jsname', 'BUtajd');
      li.setAttribute('aria-label', pair[1]);

      var glyph = document.createElement('i');
      glyph.className = 'google-material-icons';
      glyph.textContent = pair[0];
      li.appendChild(glyph);

      var outer = document.createElement('span');
      var label = document.createElement('span');
      label.setAttribute('jsname', 'K4r5Ff');
      label.textContent = pair[1];
      outer.appendChild(label);
      li.appendChild(outer);

      li.addEventListener('click', function () {
        clearPortals();
        if (pair[1] !== 'Remove from the call') return;
        if (person.confirm === 'overlay') askConfirm(person);
        else drop(person);
      });
      menu.appendChild(li);
    });

    inner.appendChild(menu);
    floater.appendChild(inner);
    portal.appendChild(floater);
    document.body.appendChild(portal);
    portal.setAttribute('data-portal', 'menu');
  }

  /* Confirmation with NO role="dialog", exactly as the live build portals it. */
  function askConfirm(person) {
    var portal = document.createElement('div');
    var box = document.createElement('div');
    box.className = 'rb-confirm';

    var heading = document.createElement('h2');
    heading.textContent = 'Remove ' + person.name + ' from the call?';
    box.appendChild(heading);

    var note = document.createElement('p');
    note.textContent = 'They will not be able to rejoin unless someone lets them back in.';
    box.appendChild(note);

    var actions = document.createElement('div');
    actions.className = 'rb-confirm-actions';
    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', clearPortals);
    actions.appendChild(cancel);

    var confirm = document.createElement('button');
    confirm.className = 'rb-confirm-go';
    confirm.textContent = 'Remove';
    confirm.addEventListener('click', function () {
      clearPortals();
      setTimeout(function () { drop(person); }, 200);
    });
    actions.appendChild(confirm);
    box.appendChild(actions);

    portal.appendChild(box);
    document.body.appendChild(portal);
    portal.setAttribute('data-portal', 'confirm');
  }

  function drop(person) {
    person.gone = true;
    if (panel) {
      var row = panel.querySelector('[data-participant-id="' + CSS.escape(person.id) + '"]');
      if (row) row.remove();
    }
    if (person.tileNode) person.tileNode.remove();
    refreshCount();
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') clearPortals();
  });

  /* ---------- scenarios that change the captured chrome ---------- */

  function applyGuest() {
    if (!GUEST) return;
    /* Meet shows Host controls to hosts and co-hosts only. */
    Array.prototype.forEach.call(
      document.querySelectorAll('[aria-label*="Host controls" i]'),
      function (node) { node.remove(); }
    );
  }

  /*
   * Bare: the worst case for the button's placement, a cold join before Meet
   * has rendered anything to dock beside. The header hides as a whole; the
   * call controls cannot be hidden by container, because the capture nests
   * them ten deep with no marker, so every control whose name the placement
   * logic would anchor to is hidden individually. The header returns a few
   * seconds later, for the float-then-relocate path.
   */
  function applyBare() {
    if (!BARE) return;
    var chip = peopleChip();
    var header = chip && chip.closest('.YDkhgc');
    if (header) header.style.display = 'none';

    var anchorish = /chat|meeting tools|host controls|activities|more options|people|participants/i;
    Array.prototype.forEach.call(
      document.querySelectorAll('button[aria-label], [role="button"][aria-label]'),
      function (node) {
        if (header && header.contains(node)) return;
        if (anchorish.test(node.getAttribute('aria-label'))) node.style.display = 'none';
      }
    );

    setTimeout(function () {
      if (header) header.style.display = '';
    }, 4000);
  }

  /* ---------- go ---------- */

  function wire() {
    adoptTiles();
    applyGuest();
    applyBare();
    refreshCount();
    var chip = peopleChip();
    if (chip) chip.addEventListener('click', openPanel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  /* A hand on the scenery for smoke scripts, mirroring harness-stub. */
  window.harness = {
    people: PEOPLE,
    idOf: function (key) { return SPACE + key; },
    panelExists: function () { return !!panel; },
    panelOpens: function () { return panelOpens; },
    portals: function () { return document.querySelectorAll('[data-portal]').length; },
    remaining: function () {
      return PEOPLE.filter(function (p) { return !p.gone; })
        .map(function (p) { return p.key; });
    }
  };
})();
