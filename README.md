# Remove Bots for Google Meet

A Chrome extension that finds AI notetaker bots in your Google Meet call and
removes them all in one click.

During a call you get a **Bots** button next to Meet's participant count, top
right. Click it and you get the list of bots it found, every one ticked. Untick
any you want to keep, hit **Remove**, and it walks the participant menu for each
of them while you watch the status update live.

The panel lives in the page rather than in a browser popup, so it sits where you
are already looking and stays open while it works. The toolbar icon toggles the
same panel if you prefer the keyboard route.

Removing participants requires host permissions in the meeting. The extension
does not grant you anything you do not already have, it just clicks faster than
you can.

## Getting started

Built with [WXT](https://wxt.dev). Requires Node 22+ and pnpm.

```sh
pnpm install          # also runs `wxt prepare`
pnpm dev              # builds to build/chrome-mv3-dev and watches
```

Then load it once, by hand:

1. `chrome://extensions` → **Developer mode** on → **Load unpacked**.
2. Select **`build/chrome-mv3-dev`**, not the repo root and not `build` itself.
   The root has no manifest any more: WXT generates one into each build folder.
3. Join a Google Meet call. The **Bots** button appears beside the participant
   count, top right.

After that first load, `pnpm dev` rebuilds and reloads the extension itself when
you edit a file, so the `chrome://extensions` visit is a one-off. Reload the Meet
tab too if you change the content script.

WXT can launch a browser with the extension pre-loaded, but only through
`web-ext`, an optional peer dependency that is not installed here. It is worth
knowing that Chrome 137+ ignores the `--load-extension` flag web-ext relies on
(checked against Chrome 151, where it silently loads nothing), so the manual load
above is the reliable route on current Chrome.

For a release build:

```sh
pnpm build            # -> build/chrome-mv3/
pnpm zip              # -> build/*.zip, for the Web Store
```

## How it works

WXT owns `entrypoints/`; React renders the UI; everything else is plain ES
modules in `lib/`, which keeps the logic independent of both and importable from
Node for tests.

```
wxt.config.ts          manifest fields WXT cannot infer, plus the React module
entrypoints/           what WXT scans and builds
  background.js        service worker
  meet.content.js      content script for meet.google.com
  options/             index.html + main.jsx + App.jsx
components/            React: the button, the panel, the rows
lib/                   plain ES modules, no framework imports
public/icon/           16/32/48/128.png, picked up automatically
```

Layered so the fragile part is small and isolated. Only one file knows how Meet
is built, and it is the only one you should expect to edit when Meet changes.

| File | Responsibility | Depends on |
| --- | --- | --- |
| `lib/bots.js` | Is this display name a bot? Names only, no DOM. | nothing |
| `lib/dom.js` | Generic DOM helpers: waiting, clicking, accessible names. | nothing |
| `lib/meet.js` | **All Meet knowledge.** Selectors, label patterns, reading the roster, opening the panel, finding menu entries. | dom |
| `lib/engine.js` | Scan and removal logic. Holds no selectors. | bots, dom, meet |
| `lib/store.js` | All UI state, held outside React so the service worker and the placement loop can drive it too. | engine |
| `lib/placement.js` | Where the button lives: anchor priority, docking, relocation. Renders nothing. | meet |
| `lib/styles.js` | The two shadow-root stylesheets, as strings. | nothing |
| `lib/ui.js` | Builds the two shadow roots, mounts one React root, starts placement. | store, placement, styles, components |
| `components/` | React. `App` renders the button and portals the panel; `Panel` and `ParticipantRow` render the list. State comes from `lib/store.js` through `useSyncExternalStore`. | store |
| `entrypoints/meet.content.js` | Mounts the UI, relays the toolbar-icon toggle. Nothing else. | ui, meet |
| `entrypoints/background.js` | Relays the icon click; opens the options page. | - |
| `entrypoints/options/` | Your own detection rules. | bots |

The content script hands WXT's `ctx.setInterval` to `mount()` and calls the
returned `stop()` on `ctx.onInvalidated`, so the button, its timer and its
listeners are all torn down when the extension reloads mid-call. That is what
makes `pnpm dev` usable during a real meeting.

Nothing in `lib/` imports from `wxt`, which is deliberate: the tests load those
modules straight from disk.

### Why the state lives outside React

Two things that are not components need to drive the UI: the service worker,
which toggles the panel when the toolbar icon is clicked, and the placement loop,
which reports when the button moves so the panel can re-anchor. Rather than
smuggle a React setter out to them, `lib/store.js` holds the state and components
read it with `useSyncExternalStore`. One source of truth either way.

There is also only **one** React root, mounted in the button's shadow root, with
the panel portalled into a second shadow root on `<body>`. Two roots could not
share state without extra plumbing; a portal can, and the panel still gets to be
`position: fixed` without Meet's header clipping it.

React costs about 180 kB in the content script bundle, which is the honest
tradeoff for this refactor: the previous hand-rolled renderer built the same DOM
in 45 kB total.

**When a Meet update breaks something, start at the `SELECTORS` and `LABELS`
tables at the top of `src/content/meet.js`.** Every non-obvious entry there
records the real-world detail that forced it. Change one, then run
`npm run test:dom` before going near a live call.

Because the UI runs in the page, it calls the engine directly: there is no
message passing, no port, and no popup lifecycle to work around. The panel stays
open and keeps updating for the whole run.

The button remounts itself if Meet re-renders its header and drops it, and the
panel refuses to dismiss while a scan or removal is in flight, because our own
automation clicks land outside the panel and would otherwise close it.

### A crowded meeting

Bots accumulate. Past a handful the panel would have grown past the screen and
taken the Remove button with it, so:

- The panel is a flex column. Only the **list** scrolls; the header, summary,
  search box and footer stay put, so Remove is always reachable.
- Its height is whatever fits **below the button**, not a flat `70vh`, and if the
  button sits low (the floating fallback lives near the bottom of the window) the
  panel opens **upwards** instead. It re-anchors on window resize.
- A **search box** appears once there are more than eight participants, filtering
  by name.

Filtering deliberately does not change what is selected, since that would make
Remove mean something different depending on what you had typed. Two
consequences, both handled: **Select all** applies to the rows the search is
showing, and if ticked bots are hidden by the current query the count says so
(`3 selected (50 hidden by search)`), so Remove can never quietly take out
someone off-screen.

### Where the button goes

It must **stack with** Meet's existing controls, never float on top of them. The
top-right corner in particular holds Meet's own header controls and a tile's
mute badge, so a pill parked there covers them. Four placements, best first:

1. **Its own cell in Meet's chip grid**, the intended home: the
   `role="region"` grid ("Call feature notifications and actions") that holds
   the participant count and the call-feature notification badges. Found
   through the chip rather than by that localised label, and only accepted if
   its computed `display` really is a grid.

   Meet places those cells by hand on one row, with column lines counted back
   from the end (`grid-area: 1 / -6` and friends), so a feature keeps its slot
   whether or not its neighbours are showing. We cannot know that template, so
   rather than guess at a free column the cell asks for one past the end: an
   implicit track sizes itself to the button and cannot land on a chip. If it
   still comes out squashed or off screen, that is measured on the spot and the
   grid is abandoned for the placements below.
2. **Beside the participants chip**, for a header with no such grid. Recognised
   by `aria-haspopup`, not by name alone: something merely *named* like
   participants can be a leftover control or a label, and docking beside it
   looks arbitrary. This lands *inside* the chip's own wrappers, which is why
   the grid cell is preferred.
3. **Beside a call-control button** (chat, meeting tools, host controls), used
   when the chip has not rendered after a couple of seconds.
4. **Floating, low and to the right**, only when nothing at all has rendered.

Meet builds the call controls before the header, so on a cold load the button
holds off briefly rather than docking somewhere it will have to leave. If a
better anchor appears later, it relocates, so it ends up in the grid even when
the header renders seconds after the page.

### Detection

Two tiers, both ticked by default, and the popup always tells you which one
fired so you can judge for yourself:

- **known bot**: the name matches a notetaker product (Otter, Fireflies, Fathom,
  Read AI, tl;dv, Gong, Avoma, Spinach, and ~45 more).
- **likely bot**: the name has a bot shape rather than a brand, for example
  "Notetaker", "Meeting Recorder", "AI Notetaker", "Sarah (Notes)".

Vendor names that are also ordinary human names (Gong, Kaia, Rilla, Tanka,
Clari, Aviso, Nyota, Sybill) only count when the name also carries a product
word such as "AI" or "Notetaker". A bot that slips through costs you one extra
tick in the **other participants** section; a real colleague queued for removal
costs a lot more, so the rules stay narrow on purpose.

Google's own Gemini notetaker is detected but shown greyed out, because it is
not a participant you can remove. Stop it from the Meet toolbar instead.

### Your own rules

Open **Rules** from the popup footer, or the extension's options page:

- **Always treat as a bot**, for in-house or brand-new notetakers.
- **Never remove**, which beats every other rule, for when a teammate's display
  name trips the detector.

Plain text matches anywhere in the name, case insensitive. Slashes make it a
regular expression: `/^recorder \d+$/`.

## Permissions

| Permission | Why |
| --- | --- |
| `https://meet.google.com/*` | Read the participant list and click the remove controls. |
| `storage` | Save your custom rules (synced with your Chrome profile). |
| `scripting` | Inject the content script into a Meet tab that was already open when the extension was installed or updated. The paths come from `chrome.runtime.getManifest()`, so renaming an entrypoint cannot break it. |

No `tabs` permission: the service worker only ever messages the tab whose icon
you clicked.

Nothing leaves your browser. There is no background server, no analytics, no
network request of any kind.

## What the real Meet DOM looks like

Captured from a live call (Aug 2026 build) and encoded in `test/harness-stub.js`.
These are the non-obvious parts, all of which broke a reasonable-looking
selector at some point:

- **The roster is lazily rendered.** With the People panel closed there are no
  `[role="listitem"]` nodes at all. `[data-participant-id]` still matches, but
  only video tiles (`div.oZRSLe`). A selector that accepts any
  `[data-participant-id]` therefore finds one or two tiles, concludes the panel
  is already open, and reports almost no participants.
- **There is no People button in the toolbar.** The control is the
  participant-count chip in the top-right header: a `div[role="button"]`
  with **no aria-label**, named through `aria-labelledby` pointing at a hidden
  "People" span. It carries `aria-haspopup="dialog"`.
- **The chat button is a near-miss for it.** Its label is "Chat with everyone",
  which matches a naive "everyone" test, and it also announces a popup.
- **So are the header notification badges.** "External participants joined" is
  built exactly like the chip - same `jsname`, same `role="button"`, same
  `aria-haspopup="dialog"` - sits earlier in the DOM, and its name contains
  "participants". Taken for the chip it opens nothing, and it swallowed the
  button: docking beside it put our pill inside the badge's tooltip slot.
- **Every chip is two wrappers deep in its grid cell** (tooltip wrapper,
  `jsshadow` span, `jsslot` div). Inserting next to the chip node is inserting
  into Meet's own slot, under its animation controller; a sibling cell is not.
- **Roster rows share one class** (`cxdMu KV1GEc`) for humans and bots. The row's
  `aria-label` is the only clean name source; `textContent` is polluted with
  badge and icon-font words.
- **Bot names are possessive.** Fathom joins as `Adesh's Fathom Notetaker`, not
  `Fathom`. Anchored patterns like `/^Fathom/` miss; substring matching is
  required.
- **Bots join as anonymous Visitors** with no email and no domain, so there is
  nothing to match on but the name.
- **`textContent` has no separators.** Adjacent badge spans concatenate into
  `domain_disabledVisitordevices`, so any `\b`-anchored pattern fails against
  the combined string. Match per leaf element instead.
- **Menus and dialogs portal into an attribute-less `<div>` directly under
  `<body>`** - no class, no id, no role - four levels above a `<ul role="menu">`
  of `<li role="menuitem">`. Because its only child is `position:fixed`, that
  wrapper measures **zero height**, so an `isVisible` check on the overlay root
  skips every popup.
- **The label is "Remove from the call"**, not "Remove from meeting", and the
  entry text includes the icon word: `remove_circle_outline\nRemove from the
  call`.

Still unknown: whether Meet shows a confirmation step for that entry, since
capturing it needed a click nobody was willing to make on a live call. The code
handles both, waiting for either the row to vanish or a confirm control to
appear, and the harness exercises both paths.

## Known limits

Google Meet ships unversioned, generated markup, so the selectors here are
defensive but not future proof. If a Meet update breaks it, the failure is loud
rather than silent: rows report "failed" with the reason instead of pretending
to succeed. The usual causes are:

- You are not the host and host controls are not delegated to you.
- Meet is in a language whose "Remove from meeting" wording is not in the match
  list yet (`REMOVE_TEXT` in `src/shared/bots.js`).
- Meet changed its participant row markup.

## Testing

Four suites, no test framework and nothing extra to install:

```sh
pnpm test                # all of it, 115 assertions
pnpm test:names          # 56: the name classifier
pnpm test:labels         # 13: Meet's selector and label tables
pnpm test:dom            # 35: the real UI driven in headless Chrome
pnpm test:dom:bare       # 11: placement when Meet has rendered nothing yet
pnpm test:dom:many       # 21: 50 bots, scrolling and search
pnpm test:dom:show       # the main scenario in a visible browser
pnpm test:dom:many:show  # 50 bots in a visible browser, to look at it
```

Any scenario also takes `--screenshot=<file>`:

```sh
node test/run-dom.mjs --page=fake-meet-many.html --screenshot=look.png
```

That is worth using rather than trusting geometry assertions. It is what caught
the panel running off the bottom of the screen: every assertion passed, and the
picture showed the Remove button half off the viewport.

The first two import `lib/` modules directly in Node, which is possible because
nothing in `lib/` touches the DOM at import time or imports from `wxt`.

`test/run-dom.mjs` starts a **Vite dev server** over the repo, opens a harness
page in headless Chrome, and drives it over the DevTools protocol. Vite is not
incidental: the harness imports the real UI, which is JSX, and Vite transforms it
on the fly. So the tests run against the same source the extension is built from,
with no separate test bundle to drift out of date.

`test/fake-meet.html` rebuilds the captured Meet DOM described above (lazy
roster, the unlabelled header chip, decoy toolbar buttons placed ahead of it,
portalled menus with no attributes, a disabled mute button, both confirmation
behaviours), mounts the UI exactly as `entrypoints/meet.content.js` does, then
drives it the way a user would: waits for the button, clicks it, reads the
rendered rows, unticks one, clicks Remove, and checks what is left in the roster.
Open it in a browser via the dev server to watch it happen.

The stub models the chip grid too: a sparse `repeat(123, auto)` template with
the badge and the chip placed by negative line, each buried in its wrappers, so
the tests can assert the button takes a cell of its own, sized and clear of the
chip, and falls back when the grid is squashed to give it no room.

`test/fake-meet-bare.html` runs the same stub with nothing to dock beside, which
is what exercises the waiting, the floating fallback and the relocation. Those
paths are unreachable in the main scenario, where a control is always available.

`test/fake-meet-many.html` puts 50 branded notetakers in the roster. It doubles
as the way to eyeball the panel with a realistic pile of bots in it, which is why
it is a harness page rather than dummy data wired into the extension: nothing
fake ships.

The suites are mutation-tested: reverting any of the fixes they cover, in the
Meet adapter or the UI, makes them fail loudly, so they are not passing
vacuously. Two mutations that survived the main scenario are caught by the bare
one, which is why it exists.

What they cannot cover is Meet's real markup, or the bundled output as Chrome
runs it. Do one manual pass on a live call before trusting a Meet update.
