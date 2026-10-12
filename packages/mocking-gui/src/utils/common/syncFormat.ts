import { HandlerType } from '@mocking-gui-types/handler';

/**
 * Shared vocabulary of the SSR sync cookie, used by both the browser writer
 * (`utils/browser/cookie.ts`) and the server reader (`utils/server/state.ts`).
 *
 * v2 value format:
 *
 *   v2~<entry>~<entry>~...
 *   entry := <hash>[.<type>[.<variant>]]
 *
 * - `hash`    fnv1a-32 of the handler key, base36 (see `hashHandlerKey`)
 * - `type`    M | A | S — present only when it differs from the handler's
 *             determined default type
 * - `variant` present only when it differs from the handler's default variant;
 *             written verbatim when it is `[A-Za-z0-9_-]*`, otherwise as
 *             `!` + base64url(UTF-8)
 *
 * Every character of the value belongs to `encodeURIComponent`'s unreserved
 * set (`A-Z a-z 0-9 - _ . ! ~`). Cookie APIs that re-serialize values — e.g.
 * Next.js `cookies().toString()` runs `encodeURIComponent` on each value —
 * therefore return the bytes unchanged, and `cookie.parse`-style decoding is
 * a no-op too. The format must stay stable under decode → encode.
 *
 * Only active handlers are listed; everything omitted falls back to the
 * server-side default, so the cookie carries the delta from default state.
 */
export const COOKIE_KEY = 'mocking_gui_sync';

/**
 * Upper bound for the encoded value. The real limit is the request-header
 * total (Node 16 KB, nginx 8 KB), shared with every other cookie on the site,
 * so the library keeps its own share under one 4 KB cookie.
 */
export const COOKIE_BUDGET = 3800;

export const SYNC_FORMAT_PREFIX = 'v2~';
export const ENTRY_SEPARATOR = '~';
export const FIELD_SEPARATOR = '.';
const OPAQUE_VARIANT_MARKER = '!';
const PLAIN_VARIANT = /^[A-Za-z0-9_-]*$/;

export type SyncTypeChar = 'M' | 'A' | 'S';

export const typeToChar = (type: HandlerType | null | undefined): SyncTypeChar => {
  if (type === HandlerType.AUTO) return 'A';
  if (type === HandlerType.SWAGGER) return 'S';
  return 'M';
};

/** Unknown characters map to Swagger, matching the legacy format's fallback. */
export const charToType = (char: string): HandlerType => {
  if (char === 'M') return HandlerType.MANUAL;
  if (char === 'A') return HandlerType.AUTO;
  return HandlerType.SWAGGER;
};

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (encoded: string) => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * Encodes a variant name into the cookie-safe, re-encoding-stable alphabet.
 */
export const encodeVariant = (variant: string): string =>
  PLAIN_VARIANT.test(variant) ? variant : OPAQUE_VARIANT_MARKER + toBase64Url(variant);

/**
 * Inverse of `encodeVariant`. Throws on malformed base64url input.
 */
export const decodeVariant = (encoded: string): string =>
  encoded.startsWith(OPAQUE_VARIANT_MARKER) ? fromBase64Url(encoded.slice(1)) : encoded;

/**
 * Retrieves a specific cookie value from a `Cookie` header / `document.cookie` string.
 */
export const getCookie = (cookieString: string, name: string): string | null => {
  const prefix = `${name}=`;
  const parts = cookieString.split(';');

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.indexOf(prefix) === 0) {
      return part.substring(prefix.length);
    }
  }
  return null;
};

/**
 * Lists the names of every cookie present in a cookie string.
 */
export const listCookieNames = (cookieString: string): string[] =>
  cookieString
    .split(';')
    .map(part => part.trim().split('=')[0])
    .filter(name => name.length > 0);

/**
 * Names of every cookie the sync writer (current or previous versions) may
 * have created: the single cookie and legacy `_0`, `_1`, … chunks.
 */
export const isSyncCookieName = (name: string) =>
  name === COOKIE_KEY || new RegExp(`^${COOKIE_KEY}_\\d+$`).test(name);
