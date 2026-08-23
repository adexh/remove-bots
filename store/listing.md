# Chrome Web Store listing

Everything the developer dashboard asks for, in one place. Copy from here so
the listing and the repo never drift apart.

## Name

Remove Bots for Google Meet

## Short description (132 characters max)

Find the AI notetaker bots in your Google Meet call and remove them all in one
click, or hide their tiles from your view.

## Detailed description

Every meeting collects notetaker bots: Otter, Fireflies, Fathom, Read AI,
tl;dv, and dozens more, each one sent by someone who may not even be on the
call any more. Removing them by hand means opening the People panel, finding
each bot, opening its menu, clicking Remove, confirming, and doing it all
again for the next one.

This extension does that for you. During a call you get a Bots button next to
Meet's participant count. Click it and you get the list of bots it found,
every one ticked, with the reason it was flagged. Untick any you want to
keep, hit Remove, and it walks Meet's own menus for each of them while you
watch the status update live. Bots you sent yourself are listed first, under
Your bots.

Not the host? The extension says so up front instead of failing noisily, and
gives you a Hide bots button instead: the bots' video tiles disappear from
your own view, and nobody else's, until you bring them back.

Detection is careful on purpose. Brand names that are also human names (Gong,
Kaia, Rilla...) only count with a product word beside them, so a colleague is
never queued for removal by accident. You can add your own rules on the
options page: always-a-bot patterns for in-house notetakers, and a
never-remove list that beats everything else.

Honest about its limits: removing participants needs host permissions in the
meeting. The extension grants you nothing you do not already have, it just
clicks faster than you can.

Private by construction: no server, no analytics, no network requests.
Nothing leaves your browser. Open source at
https://github.com/adexh/remove-bots.

## Category

Workflow & Planning (fallback: Social & Communication)

## Language

English

## Single-purpose statement

Manage AI notetaker bots in the Google Meet call the user is attending:
detect them by display name, remove the selected ones through Meet's own
controls, or hide their video tiles locally.

## Permission justifications

- **Host permission `https://meet.google.com/*`**: the extension operates on
  the Meet call the user is in. It reads the participant list to detect bots
  and clicks Meet's own "Remove from the call" controls when the user asks.
  It runs only on meet.google.com.
- **`storage`**: saves the user's own detection rules (always-a-bot,
  never-remove) via chrome.storage.sync. Nothing else is stored.
- **`scripting`**: injects the content script into Meet tabs that were
  already open at install or update time, so the user does not have to
  reload them. Paths come from the manifest itself.
- **Remote code**: none. All code ships in the package.

## Data usage disclosures (Privacy tab)

- Collects user data: **No** to every category. The extension has no server
  and makes no network requests.
- Privacy policy URL:
  https://github.com/adexh/remove-bots/blob/main/PRIVACY.md

## Assets still to capture by hand

- At least one screenshot, 1280x800 (or 640x400), PNG or JPEG: take it on a
  real call, panel open over the Meet UI. The fixture pages under test/ are
  for development and show test scaffolding, so do not screenshot those.
- Optional small promo tile 440x280, marquee 1400x560.

## Publishing steps

1. `pnpm build` then `pnpm zip`, upload
   `build/remove-bots-for-google-meet-<version>-chrome.zip`.
2. Bump `version` in package.json for every new upload; WXT stamps it into
   the manifest.
3. Fill the dashboard from this file. Expect a review delay on first submit,
   host permissions get a human look.
