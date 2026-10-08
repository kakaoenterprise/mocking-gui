import { getHandlerKey, hashHandlerKey } from '../common/keys';
import {
  COOKIE_BUDGET,
  COOKIE_KEY,
  ENTRY_SEPARATOR,
  FIELD_SEPARATOR,
  SYNC_FORMAT_PREFIX,
  encodeVariant,
  getCookie,
  isSyncCookieName,
  listCookieNames,
  typeToChar,
} from '../common/syncFormat';
import { initialStoredHandlerVariants } from '../handler/core';

import type { HandlerState, StoredHandlerVariants } from '@mocking-gui-types/handler';

export { COOKIE_BUDGET, COOKIE_KEY, getCookie };

/**
 * Sets a cookie in the browser environment.
 */
export const setCookie = (name: string, value: string, days: number = 7) => {
  if (typeof document === 'undefined') return;

  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}${expires}; path=/`;
};

/**
 * Expires a cookie immediately. Must use the same `path` the writer used.
 */
export const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

/**
 * Removes every cookie this library (any version) may have written:
 * the single `mocking_gui_sync` and legacy `mocking_gui_sync_N` chunks.
 * Only names actually present in `document.cookie` are touched.
 */
export const clearSyncCookies = () => {
  if (typeof document === 'undefined') return;
  listCookieNames(document.cookie).filter(isSyncCookieName).forEach(deleteCookie);
};

let ssrSyncEnabled = true;

/**
 * Turns the SSR sync cookie on or off (`MockingConfig.ssrSync`). While off,
 * every sync call removes the library's cookies instead of writing one, so a
 * browser-only project carries no `mocking_gui_sync` cookie on its requests.
 */
export const setSsrSyncEnabled = (enabled: boolean) => {
  ssrSyncEnabled = enabled;
};

type SyncEntry = { key: string; encoded: string; isSwagger: boolean };

const buildEntry = (
  key: string,
  config: StoredHandlerVariants,
  handler: HandlerState | undefined,
): SyncEntry => {
  const defaults = handler ? initialStoredHandlerVariants(handler) : null;
  const typeChar = typeToChar(config.type);
  const variant = config.variant ?? '';

  const typeDiffers = !defaults || typeToChar(defaults.type) !== typeChar;
  const variantDiffers = !defaults || (defaults.variant ?? '') !== variant;

  let encoded = hashHandlerKey(key);
  if (typeDiffers || variantDiffers) {
    encoded += FIELD_SEPARATOR + (typeDiffers ? typeChar : '');
  }
  if (variantDiffers) {
    encoded += FIELD_SEPARATOR + encodeVariant(variant);
  }

  return { key, encoded, isSwagger: typeChar === 'S' };
};

const join = (entries: SyncEntry[]) =>
  SYNC_FORMAT_PREFIX + entries.map(entry => entry.encoded).join(ENTRY_SEPARATOR);

/**
 * Drops Swagger-type entries (in original order) until the encoded payload fits
 * the budget. Manual/Auto entries are always preserved, so the result can still
 * exceed the budget when they alone are too large; the caller reports that.
 */
const fitToBudget = (entries: SyncEntry[], budget: number) => {
  if (join(entries).length <= budget) return { kept: entries, dropped: [] as SyncEntry[] };

  const kept = entries.filter(entry => !entry.isSwagger);
  const dropped: SyncEntry[] = [];
  let length = join(kept).length;

  for (const entry of entries) {
    if (!entry.isSwagger) continue;
    const next = length + ENTRY_SEPARATOR.length + entry.encoded.length;
    if (next > budget) {
      dropped.push(entry);
      continue;
    }
    kept.push(entry);
    length = next;
  }

  // Restore original order so the server applies entries deterministically.
  const order = new Map(entries.map((entry, index) => [entry, index]));
  kept.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  return { kept, dropped };
};

const sampleKeys = (entries: SyncEntry[]) =>
  entries
    .slice(0, 5)
    .map(entry => entry.key)
    .join(', ');

/**
 * Encodes the active part of `handlerConfigs` as the v2 sync cookie value.
 * `handlers` supplies each handler's default type/variant so unchanged values
 * can be omitted; a key with no registered handler is written explicitly.
 *
 * Warns and drops Swagger entries when the result would exceed `budget`.
 */
export const encodeSyncState = (
  handlerConfigs: Record<string, StoredHandlerVariants>,
  handlers: HandlerState[] = [],
  budget: number = COOKIE_BUDGET,
): string => {
  const handlerByKey = new Map(handlers.map(handler => [getHandlerKey(handler), handler]));

  const entries = Object.entries(handlerConfigs)
    .filter(([, config]) => config.active)
    .map(([key, config]) => buildEntry(key, config, handlerByKey.get(key)));

  const { kept, dropped } = fitToBudget(entries, budget);
  const encoded = join(kept);

  if (dropped.length > 0) {
    console.warn(
      `[MockingGUI] Mocking state too large to sync in full. Dropped ${dropped.length} Swagger ` +
        `handler override(s) to stay within the ${budget} byte cookie budget (e.g. ${sampleKeys(dropped)}). ` +
        'Manual/Auto handler overrides were preserved. Some handler state may not be ' +
        'reflected in SSR-rendered output.',
    );
  }
  if (encoded.length > budget) {
    console.warn(
      `[MockingGUI] Mocking state (${encoded.length} bytes) exceeds the ${budget} byte cookie ` +
        `budget even with every Swagger override dropped: ${kept.length} Manual/Auto overrides ` +
        'are active. The browser may reject the cookie and SSR will then fall back to defaults. ' +
        'Disable some handlers to restore SSR synchronization.',
    );
  }

  return encoded;
};

/**
 * Syncs handlerConfigs to the SSR sync cookie.
 *
 * Every write first removes all cookies previous writes (of any version) left
 * behind, then writes exactly one cookie — or none when nothing is active —
 * so the request header never accumulates stale state (issue #45).
 *
 * Syncs immediately (no debounce) to ensure SSR consistency.
 */
export const syncStateToCookie = (
  handlerConfigs: Record<string, StoredHandlerVariants>,
  handlers: HandlerState[] = [],
) => {
  if (typeof window === 'undefined') return;

  if (!ssrSyncEnabled) {
    clearSyncCookies();
    return;
  }

  try {
    const encoded = encodeSyncState(handlerConfigs, handlers);

    clearSyncCookies();
    if (encoded !== SYNC_FORMAT_PREFIX) {
      setCookie(COOKIE_KEY, encoded);
    }
  } catch (error) {
    console.error('[MockingGUI] Failed to sync state to cookie:', error);
    // Rethrow in development, log gracefully in production
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
};
