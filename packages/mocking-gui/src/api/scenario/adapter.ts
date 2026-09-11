import { serializeScenarioCookie, serializeScenario } from './serialize';

import type { Scenario } from '../../types/handler';

type InitScriptArg = { key: string; value: string; origin: string };
type CookieRecord = { name: string; value: string; url: string };

interface InitScriptHost {
  addInitScript(script: (arg: InitScriptArg) => void, arg: InitScriptArg): Promise<unknown>;
}

/**
 * Structural subset of a browser-automation driver needed to inject a
 * serialized scenario before app boot. Dependency-free on purpose — any driver
 * exposing these methods works:
 *
 * - Playwright `BrowserContext`: `addInitScript` + `addCookies`
 * - WebdriverIO v9 `browser`: `addInitScript` + `setCookies`
 *
 * Methods return `Promise<unknown>` rather than `Promise<void>` because
 * Playwright's `addInitScript` resolves to a `Disposable` (1.49+).
 */
export type InitScriptCapable = InitScriptHost &
  ({ addCookies(cookies: CookieRecord[]): Promise<unknown> } | { setCookies(cookies: CookieRecord[]): Promise<unknown> });

const writeCookies = (context: InitScriptCapable, cookies: CookieRecord[]): Promise<unknown> =>
  'addCookies' in context ? context.addCookies(cookies) : context.setCookies(cookies);

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
    (arg: InitScriptArg) => {
      if (window.location.origin !== arg.origin) return;
      window.localStorage.setItem(arg.key, arg.value);
    },
    { key, value, origin: options.origin },
  );

  if (options.ssr) {
    await writeCookies(context, [{ ...serializeScenarioCookie(scenario), url: options.origin }]);
  }
};
