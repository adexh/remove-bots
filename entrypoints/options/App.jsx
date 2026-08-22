import { useEffect, useState } from 'react';
import { DEFAULTS, vendorNames } from '../../lib/bots.js';

/** One rule per line, blanks dropped. */
function toLines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function App() {
  const [custom, setCustom] = useState('');
  const [allowlist, setAllowlist] = useState('');
  const [showHumans, setShowHumans] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      const settings = stored || DEFAULTS;
      setCustom((settings.custom || []).join('\n'));
      setAllowlist((settings.allowlist || []).join('\n'));
      setShowHumans(!!settings.showHumans);
    });
  }, []);

  function save() {
    chrome.storage.sync.set(
      {
        custom: toLines(custom),
        allowlist: toLines(allowlist),
        showHumans,
      },
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      },
    );
  }

  return (
    <>
      <h1>Detection rules</h1>
      <p>
        One rule per line. Plain text matches anywhere in the participant name, case
        insensitive. Wrap in slashes for a regular expression, for example{' '}
        <code>/^notes? by/i</code>.
      </p>

      <h2>Always treat as a bot</h2>
      <p>For in-house or newly launched notetakers the built-in list does not know yet.</p>
      <textarea
        spellCheck="false"
        placeholder={'acme notetaker\n/^recorder \\d+$/'}
        value={custom}
        onChange={(event) => setCustom(event.target.value)}
      />

      <h2>Never remove</h2>
      <p>
        Wins over every other rule. Useful when a teammate&apos;s display name trips the
        detector.
      </p>
      <textarea
        spellCheck="false"
        placeholder={'Roberto Grain\nFathom Nguyen'}
        value={allowlist}
        onChange={(event) => setAllowlist(event.target.value)}
      />

      <label className="row">
        <input
          type="checkbox"
          checked={showHumans}
          onChange={(event) => setShowHumans(event.target.checked)}
        />
        <span>Expand the other-participants list by default</span>
      </label>

      <div className="bar">
        <button type="button" onClick={save}>
          Save
        </button>
        <span className={saved ? 'saved show' : 'saved'}>Saved</span>
      </div>

      <details>
        <summary>Bots detected out of the box</summary>
        <div className="vendors">
          {vendorNames().map((name) => (
            <div key={name}>{name}</div>
          ))}
        </div>
        <p style={{ marginTop: '12px' }}>
          Plus generic names containing notetaker, bot, recorder, transcription, AI
          assistant, or meeting notes.
        </p>
      </details>
    </>
  );
}
