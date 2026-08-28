import { serializeScenarioCookie, serializeScenario } from './serialize';

import type { Scenario } from '../types/handler';

/**
 * Structural subset of the Playwright `BrowserContext` API needed to inject a
 * serialized scenario before app boot. Kept minimal and dependency-free so
 * this module never imports Playwright (or any runner package) directly — any
 * runner exposing these two methods works.
 *
 * Both methods are typed as returning `Promise<unknown>` rather than
 * `Promise<void>`: Playwright's `addInitScript` resolves to a `Disposable`
 * (1.49+), and a `Promise<void>` return type would reject a real
 * `BrowserContext` outright. Only the awaited side effect matters here.
 */
export interface InitScriptCapable {
  addInitScript(
    script: (arg: { key: string; value: string; origin: string }) => void,
    arg: { key: string; value: string; origin: string },
  ): Promise<unknown>;
  addCookies(cookies: { name: string; value: string; url: string }[]): Promise<unknown>;
}

export interface ApplyScenarioOptions {
  /**
   * Origin of the page the scenario applies to, e.g. `http://localhost:5173`.
   *
   * Guards the localStorage write so an auth redirect through a third-party
   * origin cannot be seeded by accident, and scopes the sync cookie. Required
   * rather than optional: a single mandatory option cannot be confused with
   * another or forgotten.
   */
  origin: string;
  /**
   * Also write the sync cookie, so a server-rendered first paint sees the same
   * scenario as the client. Defaults to `false`.
   */
  ssr?: boolean;
}

/**
 * Applies a `Scenario` to a test runner's browser context: seeds localStorage
 * via `addInitScript` so it is present before app boot, and additionally sets
 * the sync cookie when `options.ssr` is set.
 */
export const applyScenario = async (
  context: InitScriptCapable,
  scenario: Scenario,
  options: ApplyScenarioOptions,
): Promise<void> => {
  const { key, value } = serializeScenario(scenario);

  // NOTE: this callback is serialized and executed inside the page by the test
  // runner. It must be fully self-contained and must NOT close over any
  // variable from this scope.
  await context.addInitScript(
    (arg: { key: string; value: string; origin: string }) => {
      if (window.location.origin !== arg.origin) return;
      window.localStorage.setItem(arg.key, arg.value);
    },
    { key, value, origin: options.origin },
  );

  if (options.ssr) {
    await context.addCookies([{ ...serializeScenarioCookie(scenario), url: options.origin }]);
  }
};
