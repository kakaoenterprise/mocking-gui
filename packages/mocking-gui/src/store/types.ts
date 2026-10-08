import { SwaggerSourceConfigOption } from '@mocking-gui-types/config';

import type { HandlerState, Scenario, StoredHandlerVariants } from '@mocking-gui-types/handler';

export type SwaggerSourceStatus = 'pending' | 'success' | 'error';
export type SwaggerSource = {
  name: string;
  configUrl: string;
  docsUrl?: string;
  status: SwaggerSourceStatus;
  count?: number;
  lastFetchedAt?: string;
  errorMessage?: string;
};

export type HandlerStoreState = {
  handlers: HandlerState[];
  /**
   * Config values set for each Handler
   */
  handlerConfigs: Record<string, StoredHandlerVariants>;
  /**
   * Swagger URL and load status passed to the Provider
   */
  swaggerSources?: SwaggerSource[];
  /**
   */
  expired?: string;
  /**
   * List of saved scenarios
   */
  scenarios: Scenario[];
  /**
   * Temporary storage before saving as a scenario
   */
  draftScenario: Record<string, StoredHandlerVariants>;
  /**
   * Currently active scenario ID
   */
  activeScenarioId: string | null;
};

export type AddScenarioResult =
  | { success: true }
  | { success: false; reason: 'duplicate_name' | 'duplicate_config' | 'empty_draft' };

export type HandlerStoreAction = {
  setupInitialState: (handlers: HandlerState[]) => void;

  /**
   * Initializes Swagger URL status.
   */
  initSwaggerSources: (sourcesInput: SwaggerSourceConfigOption[]) => void;

  /**
   * Updates the status of a specific Swagger URL.
   */
  updateSwaggerSource: (configUrl: string, updateSource: Partial<SwaggerSource>) => void;
  /**
   * @description Updates the configuration value of a specific handler in handlerConfigs
   * @param handlerKey : key of handlerConfigs
   * @param updates : Values to update
   */
  updateHandlerConfigs: (
    handlerKey: string,
    updateVariants: Partial<StoredHandlerVariants>,
  ) => void;
  /**
   * Scenario related actions
   */
  initScenarios: (scenarios: Scenario[]) => void;
  addScenario: (name: string, description?: string) => AddScenarioResult;
  deleteScenario: (id: string) => void;
  activateScenario: (id: string) => void;
  updateScenario: (id: string, configs: Record<string, StoredHandlerVariants>) => void;
  deactivateScenario: () => void;
  importScenario: (scenario: Scenario) => boolean;
  importScenarios: (scenarios: Scenario[]) => number;

  /**
   * Draft related actions
   */
  addToDraft: (handlerKey: string, variant?: StoredHandlerVariants) => void;
  removeFromDraft: (handlerKey: string) => void;
  clearDraft: () => void;

  /**
   * Resets all handler configurations to their initial state.
   */
  resetAllHandlerConfigs: () => void;
};
