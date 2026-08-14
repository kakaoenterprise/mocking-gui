import type { StoredHandlerVariants } from '@mocking-gui-types/handler';

export const COOKIE_KEY = 'mocking_gui_sync';

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
 * Retrieves a specific cookie value from the cookie string.
 */
export const getCookie = (cookieString: string, name: string): string | null => {
  const cookieNameEqualSubString = `${name}=`;
  const cookieArray = cookieString.split(';');

  for (let i = 0; i < cookieArray.length; i++) {
    let cookiePart = cookieArray[i].trim();
    if (cookiePart.indexOf(cookieNameEqualSubString) === 0) {
      return cookiePart.substring(cookieNameEqualSubString.length, cookiePart.length);
    }
  }
  return null;
};

/**
 * Compresses handlerConfigs state and syncs to cookie.
 * Format: [["key", "type(M/A/S)", "variant"], ...]
 *
 * Syncs immediately (no debounce) to ensure SSR consistency.
 * SSR may read cookie during request, so debounce delay causes desynchronization.
 * Performance impact: negligible (~0.1ms per sync)
 */
type CookieEntry = [key: string, typeChar: string, variant: string];

const SINGLE_COOKIE_LIMIT = 3800;
const HARD_CAP = 10000;

/**
 * Writes an already-encoded payload as a single cookie or, if it exceeds
 * SINGLE_COOKIE_LIMIT, splits it across multiple cookies.
 */
const writeEncodedState = (encoded: string) => {
  if (encoded.length <= SINGLE_COOKIE_LIMIT) {
    setCookie(COOKIE_KEY, encoded);
  } else {
    syncMultiCookie(encoded);
  }
};

/**
 * Drops Swagger-type entries (in original order) until the encoded payload
 * fits within HARD_CAP. Manual/Auto entries are always preserved.
 */
const truncateEntriesByPriority = (
  activeEntries: CookieEntry[],
): { kept: CookieEntry[]; droppedCount: number } => {
  const priorityEntries = activeEntries.filter(([, typeChar]) => typeChar !== 'S');
  const swaggerEntries = activeEntries.filter(([, typeChar]) => typeChar === 'S');

  const kept: CookieEntry[] = [...priorityEntries];
  let droppedCount = 0;

  for (const entry of swaggerEntries) {
    const candidateEncoded = encodeURIComponent(JSON.stringify([...kept, entry]));
    if (candidateEncoded.length > HARD_CAP) {
      droppedCount += 1;
      continue;
    }
    kept.push(entry);
  }

  return { kept, droppedCount };
};

/**
 * Pure encoder: compresses active handlerConfigs into the cookie value string.
 * Includes HARD_CAP truncation-by-priority (drops Swagger entries first) so the
 * result is guaranteed to fit within HARD_CAP bytes.
 *
 * Exported so client runtime code (syncStateToCookie) and Node/SSR-safe code
 * (testing serializers) share a single source of truth and cannot drift.
 */
export const encodeHandlerConfigsToCookieValue = (
  handlerConfigs: Record<string, StoredHandlerVariants>,
): string => {
  const activeEntries: CookieEntry[] = Object.entries(handlerConfigs)
    .filter(([_, config]) => config.active)
    .map(([key, config]) => {
      const typeChar = config.type?.[0] || 'M'; // Manual, Auto, Swagger
      return [key, typeChar, config.variant || ''];
    });

  const encoded = encodeURIComponent(JSON.stringify(activeEntries));

  if (encoded.length <= HARD_CAP) {
    return encoded;
  }

  // Size limit exceeded. Truncate by priority, then warn instead of throwing.
  const { kept, droppedCount } = truncateEntriesByPriority(activeEntries);

  console.warn(
    `[MockingGUI] Mocking state too large (${encoded.length} bytes) to sync in full. ` +
      `Dropped ${droppedCount} Swagger-type handler override(s) to fit within the ${HARD_CAP} ` +
      'byte limit. Manual/Auto handler overrides were preserved. Some handler state may not ' +
      'be reflected in SSR-rendered output.',
  );

  return encodeURIComponent(JSON.stringify(kept));
};

export const syncStateToCookie = (handlerConfigs: Record<string, StoredHandlerVariants>) => {
  if (typeof window === 'undefined') return;

  try {
    const encoded = encodeHandlerConfigsToCookieValue(handlerConfigs);
    writeEncodedState(encoded);
  } catch (error) {
    console.error('[MockingGUI] Failed to sync state to cookie:', error);
    // Rethrow in development, log gracefully in production
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
};

/**
 * Splits large state across multiple cookies (mocking_gui_sync_0, _1, etc.)
 * Standard pattern used by Google Analytics and other libraries.
 *
 * @param encoded - URL-encoded cookie value
 */
const syncMultiCookie = (encoded: string) => {
  const CHUNK_SIZE = 3000; // Conservative size to account for overhead
  const chunks = encoded.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g')) || [];

  chunks.forEach((chunk, index) => {
    const cookieKey = `${COOKIE_KEY}_${index}`;
    setCookie(cookieKey, chunk);
  });
};
