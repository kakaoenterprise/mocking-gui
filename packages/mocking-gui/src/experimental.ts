/**
 * `@kakaocloud/mocking-gui/experimental`
 *
 * Staging entry for features published under the `alpha` / `beta` dist-tags.
 * Everything exported here is **outside semver guarantees**: a minor release may
 * change or remove it. When a feature graduates it moves to its domain entry
 * (e.g. `@kakaocloud/mocking-gui/scenario`) and stays here as a `@deprecated`
 * re-export for one minor release. See ADR-0006.
 */

/** @experimental Scenario authoring & injection API. Graduates to `./scenario`. */
export {
  applyScenario,
  defineRegistry,
  defineScenario,
  extendScenario,
  serializeScenario,
} from './api/scenario';

/** @experimental */
export type {
  ApplyScenarioOptions,
  DefinedHandler,
  HandlerByName,
  HandlerNameOf,
  HandlerRef,
  HandlerRegistry,
  InitScriptCapable,
  ScenarioOptions,
  ScenarioStateEntry,
  Selection,
  VariantName,
} from './api/scenario';
export type { Scenario } from './types/handler';
