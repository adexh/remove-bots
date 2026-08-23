/*
 * Meet's People side panel: the white card that holds the roster.
 *
 * Contract points 2 and 4 (src/contract.md) are enforced by the row markup
 * here: rows are [role="listitem"][data-participant-id] named through
 * aria-label, badges and glyph words are whole leaf spans (the extension's
 * name cleanup, LABELS.nameNoise in lib/meet.js, matches leaves exactly and
 * would fail on concatenated text), and the overflow button's textContent is
 * exactly "more_vert", which is how the extension tells it apart from the
 * disabled mute button beside it.
 */
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { initials } from '../data.js';
import { RowMenu } from './RowMenu.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';

export function PeoplePanel({ people, guest, onClose, onDrop }) {
  /* Which row's menu is open, and the button that opened it: the menu is
   * positioned off that button's live getBoundingClientRect. */
  const [menuFor, setMenuFor] = useState(null);
  const [confirmFor, setConfirmFor] = useState(null);

  const toggleMenu = (person, event) => {
    const anchor = event.currentTarget;
    setMenuFor((open) =>
      open && open.person.id === person.id ? null : { person, anchor }
    );
  };

  const removeRequested = (person) => {
    if (person.confirm === 'overlay') setConfirmFor(person);
    else onDrop(person.id);
  };

  const confirmRemove = () => {
    const id = confirmFor.id;
    setConfirmFor(null);
    /* The dialog closes first and the row disappears a beat later, the same
     * order as Meet's server round trip; the extension waits on the row.
     * flushSync because a timer callback is not an event: nothing else would
     * force the commit while the extension polls the roster. */
    window.setTimeout(() => flushSync(() => onDrop(id)), 200);
  };

  return (
    <aside className="flex w-[360px] flex-none flex-col overflow-hidden rounded-2xl bg-surface-panel text-on-panel">
      <header className="flex flex-none items-center justify-between py-3 pl-6 pr-3">
        <h2 className="text-lg font-normal">People</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-panel-muted hover:bg-black/5"
        >
          <i className="material-icon text-xl">close</i>
        </button>
      </header>

      <div className="flex-none px-6 pb-2 text-[11px] font-medium uppercase tracking-wider text-on-panel-muted">
        In call
      </div>

      <div role="list" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {people.map((p) => (
          <div
            key={p.id}
            role="listitem"
            data-participant-id={p.id}
            aria-label={p.name}
            className="flex items-center gap-3 rounded-lg px-3 py-1.5"
          >
            <span
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: `hsl(${p.hue} 30% 55%)` }}
            >
              {initials(p.name)}
            </span>

            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-sm">{p.name}</span>
              {p.self ? <Badge>(You)</Badge> : null}
              {p.host ? <Badge>Meeting host</Badge> : null}
              {p.visitor ? <Badge>Visitor</Badge> : null}
            </span>

            {p.visitor ? <Glyph>domain_disabled</Glyph> : null}
            <Glyph>devices</Glyph>

            {p.visitor ? (
              <button
                type="button"
                disabled
                aria-label="You can't unmute someone else"
                className="flex h-9 w-9 flex-none cursor-default items-center justify-center rounded-full text-on-panel-muted opacity-60"
              >
                <i className="material-icon text-xl">mic_off</i>
              </button>
            ) : null}

            <button
              type="button"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={
                menuFor && menuFor.person.id === p.id ? 'true' : 'false'
              }
              onClick={(event) => toggleMenu(p, event)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-on-panel-muted hover:bg-black/5"
            >
              <i className="material-icon text-xl">more_vert</i>
            </button>
          </div>
        ))}
      </div>

      {menuFor ? (
        <RowMenu
          person={menuFor.person}
          guest={guest}
          anchor={menuFor.anchor}
          onClose={() => setMenuFor(null)}
          onRemove={removeRequested}
        />
      ) : null}

      {confirmFor ? (
        <ConfirmDialog
          person={confirmFor}
          onCancel={() => setConfirmFor(null)}
          onConfirm={confirmRemove}
        />
      ) : null}
    </aside>
  );
}

function Badge({ children }) {
  return (
    <span className="flex-none rounded bg-black/5 px-1.5 py-0.5 text-[11px] text-on-panel-muted">
      {children}
    </span>
  );
}

function Glyph({ children }) {
  return (
    <span className="material-icon flex-none text-lg text-on-panel-muted">
      {children}
    </span>
  );
}
