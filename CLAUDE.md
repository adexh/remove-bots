# CLAUDE.md

Remove Meeting Bots: WXT Chrome MV3 extension that detects AI notetaker bots
in a Google Meet call, removes them via Meet's own menus, or hides their tiles
locally. Node 22+, pnpm. Docs are split: README.md is the lean user page
(features, install, permissions), docs/DEVELOPMENT.md is the canonical dev doc
(architecture, Meet DOM facts, testing, releases). Keep both in sync.

## Architecture rules (enforced by convention, break nothing)

- `lib/meet.js` is the ONLY file that knows Meet's DOM. All selectors and
  label regexes live in its SELECTORS/LABELS tables at the top; every
  non-obvious entry gets a comment naming the real-world detail that forced
  it. Meet breaks -> fix here first, then `pnpm test:dom` before a live call.
- `lib/` is plain ES modules: no wxt imports, no React, no DOM access at
  import time. Tests import these straight into Node.
- `lib/bots.js`: name classification only, zero DOM. Narrow on purpose: a
  missed bot costs one tick, a false positive queues a human for removal.
- `lib/engine.js`: scan/remove logic, holds no selectors, speaks only through
  the meet adapter.
- `lib/store.js`: all UI state, outside React (service worker and placement
  loop drive it too); components read via useSyncExternalStore.
- One React root in the button's shadow root; panel portalled into a second
  shadow root on <body>. Styles are strings in `lib/styles.js`.
- Hiding tiles = injected stylesheet keyed on data-participant-id (survives
  Meet re-renders); owned by `lib/hide.js`; cleared on teardown.
- `entrypoints/` is all WXT sees. Content script passes ctx.setInterval to
  mount() and stops on ctx.onInvalidated (keeps `pnpm dev` usable mid-call).

## Code style

- lib/ uses var + function declarations (matches existing); components/ use
  modern JSX. Match whatever the surrounding file does.
- Comments say WHY (the captured Meet fact, the failure that forced the
  code), never what the next line does.
- NEVER use em dashes anywhere (code, docs, commits). Commas or hyphens.
- UI class names in use: .chip .primary .secondary .beta .notice .notice.warn
  .section-head .row .tag .list-head .foot .scroll.

## Tests (no framework, nothing to install)

- `pnpm test` = 6 suites. names/labels run in Node; dom/bare/many/guest drive
  headless Chrome via test/run-dom.mjs (Vite serves real source, JSX included).
- Harness style: check(ok, 'label that reads as a sentence'), until() for
  waits, finish() stamps data-harness on <body>.
- test/harness-stub.js encodes captured Meet DOM facts (lazy roster,
  unlabelled chip, portalled attribute-less overlays, possessive bot names,
  icon-font text pollution). Scenario params: ?bots=N ?guest=1 ?bare=1.
- Every fix gets checks that fail if reverted (suites are mutation-tested).
- Adding checks -> update the counts in docs/DEVELOPMENT.md's Testing section.
- Geometry claims: screenshot instead of trusting assertions:
  `node test/run-dom.mjs --page=<page> --screenshot=out.png`.
- meet-clone/ is a React+Vite replica honouring meet-clone/src/contract.md;
  test/fake-meet-manual.html is a pixel-real captured page for hand-testing
  the built extension.

## Git and workflow

- Work directly in this checkout, no worktrees unless the user asks
  (bgIsolation is off in .claude/settings.json).
- Commit straight to main; push when the user asks (they usually do).
- Commit messages: imperative subject that tells the story ("Let a guest hide
  bot tiles from their own view"), body = prose why, not bullet lists.
- Releases: bump version in package.json on main, then merge main into the
  `release` branch; .github/workflows/release.yml tags v<version>, gates on
  the Node suites, attaches build/remove-meeting-bots-<version>-chrome.zip,
  notes from commit subjects. It refuses an existing tag.
- ALL CI runs only on PRs targeting `release`, never on push or schedule:
  ci.yml (six suites in headless Chrome + production build/zip) and
  codeql.yml (JS scan, captured-Meet fixtures excluded). Dependabot watches
  npm (root + meet-clone) and actions, weekly, minor/patch grouped.

## Publishing

- Web Store collateral: store/listing.md (all dashboard fields), PRIVACY.md.
- The extension NAME must not contain "Google Meet" (trademark); the
  description may mention it. Manifest fields live in wxt.config.ts;
  version comes from package.json.
- Privacy stance is load-bearing: no network requests, no analytics, storage
  only for user rules. Do not add anything that phones home.

## Commands

- `pnpm dev` -> build/chrome-mv3-dev, watches. Load unpacked once by hand
  (Chrome 137+ ignores --load-extension). Reload the Meet tab after content
  script changes.
- `pnpm build` / `pnpm zip` -> production, Meet-only matches (dev builds also
  match localhost/127.0.0.1/file for the fixtures).
- `pnpm play` (captured fixture) / `pnpm play:clone` (React clone, :5175).
