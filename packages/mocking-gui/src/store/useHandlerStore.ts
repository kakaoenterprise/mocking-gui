import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { LOCAL_STORAGE_KEY, PERSIST_VERSION } from '@constants/key';
import { SwaggerSourceConfigOption } from '@mocking-gui-types/config';
import { syncStateToCookie } from '@utils/browser/cookie';
import { getHandlerKey } from '@utils/common/keys';
import { initialStoredHandlerVariants, validateAndUpdateStoredConfig } from '@utils/handler/core';
import {
  buildAppliedConfigs,
  computeActiveScenarioId,
  isDuplicateScenarioConfig,
} from '@utils/scenario';

import type {
  AddScenarioResult,
  HandlerStoreAction,
  HandlerStoreState,
  SwaggerSource,
} from './types';
import type { HandlerState, Scenario, StoredHandlerVariants } from '../types/handler';

const initialState: HandlerStoreState = {
  handlers: [],
  handlerConfigs: {},
  swaggerSources: [],
  scenarios: [],
  draftScenario: {},
  activeScenarioId: null,
};

export const useHandlerStore = create<HandlerStoreState & HandlerStoreAction>()(
  persist(
    (set, get) => ({
      ...initialState,
      setupInitialState: (handlers: HandlerState[]) => {
        const storedConfigs = get().handlerConfigs ?? {};
        const newConfigs: Record<string, StoredHandlerVariants> = {};
        handlers.forEach(handler => {
          const handlerKey = getHandlerKey(handler);
          newConfigs[handlerKey] = !storedConfigs[handlerKey]
            ? initialStoredHandlerVariants(handler)
            : validateAndUpdateStoredConfig(handler, storedConfigs[handlerKey]);
        });
        const nextActive = computeActiveScenarioId(
          get().activeScenarioId,
          get().scenarios,
          newConfigs,
          handlers,
        );
        set({
          handlers: handlers,
          handlerConfigs: newConfigs,
          activeScenarioId: nextActive,
        });
      },
      initSwaggerSources: (sourcesInput: SwaggerSourceConfigOption[]) => {
        const sources: SwaggerSource[] = sourcesInput.map(({ configUrl, name, docsUrl }) => {
          return {
            configUrl,
            name,
            docsUrl,
            status: 'pending',
          };
        });
        set({ swaggerSources: sources });
      },
      updateSwaggerSource: (configUrl: string, updateSource: Partial<SwaggerSource>) => {
        set(state => {
          const updated = state.swaggerSources?.map(source =>
            source.configUrl === configUrl ? { ...source, ...updateSource } : source,
          );
          return { swaggerSources: updated };
        });
      },
      initScenarios: (scenarios: Scenario[]) => {
        set(state => {
          const existingIds = new Set(state.scenarios.map(s => s.id));
          const newScenarios = scenarios.filter(s => !existingIds.has(s.id));
          return { scenarios: [...state.scenarios, ...newScenarios] };
        });
      },
      updateHandlerConfigs: (
        handlerKey: string,
        updateVariants: Partial<StoredHandlerVariants>,
      ) => {
        set(state => {
          const { handlers, handlerConfigs, scenarios, activeScenarioId, draftScenario } = state;
          const updatedConfigs = {
            ...handlerConfigs,
            [handlerKey]: { ...handlerConfigs[handlerKey], ...updateVariants },
          };

          const updatedDraft = draftScenario[handlerKey]
            ? {
                ...draftScenario,
                [handlerKey]: { ...draftScenario[handlerKey], ...updateVariants },
              }
            : draftScenario;

          const nextActive = computeActiveScenarioId(
            activeScenarioId,
            scenarios,
            updatedConfigs,
            handlers,
          );
          return {
            handlerConfigs: updatedConfigs,
            activeScenarioId: nextActive,
            draftScenario: updatedDraft,
          };
        });
      },
      addScenario: (name: string, description?: string): AddScenarioResult => {
        const { draftScenario, scenarios } = get();
        if (Object.keys(draftScenario).length === 0) {
          return { success: false, reason: 'empty_draft' };
        }

        const duplicateByName = (scenarios || []).some(s => s.name.trim() === name.trim());
        if (duplicateByName) {
          return { success: false, reason: 'duplicate_name' };
        }

        const duplicateByConfig = isDuplicateScenarioConfig(draftScenario, scenarios);
        if (duplicateByConfig) {
          return { success: false, reason: 'duplicate_config' };
        }

        const newScenario: Scenario = {
          id: crypto.randomUUID(),
          name,
          description,
          configs: { ...draftScenario },
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          scenarios: [newScenario, ...(state.scenarios || [])],
          draftScenario: {},
        }));
        return { success: true };
      },
      deleteScenario: (id: string) => {
        set(state => ({
          scenarios: state.scenarios.filter(s => s.id !== id),
        }));
      },
      activateScenario: (id: string) => {
        const { scenarios, handlers } = get();
        const scenario = scenarios.find(s => s.id === id);
        if (!scenario) return;
        const { appliedConfigs } = buildAppliedConfigs(scenario, handlers);
        set(state => ({
          handlerConfigs: {
            ...state.handlerConfigs,
            ...appliedConfigs,
          },
          activeScenarioId: id,
        }));
      },
      updateScenario: (id: string, configs: Record<string, StoredHandlerVariants>) => {
        set(state => ({
          scenarios: state.scenarios.map(s =>
            s.id === id ? { ...s, configs: { ...configs } } : s,
          ),
        }));
      },
      importScenario: (scenario: Scenario) => {
        const { scenarios } = get();
        const isExist = scenarios.some(({ id }) => id === scenario.id);
        const isDuplicate = scenarios.some(({ name }) => name.trim() === scenario.name.trim());

        if (isExist || isDuplicate) return false;
        set(state => {
          const newScenario = {
            ...scenario,
            createdAt: new Date().toISOString(),
          };
          return {
            scenarios: [newScenario, ...(state.scenarios || [])],
          };
        });
        return true;
      },
      addToDraft: (handlerKey: string, variant?: StoredHandlerVariants) => {
        const { handlerConfigs } = get();
        const config = variant || handlerConfigs[handlerKey];
        if (!config) return;
        set(state => ({
          draftScenario: {
            ...state.draftScenario,
            [handlerKey]: { ...config, active: true },
          },
        }));
      },
      removeFromDraft: (handlerKey: string) => {
        set(state => {
          const next = { ...state.draftScenario };
          delete next[handlerKey];
          return { draftScenario: next };
        });
      },
      clearDraft: () => {
        set({ draftScenario: {} });
      },
      deactivateScenario: () => {
        const { handlers, handlerConfigs, scenarios, activeScenarioId } = get();
        const activeScenario = scenarios.find(s => s.id === activeScenarioId);
        if (!activeScenario) {
          set({ activeScenarioId: null });
          return;
        }
        const scenarioKeys = new Set(Object.keys(activeScenario.configs));
        const updatedConfigs = { ...handlerConfigs };
        handlers.forEach(handler => {
          const key = getHandlerKey(handler);
          if (scenarioKeys.has(key)) {
            updatedConfigs[key] = initialStoredHandlerVariants(handler);
          }
        });
        set({
          handlerConfigs: updatedConfigs,
          activeScenarioId: null,
        });
      },
      resetAllHandlerConfigs: () => {
        const { handlers } = get();
        const newConfigs: Record<string, StoredHandlerVariants> = {};
        handlers.forEach(handler => {
          const handlerKey = getHandlerKey(handler);
          newConfigs[handlerKey] = initialStoredHandlerVariants(handler);
        });
        set({
          handlerConfigs: newConfigs,
          activeScenarioId: null,
          draftScenario: {},
        });
      },
    }),
    {
      name: LOCAL_STORAGE_KEY.MOCKING_GUI_HANDLERS,
      version: PERSIST_VERSION,
      partialize: state => ({
        handlerConfigs: state.handlerConfigs,
        scenarios: state.scenarios || [],
        activeScenarioId: state.activeScenarioId,
      }),
    },
  ),
);

// Sync state to cookie on change (Browser side only)
if (typeof window !== 'undefined') {
  useHandlerStore.subscribe(state => {
    syncStateToCookie(state.handlerConfigs);
  });
}
