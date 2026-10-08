/**
 * Readers for the panel's persisted state.
 *
 * The library exposes no API for asking "is this handler on?", so the zustand
 * envelope is read directly — the same coupling `seedDefaults` documents. It is
 * isolated here so there is one place to change when a public API arrives.
 */
export const MOCK_STATE_STORAGE_KEY = 'MOCKING_GUI_HANDLERS';

type PersistedState = {
  handlerConfigs?: Record<string, { active?: boolean } | undefined>;
  scenarios?: { id: string }[];
  activeScenarioId?: string | null;
};

export const readMockState = (): PersistedState => {
  try {
    const raw = localStorage.getItem(MOCK_STATE_STORAGE_KEY);
    if (!raw) return {};

    const state = JSON.parse(raw)?.state;
    return state && typeof state === 'object' ? (state as PersistedState) : {};
  } catch {
    return {};
  }
};
