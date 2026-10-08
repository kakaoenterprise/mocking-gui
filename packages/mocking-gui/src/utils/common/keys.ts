import { generateNormalizedUrl } from '../handler/pathParams';

import type { HandlerResponseVariant, HandlerState } from '@mocking-gui-types/handler';

/**
 *
 * @param handler
 * @description Specifies the handlerKey value for handlerConfig.
 */
export const getHandlerKey = (handler: HandlerState) => {
  return `${handler.method}.${handler.url}`;
};

/**
 * Short, deterministic reference to a handler key for the SSR sync cookie:
 * FNV-1a 32-bit over UTF-16 code units, rendered in base36 (≤ 7 chars).
 * Browser and server compute it from the same `getHandlerKey` string, so the
 * cookie can carry the hash instead of the full (absolute-URL) key.
 */
export const hashHandlerKey = (handlerKey: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < handlerKey.length; i++) {
    hash ^= handlerKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/**
 * Key for merging/matching swagger & manual handlers: method + normalized URL(Origin + Path)
 */
export const getHandlerUniqueKey = (handler: HandlerState) => {
  const normalizedUrl = generateNormalizedUrl(handler.url);
  return `${handler.method}.${normalizedUrl}`;
};

/**
 *
 * @param variants
 * @description Specifies the selected variant key value when handlerConfig type is MANUAL.
 */
export const getVariantKey = (variant: HandlerResponseVariant) => {
  return variant.name;
};

/**
 * @param handlerKey
 * @description Splits handlerKey back into method and url.
 */
export const getHandlerInfoFromKey = (handlerKey: string) => {
  const firstDotIndex = handlerKey.indexOf('.');
  const method = firstDotIndex > -1 ? handlerKey.substring(0, firstDotIndex) : 'API';
  const url = firstDotIndex > -1 ? handlerKey.substring(firstDotIndex + 1) : handlerKey;
  return { method, url };
};
