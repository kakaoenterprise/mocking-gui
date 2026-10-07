import { handlers } from '@/mocks/handlers';

/**
 * Turns the demo's handlers on for a first-time visitor.
 *
 * WHY THIS EXISTS: `HandlerConfigOption` has no way to declare a handler active
 * by default, and the library seeds every new handler with `active: false`. That
 * is a sensible default for a real app — nothing should start intercepting
 * without being asked — but it means a visitor's first click on this page would
 * hit a passthrough and fail. So we pre-seed the persisted store.
 *
 * CAVEAT: this writes the library's internal persistence shape
 * (`MOCKING_GUI_HANDLERS`, a zustand `persist` envelope) and would need updating
 * if that shape changes. A public "default on" option, or a programmatic
 * `applyMockState()`, would remove the need for it entirely.
 *
 * Returning visitors are left alone — whatever they configured wins.
 */
const STORAGE_KEY = 'MOCKING_GUI_HANDLERS';

type SeededConfig = {
  active: boolean;
  type: 'Manual' | 'Auto' | null;
  variant?: string;
  delay: number;
};

export const seedDefaultMockState = () => {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const handlerConfigs: Record<string, SeededConfig> = {};

    for (const handler of handlers) {
      const handlerKey = `${handler.method}.${handler.url}`;

      if (handler.responseVariantsFn) {
        handlerConfigs[handlerKey] = { active: true, type: 'Auto', delay: 0 };
        continue;
      }

      const firstVariant = handler.responseVariants?.[0]?.name;
      handlerConfigs[handlerKey] = firstVariant
        ? { active: true, type: 'Manual', variant: firstVariant, delay: 0 }
        : { active: false, type: null, delay: 0 };
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { handlerConfigs, scenarios: [], activeScenarioId: null },
        version: 0,
      }),
    );
  } catch {
    // Private browsing or blocked storage — the panel still works, the visitor
    // just has to switch handlers on by hand.
  }
};
