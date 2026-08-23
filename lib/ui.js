/*
 * Mounts the in-page UI.
 *
 * Two shadow roots, one React root: the button host goes wherever the placement
 * module puts it inside Meet's chrome, and the panel is portalled into a second
 * host on <body> so it can be fixed-positioned without being clipped. Shadow
 * roots both ways, so Meet's stylesheet cannot reach in and ours cannot leak.
 */
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { App } from '../components/App.jsx';
import * as hide from './hide.js';
import * as placement from './placement.js';
import { busy, isOpen, moved, setOpen, toggle } from './store.js';
import { BUTTON_CSS, PANEL_CSS } from './styles.js';

const PANEL_HOST_ID = 'remove-bots-panel-host';

let buttonHost = null;
let panelHost = null;
let root = null;
let listeners = [];

/** A host element with a shadow root and its stylesheet already inside. */
function shadowHost(id, css) {
  const host = document.createElement('div');
  if (id) host.id = id;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  return { host, shadow };
}

function listen(type, handler, capture) {
  document.addEventListener(type, handler, capture);
  listeners.push([type, handler, capture, document]);
}

/*
 * Close on an outside click or Escape, without swallowing either from Meet.
 *
 * The busy() guard is load-bearing, not defensive: scanning clicks Meet's
 * People chip and removing clicks row menus, and those clicks bubble to document
 * from outside our panel. Without the guard the panel dismisses itself the
 * moment it starts working.
 */
function bindDismiss() {
  listen(
    'click',
    (event) => {
      if (!isOpen() || busy()) return;
      const path = event.composedPath ? event.composedPath() : [];
      if (path.indexOf(panelHost) !== -1 || path.indexOf(buttonHost) !== -1) return;
      setOpen(false);
    },
    true,
  );

  listen('keydown', (event) => {
    if (event.key === 'Escape' && isOpen() && !busy()) setOpen(false);
  });
}

/*
 * Re-anchor on resize. The panel's height and whether it opens up or down are
 * both decided from the space around the button, and that changes when the
 * window is resized or Meet goes fullscreen.
 */
function bindResize() {
  const onResize = () => {
    if (isOpen()) moved();
  };
  window.addEventListener('resize', onResize);
  listeners.push(['resize', onResize, undefined, window]);
}

/**
 * Build the UI and start keeping the button in place.
 *
 * @param {{setInterval?: Function}} [options] pass a context-bound setInterval
 *   (WXT's `ctx.setInterval`) so the placement loop dies with the content script.
 * @returns {{stop: Function, toggle: Function, isOpen: Function}|null}
 */
export function mount(options) {
  if (!document.body) return null;

  const button = shadowHost(null, BUTTON_CSS);
  const panel = shadowHost(PANEL_HOST_ID, PANEL_CSS);
  buttonHost = button.host;
  panelHost = panel.host;
  document.body.appendChild(panelHost);

  root = createRoot(button.shadow);
  root.render(
    createElement(App, { panelTarget: panel.shadow, anchor: () => buttonHost }),
  );

  bindDismiss();
  bindResize();

  /* The host is attached to the page by placement, not here: until it picks a
   * spot there is deliberately no button in the DOM. */
  placement.start(buttonHost, {
    onMoved: moved,
    setInterval: options && options.setInterval,
  });

  return { stop, toggle, isOpen };
}

/** Undo everything, for when the extension reloads or updates mid-call. */
export function stop() {
  placement.stop();

  /* Tiles hidden by a build that is going away must come back: the stylesheet
   * would otherwise outlive the UI that knows how to lift it. */
  hide.clear();

  listeners.forEach(([type, handler, capture, target]) =>
    (target || document).removeEventListener(type, handler, capture),
  );
  listeners = [];

  if (root) root.unmount();
  root = null;

  if (panelHost) panelHost.remove();
  buttonHost = null;
  panelHost = null;
  setOpen(false);
}

export { toggle, isOpen };
