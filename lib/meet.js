/*
 * Everything that knows how Google Meet is built.
 *
 * When a Meet update breaks this extension, the fix is almost certainly in the
 * SELECTORS or LABELS tables below. They are deliberately the first thing in
 * the file, and every non-obvious entry says which real-world detail forced it.
 * The DOM facts behind them are captured in test/harness-stub.js, so a change
 * here can be checked with `node test/run-dom.mjs` before touching a live call.
 */
import * as dom from './dom.js';


const SELECTORS = {
  /* Roster rows in the People panel. Video tiles carry data-participant-id
   * too, so this must stay narrow: a looser match picks up a tile, makes the
   * panel look open, and reports almost no participants. */
  rosterRow: '[role="listitem"][data-participant-id]',
  rosterRowFallback: '[role="list"] [data-participant-id], [role="listitem"] [data-participant-id]',

  /* Any participant node at all, tiles included. Read-only fallback. */
  anyParticipant: '[data-participant-id]',

  /* Candidates for the control that opens the People panel. jsname="ocqpFe"
   * is the current header chip; it is a hint, not a requirement, because
   * generated names churn. */
  peopleControl: 'button, [role="button"], [role="tab"], [jsname="ocqpFe"]',

  /* The region holding the top-right chips: the participant count, the
   * notification badges, and the cell we add for our own button. Matched
   * structurally, then confirmed by computed display, because its aria-label
   * ("Call feature notifications and actions") is localised. */
  chipGrid: '[role="region"]',

  rowControls: 'button, [role="button"]',

  /* Anything with an accessible name we can read, for looking up a control by
   * what a screen reader would call it. aria-labelledby is included because
   * Meet names several header controls that way and nothing else. */
  namedControl: 'button[aria-label], [role="button"][aria-label], ' +
    'button[aria-labelledby], [role="button"][aria-labelledby]',

  menu: '[role="menu"], [role="listbox"]',
  menuEntry: '[role="menuitem"], [role="menuitemradio"], [role="option"], li',
  dialog: '[role="dialog"], [role="alertdialog"]',
  leaveCall: 'button[aria-label*="leave call" i], button[aria-label*="hang up" i]',
  selfMarker: '[data-is-self="true"]',
  selfName: '[data-self-name]'
};

const LABELS = {
  /* "Remove from the call" in the current build, "Remove from meeting" in
   * older ones, plus the other locales we know the wording for. */
  remove: /\bremove\b|\bexpulsar\b|\bentfernen\b|\bsupprimer\b|\bretirer\b|\brimuovi\b|\bremover\b|\bverwijderen\b|\bfjern\b|\bta bort\b|\bpoista\b|\busu(?:ń|n)\b|\bудалить\b|\bвиключити\b|\b削除\b|\b退出させ\b|\b移除\b|\b移出\b|\b삭제\b|\b내보내기\b|\bkaldır\b|\bhapus\b|\bkeluarkan\b|\bإزالة\b/i,

  /* Checked before `remove`, so a "Cancel" button can never be mistaken for
   * the confirm button. */
  cancel: /\bcancel\b|\bcancelar\b|\bannuler\b|\babbrechen\b|\bannulla\b|\bannuleren\b|\bavbryt\b|\bотмена\b|\bキャンセル\b|\b取消\b|\b취소\b|\biptal\b|\bbatal\b|\bإلغاء\b|\bback\b|\bkeep\b/i,

  people: /\bpeople\b|\bparticipants?\b|\bshow everyone\b|\beveryone\b|\bpersonas\b|\bparticipantes\b|\bteilnehmer\b|\bpersonen\b|\bpersone\b|\bpessoas\b|\bлюди\b|\bучастники\b|\b参加者\b|\bユーザー\b|\b参会者\b|\b成员\b|\b참여자\b|\bkatılımcı\b|\borang\b|\bالأشخاص\b/i,

  /* The chat button's label is "Chat with everyone", which matches `people`
   * above and also announces a popup, so it has to be excluded explicitly.
   *
   * "External participants joined" is the same trap in the header: a
   * notification badge built exactly like the People chip, down to the jsname
   * and aria-haspopup, and earlier in document order. Clicking it opens
   * nothing, and docking beside it put our button inside the badge. */
  notPeople: /\bchat\b|\bmessages?\b|\bsend\b|\bjoined\b|\bleft\b|\bexternal\b/i,

  moreOptions: /more|option|menu|acci|weitere|plus|altre|mais|ещё|еще|その他|更多|더보기|diğer|lainnya|المزيد/i,

  /* Meet's icon font renders as literal text, so the overflow button's
   * innerText is the glyph name. This is the most reliable way to find it. */
  overflowGlyph: /more_vert|more_horiz/,

  /* Marks an account-less guest. Bots join this way, but so do human guests,
   * so this is shown as context and never used to classify. */
  visitorToken: /^(?:domain_disabled|visitor)$/i,

  selfChip: /^(?:you|\(you\)|you \(host\))$/i,

  /* "More options for Ada Lovelace" -> "Ada Lovelace" */
  nameFromControl: /(?:^|\s)(?:for|of|de|para|von|di|voor|för|для|van)\s+(.+)$/i,

  meetingCodePath: /\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,

  /* Call-control buttons, used as a second place to dock our own button when
   * the header chip is not available. */
  toolbarNeighbour: /\bchat\b|\bmeeting tools\b|\bhost controls\b|\bactivities\b|\bmore options\b/i,

  /*
   * Badges that mark a roster row as someone who can remove people: the host,
   * and any co-host they have promoted.
   *
   * Matched against whole leaf strings, like nameNoise, because "host" on its
   * own is an ordinary word that turns up inside real sentences. The
   * non-English entries are the usual word for a meeting host in each
   * language rather than verified captures; wording we do not have falls
   * through to "unknown", which warns about nothing.
   */
  hostBadge: new RegExp('^(?:' + [
    'meeting host', 'host', 'co-?host', 'you \\(host\\)', '\\(you\\) \\(host\\)',
    'anfitri[oó]n', 'organizador(?:a)?', 'anfitri[aã]o', 'organisateur',
    'moderator(?:in)?', 'gastgeber(?:in)?', 'gastheer', 'organizzatore',
    'ведущий', 'организатор', '主催者', 'ホスト', '主持人', '會議主持人',
    '주최자', '호스트', 'toplantı sahibi', 'penyelenggara', 'tuan rumah', 'مضيف'
  ].join('|') + ')$', 'i'),

  /*
   * The call control that opens Meet's host controls. Meet renders it for the
   * host and co-hosts only, which makes its presence the second signal that
   * this user can remove people.
   *
   * English wording only, deliberately: a wrong guess here would read as
   * "you are the host" and suppress the warning. Other locales fall through
   * to the badge signal above.
   */
  hostControls: /\bhost controls?\b|\bhost management\b/i
};

/*
 * Text that sits beside a name without being part of it: status chips, the
 * Visitor badge, and icon-font glyph words. Matched against whole leaf
 * strings, so entries are exact rather than substrings.
 */
LABELS.nameNoise = new RegExp('^(?:' + [
  'you', '\\(you\\)', 'you \\(host\\)', 'meeting host', 'host', 'co-?host',
  'presenting', 'presentation', 'pinned', 'muted', 'unmuted', 'joined', 'calling',
  'contributor', 'viewer', 'guest', 'invited', 'in the meeting', 'screen share',
  'visitor', 'more actions', 'more options', 'reframe', 'backgrounds and effects',
  'pin to the screen', 'ask to pair your tiles', "don't watch", 'remove from the call',
  'for myself only', 'for everyone', "you can't unmute someone else",
  /* icon-font glyph words */
  'devices', 'more_vert', 'more_horiz', 'domain_disabled', 'frame_person',
  'visual_effects', 'remove_circle_outline', 'videocam_off', 'keep', 'link',
  'chat', 'apps', 'lock_person', 'people', 'group', 'push_pin', 'mic_off'
].join('|') + ')$', 'i');

/* ---------- reading the roster ---------- */

/** Roster rows, and only roster rows. Never video tiles. */
function rosterRows() {
  var rows = document.querySelectorAll(SELECTORS.rosterRow);
  if (rows.length) return dom.dedupeBy(rows, 'data-participant-id');
  return dom.dedupeBy(
    document.querySelectorAll(SELECTORS.rosterRowFallback),
    'data-participant-id'
  );
}

/**
 * Video tiles, used only to name participants when the panel will not open.
 * Removal always needs the roster, so this never feeds it.
 */
function tiles() {
  if (rosterRows().length) return [];
  return dom.dedupeBy(
    Array.prototype.filter.call(
      document.querySelectorAll(SELECTORS.anyParticipant),
      function (node) {
        return !node.closest('[role="listitem"]') && dom.text(node).length < 400;
      }
    ),
    'data-participant-id'
  );
}

function findRow(id) {
  var rows = rosterRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].getAttribute('data-participant-id') === id) return rows[i];
  }
  return null;
}

/**
 * Best available display name for a row.
 *
 * The row's own aria-label is by far the cleanest source: it holds exactly
 * "Adesh's Fathom Notetaker" where textContent holds that plus every badge
 * and glyph word. The rest are fallbacks for tiles and older builds.
 */
function participantName(row) {
    var candidates = [];

  var selfName = row.querySelector(SELECTORS.selfName);
  if (selfName) candidates.push(selfName.getAttribute('data-self-name'));
  if (row.hasAttribute('data-self-name')) candidates.push(row.getAttribute('data-self-name'));

  var aria = row.getAttribute('aria-label');
  if (aria) candidates.push(aria);

  Array.prototype.forEach.call(
    row.querySelectorAll('button[aria-label], [role="button"][aria-label]'),
    function (button) {
      var match = LABELS.nameFromControl.exec(button.getAttribute('aria-label') || '');
      if (match) candidates.push(match[1].trim());
    }
  );

  var avatar = row.querySelector('img[alt]');
  if (avatar) candidates.push(avatar.getAttribute('alt'));

  /* Longest leaf line wins: a real name is longer than the badges beside it. */
  var lines = dom.leafTexts(row).filter(function (line) {
    return line.length < 80 && !LABELS.nameNoise.test(line);
  });
  lines.sort(function (a, b) { return b.length - a.length; });

  return candidates.concat(lines).reduce(function (found, candidate) {
    if (found) return found;
    var value = (candidate || '').replace(/\s+/g, ' ').trim();
    return (value && value.length < 120 && !LABELS.nameNoise.test(value)) ? value : '';
  }, '');
}

function isSelf(row) {
  if (row.querySelector(SELECTORS.selfMarker)) return true;
  if (row.getAttribute('data-is-self') === 'true') return true;
  return dom.leafTexts(row).some(function (line) { return LABELS.selfChip.test(line); });
}

function isVisitor(row) {
  return dom.leafTexts(row).some(function (line) { return LABELS.visitorToken.test(line); });
}

/**
 * The row's overflow ("More actions") control.
 *
 * Deliberately refuses to guess when several buttons are present: clicking
 * the wrong one would pin or mute a participant instead of opening a menu.
 */
function moreButton(row) {
    var buttons = Array.prototype.filter.call(
    row.querySelectorAll(SELECTORS.rowControls),
    function (button) { return !button.disabled; }
  );

  for (var i = buttons.length - 1; i >= 0; i--) {
    if (LABELS.overflowGlyph.test(dom.text(buttons[i]))) return buttons[i];
  }

  var labelled = buttons.filter(function (button) {
    return button.getAttribute('aria-haspopup') ||
      LABELS.moreOptions.test((button.getAttribute('aria-label') || '') + ' ' + dom.text(button));
  });
  if (labelled.length) return labelled[labelled.length - 1];

  return buttons.length === 1 ? buttons[0] : null;
}

/* ---------- who you are in this call ---------- */

/** True when a row carries the host or co-host badge. */
function isHost(row) {
  return dom.leafTexts(row).some(function (line) { return LABELS.hostBadge.test(line); });
}

/**
 * Meet's "Host controls" call control, if this user has one.
 *
 * Disabled and aria-disabled nodes are rejected: a greyed-out control means
 * the feature exists in this build, not that it is ours to use.
 */
function hostControl() {
  var nodes = document.querySelectorAll(SELECTORS.namedControl);
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.disabled || node.getAttribute('aria-disabled') === 'true') continue;
    var name = dom.accessibleName(node);
    if (name && LABELS.hostControls.test(name) && dom.isVisible(node)) return node;
  }
  return null;
}

/**
 * Whether this user is in a position to remove anyone.
 *
 * Three answers, because two would lie. "host" and "guest" are only returned
 * on positive evidence; everything else is "unknown", which the UI treats as
 * "go ahead and try". Ranked by how much the signal can be trusted:
 *
 *   1. our own row is badged host or co-host  -> host
 *   2. Meet is showing us the host controls   -> host (covers co-hosts whose
 *      row carries no badge)
 *   3. our row has no badge but someone
 *      else's does                            -> guest
 *
 * Note that "guest" is not the same as "cannot remove": with host management
 * turned off, Meet lets any participant remove another. So this is worth a
 * warning and never worth a hard block.
 *
 * @returns {{role: 'host'|'guest'|'unknown', why: string}}
 */
function hostRole() {
  var rows = rosterRows();
  var self = null;
  var otherHost = false;

  for (var i = 0; i < rows.length; i++) {
    if (isSelf(rows[i])) {
      if (!self) self = rows[i];
    } else if (isHost(rows[i])) {
      otherHost = true;
    }
  }

  if (self && isHost(self)) {
    return { role: 'host', why: 'your row is badged as the meeting host' };
  }
  if (hostControl()) {
    return { role: 'host', why: 'Meet is showing you its host controls' };
  }
  if (self && otherHost) {
    return { role: 'guest', why: 'someone else is badged as the meeting host' };
  }
  /* No badge either way: a call with no host management, a virtualised roster
   * that has not rendered the host's row, or wording we do not know. */
  return { role: 'unknown', why: '' };
}

/* ---------- overlays ---------- */

/*
 * Meet portals menus and dialogs into an attribute-less <div> directly under
 * <body>: no class, no id, no role, nothing to select on. So overlay roots
 * are found by elimination, and their contents are matched by text.
 */
function overlayRoots() {
  return Array.prototype.filter.call(document.body.children, function (node) {
    var tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'MAIN') return false;
    /* Skip the app shell: it holds the roster and the video tiles. */
    if (node.querySelector(SELECTORS.anyParticipant) || node.querySelector('main')) return false;
    /* Note: visibility is NOT checked here. The portal wrapper's only child
     * is position:fixed, so the wrapper itself measures zero height and an
     * isVisible test would reject every overlay. Leaves are checked instead. */
    return true;
  });
}

function openMenu() {
  var menus = document.querySelectorAll(SELECTORS.menu);
  for (var i = menus.length - 1; i >= 0; i--) {
    if (dom.isVisible(menus[i])) return menus[i];
  }
  return null;
}

function menuEntries(menu) {
  return Array.prototype.filter.call(menu.querySelectorAll(SELECTORS.menuEntry), dom.isVisible);
}

/**
 * Smallest visible label in any overlay whose text matches, skipping
 * cancel-style wording. Used to find a menu entry when ARIA roles are absent,
 * and to find the confirm button, which has no role="dialog" to anchor on.
 *
 * Smallest wins so that a heading like "Remove Ada from the call?" never beats
 * the "Remove" button underneath it.
 */
function findOverlayAction(pattern, ignore) {
    var roots = overlayRoots();
  var best = null;
  var bestLength = Infinity;

  for (var r = 0; r < roots.length; r++) {
    var nodes = roots[r].querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.children.length > 2 || node.disabled) continue;
      /* The whole subtree of `ignore`, not just the node itself: on a page
       * that re-renders through a framework, the menu entry just clicked can
       * linger in the DOM for a frame, and its inner label would otherwise
       * win this scan and be clicked again, after the framework has already
       * detached it, where the click lands on nothing. */
      if (ignore && (node === ignore || ignore.contains(node))) continue;

      var own = dom.text(node);
      if (!own || own.length > 60 || own.length >= bestLength) continue;

      var label = own + ' ' + (node.getAttribute('aria-label') || '');
      if (LABELS.cancel.test(label) || !pattern.test(label)) continue;
      if (!dom.isVisible(node)) continue;

      bestLength = own.length;
      best = node;
    }
  }
  return best ? dom.clickableAncestor(best) : null;
}

function findRemoveEntry() {
    var menu = openMenu();
  if (menu) {
    var entries = menuEntries(menu);
    for (var i = 0; i < entries.length; i++) {
      var label = dom.text(entries[i]) + ' ' + (entries[i].getAttribute('aria-label') || '');
      if (LABELS.remove.test(label)) return entries[i];
    }
  }
  /* No role="menu" in this build, or no matching entry inside it. */
  return findOverlayAction(LABELS.remove, null);
}

/* ---------- opening the People panel ---------- */

/**
 * The control that opens the People panel.
 *
 * In the current build this is the participant-count chip in the top-right
 * header, not a toolbar button: a div[role="button"] with no aria-label,
 * named through aria-labelledby, carrying aria-haspopup="dialog". Matching on
 * the accessible name covers that and older toolbar buttons alike.
 */
function peopleControl() {
    var candidates = document.querySelectorAll(SELECTORS.peopleControl);
  var fallback = null;

  for (var i = 0; i < candidates.length; i++) {
    var node = candidates[i];
    if (!dom.isVisible(node) || node.disabled) continue;

    var name = dom.accessibleName(node) || dom.text(node);
    if (!name || !LABELS.people.test(name) || LABELS.notPeople.test(name)) continue;

    /* Prefer the one that announces it opens a panel. */
    if (node.getAttribute('aria-haspopup')) return node;
    if (!fallback) fallback = node;
  }
  return fallback;
}

/**
 * Meet's top-right chip grid, the one place in the header where a button of
 * ours can stand beside Meet's chips instead of inside one of them.
 *
 * Every chip in that region - the participant count and each notification
 * badge - sits two wrappers deep in its own grid cell, so inserting next to
 * the chip node lands in Meet's tooltip slot, under its animation controller.
 * A cell of our own is a sibling of theirs and owns its own layout.
 *
 * Reached through the chip rather than by aria-label, which is localised, and
 * only accepted if it really is a grid: appending a cell to something else
 * would stack our button on top of Meet's.
 */
function chipGrid() {
  var control = peopleControl();
  var region = control && control.closest(SELECTORS.chipGrid);
  if (!region || !dom.isVisible(region)) return null;

  var display = getComputedStyle(region).display;
  return display === 'grid' || display === 'inline-grid' ? region : null;
}

/**
 * Make sure the roster is rendered, opening the panel if needed.
 *
 * Meet renders the roster lazily: with the panel closed there are no
 * [role="listitem"] nodes at all, so nothing can be read or removed until it
 * is open. Three ways in, cheapest first.
 */
async function ensurePanel() {
    if (rosterRows().length) return true;

  var control = peopleControl();
  if (control) {
    dom.click(control);
    if (await settled(4000)) return true;

    /* The chip's own description says: press the down arrow to open it. */
    if (control.focus) control.focus();
    dom.sendKey(control, 'ArrowDown', 'ArrowDown', 40);
    if (await settled(2500)) return true;
  }

  /* Ctrl+Alt+P toggles the participants panel. */
  dom.sendKey(document, 'p', 'KeyP', 80, { ctrlKey: true, altKey: true });
  return settled(3000);
}

function settled(timeout) {
  return dom.waitFor(function () { return rosterRows().length; }, { timeout: timeout })
    .then(function () { return true; }, function () { return false; });
}

/**
 * A call-control button to dock beside, for when the header chip is missing.
 * Returns the last match so we land at the end of the row rather than in the
 * middle of Meet's controls.
 */
function toolbarAnchor() {
    var found = Array.prototype.filter.call(
    document.querySelectorAll('button[aria-label], [role="button"][aria-label]'),
    function (node) {
      var name = dom.accessibleName(node);
      return name && LABELS.toolbarNeighbour.test(name) && dom.isVisible(node);
    }
  );
  return found.length ? found[found.length - 1] : null;
}

function inCall() {
  return !!(
    document.querySelector(SELECTORS.anyParticipant) ||
    document.querySelector(SELECTORS.leaveCall) ||
    LABELS.meetingCodePath.test(location.pathname)
  );
}

export {
  SELECTORS, LABELS, rosterRows, tiles, findRow, participantName, isSelf, isVisitor,
  isHost, hostControl, hostRole,
  moreButton, overlayRoots, openMenu, menuEntries, findOverlayAction, findRemoveEntry,
  peopleControl, chipGrid, toolbarAnchor, ensurePanel, inCall
};
