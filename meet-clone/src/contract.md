# The DOM contract this clone must honour

The Remove Bots extension (see ../lib/meet.js) drives Google Meet through
these DOM facts. Every component in this clone keeps them true, and nothing
may "improve" them away:

1. **Video tiles** carry `data-participant-id` and are NOT inside any
   `[role="listitem"]`. They exist with the People panel closed.
2. **Roster rows** exist only while the People panel is open:
   `[role="listitem"][data-participant-id]`, with the participant's name as
   the row's `aria-label`. Badges beside the name ("(You)", "Meeting host",
   "Visitor", "domain_disabled", "devices") are whole leaf spans, never
   concatenated into one text node.
3. **The People chip** is a `[role="button"]` with accessible name "People"
   (its `aria-label`), `aria-haspopup="dialog"`, inside a `[role="region"]`
   whose computed display is `grid`. That region is where the extension docks
   its own button, in an implicit grid cell, so the grid must tolerate an
   extra child.
4. **The row overflow button** has `textContent` exactly `more_vert`
   (rendered as a glyph by the Material Symbols ligature font), plus
   `aria-label="More actions"` and `aria-haspopup="menu"`. A disabled mute
   button (`aria-label="You can't unmute someone else"`) sits beside it.
5. **The row menu** is portalled to `document.body`: a visible
   `[role="menu"]` of `[role="menuitem"]` entries, one reading
   "Remove from the call" (with glyph word `remove_circle_outline` in front,
   as a separate leaf). Participants who cannot be removed simply have no
   such entry, which is how Meet behaves for non-hosts.
6. **The confirm dialog** (only some removals confirm) is portalled to
   `document.body` WITHOUT `role="dialog"`: a heading
   "Remove NAME from the call?", a "Cancel" button and a "Remove" button.
   The extension finds "Remove" by overlay text scan, smallest match wins.
7. **Decoys stay decoys**: "Chat with everyone" (aria-haspopup, name matches
   /everyone/), "Host controls" (host mode only), "Meeting tools". Clicking
   them must never open the People panel.
8. The app shell is a `<main>`, so the extension's overlay scan skips it.
9. Scenario query params, same as the other fixtures: `?bots=N` extra bots,
   `?guest=1` you are not the host, `?bare=1` header renders 4s late.
