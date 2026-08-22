/*
 * Content script entrypoint. Mounts the in-page UI on Google Meet and relays
 * the one message the service worker sends.
 */
import { mount, toggle, isOpen } from '../lib/ui.js';
import { inCall } from '../lib/meet.js';

export default defineContentScript({
  matches: ['https://meet.google.com/*'],
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
