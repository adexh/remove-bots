import { defineConfig } from 'wxt';

export default defineConfig({
  /* Adds the React plugin and its auto-imports. */
  modules: ['@wxt-dev/module-react'],

  /*
   * Vite's dependency scanner defaults to every *.html under the project
   * root, which here means the test fixtures, the captured Meet page in
   * meet-temp/ and, fatally, the previous dev build: build/chrome-mv3-dev is
   * being emptied for the new build while the scanner holds it as an entry,
   * so `pnpm dev` fails the scan and skips pre-bundling. The real entrypoints
   * are the only thing worth scanning.
   */
  vite: () => ({
    optimizeDeps: {
      entries: ['entrypoints/**/*.{html,js,jsx}'],
    },
  }),

  /*
   * Default is ".output", but a dot-prefixed folder is hidden in Finder and the
   * Chrome "Load unpacked" picker, which makes loading the build needlessly
   * fiddly. A visible folder costs nothing.
   */
  outDir: 'build',

  /* Entrypoints are the only thing WXT scans; lib/ is plain imports. */
  manifest: {
    name: 'Remove Meeting Bots',
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
