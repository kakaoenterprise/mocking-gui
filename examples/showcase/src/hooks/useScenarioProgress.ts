import { useEffect, useState } from 'react';

import { readMockState } from '@/lib/mockState';

/**
 * Where the visitor is in the import flow, read from the panel's own state.
 *
 * The page needs this to guide anybody through registering a scenario: without
 * it, "now import it in the panel" is an instruction with no feedback, and a
 * reader who mis-clicks has no way to tell.
 *
 * CAVEAT: the library exposes no API for this, so the persisted zustand
 * envelope is read directly — the same coupling `seedDefaults` documents. The
 * panel writes it in this document, which does not raise a `storage` event, so
 * it is polled rather than subscribed to.
 */
const POLL_MS = 600;

export type ScenarioProgress = {
  importedIds: Set<string>;
  activeId: string | null;
};

const read = (): ScenarioProgress => {
  const state = readMockState();
  const scenarios = Array.isArray(state.scenarios) ? state.scenarios : [];

  return {
    importedIds: new Set(scenarios.map(scenario => scenario.id)),
    activeId: typeof state.activeScenarioId === 'string' ? state.activeScenarioId : null,
  };
};

const same = (a: ScenarioProgress, b: ScenarioProgress) =>
  a.activeId === b.activeId &&
  a.importedIds.size === b.importedIds.size &&
  [...a.importedIds].every(id => b.importedIds.has(id));

export const useScenarioProgress = (): ScenarioProgress => {
  const [progress, setProgress] = useState<ScenarioProgress>(read);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress(current => {
        const next = read();
        return same(current, next) ? current : next;
      });
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return progress;
};
