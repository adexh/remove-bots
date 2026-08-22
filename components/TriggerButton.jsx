import { BotIcon } from './BotIcon.jsx';
import { removableBots, toggle } from '../lib/store.js';
import { useStore } from './useStore.js';

/**
 * The button itself, rendered into its own shadow root inside Meet's chrome.
 *
 * Stops propagation because the panel closes on any outside click, and this
 * click is what opens it.
 */
export function TriggerButton() {
  const state = useStore();
  const bots = removableBots(state.participants).length;

  return (
    <button
      type="button"
      title="Remove meeting bots"
      data-active={state.open ? 'true' : 'false'}
      onClick={(event) => {
        event.stopPropagation();
        toggle();
      }}
    >
      <BotIcon />
      <span>Bots</span>
      <span className="count" style={{ display: bots ? undefined : 'none' }}>
        {bots ? String(bots) : ''}
      </span>
    </button>
  );
}
