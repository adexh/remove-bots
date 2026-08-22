/*
 * Where the button lives.
 *
 * Nothing here renders anything: it is handed a host element and decides where
 * in Meet's chrome to put it, then keeps it there as Meet re-renders. Split out
 * of the UI so the placement rules can be read, and tested, on their own.
 */
import * as meet from './meet.js';

var HOST_ID = 'remove-bots-button-host';

/*
 * A grid cell that did not work out. Meet's chip grid is the right home in
 * every layout we have seen, but if the cell comes out clipped or squashed in
 * one we have not, we stop asking for it and stack with a control instead.
 */
var gridRejected = false;
var placementKind = null;
var waitingSince = 0;
var timer = null;
var buttonHost = null;
var onMoved = function () {};

/*
 * How long to hold out for the participants chip before settling for a
 * call-control button, and then for floating. Meet renders its header within
 * a second or two of joining; after that, stacking with the call controls
 * beats waiting around, and the tick relocates us if the chip turns up later.
 */
var ANCHOR_GRACE_MS = 2500;
var TICK_MS = 1000;

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

/** Dock beside an existing control so we stack with it in its flex row. */
function dock(anchor) {
  if (anchor.kind === 'grid') return dockCell(anchor.node);

  buttonHost.style.cssText = 'display:inline-flex;align-items:center';
  anchor.node.parentElement.insertBefore(buttonHost, anchor.node.nextSibling);
  placementKind = anchor.kind;
  onMoved();
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
  placementKind = 'grid';

  if (!usable()) {
    gridRejected = true;
    buttonHost.remove();
    placementKind = null;
    var next = bestAnchor();
    /* bestAnchor no longer offers the grid, so this cannot loop. */
    if (next) return dock(next);
    return float();
  }

  onMoved();
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
  placementKind = 'floating';
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
  var mounted = document.getElementById(HOST_ID);

  /* Already in the best spot there is. */
  if (mounted && placementKind === 'grid') return;

  var anchor = bestAnchor();

  if (mounted) {
    /* Move up if a better anchor has appeared: Meet renders its header after
     * the call controls, so the first dock is often the toolbar. */
    if (anchor && anchor.kind !== placementKind) dock(anchor);
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
      dock(anchor);
    return;
  }
  if (patient) return;

  float();
}

/**
 * Start placing `host`, and keep it placed.
 *
 * @param {HTMLElement} host the element to position, already built
 * @param {{onMoved?: Function, setInterval?: Function}} [options] onMoved fires
 *   whenever the host changes place, so anything anchored to it can follow.
 */
export function start(host, options) {
  var opts = options || {};
  buttonHost = host;
  buttonHost.id = HOST_ID;
  onMoved = opts.onMoved || function () {};
  waitingSince = Date.now();

  var schedule = opts.setInterval || setInterval;
  tick();
  if (!timer) timer = schedule(tick, TICK_MS);
}

export function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (buttonHost) buttonHost.remove();
  buttonHost = null;
  placementKind = null;
  gridRejected = false;
}

/** Where the button currently sits: grid, header, toolbar, floating, or null. */
export function kind() {
  return placementKind;
}

export { HOST_ID };
