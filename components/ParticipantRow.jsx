import { select } from '../lib/store.js';

function tagFor(person) {
  if (person.tier === 'vendor') return { cls: 'known', label: 'known bot' };
  if (person.tier === 'custom') return { cls: 'known', label: 'your rule' };
  if (person.tier === 'builtin') return { cls: 'likely', label: 'built in' };
  if (person.tier === 'likely') return { cls: 'likely', label: 'likely bot' };
  return null;
}

/*
 * The secondary line under a name: why the row is listed.
 *
 * person.removable is deliberately not surfaced: Meet renders a row's overflow
 * control only on hover, so a scan-time miss is not evidence that host controls
 * are missing. The removal run reports the real reason.
 */
function explain(person) {
  if (person.builtin) return person.reason + '. Turn it off from the Meet toolbar.';
  if (person.self) return 'That is you';
  if (person.reason) return person.reason + (person.visitor ? ' - guest, no account' : '');
  if (person.visitor) return 'Guest, no account';
  return '';
}

export function ParticipantRow({ person, checked, status, running, hidden }) {
  const tag = tagFor(person);
  const why = (status && status.message) || explain(person);
  const classes = ['row', status && status.phase === 'busy' ? 'busy' : '',
    status && status.phase === 'done' ? 'done' : ''].filter(Boolean).join(' ');

  return (
    <li className={classes} data-id={person.id}>
      <input
        type="checkbox"
        checked={checked}
        disabled={person.self || person.builtin || running}
        onChange={(event) => select(person.id, event.target.checked)}
      />
      <div className="row-body">
        <span className="row-name">
          {person.name}
          {tag ? <span className={'tag ' + tag.cls}>{tag.label}</span> : null}
          {hidden ? <span className="tag hidden">hidden</span> : null}
        </span>
        {why ? <span className="row-why">{why}</span> : null}
      </div>
      {status && status.label ? (
        <span className={'row-status ' + (status.kind || '')}>{status.label}</span>
      ) : null}
    </li>
  );
}
