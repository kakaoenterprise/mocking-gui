import { getHandlerKey, hashHandlerKey } from '../common/keys';
import {
  COOKIE_KEY,
  ENTRY_SEPARATOR,
  FIELD_SEPARATOR,
  SYNC_FORMAT_PREFIX,
  charToType,
  decodeVariant,
  getCookie,
} from '../common/syncFormat';
import { initialStoredHandlerVariants } from '../handler/core';

import type { HandlerState, StoredHandlerVariants } from '@mocking-gui-types/handler';

/**
 * Reads the raw sync value from the cookie string.
 *
 * - v2 writes a single `mocking_gui_sync` cookie.
 * - Legacy (≤ 1.0.6) wrote either a single cookie or `_0.._N` chunks and never
 *   removed the other form. When both are present the state most likely grew
 *   (single → chunks), so the chunks are read first; this only matters for the
 *   first request before the upgraded browser code clears the legacy cookies.
 */
const readSyncCookieValue = (cookieString: string): string | null => {
  const single = getCookie(cookieString, COOKIE_KEY);
  if (single && single.startsWith(SYNC_FORMAT_PREFIX)) return single;

  let chunked = '';
  for (let index = 0; index < 100; index++) {
    const chunk = getCookie(cookieString, `${COOKIE_KEY}_${index}`);
    if (!chunk) break;
    chunked += chunk;
  }
  if (chunked.length > 0) return chunked;

  return single || null;
};

type HashIndex = Map<string, HandlerState | 'collision'>;

const indexHandlersByHash = (handlers: HandlerState[]): HashIndex => {
  const index: HashIndex = new Map();
  handlers.forEach(handler => {
    const hash = hashHandlerKey(getHandlerKey(handler));
    index.set(hash, index.has(hash) ? 'collision' : handler);
  });
  return index;
};

/**
 * Messages already logged by this process. The same mismatch (e.g. a Swagger
 * source registered only in the browser) recurs on every SSR request, so each
 * distinct message is logged once instead of once per request.
 */
const warnedMessages = new Set<string>();

const warnSkipped = (reason: string, hashes: string[]) => {
  if (hashes.length === 0) return;
  const message =
    `[MockingGUI] Ignored ${hashes.length} sync cookie entr${hashes.length === 1 ? 'y' : 'ies'} ` +
    `(${reason}): ${hashes.slice(0, 5).join(', ')}${hashes.length > 5 ? ', …' : ''}`;
  if (warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(message);
};

const parseV2 = (
  value: string,
  handlers: HandlerState[],
): Record<string, StoredHandlerVariants> => {
  const configs: Record<string, StoredHandlerVariants> = {};
  const index = indexHandlersByHash(handlers);
  const entries = value.slice(SYNC_FORMAT_PREFIX.length).split(ENTRY_SEPARATOR).filter(Boolean);

  const unknown: string[] = [];
  const collided: string[] = [];
  const malformed: string[] = [];

  entries.forEach(entry => {
    const [hash, typeChar, encodedVariant] = entry.split(FIELD_SEPARATOR);
    const handler = index.get(hash);

    if (!handler) {
      unknown.push(hash);
      return;
    }
    if (handler === 'collision') {
      collided.push(hash);
      return;
    }

    try {
      const defaults = initialStoredHandlerVariants(handler);
      const type = typeChar ? charToType(typeChar) : defaults.type;
      const variant =
        encodedVariant === undefined
          ? defaults.variant
          : decodeVariant(encodedVariant) || undefined;

      configs[getHandlerKey(handler)] = { ...defaults, active: true, type, variant };
    } catch {
      malformed.push(hash);
    }
  });

  warnSkipped('no registered handler matches the hash', unknown);
  warnSkipped('hash collision between registered handlers', collided);
  warnSkipped('malformed variant encoding', malformed);

  return configs;
};

const parseLegacy = (value: string): Record<string, StoredHandlerVariants> => {
  const configs: Record<string, StoredHandlerVariants> = {};
  const entries: [string, string, string][] = JSON.parse(decodeURIComponent(value));

  entries.forEach(([key, typeChar, variant]) => {
    if (!key || !typeChar) {
      console.warn('[MockingGUI] Invalid entry in sync cookie:', [key, typeChar, variant]);
      return;
    }

    configs[key] = { active: true, type: charToType(typeChar), variant: variant || undefined };
  });

  return configs;
};

/**
 * Reconstructs handler configurations from the SSR sync cookie.
 *
 * @param cookieString - Raw cookie string from the request header
 * @param handlers - Handlers registered on the server (`mocks` + loaded `swagger`);
 *                   needed to resolve v2 hash references and restore defaults
 * @returns Configurations for every handler the cookie marks active. Handlers
 *          not listed keep their default (inactive) state downstream.
 */
export const reconstructHandlerConfigsFromCookie = (
  cookieString: string,
  handlers: HandlerState[] = [],
): Record<string, StoredHandlerVariants> => {
  const value = readSyncCookieValue(cookieString);
  if (!value) return {};

  try {
    const isV2 = value.startsWith(SYNC_FORMAT_PREFIX);
    const configs = isV2 ? parseV2(value, handlers) : parseLegacy(value);

    console.log('[MockingGUI] Server-side state reconstructed from cookie', {
      count: Object.keys(configs).length,
      format: isV2 ? 'v2' : 'legacy',
    });

    return configs;
  } catch (error) {
    console.error(
      '[MockingGUI] Failed to parse mocking_gui_sync cookie. ' +
        'This may indicate a corrupted or malformed cookie. ' +
        'SSR will use default handler configurations.',
      error,
    );
    return {};
  }
};
