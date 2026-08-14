import { generateNormalizedUrl } from '../handler/pathParams';

import type { HandlerResponseVariant, HandlerState } from '@mocking-gui-types/handler';

/**
 *
 * @param handler
 * @description Specifies the handlerKey value for handlerConfig.
 */
export const getHandlerKey = (handler: Pick<HandlerState, 'method' | 'url'>) => {
  return `${handler.method}.${handler.url}`;
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
