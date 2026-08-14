import { LOCAL_STORAGE_KEY, PERSIST_VERSION } from '../constants/key';
import { COOKIE_KEY, encodeHandlerConfigsToCookieValue } from '../utils/browser/cookie';

import type { Scenario } from '../types/handler';

/**
 * The serialized payload shape is owned entirely by this library.
 *
 * Consumers reach it only through {@link serializeScenario} and
 * `applyScenario`, and describe what they
 * want with a typed `Scenario` — so no consumer code encodes the envelope, and
 * there is nothing for them to pin a version against.
 *
 * **If the envelope shape ever changes**, the coupling to handle is the stored
 * data, not consumer code:
 *
 * 1. Bump {@link PERSIST_VERSION} and add a `migrate` handler to the store, so
 *    state persisted by an older build is upgraded rather than discarded.
 * 2. Release it as a major version and describe it under a scenario-injection
 *    heading in the changelog.
 * 3. Consumers re-run their suite; nothing in their code needs editing, because
 *    the payload is rebuilt from their `Scenario` objects on every run.
 *
 * Point 3 is what makes a version handshake unnecessary: `scenario()` is
 * deterministic (fixed `createdAt`, slug-derived `id`), so a harness never has
 * to persist a serialized payload as a fixture — it can always re-serialize.
 * Do not snapshot the envelope into a file; snapshot the `Scenario` instead.
 */

/** A single localStorage-shaped key/value pair produced for test injection. */
export interface ScenarioStateEntry {
  key: string;
  value: string;
}

/**
 * Serializes a `Scenario` into the same envelope shape zustand's `persist`
 * middleware writes to `localStorage` (`LOCAL_STORAGE_KEY.MOCKING_GUI_HANDLERS`),
 * so it can be injected before app boot (e.g. Playwright `addInitScript`,
 * Cypress `localStorage` seeding) to deterministically activate a scenario.
 */
export const serializeScenario = (scenario: Scenario): ScenarioStateEntry => {
  const value = JSON.stringify({
    state: {
      handlerConfigs: scenario.configs,
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    },
    version: PERSIST_VERSION,
  });

  return {
    key: LOCAL_STORAGE_KEY.MOCKING_GUI_HANDLERS,
    value,
  };
};

/**
 * Serializes a `Scenario` into the same cookie name/value shape
 * `syncStateToCookie` writes at runtime, reusing the extracted pure encoder
 * so client and SSR/test-injection paths cannot drift (Risk 4).
 */
/**
 * Internal: used by `applyScenario({ ssr: true })`. Not part of the public
 * entry point — a consumer needing the cookie needs the localStorage seed too,
 * and `applyScenario` is what keeps the two in step.
 */
export const serializeScenarioCookie = (scenario: Scenario): { name: string; value: string } => ({
  name: COOKIE_KEY,
  value: encodeHandlerConfigsToCookieValue(scenario.configs),
});
