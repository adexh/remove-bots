/*
 * In-page UI: a button in Meet's top-right chip grid, and the panel it opens.
 *
 * Living in the page means this talks to the engine directly, with no message
 * passing at all. Everything is rendered inside a shadow root so Meet's
 * stylesheet cannot reach in and ours cannot leak out.
 */
import * as engine from './engine.js';
import * as meet from './meet.js';


var BUTTON_HOST_ID = 'remove-bots-button-host';
var PANEL_HOST_ID = 'remove-bots-panel-host';

var state = {
  open: false,
  scanning: false,
  running: false,
  participants: [],
  selected: Object.create(null),
  source: 'panel',
  notice: '',
  summary: ''
};

var buttonHost = null;
var panelHost = null;
var panelRoot = null;
var placement = null;
/*
 * A grid cell that did not work out. Meet's chip grid is the right home in
 * every layout we have seen, but if the cell comes out clipped or squashed in
 * one we have not, we stop asking for it and stack with a control instead.
 */
var gridRejected = false;
var waitingSince = 0;
var timer = null;
var listeners = [];

/*
 * How long to hold out for the participants chip before settling for a
 * call-control button, and then for floating. Meet renders its header within
 * a second or two of joining; after that, stacking with the call controls
 * beats waiting around, and the tick relocates us if the chip turns up later.
 */
var ANCHOR_GRACE_MS = 2500;
var TICK_MS = 1000;

/* ---------- styles ---------- */

var BUTTON_CSS = [
  ':host { all: initial; }',
  'button {',
  '  display: inline-flex; align-items: center; gap: 6px;',
  '  height: 40px; padding: 0 14px; margin-left: 8px;',
  '  border: none; border-radius: 20px; cursor: pointer;',
  '  background: #333537; color: #e3e3e3;',
  '  font: 500 13px/1 "Google Sans", Roboto, -apple-system, sans-serif;',
  '}',
  'button:hover { background: #3f4144; }',
  'button[data-active="true"] { background: #a8c7fa; color: #062e6f; }',
  'svg { width: 18px; height: 18px; }',
  '.count {',
  '  min-width: 16px; padding: 0 4px; border-radius: 8px;',
  '  background: #f2b8b5; color: #601410; font-size: 11px; line-height: 16px;',
  '}'
].join('\n');

var PANEL_CSS = [
  ':host { all: initial; }',
  '* { box-sizing: border-box; }',
  '.panel {',
  '  position: fixed; width: 340px; max-height: 70vh; overflow-y: auto;',
  '  background: #1f2020; color: #e3e3e3; border: 1px solid #444746;',
  '  border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.5);',
  '  font: 13px/1.45 "Google Sans", Roboto, -apple-system, sans-serif;',
  '  z-index: 2147483647;',
  '}',
  '.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px 6px; }',
  '.head h2 { margin: 0; font-size: 14px; font-weight: 500; }',
  '.head-actions { display: flex; align-items: center; gap: 4px; }',
  '.chip { background: none; border: 1px solid #444746; border-radius: 14px; color: #9aa0a6;',
  '  cursor: pointer; font: inherit; font-size: 11px; padding: 3px 10px; }',
  '.chip:hover { background: #333537; color: #e3e3e3; }',
  '.icon-btn { background: none; border: 0; color: #9aa0a6; cursor: pointer; font-size: 18px;',
  '  line-height: 1; padding: 2px 6px; border-radius: 50%; }',
  '.icon-btn:hover { background: #333537; color: #e3e3e3; }',
  '.summary { margin: 0; padding: 0 14px 8px; color: #9aa0a6; font-size: 12px; }',
  '.notice { margin: 0 14px 10px; padding: 8px 10px; border-radius: 8px;',
  '  background: #37331c; color: #f6e28a; font-size: 12px; }',
  '.list-head { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 4px; }',
  '.check-all { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }',
  '.muted { color: #9aa0a6; font-size: 11px; }',
  'ul { list-style: none; margin: 0; padding: 0 8px; }',
  '.row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 6px; border-radius: 8px; }',
  '.row + .row { border-top: 1px solid #333537; border-radius: 0; }',
  '.row:hover { background: #292a2b; }',
  '.row.busy { background: rgba(168,199,250,.12); }',
  '.row.done { opacity: .55; }',
  '.row input { margin-top: 2px; flex: none; accent-color: #a8c7fa; }',
  '.row-body { min-width: 0; flex: 1; }',
  '.row-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
  '.row-why { display: block; color: #9aa0a6; font-size: 11px; }',
  '.tag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 8px;',
  '  font-size: 10px; line-height: 15px; vertical-align: 1px; background: #333537; color: #9aa0a6; }',
  '.tag.known { color: #a8c7fa; }',
  '.tag.likely { color: #f6e28a; }',
  '.row-status { flex: none; font-size: 11px; color: #9aa0a6; }',
  '.row-status.ok { color: #6dd58c; }',
  '.row-status.err { color: #f2b8b5; }',
  'details { border-top: 1px solid #333537; margin-top: 8px; padding-top: 8px; }',
  'summary { cursor: pointer; padding: 0 14px 4px; color: #9aa0a6; font-size: 12px; }',
  '.hint { margin: 4px 14px 6px; color: #9aa0a6; font-size: 11px; }',
  '.foot { position: sticky; bottom: 0; display: flex; align-items: center; gap: 10px;',
  '  padding: 10px 14px 12px; margin-top: 8px; background: #1f2020; border-top: 1px solid #333537; }',
  '.primary { flex: 1; background: #a50e0e; border: 0; border-radius: 18px; color: #fff;',
  '  cursor: pointer; font: inherit; font-weight: 500; padding: 9px 12px; }',
  '.primary:hover:not(:disabled) { background: #c5221f; }',
  '.primary:disabled { background: #333537; color: #9aa0a6; cursor: default; }',
  '.link { background: none; border: 0; color: #a8c7fa; cursor: pointer; font: inherit; font-size: 12px; }',
  '.link:hover { text-decoration: underline; }'
].join('\n');

var BOT_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M12 2a1 1 0 0 1 1 1v1.2A5 5 0 0 1 17 9v1h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1V9a5 5 0 0 1 4-4.8V3a1 1 0 0 1 1-1Zm-2.5 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>' +
  '</svg>';

/* ---------- helpers ---------- */

function el(tag, className, textContent) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

function shadowHost(id, css) {
  var host = document.createElement('div');
  host.id = id;
  var shadow = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  return { host: host, shadow: shadow };
}

function removableBots() {
  return state.participants.filter(function (p) { return p.isBot && !p.builtin && !p.self; });
}

function selectedIds() {
  return state.participants
    .filter(function (p) { return state.selected[p.id]; })
    .map(function (p) { return p.id; });
}

function openOptions() {
  try {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  } catch (err) {
    /* Service worker asleep or context invalidated; nothing useful to do. */
  }
}

/* ---------- the button ---------- */

/*
 * Where to dock the button, best first. Meet builds its header a moment after
 * the page loads, so on a cold load there is briefly no anchor at all; we
 * wait rather than float, otherwise the button lands on top of the call
 * controls instead of stacking with them.
 */
function bestAnchor() {
  /*
   * Best of all is a cell of our own in the chip grid: the button then sits
   * beside Meet's participant count as a peer, rather than inside the chip's
   * wrappers where Meet's own animation and re-renders reach it.
   */
  if (!gridRejected) {
    var grid = meet.chipGrid();
    if (grid) return { node: grid, kind: 'grid' };
  }

  var control = meet.peopleControl();

  /*
   * Only a control that announces a popup is the real participants chip.
   * Something merely *named* like participants can be a leftover or a label,
   * and docking beside it looks arbitrary. Those count as a weak anchor, so
   * we keep waiting for the chip and relocate to it when it renders.
   */
  if (control && control.parentElement && control.getAttribute('aria-haspopup')) {
    return { node: control, kind: 'header' };
  }

  var weak = meet.toolbarAnchor() || control;
  if (weak && weak.parentElement) return { node: weak, kind: 'toolbar' };

  return null;
}

function buildButton() {
  var made = shadowHost(BUTTON_HOST_ID, BUTTON_CSS);
  buttonHost = made.host;

  var button = el('button');
  button.type = 'button';
  button.title = 'Remove meeting bots';
  button.innerHTML = BOT_ICON;
  button.appendChild(el('span', null, 'Bots'));
  button.appendChild(el('span', 'count'));
  button.addEventListener('click', function (event) {
    event.stopPropagation();
    toggle();
  });
  made.shadow.appendChild(button);
}

/** Dock beside an existing control so we stack with it in its flex row. */
function dock(anchor) {
  if (anchor.kind === 'grid') return dockCell(anchor.node);

  buttonHost.style.cssText = 'display:inline-flex;align-items:center';
  anchor.node.parentElement.insertBefore(buttonHost, anchor.node.nextSibling);
  placement = anchor.kind;
  /* Moving the button moves what the panel is anchored to. */
  if (state.open) render();
}

/*
 * Take a cell in the chip grid.
 *
 * Meet places every chip in that grid by hand, on one row, with column lines
 * counted back from the end (grid-area: 1 / -6 and friends) so a feature keeps
 * its slot whether or not its neighbours are showing. We cannot know that
 * template, so rather than guess at a free column we ask for one past the end:
 * an implicit track sizes itself to the button and cannot land on a chip.
 */
function dockCell(region) {
  buttonHost.style.cssText =
    'display:inline-flex;align-items:center;grid-row:1;grid-column:-1';
  region.appendChild(buttonHost);
  placement = 'grid';

  if (!usable()) {
    gridRejected = true;
    buttonHost.remove();
    placement = null;
    var next = bestAnchor();
    /* bestAnchor no longer offers the grid, so this cannot loop. */
    if (next) return dock(next);
    return float();
  }

  /* Moving the button moves what the panel is anchored to. */
  if (state.open) render();
}

/** Whether the button, as just placed, is its own size and on the screen. */
function usable() {
  var box = buttonHost.getBoundingClientRect();
  return box.width >= 24 && box.height >= 16 &&
    box.left >= -1 && box.right <= window.innerWidth + 1 &&
    box.bottom > 0 && box.top < window.innerHeight;
}

/*
 * Last resort only, and deliberately low and right: the top-right corner is
 * where Meet puts its own header controls and a tile's mute badge, so a pill
 * parked there covers them.
 */
function float() {
  buttonHost.style.cssText =
    'position:fixed;bottom:96px;right:16px;z-index:2147483646;display:inline-flex';
  document.body.appendChild(buttonHost);
  placement = 'floating';
}

/**
 * Keep the button present and correctly placed.
 *
 * Runs on a slow tick because Meet re-renders its header mid-call and drops
 * injected nodes. Once the button holds a grid cell the tick is just an id
 * lookup; on a header with no such grid it keeps looking for one, which costs
 * an anchor lookup a second.
 */
function tick() {
  var mounted = document.getElementById(BUTTON_HOST_ID);

  /* Already in the best spot there is. */
  if (mounted && placement === 'grid') return;

  var anchor = bestAnchor();

  if (mounted) {
    /* Move up if a better anchor has appeared: Meet renders its header after
     * the call controls, so the first dock is often the toolbar. */
    if (anchor && anchor.kind !== placement) dock(anchor);
    return;
  }

  if (!meet.inCall()) return;

  /*
   * Meet renders the call controls before the header, so the toolbar anchor
   * is usually available first. Hold out briefly for the header chip anyway:
   * docking twice makes the button visibly jump. After the grace period,
   * take whatever is there, and float only if there is nothing at all.
   *
   * waitingSince is never reset, so this patience applies to the first mount
   * only. Later remounts, after Meet re-renders and drops the button, are
   * immediate.
   */
  var patient = Date.now() - waitingSince < ANCHOR_GRACE_MS;
  if (anchor && (anchor.kind !== 'toolbar' || !patient)) {
    if (!buttonHost) buildButton();
    dock(anchor);
    paintButton();
    return;
  }
  if (patient) return;

  if (!buttonHost) buildButton();
  float();
  paintButton();
}

function paintButton() {
  if (!buttonHost || !buttonHost.shadowRoot) return;
  var button = buttonHost.shadowRoot.querySelector('button');
  var count = buttonHost.shadowRoot.querySelector('.count');
  if (!button) return;
  button.setAttribute('data-active', state.open ? 'true' : 'false');
  var bots = removableBots().length;
  count.textContent = bots ? String(bots) : '';
  count.style.display = bots ? '' : 'none';
}

/* ---------- the panel ---------- */

function ensurePanel() {
  if (panelHost && document.body.contains(panelHost)) return;
  var made = shadowHost(PANEL_HOST_ID, PANEL_CSS);
  panelHost = made.host;
  panelRoot = made.shadow;
  document.body.appendChild(panelHost);
}

function position(panel) {
  var anchor = buttonHost && buttonHost.getBoundingClientRect();
  var top = anchor && anchor.height ? anchor.bottom + 8 : 60;
  panel.style.top = Math.round(top) + 'px';
  panel.style.right = '12px';
}

function render() {
  ensurePanel();
  var existing = panelRoot.querySelector('.panel');
  if (existing) existing.remove();
  if (!state.open) return paintButton();

  var panel = el('div', 'panel');

  var head = el('div', 'head');
  head.appendChild(el('h2', null, 'Remove meeting bots'));
  var actions = el('div', 'head-actions');
  var rescan = el('button', 'chip', 'Rescan');
  rescan.disabled = state.running || state.scanning;
  rescan.addEventListener('click', scan);
  actions.appendChild(rescan);
  var close = el('button', 'icon-btn', '×');
  close.title = 'Close';
  close.addEventListener('click', function () { setOpen(false); });
  actions.appendChild(close);
  head.appendChild(actions);
  panel.appendChild(head);

  panel.appendChild(el('p', 'summary', state.summary));
  if (state.notice) panel.appendChild(el('p', 'notice', state.notice));

  var bots = removableBots().concat(
    state.participants.filter(function (p) { return p.isBot && p.builtin; })
  );
  var others = state.participants.filter(function (p) { return !p.isBot; });

  if (bots.length) {
    var listHead = el('div', 'list-head');
    var all = el('label', 'check-all');
    var allBox = document.createElement('input');
    allBox.type = 'checkbox';
    allBox.checked = removableBots().length > 0 &&
      removableBots().every(function (p) { return state.selected[p.id]; });
    allBox.disabled = state.running;
    allBox.addEventListener('change', function () {
      removableBots().forEach(function (p) {
        if (allBox.checked) state.selected[p.id] = true;
        else delete state.selected[p.id];
      });
      render();
    });
    all.appendChild(allBox);
    all.appendChild(el('span', null, allBox.checked ? 'All' : 'Select all'));
    listHead.appendChild(all);
    listHead.appendChild(el('span', 'muted', selectedIds().length + ' selected'));
    panel.appendChild(listHead);

    var list = document.createElement('ul');
    bots.forEach(function (person) { list.appendChild(buildRow(person)); });
    panel.appendChild(list);
  }

  if (others.length) {
    var details = document.createElement('details');
    details.appendChild(el('summary', null,
      others.length === 1 ? '1 other participant' : others.length + ' other participants'));
    details.appendChild(el('p', 'hint', 'Tick anyone here to remove them too.'));
    var otherList = document.createElement('ul');
    others.forEach(function (person) { otherList.appendChild(buildRow(person)); });
    details.appendChild(otherList);
    panel.appendChild(details);
  }

  var foot = el('div', 'foot');
  var remove = el('button', 'primary');
  var count = selectedIds().length;
  remove.textContent = count
    ? 'Remove ' + count + (count === 1 ? ' bot' : ' bots')
    : 'Remove bots';
  remove.disabled = state.running || state.scanning || count === 0;
  remove.addEventListener('click', run);
  foot.appendChild(remove);
  var rules = el('button', 'link', 'Rules');
  rules.addEventListener('click', openOptions);
  foot.appendChild(rules);
  panel.appendChild(foot);

  panelRoot.appendChild(panel);
  position(panel);
  paintButton();
}

function tagFor(person) {
  if (person.tier === 'vendor') return { cls: 'known', label: 'known bot' };
  if (person.tier === 'custom') return { cls: 'known', label: 'your rule' };
  if (person.tier === 'builtin') return { cls: 'likely', label: 'built in' };
  if (person.tier === 'likely') return { cls: 'likely', label: 'likely bot' };
  return null;
}

/*
 * The secondary line under a name: why the row is listed.
 *
 * person.removable is deliberately not surfaced: Meet renders a row's
 * overflow control only on hover, so a scan-time miss is not evidence that
 * host controls are missing. The removal run reports the real reason.
 */
function explain(person) {
  if (person.builtin) return person.reason + '. Turn it off from the Meet toolbar.';
  if (person.self) return 'That is you';
  if (person.reason) return person.reason + (person.visitor ? ' - guest, no account' : '');
  if (person.visitor) return 'Guest, no account';
  return '';
}

function buildRow(person) {
  var row = el('li', 'row');
  row.setAttribute('data-id', person.id);
  if (person.status === 'busy') row.classList.add('busy');
  if (person.status === 'done') row.classList.add('done');

  var box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!state.selected[person.id];
  box.disabled = person.self || person.builtin || state.running;
  box.addEventListener('change', function () {
    if (box.checked) state.selected[person.id] = true;
    else delete state.selected[person.id];
    render();
  });
  row.appendChild(box);

  var body = el('div', 'row-body');
  var name = el('span', 'row-name', person.name);
  var tag = tagFor(person);
  if (tag) {
    var chip = el('span', 'tag ' + tag.cls, tag.label);
    name.appendChild(chip);
  }
  body.appendChild(name);

  var why = person.statusMessage || explain(person);
  if (why) body.appendChild(el('span', 'row-why', why));
  row.appendChild(body);

  if (person.statusLabel) {
    row.appendChild(el('span', 'row-status ' + (person.statusKind || ''), person.statusLabel));
  }
  return row;
}

/* ---------- behaviour ---------- */

async function scan() {
  state.scanning = true;
  state.notice = '';
  state.summary = 'Scanning the meeting...';
  render();

  var response = await engine.scan();
  state.scanning = false;

  if (!response.ok) {
    state.participants = [];
    state.summary = response.code === 'NOT_IN_CALL' ? 'Not in a call yet.' : 'Could not read the participants.';
    state.notice = response.message || '';
    return render();
  }

  state.participants = response.participants;
  state.source = response.source;
  state.selected = Object.create(null);
  state.participants.forEach(function (person) {
    if (person.isBot && !person.builtin && !person.self) state.selected[person.id] = true;
  });

  var bots = removableBots().length;
  state.summary = bots
    ? bots + (bots === 1 ? ' bot' : ' bots') + ' found in this meeting, out of '
      + state.participants.length + ' participants.'
    : 'No bots found among ' + state.participants.length +
      (state.participants.length === 1 ? ' participant.' : ' participants.');

  state.notice = response.source === 'tiles'
    ? 'Could not open the People panel, so this list came from the video tiles '
      + 'on screen and may be incomplete. Open People in Meet, then rescan.'
    : '';

  render();
}

function findPerson(id) {
  for (var i = 0; i < state.participants.length; i++) {
    if (state.participants[i].id === id) return state.participants[i];
  }
  return null;
}

async function run() {
  var ids = selectedIds();
  if (!ids.length) return;

  state.running = true;
  state.summary = 'Removing ' + ids.length + (ids.length === 1 ? ' bot...' : ' bots...');
  render();

  var removed = 0;
  var failed = 0;

  await engine.removeMany(ids, function (event) {
    var person = event.id ? findPerson(event.id) : null;

    if (event.type === 'ITEM_START' && person) {
      person.status = 'busy';
      person.statusLabel = 'removing';
      person.statusKind = '';
    } else if (event.type === 'ITEM_DONE' && person) {
      person.status = 'done';
      if (event.status === 'removed' || event.status === 'gone') {
        removed++;
        person.statusLabel = event.status === 'gone' ? 'had left' : 'removed';
        person.statusKind = 'ok';
      } else {
        failed++;
        person.statusLabel = 'failed';
        person.statusKind = 'err';
        person.statusMessage = event.message || '';
      }
    } else if (event.type === 'ALL_DONE') {
      state.running = false;
      state.selected = Object.create(null);
      state.summary = failed
        ? removed + ' removed, ' + failed + ' failed.'
        : removed + (removed === 1 ? ' bot removed.' : ' bots removed.');
      state.notice = failed
        ? 'Some removals did not go through. That usually means you are not the host, '
          + 'or the host has not enabled host controls for you.'
        : '';
    }
    render();
  });
}

function setOpen(open) {
  state.open = open;
  if (open) scan();
  else render();
}

function toggle() {
  setOpen(!state.open);
}

function isOpen() {
  return state.open;
}

/* True while the engine is driving Meet's own UI on our behalf. */
function busy() {
  return state.scanning || state.running;
}

/*
 * Close on an outside click or Escape, without swallowing either from Meet.
 *
 * The busy() guard is load-bearing, not defensive: scanning clicks Meet's
 * People chip and removing clicks row menus, and those clicks bubble to
 * document from outside our panel. Without the guard the panel dismisses
 * itself the moment it starts working.
 */
function listen(type, handler, capture) {
  document.addEventListener(type, handler, capture);
  listeners.push([type, handler, capture]);
}

function bindDismiss() {
  listen('click', function (event) {
    if (!state.open || busy()) return;
    var path = event.composedPath ? event.composedPath() : [];
    if (path.indexOf(panelHost) !== -1 || path.indexOf(buttonHost) !== -1) return;
    setOpen(false);
  }, true);

  listen('keydown', function (event) {
    if (event.key === 'Escape' && state.open && !busy()) setOpen(false);
  });
}

/**
 * Start watching for a place to put the button, and keep it there.
 *
 * @param {{setInterval?: Function}} [options] pass a context-bound setInterval
 *   (WXT's `ctx.setInterval`) so the timer dies with the content script.
 * @returns {{stop: Function, toggle: Function, isOpen: Function}}
 */
function mount(options) {
  if (!document.body) return null;
  var schedule = (options && options.setInterval) || setInterval;

  waitingSince = Date.now();
  bindDismiss();
  tick();
  if (!timer) timer = schedule(tick, TICK_MS);

  return { stop: stop, toggle: toggle, isOpen: isOpen };
}

/** Undo everything, for when the extension is reloaded or updated mid-call. */
function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  listeners.forEach(function (entry) {
    document.removeEventListener(entry[0], entry[1], entry[2]);
  });
  listeners = [];

  if (buttonHost) buttonHost.remove();
  if (panelHost) panelHost.remove();
  buttonHost = null;
  panelHost = null;
  panelRoot = null;
  placement = null;
  state.open = false;
}

export { mount, stop, toggle, isOpen };
