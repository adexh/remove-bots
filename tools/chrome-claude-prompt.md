I'm debugging a Chrome extension that removes AI notetaker bots from Google Meet.
I need RAW DOM FACTS from the Meet tab that's currently in a call. Not analysis.

RULES, these matter more than being helpful:
- Report exact strings VERBATIM: full attribute values, complete generated class
  names, exact visible text including punctuation and capitalisation.
- Never paraphrase, summarise, shorten, or "clean up" a value. Never describe a
  value in words when you can quote it.
- If an attribute is absent, write `absent`. If empty, write `""`.
- Answer in fenced code blocks, numbered Q1..Q6 to match below.
- Do not remove any participant except in Q6, and cancel it there.

Q1. With the People panel CLOSED (close it first if it's open):
  a) count of document.querySelectorAll('[role="listitem"][data-participant-id]')
  b) count of document.querySelectorAll('[data-participant-id]')
  c) for the first 3 nodes matching [data-participant-id]: tagName, the COMPLETE
     class attribute value, whether it contains a <video>, how many <button>
     descendants it has, and its complete trimmed textContent.

Q2. The People / participants button in the toolbar:
  a) its complete opening tag with every attribute, children omitted
  b) its exact aria-label value
  c) if it contains an <i>/<span> holding an icon-font word, that exact text
     (e.g. "people", "group")

Q3. Now open the People panel. For EVERY [role="listitem"][data-participant-id]:
  a) the exact aria-label value
  b) the last 12 characters of data-participant-id
  c) the complete trimmed textContent
  d) for each descendant <button> or [role="button"]: its complete opening tag,
     plus its exact innerText

Q4. The bot row (the one named like Fathom / Otter / Notetaker). Hover it, then
    find its "more options" control:
  a) its complete opening tag
  b) its exact innerText (I expect an icon-font word such as "more_vert")
  c) whether it has aria-haspopup, and that value

Q5. Click that control, then report:
  a) is the menu a direct child of <body>? Give the complete opening tag of the
     container element it renders into.
  b) does that container, or ANY ancestor of the menu entries, carry
     role="menu"? Answer yes/no and quote the role value if there is one.
  c) the exact text of EVERY menu entry, verbatim, in order.
  d) for the entry that removes a participant: quote its EXACT text, then walk
     from that text's own element up through 6 ancestors. For each ancestor give
     tagName, the COMPLETE class attribute, and the values of: role, jsaction,
     tabindex, jsname, aria-label (write `absent` where missing).

Q6. Click that remove entry, then:
  a) does a confirmation dialog appear? yes/no
  b) the complete opening tag of its container, and whether role="dialog" or
     role="alertdialog" is present
  c) the exact verbatim text of every button inside it
  d) the complete opening tag of the button that CONFIRMS removal
  e) then click Cancel, or press Escape, so nobody is actually removed. Confirm
     you did this.
  If no dialog appeared and the participant WAS removed, say so explicitly.

If you are able to execute JavaScript in the page, that is strictly better:
run the script I'm pasting separately and return its console output verbatim
instead of answering Q1-Q5 by inspection.
