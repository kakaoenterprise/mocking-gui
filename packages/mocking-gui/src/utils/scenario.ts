import { HandlerType, ScenarioMatchStatus } from '../types/handler';
import { getHandlerKey } from './common/keys';
import { validateAndUpdateStoredConfig } from './handler/core';
import type { HandlerState, Scenario, StoredHandlerVariants } from '../types/handler';

export type MatchStats = {
  total: number;
  matched: number;
};

const isNonNullObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Computes how many handlers in a scenario match the current stored configurations.
 *
 * @param scenario - The scenario to check against.
 * @param configs - The current stored handler configurations.
 * @param handlers - The list of current handler states.
 * @returns Match statistics (total handlers in scenario vs. those matching current config).
 */
export const computeScenarioMatchStats = (
  scenario: Scenario,
  configs: Record<string, StoredHandlerVariants>,
  handlers: HandlerState[],
): MatchStats => {
  const entries = Object.entries(scenario.configs);
  const handlerKeys = new Set(handlers.map(h => getHandlerKey(h)));
  let total = 0;
  let matched = 0;
  for (const [key, desired] of entries) {
    if (!handlerKeys.has(key)) continue;
    total += 1;
    const current = configs[key];
    if (!current || !current.active) continue;
    const exact =
      current.type === desired.type &&
      (current.variant ?? undefined) === (desired.variant ?? undefined);
    if (exact) matched += 1;
  }
  return { total, matched };
};

/**
 * Checks if a set of handler configurations matches any existing scenario's configuration.
 * Used to prevent duplicate scenario registration with the same handler combination.
 *
 * @param newConfigs - The configuration map to check.
 * @param existingScenarios - List of already saved scenarios.
 * @returns true if a scenario with the exact same handler-variant combination exists.
 */
export const isDuplicateScenarioConfig = (
  newConfigs: Record<string, StoredHandlerVariants>,
  existingScenarios: Scenario[],
): boolean => {
  const newKeys = Object.keys(newConfigs);
  if (newKeys.length === 0) return false;

  return existingScenarios.some(scenario => {
    const existingConfigs = scenario.configs;
    const existingKeys = Object.keys(existingConfigs);

    if (newKeys.length !== existingKeys.length) return false;

    return newKeys.every(key => {
      const newCfg = newConfigs[key];
      const existCfg = existingConfigs[key];
      if (!existCfg) return false;

      return (
        newCfg.type === existCfg.type &&
        (newCfg.variant ?? undefined) === (existCfg.variant ?? undefined) &&
        newCfg.active === existCfg.active
      );
    });
  });
};

/**
 * Determines how closely the current handler configurations match a given Scenario.
 *
 * Returns ACTIVE only if all handlers defined in the scenario are present and match
 * the current session's active variants exactly.
 *
 * @param scenario The scenario to compare against current configs
 * @param configs Current stored handler config map
 * @param handlers Current handler states (used to check presence)
 * @returns ScenarioMatchStatus indicating the match level
 */
export const getScenarioStatus = (
  scenario: Scenario,
  configs: Record<string, StoredHandlerVariants>,
  handlers: HandlerState[],
): ScenarioMatchStatus => {
  const { total, matched } = computeScenarioMatchStats(scenario, configs, handlers);

  // If all handlers in the scenario are matched with current session's config,
  // we consider it fully ACTIVE.
  return total > 0 && matched === total ? ScenarioMatchStatus.ACTIVE : ScenarioMatchStatus.INACTIVE;
};

export const computeActiveScenarioId = (
  activeId: string | null,
  scenarios: Scenario[],
  nextConfigs: Record<string, StoredHandlerVariants>,
  handlers: HandlerState[],
): string | null => {
  if (!activeId) return null;
  const scenario = scenarios.find(({ id }) => id === activeId);
  if (!scenario) return null;
  const status = getScenarioStatus(scenario, nextConfigs, handlers);
  return status === ScenarioMatchStatus.ACTIVE ? activeId : null;
};

/**
 * Builds a subset of handler configs derived from a Scenario,
 * applying only entries that exist in current handlers.
 *
 * @param scenario The scenario source
 * @param handlers Current handler states
 * @returns Applied configs and simple counters (total, applied)
 */
export const buildAppliedConfigs = (
  scenario: Scenario,
  handlers: HandlerState[],
): { appliedConfigs: Record<string, StoredHandlerVariants>; total: number; applied: number } => {
  const keySet = new Set(handlers.map(handler => getHandlerKey(handler)));
  const appliedConfigs: Record<string, StoredHandlerVariants> = {};
  let total = 0;
  let applied = 0;
  for (const [hKey, cfg] of Object.entries(scenario.configs)) {
    total += 1;
    if (!keySet.has(hKey)) continue;
    const target = handlers.find(handler => getHandlerKey(handler) === hKey);
    if (!target) continue;
    appliedConfigs[hKey] = validateAndUpdateStoredConfig(target, {
      ...cfg,
      active: cfg.active,
    });
    applied += 1;
  }
  return { appliedConfigs, total, applied };
};

/**
 * Encodes a Scenario object into a Base64 string for sharing.
 * Uses UTF-8 encoding to ensure all characters are preserved.
 *
 * @param scenario - The scenario object to encode.
 * @returns A Base64 string representing the encoded scenario.
 */
export const encodeScenario = (scenario: Scenario): string => {
  try {
    const json = JSON.stringify(scenario);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error('[MockingGUI] Failed to encode scenario', e);
    throw new Error('Failed to generate scenario code');
  }
};

/**
 * Validates the structure and content of a Scenario object.
 *
 * @param data - The object to validate.
 * @returns true if the object is a valid Scenario, false otherwise.
 */
export const isValidScenario = (data: unknown): data is Scenario => {
  if (!isNonNullObject(data)) return false;
  const id = data['id'];
  const name = data['name'];
  const createdAt = data['createdAt'];
  const configs = (data as Record<string, unknown>)['configs'];
  if (typeof id !== 'string' || typeof name !== 'string' || typeof createdAt !== 'string') {
    return false;
  }
  if (!isNonNullObject(configs)) return false;
  for (const value of Object.values(configs)) {
    if (!isNonNullObject(value)) return false;
    if (!('active' in value)) return false;
  }
  return true;
};

/**
 * Decodes a shared scenario string (Base64) back into a Scenario object.
 * Supports various Base64 variants and handles malformed input gracefully.
 *
 * @param input - The encoded scenario string.
 * @returns The decoded Scenario object, or null if decoding fails or data is invalid.
 */
export const decodeScenario = (input: string): Scenario | null => {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;

  const normalizeBase64Input = (raw: string) => {
    let base64String = raw.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const remainder = base64String.length % 4;
    if (remainder === 2) base64String += '==';
    else if (remainder === 3) base64String += '=';
    return base64String;
  };

  const decodeUtf8 = (b64: string) => {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch {
      // Fallback for non-standard Base64 or URI encoded data
      try {
        return decodeURIComponent(atob(b64));
      } catch {
        return null;
      }
    }
  };

  try {
    const normalizedBase64 = normalizeBase64Input(trimmedInput);
    const json = decodeUtf8(normalizedBase64);
    if (!json) return null;

    const parsed = JSON.parse(json);
    if (isValidScenario(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.warn(
      '[MockingGUI] Scenario decoding failed:',
      e instanceof Error ? e.message : String(e),
    );
  }

  return null;
};

/**
 * Decodes a shared scenario string using Web APIs for robust UTF-8 handling.
 * Uses a Data URL with fetch → Response.json() pipeline to avoid manual byte processing.
 *
 * @param input - The encoded scenario string.
 * @returns Promise resolving to Scenario or null if decoding fails/invalid.
 */
export const decodeScenarioAsync = async (input: string): Promise<Scenario | null> => {
  if (!input) return null;

  const normalizeBase64Input = (raw: string) => {
    let base64 = raw.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const remainder = base64.length % 4;
    if (remainder === 2) base64 += '==';
    else if (remainder === 3) base64 += '=';
    return base64;
  };
  try {
    const base64Payload = normalizeBase64Input(input);
    const response = await fetch(`data:application/json;base64,${base64Payload}`);
    const parsedJson = await response.json();
    return isValidScenario(parsedJson) ? (parsedJson as Scenario) : null;
  } catch (err) {
    console.warn(
      '[MockingGUI] Scenario async decoding failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
};

/**
 * Retrieves the status code for a given handler configuration.
 *
 * @param handlerKey - The key of the handler.
 * @param config - The stored configuration for the handler.
 * @param handlers - The list of current handler states.
 * @returns The status code, or undefined if not found.
 */
export const getVariantStatusCode = (
  handlerKey: string,
  config: Partial<StoredHandlerVariants>,
  handlers: HandlerState[],
) => {
  const target = handlers.find(handler => getHandlerKey(handler) === handlerKey);
  if (!target) return undefined;

  if (config.type === HandlerType.AUTO) {
    return 'Auto';
  }

  if (!config.variant) return undefined;

  if (config.type === HandlerType.MANUAL) {
    const variant = target.responseVariants?.find(({ name }) => name === config.variant);
    return variant?.status || 'Default';
  }

  if (config.type === HandlerType.SWAGGER) {
    const variant = target.swaggerResponseVariants?.find(({ name }) => name === config.variant);
    return variant?.status || 'Default';
  }

  return undefined;
};

/**
 * Downloads a list of scenarios as a JSON file.
 *
 * @param scenarios - The scenarios to export.
 * @param fileName - Optional custom filename.
 */
export const exportScenariosToFile = (
  scenarios: Scenario[],
  fileName = 'mocking-gui-scenarios.json',
) => {
  try {
    const json = JSON.stringify(scenarios, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[Mocking GUI] Failed to export scenarios', e);
    alert('Failed to export scenarios to file.');
  }
};

/**
 * Selects the scenarios of an import batch that can be saved, keeping their original order.
 * An entry is dropped when its id or name collides with a saved scenario or with an entry
 * already accepted from this batch.
 *
 * @param incoming - The scenarios to import, in source order.
 * @param existing - The scenarios already saved.
 * @returns The importable scenarios, in source order.
 */
export const selectImportableScenarios = (
  incoming: Scenario[],
  existing: Scenario[],
): Scenario[] => {
  const ids = new Set(existing.map(({ id }) => id));
  const names = new Set(existing.map(({ name }) => name.trim()));
  const importable: Scenario[] = [];

  for (const scenario of incoming) {
    const name = scenario.name.trim();
    if (ids.has(scenario.id) || names.has(name)) continue;
    ids.add(scenario.id);
    names.add(name);
    importable.push(scenario);
  }

  return importable;
};

/**
 * Parses a JSON file into a list of scenarios.
 * Validates each scenario in the list.
 *
 * @param file - The JSON file to parse.
 * @returns Promise resolving to a list of valid scenarios.
 */
export const parseScenariosFromFile = async (file: File): Promise<Scenario[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        const validScenarios: Scenario[] = [];

        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (isValidScenario(item)) validScenarios.push(item);
          });
        } else if (isValidScenario(parsed)) {
          validScenarios.push(parsed);
        }

        resolve(validScenarios);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        reject(new Error(`Invalid JSON format: ${message}`));
      }
    };
    reader.onerror = () => {
      const message = reader.error?.message || 'Unknown error';
      reject(new Error(`Failed to read file: ${message}`));
    };
    reader.readAsText(file);
  });
};
