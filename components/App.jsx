import { createPortal } from 'react-dom';
import { Panel } from './Panel.jsx';
import { TriggerButton } from './TriggerButton.jsx';
import { useStore } from './useStore.js';

/**
 * One React root for both pieces.
 *
 * The button renders where the root is mounted, inside Meet's chrome; the panel
 * is portalled into a second shadow root attached to <body>, so it can be
 * position: fixed without Meet's header clipping it. One root means the two
 * share state with no cross-root plumbing.
 *
 * @param {{panelTarget: ShadowRoot, anchor: () => HTMLElement|null}} props
 */
export function App({ panelTarget, anchor }) {
  const state = useStore();

  /* Read on every render, and state.placedAt changes when the button moves,
   * so the panel re-anchors instead of pointing at where the button used to be. */
  const host = anchor();
  const anchorRect = host ? host.getBoundingClientRect() : null;
  void state.placedAt;

  return (
    <>
      <TriggerButton />
      {state.open ? createPortal(<Panel anchorRect={anchorRect} />, panelTarget) : null}
    </>
  );
}
