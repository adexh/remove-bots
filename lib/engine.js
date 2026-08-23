/*
 * What the extension actually does: read the participants, and remove the ones
 * that were selected. Speaks only through the Meet adapter, so it holds no selectors.
 */
import * as bots from './bots.js';
import * as dom from './dom.js';
import * as meet from './meet.js';


var SETTLE_BETWEEN_REMOVALS_MS = 450;
var HOVER_SETTLE_MS = 150;
var MENU_TIMEOUT_MS = 3000;
var CONFIRM_TIMEOUT_MS = 3000;
var DEPARTURE_TIMEOUT_MS = 8000;

function loadSettings() {
  return new Promise(function (resolve) {
    try {
      chrome.storage.sync.get(bots.DEFAULTS, function (stored) {
        resolve(stored || bots.DEFAULTS);
      });
    } catch (err) {
      resolve(bots.DEFAULTS);
    }
  });
}

function describe(row, settings) {
  var name = meet.participantName(row) || 'Unnamed participant';
  var self = meet.isSelf(row);
  var verdict = self
    ? { isBot: false, tier: 'self', label: 'That is you', builtin: false }
    : bots.classify(name, settings);

  return {
    id: row.getAttribute('data-participant-id'),
    name: name,
    isBot: verdict.isBot,
    tier: verdict.tier,
    reason: verdict.label,
    builtin: verdict.builtin,
    self: self,
    visitor: meet.isVisitor(row),
    removable: !self && !verdict.builtin && !!meet.moreButton(row)
  };
}

/**
 * List everyone in the call and classify them.
 *
 * `source` tells the popup where the list came from: "panel" is complete,
 * "tiles" means the panel would not open and only on-screen participants
 * could be named, so the list may be short and removal will not work yet.
 *
 * `role` says whether this user looks able to remove anyone at all, so the
 * panel can say so before a run rather than after it fails. Read here, with
 * the roster open, because that is where the evidence is.
 */
async function scan() {

  if (!meet.inCall()) {
    return { ok: false, code: 'NOT_IN_CALL', message: 'Join the meeting first, then scan again.' };
  }

  await meet.ensurePanel();

  var rows = meet.rosterRows();
  var source = 'panel';
  if (!rows.length) {
    rows = meet.tiles();
    source = 'tiles';
  }
  if (!rows.length) {
    return {
      ok: false,
      code: 'NO_PANEL',
      message: 'Could not read the participants list. Open the People panel in Meet, then scan again.'
    };
  }

  var settings = await loadSettings();
  var participants = rows.map(function (row) { return describe(row, settings); });

  /* Ownership needs the self row's name, so it is stamped after the map. */
  var self = participants.filter(function (p) { return p.self; })[0];
  participants.forEach(function (p) {
    p.owned = !!(p.isBot && !p.self && self && bots.ownedBy(p.name, self.name));
  });

  var host = meet.hostRole();

  return {
    ok: true,
    participants: participants,
    total: participants.length,
    source: source,
    role: host.role,
    roleWhy: host.why,
    showHumans: !!settings.showHumans
  };
}

/* ---------- removal ---------- */

function outcome(id, name, status, message) {
  var result = { id: id, name: name, status: status };
  if (message) result.message = message;
  return result;
}

/**
 * Remove one participant: open their row menu, click the remove entry, then
 * confirm if Meet asks.
 *
 * Every failure returns a reason rather than throwing, because a partial run
 * still needs to report per-row status to the popup.
 */
async function removeOne(id) {

  var row = meet.findRow(id);
  if (!row) return outcome(id, '', 'gone', 'Already left the meeting');

  var name = meet.participantName(row);

  row.scrollIntoView({ block: 'center' });
  dom.hover(row);
  await dom.sleep(HOVER_SETTLE_MS);

  /* Re-find the row: hovering can re-render it. */
  var button = meet.moreButton(meet.findRow(id) || row);
  if (!button) return outcome(id, name, 'error', 'No options menu on this row');

  dom.click(button);

  var removeEntry = null;
  try {
    removeEntry = await dom.waitFor(meet.findRemoveEntry, { timeout: MENU_TIMEOUT_MS });
  } catch (err) {
    /* Nothing matched: either the menu never opened, or it has no remove
     * entry because host controls are limited for this user. */
  }

  if (!removeEntry) {
    dom.pressEscape();
    return outcome(id, name, 'error',
      'No remove option in this menu. Host controls may be limited for you.');
  }

  dom.click(removeEntry);

  /*
   * Meet may or may not confirm, and when it does the dialog is portalled
   * without role="dialog". So wait for whichever happens first: the row
   * disappearing, or a confirm control appearing.
   */
  try {
    var next = await dom.waitFor(function () {
      if (!meet.findRow(id)) return 'gone';
      return meet.findOverlayAction(meet.LABELS.remove, removeEntry) || null;
    }, { timeout: CONFIRM_TIMEOUT_MS });
    if (next !== 'gone') dom.click(next);
  } catch (err) {
    /* Neither happened; the departure check below decides the outcome. */
  }

  try {
    await dom.waitFor(function () { return !meet.findRow(id); }, { timeout: DEPARTURE_TIMEOUT_MS });
    return outcome(id, name, 'removed');
  } catch (err) {
    return outcome(id, name, 'error', 'Still in the meeting after removing');
  }
}

/**
 * Remove each id in turn, reporting progress through `emit`.
 *
 * Serial on purpose: Meet re-renders the roster after each removal, and
 * overlapping menus would fight over the same portal.
 */
async function removeMany(ids, emit) {
  /* Removal drives the roster rows, so the panel has to be open first. */
  if (!await meet.ensurePanel()) {
    ids.forEach(function (id, index) {
      emit(Object.assign(
        { type: 'ITEM_DONE', index: index, total: ids.length },
        outcome(id, '', 'error', 'Open the People panel in Meet, then try again')
      ));
    });
    emit({ type: 'ALL_DONE', results: [] });
    return [];
  }

  var results = [];
  for (var i = 0; i < ids.length; i++) {
    emit({ type: 'ITEM_START', id: ids[i], index: i, total: ids.length });

    var result;
    try {
      result = await removeOne(ids[i]);
    } catch (err) {
      result = outcome(ids[i], '', 'error', String((err && err.message) || err));
    }

    results.push(result);
    emit(Object.assign({ type: 'ITEM_DONE', index: i, total: ids.length }, result));
    await dom.sleep(SETTLE_BETWEEN_REMOVALS_MS);
  }

  emit({ type: 'ALL_DONE', results: results });
  return results;
}

export { scan, removeOne, removeMany };
