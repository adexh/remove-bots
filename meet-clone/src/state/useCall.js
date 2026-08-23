/*
 * All call state in one hook, owned by App and passed down as props, so the
 * pieces built by different hands cannot disagree about who is in the call.
 */
import { useMemo, useState, useEffect } from 'react';
import { buildCast, readScenario } from '../data.js';

export function useCall() {
  const scenario = useMemo(readScenario, []);
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

  return {
    scenario,
    people,
    panelOpen,
    headerReady,
    togglePanel: () => setPanelOpen((open) => !open),
    closePanel: () => setPanelOpen(false),
    drop,
  };
}
