import { ParticipantRow } from './ParticipantRow.jsx';
import {
  openOptions,
  removableBots,
  removeSelected,
  scan,
  selectAll,
  selectedIds,
  setOpen,
} from '../lib/store.js';
import { useStore } from './useStore.js';

/**
 * The panel, portalled into its own shadow root and anchored under the button.
 *
 * @param {{anchorRect: DOMRect|null}} props where the button currently is, so
 *   the panel follows it when Meet's header re-renders and it moves.
 */
export function Panel({ anchorRect }) {
  const state = useStore();

  const bots = removableBots(state.participants).concat(
    state.participants.filter((p) => p.isBot && p.builtin),
  );
  const others = state.participants.filter((p) => !p.isBot);

  const removable = removableBots(state.participants);
  const allTicked = removable.length > 0 && removable.every((p) => state.selected[p.id]);
  const chosen = selectedIds().length;

  const top = anchorRect && anchorRect.height ? Math.round(anchorRect.bottom + 8) : 60;

  return (
    <div className="panel" style={{ top: top + 'px', right: '12px' }}>
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

      {bots.length ? (
        <>
          <div className="list-head">
            <label className="check-all">
              <input
                type="checkbox"
                checked={allTicked}
                disabled={state.running}
                onChange={(event) => selectAll(event.target.checked)}
              />
              <span>{allTicked ? 'All' : 'Select all'}</span>
            </label>
            <span className="muted">{chosen} selected</span>
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

      {others.length ? (
        <details>
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

      <div className="foot">
        <button
          type="button"
          className="primary"
          disabled={state.running || state.scanning || chosen === 0}
          onClick={removeSelected}
        >
          {chosen ? 'Remove ' + chosen + (chosen === 1 ? ' bot' : ' bots') : 'Remove bots'}
        </button>
        <button type="button" className="link" onClick={openOptions}>
          Rules
        </button>
      </div>
    </div>
  );
}
