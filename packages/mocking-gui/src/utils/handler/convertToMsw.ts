import { delay, http, HttpHandler, HttpResponse, passthrough } from 'msw';

import { HandlerType } from '@mocking-gui-types/handler';

import { initialStoredHandlerVariants } from './core';
import { toMswPath } from './pathParams';
import { getHandlerKey, getVariantKey } from '../common/keys';

import type { HandlerState, RawBody, StoredHandlerVariants } from '@mocking-gui-types/handler';

export const convertToMswHandler = (
  handlers: HandlerState[] = [],
  handlerConfigs: Record<string, StoredHandlerVariants>,
): HttpHandler[] => {
  return handlers.map(handler => {
    const handlerKey = getHandlerKey(handler);
    const storedHandlerConfig =
      handlerConfigs?.[handlerKey] ?? initialStoredHandlerVariants(handler);

    if (storedHandlerConfig.type === HandlerType.MANUAL)
      return createManualHandler(handler, storedHandlerConfig);

    if (storedHandlerConfig.type === HandlerType.AUTO)
      return createAutoHandler(handler, storedHandlerConfig);

    if (storedHandlerConfig.type === HandlerType.SWAGGER)
      return createSwaggerHandler(handler, storedHandlerConfig);

    // Bypass to real server if type is null, etc.
    return http[handler.method](toMswPath(handler.url), () => passthrough());
  });
};

/**
 * @param handler handler passed to MockingGUIBoundary by user
 * @param storedHandlerConfig handler configuration values stored in local storage
 * @returns HttpHandler
 */
export const createManualHandler = (
  handler: HandlerState,
  storedHandlerConfig: StoredHandlerVariants,
): HttpHandler => {
  const { method, url, responseVariants } = handler;
  const { active, delay: delayTime, variant: variantKey = '' } = storedHandlerConfig;

  return http[method](toMswPath(url), async () => {
    try {
      const selectedVariant = responseVariants?.find(
        variant => getVariantKey(variant) === variantKey,
      );

      // Bypass to real server if inactive or no variant selected
      if (!active || !selectedVariant) {
        return passthrough();
      }

      // Apply Delay
      if (delayTime) {
        await delay(delayTime);
      }

      // NOTE: RawBody takes precedence over body.
      // TODO (@mei-yo) : Consider unifying rawBody and body.
      const rawBodyResponse = resolveRawBodyResponse(
        selectedVariant.rawBody,
        selectedVariant.status,
        selectedVariant.headers,
      );

      if (rawBodyResponse) return rawBodyResponse;

      return HttpResponse.json(selectedVariant.body ?? null, {
        status: selectedVariant.status,
        headers: selectedVariant.headers,
      });
    } catch (error) {
      console.error(
        `[MockingGUI] Error in ManualHandler for ${method} ${url}. If you want to bypass this request, please ensure the handler configuration is correct.`,
        error,
      );
      throw error;
    }
  });
};

/**
 *
 * @param handler handler passed to MockingGUIBoundary by user
 * @param storedHandlerConfig handler configuration values stored in local storage
 * @returns HttpHandler
 *
 *  Implement the conversion logic from HandlerState to MSW HttpHandler (Auto type)
 */
export const createAutoHandler = (
  handler: HandlerState,
  storedHandlerConfig: StoredHandlerVariants,
): HttpHandler => {
  const { method, url, responseVariantsFn } = handler;

  return http[method](toMswPath(url), async params => {
    try {
      // Passthrough if inactive
      if (!storedHandlerConfig.active || !responseVariantsFn) {
        return passthrough();
      }

      const { status, body, rawBody } = responseVariantsFn(params);

      // Apply Delay
      if (storedHandlerConfig?.delay) {
        await delay(storedHandlerConfig.delay);
      }

      // Method to convert to match function
      const rawBodyResponse = resolveRawBodyResponse(rawBody, status);
      if (rawBodyResponse) return rawBodyResponse;

      return HttpResponse.json(body ?? null, { status });
    } catch (error) {
      console.error(
        `[MockingGUI] Error in AutoHandler for ${method} ${url}. If you want to bypass this request, please ensure the handler configuration is correct.`,
        error,
      );
      throw error;
    }
  });
};

/**
 * Response handler based on Swagger(OpenAPI) variants
 */
export const createSwaggerHandler = (
  handler: HandlerState,
  storedHandlerConfig: StoredHandlerVariants,
): HttpHandler => {
  const { method, url, swaggerResponseVariants } = handler;
  const { active, delay: delayTime, variant: variantKey = '' } = storedHandlerConfig;

  return http[method](toMswPath(url), async () => {
    try {
      const selectedVariant = swaggerResponseVariants?.find(
        variant => getVariantKey(variant) === variantKey,
      );

      if (!active || !selectedVariant) {
        return passthrough();
      }

      if (delayTime) {
        await delay(delayTime);
      }

      return HttpResponse.json(selectedVariant.body ?? null, {
        status: selectedVariant.status,
        headers: selectedVariant.headers,
      });
    } catch (error) {
      console.error(
        `[MockingGUI] Error in SwaggerHandler for ${method} ${url}. If you want to bypass this request, please ensure the handler configuration is correct.`,
        error,
      );
      throw error;
    }
  });
};

/**
 * Resolves an `HttpResponse` based on the `rawBody` kind.
 *
 * @param rawBody - The raw body to resolve (`text` or `html`)
 * @param status - HTTP status code to include in the response
 * @param headers - Optional HTTP response headers
 * @returns `HttpResponse` for supported kinds, or `undefined` if `rawBody` is absent or has no value
 */
const resolveRawBodyResponse = (
  rawBody: RawBody | undefined,
  status: number,
  headers?: HeadersInit,
) => {
  if (!rawBody?.value) return undefined;

  if (rawBody.kind === 'text') return HttpResponse.text(rawBody.value, { status, headers });

  if (rawBody.kind === 'html') return HttpResponse.html(rawBody.value, { status, headers });

  if (rawBody.kind === 'formData') return HttpResponse.formData(rawBody.value, { status, headers });

  if (rawBody.kind === 'xml') return HttpResponse.xml(rawBody.value, { status, headers });

  if (rawBody.kind === 'arrayBuffer')
    return HttpResponse.arrayBuffer(rawBody.value, { status, headers });

  return undefined;
};
