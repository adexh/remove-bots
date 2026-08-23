/*
 * Composition root. All state lives in useCall; the components are wired here
 * and nowhere else, so the DOM contract (src/contract.md) has one owner.
 *
 * A <main> on purpose: the extension's overlay scan walks direct children of
 * <body> and skips anything that is, or contains, a main element, which keeps
 * the app shell from being mistaken for a portalled menu.
 */
import { useCall } from './state/useCall.js';
import { TopBar } from './components/TopBar.jsx';
import { ChipGrid } from './components/ChipGrid.jsx';
import { TileGrid } from './components/TileGrid.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { PeoplePanel } from './components/PeoplePanel.jsx';

export function App() {
  const call = useCall();

  return (
    <main className="flex h-full flex-col bg-shell font-sans text-on-surface">
      {/* The header. Meet keeps the notification-and-actions chips at the TOP
          right of the call, not in the control bar, and the extension names
          this dock "header" accordingly. Meet builds it after the call view;
          in ?bare=1 that beat is four seconds, the extension's worst case for
          finding a dock. */}
      <div className="relative h-16 flex-none">
        {call.headerReady ? (
          <ChipGrid
            count={call.people.length}
            expanded={call.panelOpen}
            onTogglePeople={call.togglePanel}
          />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4 pt-0">
        <TileGrid people={call.people} />
        {call.panelOpen ? (
          <PeoplePanel
            people={call.people}
            guest={call.scenario.guest}
            onClose={call.closePanel}
            onDrop={call.drop}
          />
        ) : null}
      </div>

      <div className="relative flex h-20 flex-none items-center px-6">
        <TopBar />
        {call.headerReady ? <Toolbar guest={call.scenario.guest} /> : null}
      </div>
    </main>
  );
}
