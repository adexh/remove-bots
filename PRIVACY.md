# Privacy policy, Remove Bots for Google Meet

Last updated: 23 August 2026.

## The short version

This extension collects nothing, stores nothing about your meetings, and makes
no network requests. Everything it does happens inside your own browser, on
the Google Meet tab you are looking at.

## What the extension reads

To do its job, the extension reads the participant list and the video tiles of
the Google Meet call you are in: display names, and the roster badges Meet
renders beside them (host, visitor). It reads them in the page, classifies
them in the page, and shows you the result in the page. None of it is
recorded, none of it leaves the tab, and closing the tab is the end of it.

## What the extension stores

One thing: the detection rules you write yourself on the options page
("always treat as a bot", "never remove"). They are saved with
`chrome.storage.sync`, which means Chrome keeps them in your own browser
profile and syncs them across your own signed-in browsers, the same place
your bookmarks live. The extension has no server, so it could not receive
them if it wanted to.

## What the extension sends

Nothing. There is no analytics, no telemetry, no crash reporting, no remote
configuration, and no network request of any kind anywhere in the code. The
code is open source, so this is checkable rather than a promise:
https://github.com/adexh/remove-bots

## Permissions, and why each one is needed

| Permission | Why |
| --- | --- |
| `https://meet.google.com/*` | Read the participant list of the call you are in, and click Meet's own remove controls on your behalf. |
| `storage` | Save the custom detection rules you write on the options page. |
| `scripting` | Inject the extension into a Meet tab that was already open when the extension was installed or updated, so you do not have to reload the tab. |

## What the extension does on your behalf

When you click Remove, the extension clicks the same "Remove from the call"
menu entries you could click yourself, one participant at a time, in your own
session. It grants you no ability you do not already have in the meeting.
Hiding bots is entirely local: a stylesheet in your own tab, gone when the
tab closes.

## Changes

If a future version ever changes any of the above, this policy will be
updated in the repository and the change will be visible in its history.

## Contact

Open an issue at https://github.com/adexh/remove-bots/issues.
