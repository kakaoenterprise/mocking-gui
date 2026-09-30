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

/**
 * Whether a handler is currently switched on.
 *
 * Used to label a response as mocked instead of inspecting its body. Body
 * sniffing looked fine until a handler answered with a Swagger variant whose
 * document declared no schema: the body was `null`, the check dereferenced it,
 * and the page went blank. What answered a request is a property of the panel,
 * not of the payload.
 */
export const isHandlerActive = (handlerKey: string): boolean =>
  readMockState().handlerConfigs?.[handlerKey]?.active === true;
