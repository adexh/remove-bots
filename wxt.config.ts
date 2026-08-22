import { defineConfig } from 'wxt';

export default defineConfig({
  /*
   * Default is ".output", but a dot-prefixed folder is hidden in Finder and the
   * Chrome "Load unpacked" picker, which makes loading the build needlessly
   * fiddly. A visible folder costs nothing.
   */
  outDir: 'build',

  /* Entrypoints are the only thing WXT scans; lib/ is plain imports. */
  manifest: {
    name: 'Remove Bots for Google Meet',
    description:
      'Find AI notetaker bots in a Google Meet call and remove them all in one click.',
    permissions: ['storage', 'scripting'],
    host_permissions: ['https://meet.google.com/*'],
    /* No default_popup: the icon toggles the in-page panel instead. */
    action: {
      default_title: 'Remove meeting bots',
    },
    minimum_chrome_version: '111',
  },
});
