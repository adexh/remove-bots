import { ParticipantRow } from './ParticipantRow.jsx';
import {
  allowed,
  matches,
  openOptions,
  removableBots,
  removeSelected,
  scan,
  selectAll,
  selectedIds,
  setOpen,
  setQuery,
  tryAnyway,
} from '../lib/store.js';
import { useStore } from './useStore.js';

/* Below this many participants a search box is just clutter. */
const SEARCH_THRESHOLD = 8;

/* Breathing room between the button, the panel and the window edge. */
const GAP = 8;
const MARGIN = 12;
/* Under this, opening downwards is not worth it; go up instead. */
const MIN_USEFUL = 260;

/**
 * Where to put the panel, and how tall it may be.
 *
 * A flat max-height ignores how much room is actually below the button, which
 * ran the panel off the bottom of the screen. So the height is whatever fits,
 * and if the button sits low (the floating fallback lives near the bottom) the
 * panel opens upwards instead.
 *
 * @param {DOMRect|null} rect the button's box, or null before it is placed
 */
function place(rect) {
  const viewport = window.innerHeight;
  const anchorTop = rect && rect.height ? rect.top : 52;
  const anchorBottom = rect && rect.height ? rect.bottom : 52;

  const below = viewport - anchorBottom - GAP - MARGIN;
  const above = anchorTop - GAP - MARGIN;
  const openUp = below < MIN_USEFUL && above > below;

  const room = Math.max(160, Math.min(viewport * 0.7, openUp ? above : below));
  const style = { right: MARGIN + 'px', maxHeight: Math.round(room) + 'px' };

  if (openUp) style.bottom = Math.round(viewport - anchorTop + GAP) + 'px';
  else style.top = Math.round(anchorBottom + GAP) + 'px';

  return style;
}

/**
 * The panel, portalled into its own shadow root and anchored under the button.
 *
 * @param {{anchorRect: DOMRect|null}} props where the button currently is, so
 *   the panel follows it when Meet's header re-renders and it moves.
 */
export function Panel({ anchorRect }) {
  const state = useStore();

  const allBots = removableBots(state.participants).concat(
    state.participants.filter((p) => p.isBot && p.builtin),
  );
  const allOthers = state.participants.filter((p) => !p.isBot);

  const bots = allBots.filter((p) => matches(p, state.query));
  const others = allOthers.filter((p) => matches(p, state.query));
  const filtering = !!state.query.trim();

  /* "All" ticks what is on screen, not what the search is hiding. */
  const tickable = bots.filter((p) => !p.builtin && !p.self);
  const allTicked = tickable.length > 0 && tickable.every((p) => state.selected[p.id]);

  const chosen = selectedIds();
  const visibleIds = new Set(bots.concat(others).map((p) => p.id));
  const hiddenChosen = chosen.filter((id) => !visibleIds.has(id)).length;

  const showSearch = state.participants.length > SEARCH_THRESHOLD;
  const canRemove = allowed();

  return (
    <div className="panel" style={place(anchorRect)}>
      <div className="head">
        <h2>Remove meeting bots</h2>
        <div className="head-actions">
          <button
            type="button"
            className="chip"
            disabled={state.running || state.scanning}
            onClick={scan}
          >
            Rescan
          </button>
          <button type="button" className="icon-btn" title="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
      </div>

      <p className="summary">{state.summary}</p>
      {state.notice ? <p className="notice">{state.notice}</p> : null}

      {/* Said before a run rather than after it: a guest clicking Remove gets
          a row of red failures, which reads like a broken extension. */}
      {canRemove ? null : (
        <div className="notice warn">
          <p>
            You are not the host of this meeting, so Meet will probably refuse to remove
            anyone. Ask the host to remove them, or to make you a co-host.
          </p>
          {state.roleWhy ? <p className="why">Read from Meet: {state.roleWhy}.</p> : null}
          <button type="button" className="chip" onClick={tryAnyway}>
            Try anyway
          </button>
        </div>
      )}

      {showSearch ? (
        <div className="search">
          <input
            type="search"
            placeholder="Search by name"
            aria-label="Search participants by name"
            value={state.query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}

      {/* Only this middle section scrolls: the Remove button must stay reachable
          however many bots the meeting has collected. */}
      <div className="scroll">
        {bots.length ? (
          <>
            <div className="list-head">
              <label className="check-all">
                <input
                  type="checkbox"
                  checked={allTicked}
                  disabled={state.running || tickable.length === 0}
                  onChange={(event) =>
                    selectAll(
                      event.target.checked,
                      tickable.map((p) => p.id),
                    )
                  }
                />
                <span>{allTicked ? 'All' : 'Select all'}</span>
              </label>
              <span className="muted">
                {chosen.length} selected
                {hiddenChosen ? (
                  <span className="hidden-note"> ({hiddenChosen} hidden by search)</span>
                ) : null}
              </span>
            </div>
            <ul>
              {bots.map((person) => (
                <ParticipantRow
                  key={person.id}
                  person={person}
                  checked={!!state.selected[person.id]}
                  status={state.statuses[person.id]}
                  running={state.running}
                />
              ))}
            </ul>
          </>
        ) : null}

        {!bots.length && filtering ? (
          <p className="empty">No bots match “{state.query}”.</p>
        ) : null}

        {others.length ? (
          <details open={filtering || undefined}>
            <summary>
              {others.length === 1 ? '1 other participant' : others.length + ' other participants'}
            </summary>
            <p className="hint">Tick anyone here to remove them too.</p>
            <ul>
              {others.map((person) => (
                <ParticipantRow
                  key={person.id}
                  person={person}
                  checked={!!state.selected[person.id]}
                  status={state.statuses[person.id]}
                  running={state.running}
                />
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="foot">
        <button
          type="button"
          className="primary"
          disabled={state.running || state.scanning || chosen.length === 0 || !canRemove}
          onClick={removeSelected}
        >
          {chosen.length
            ? 'Remove ' + chosen.length + (chosen.length === 1 ? ' bot' : ' bots')
            : 'Remove bots'}
        </button>
        <button type="button" className="link" onClick={openOptions}>
          Rules
        </button>
      </div>
    </div>
  );
}
