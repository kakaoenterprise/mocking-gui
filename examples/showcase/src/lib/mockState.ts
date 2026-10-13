/**
 * Readers for the panel's persisted state.
 *
 * The library exposes no API for asking "is this handler on?", so the zustand
 * envelope is read directly — the same coupling `seedDefaults` documents. It is
 * isolated here so there is one place to change when a public API arrives.
 */
export const MOCK_STATE_STORAGE_KEY = 'MOCKING_GUI_HANDLERS';

export type PersistedHandlerConfig = {
  active?: boolean;
  type?: 'Manual' | 'Auto' | 'Swagger' | null;
  variant?: string;
  delay?: number;
};

type PersistedState = {
  handlerConfigs?: Record<string, PersistedHandlerConfig | undefined>;
  scenarios?: { id: string }[];
  activeScenarioId?: string | null;
};

/** The key the panel stores a handler's config under. */
export const handlerKey = (method: string, url: string) => `${method}.${url}`;

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
