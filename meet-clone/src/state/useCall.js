/*
 * All call state in one hook, owned by App and passed down as props, so the
 * pieces built by different hands cannot disagree about who is in the call.
 */
import { useState, useEffect } from 'react';
import { buildCast, readScenario, writeScenario } from '../data.js';

export function useCall() {
  const [scenario, setScenario] = useState(readScenario);
  const [people, setPeople] = useState(() => buildCast(scenario));
  const [panelOpen, setPanelOpen] = useState(false);

  /* Bare: the header renders a beat after the page, as on a cold join. */
  const [headerReady, setHeaderReady] = useState(!scenario.bare);
  useEffect(() => {
    if (headerReady) return undefined;
    const timer = setTimeout(() => setHeaderReady(true), 4000);
    return () => clearTimeout(timer);
  }, [headerReady]);

  const drop = (id) => setPeople((prev) => prev.filter((p) => p.id !== id));

  /*
   * Live scenario edits from the tester bar: merge, mirror to the URL, and
   * rebuild the cast from scratch. Rebuilding forgets earlier removals, which
   * is what a tester wants, a clean take of the new scenario. Deliberately
   * leaves headerReady alone so toggling bare never replays the join delay.
   */
  const updateScenario = (partial) => {
    const next = { ...scenario, ...partial };
    setScenario(next);
    writeScenario(next);
    setPeople(buildCast(next));
  };

  return {
    scenario,
    updateScenario,
    people,
    panelOpen,
    headerReady,
    togglePanel: () => setPanelOpen((open) => !open),
    closePanel: () => setPanelOpen(false),
    drop,
  };
}
