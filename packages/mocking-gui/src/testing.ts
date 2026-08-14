export type { ApplyScenarioOptions, InitScriptCapable } from './api/adapter';
export { applyScenario } from './api/adapter';
export type {
  DefinedHandler,
  HandlerByName,
  HandlerNameOf,
  HandlerRegistry,
  Selection,
  VariantName,
} from './api/define';
export { defineHandlers } from './api/define';
export type { ScenarioOptions, Unique } from './api/scenario';
export { extendScenario, scenario } from './api/scenario';
export type { ScenarioStateEntry } from './api/serialize';
export { serializeScenario } from './api/serialize';
export type { Scenario } from './types/handler';
