export const LOCAL_STORAGE_KEY = {
  MOCKING_GUI_HANDLERS: 'MOCKING_GUI_HANDLERS',
  MOCKING_GUI_PANEL: 'MOCKING_GUI_PANEL',
} as const;

/**
 * Version stamped on the persisted store envelope.
 *
 * Passed explicitly to zustand's `persist` **and** used by the scenario
 * serializer, so the value the store expects on rehydrate and the value an
 * injected payload carries are the same constant — not two numbers that happen
 * to agree. Bumping it requires adding a `migrate` handler to the store.
 *
 * Zustand's own default is 0; making it explicit is what removes the guesswork.
 */
export const PERSIST_VERSION = 0;
