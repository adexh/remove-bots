/*
 * Content script entrypoint. Mounts the in-page UI on Google Meet and relays
 * the one message the service worker sends.
 */
import { mount, toggle, isOpen } from '../lib/ui.js';
import { inCall } from '../lib/meet.js';

const MEET = ['https://meet.google.com/*'];

/*
 * The local fake-Meet page, test/fake-meet-manual.html, so the extension can
 * be driven by hand without joining a real call. Ports are not part of a match
 * pattern, so one localhost entry covers every dev server; file:// also needs
 * "Allow access to file URLs" ticked on chrome://extensions.
 *
 * Development builds only. A published build has no business asking for access
 * to whatever else is running on localhost.
 */
const PLAYGROUND = ['http://localhost/*', 'http://127.0.0.1/*', 'file:///*'];

export default defineContentScript({
  matches: import.meta.env.DEV ? MEET.concat(PLAYGROUND) : MEET,
  runAt: 'document_idle',
  allFrames: false,

  main(ctx) {
    /* ctx.setInterval stops itself when the script is invalidated, which
     * happens on every reload during `wxt dev`. */
    const ui = mount({ setInterval: ctx.setInterval.bind(ctx) });

    if (typeof ctx.onInvalidated === 'function') {
      ctx.onInvalidated(() => ui && ui.stop());
    }

    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (!message || !ctx.isValid) return undefined;

      if (message.type === 'TOGGLE_PANEL') {
        toggle();
        respond({ ok: true, open: isOpen() });
        return true;
      }

      if (message.type === 'PING') {
        respond({ ok: true, inCall: inCall() });
        return true;
      }

      return undefined;
    });
  },
});
