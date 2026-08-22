/*
 * All UI state, held outside React.
 *
 * It lives outside because two things drive it that are not components: the
 * service worker (which toggles the panel when the toolbar icon is clicked) and
 * the placement loop (which reports when the button moves). Components read it
 * through useSyncExternalStore, so there is one source of truth either way.
 */
import * as engine from './engine.js';

const listeners = new Set();

let state = {
  open: false,
  scanning: false,
  running: false,
  participants: [],
  /** id -> true, for the tick boxes. */
  selected: {},
  /** id -> { phase, label, kind, message } while removing. */
  statuses: {},
  source: 'panel',
  summary: '',
  notice: '',
  /** Bumped whenever the button moves, so the panel can re-anchor. */
  placedAt: 0,
};

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/* ---------- selectors ---------- */

/** Bots we could actually remove: not you, not Meet's own assistant. */
export function removableBots(from) {
  return (from || state.participants).filter((p) => p.isBot && !p.builtin && !p.self);
}

export function selectedIds() {
  return state.participants.filter((p) => state.selected[p.id]).map((p) => p.id);
}

/** True while the engine is driving Meet's UI on our behalf. */
export function busy() {
  return state.scanning || state.running;
}

/* ---------- actions ---------- */

export function moved() {
  set({ placedAt: state.placedAt + 1 });
}

export function setOpen(open) {
  set({ open });
  if (open) scan();
}

export function toggle() {
  setOpen(!state.open);
}

export function isOpen() {
  return state.open;
}

export function select(id, on) {
  const selected = { ...state.selected };
  if (on) selected[id] = true;
  else delete selected[id];
  set({ selected });
}

export function selectAll(on) {
  const selected = { ...state.selected };
  removableBots().forEach((person) => {
    if (on) selected[person.id] = true;
    else delete selected[person.id];
  });
  set({ selected });
}

export function openOptions() {
  try {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  } catch (err) {
    /* Service worker asleep or context invalidated; nothing useful to do. */
  }
}

function summarise(participants) {
  const bots = removableBots(participants).length;
  if (!bots) {
    return (
      'No bots found among ' +
      participants.length +
      (participants.length === 1 ? ' participant.' : ' participants.')
    );
  }
  return (
    bots +
    (bots === 1 ? ' bot' : ' bots') +
    ' found in this meeting, out of ' +
    participants.length +
    ' participants.'
  );
}

export async function scan() {
  set({ scanning: true, notice: '', summary: 'Scanning the meeting...', statuses: {} });

  const response = await engine.scan();

  if (!response.ok) {
    set({
      scanning: false,
      participants: [],
      summary:
        response.code === 'NOT_IN_CALL'
          ? 'Not in a call yet.'
          : 'Could not read the participants.',
      notice: response.message || '',
    });
    return;
  }

  const participants = response.participants;
  const selected = {};
  participants.forEach((person) => {
    /* Everything detected as a bot starts ticked, minus Meet's own assistants
     * which cannot be removed this way. */
    if (person.isBot && !person.builtin && !person.self) selected[person.id] = true;
  });

  set({
    scanning: false,
    participants,
    selected,
    source: response.source,
    summary: summarise(participants),
    notice:
      response.source === 'tiles'
        ? 'Could not open the People panel, so this list came from the video tiles ' +
          'on screen and may be incomplete. Open People in Meet, then rescan.'
        : '',
  });
}

export async function removeSelected() {
  const ids = selectedIds();
  if (!ids.length) return;

  set({
    running: true,
    summary: 'Removing ' + ids.length + (ids.length === 1 ? ' bot...' : ' bots...'),
  });

  let removed = 0;
  let failed = 0;

  await engine.removeMany(ids, (event) => {
    if (event.type === 'ITEM_START') {
      set({
        statuses: { ...state.statuses, [event.id]: { phase: 'busy', label: 'removing' } },
      });
      return;
    }

    if (event.type === 'ITEM_DONE') {
      const gone = event.status === 'removed' || event.status === 'gone';
      if (gone) removed++;
      else failed++;

      set({
        statuses: {
          ...state.statuses,
          [event.id]: gone
            ? {
                phase: 'done',
                label: event.status === 'gone' ? 'had left' : 'removed',
                kind: 'ok',
              }
            : { phase: 'done', label: 'failed', kind: 'err', message: event.message || '' },
        },
      });
      return;
    }

    if (event.type === 'ALL_DONE') {
      set({
        running: false,
        selected: {},
        summary: failed
          ? removed + ' removed, ' + failed + ' failed.'
          : removed + (removed === 1 ? ' bot removed.' : ' bots removed.'),
        notice: failed
          ? 'Some removals did not go through. That usually means you are not the host, ' +
            'or the host has not enabled host controls for you.'
          : '',
      });
    }
  });
}
