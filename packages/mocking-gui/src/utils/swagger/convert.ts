import { sample } from 'openapi-sampler';

import { normalizePathParams } from '../handler/pathParams';

import type { HandlerState } from '@mocking-gui-types/handler';
import type { http, JsonBodyType } from 'msw';

type OpenAPISchema = Record<string, unknown>;

type OpenAPIMediaType = {
  schema?: OpenAPISchema;
};

type OpenAPIResponse = {
  description?: string;
  // OpenAPI 3.0 spec
  content?: Record<string, OpenAPIMediaType>;
  headers?: Record<string, unknown>;
  // Swagger 2.0 spec
  schema?: OpenAPISchema;
};

type OpenAPIOperation = {
  summary?: string;
  tags?: string[];
  operationId?: string;
  responses?: Record<string, OpenAPIResponse>;
};

type OpenAPIPaths = Record<string, Partial<Record<string, OpenAPIOperation>>>;

export type OpenAPI = {
  openapi?: string;
  swagger?: string;
  info?: unknown;
  servers?: Array<{ url: string; description?: string }>;
  paths: OpenAPIPaths;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    responses?: Record<string, unknown>;
  };
  definitions?: Record<string, OpenAPISchema>;
};

const generateMockFromSchema = (schema: OpenAPISchema, specs: OpenAPI): unknown => {
  if (!schema || typeof schema !== 'object') return null;

  try {
    return sample(schema, {}, specs);
  } catch (error) {
    console.warn(
      '[MockingGUI] Failed to generate mock:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
};

export const convertSwaggerToHandlers = (baseUrl: string, swagger: OpenAPI): HandlerState[] => {
  const handlers: HandlerState[] = [];

  Object.entries(swagger.paths ?? {}).forEach(([path, operations]) => {
    Object.entries(operations ?? {}).forEach(([method, operation]) => {
      if (!operation) return;

      const httpMethod = method as keyof typeof http;

      const name = operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`;
      const responses = operation.responses ?? {};
      const handlerPath = baseUrl + normalizePathParams(path);

      const swaggerResponseVariants = Object.entries(responses).map(([statusCode, res]) => {
        const variantName = res?.description || statusCode;

        // Priority: OpenAPI 3.0 (application/json -> First content type) > Swagger 2.0
        const schema =
          res?.content?.['application/json']?.schema ??
          Object.values(res?.content ?? {})[0]?.schema ??
          res?.schema;

        let body: JsonBodyType | undefined;
        if (schema && typeof schema === 'object') {
          body = generateMockFromSchema(schema, swagger) as JsonBodyType;
        }

        // Handle "default" response: map to 500 (Internal Server Error)
        // OpenAPI spec uses "default" for responses not explicitly defined
        const status = statusCode === 'default' ? 500 : Number(statusCode);

        return {
          name: variantName,
          status,
          body,
        };
      });

      const handler: HandlerState = {
        name,
        method: httpMethod,
        url: handlerPath,
        swaggerResponseVariants,
      };
      handlers.push(handler);
    });
  });

  return handlers.sort(
    (prev, next) => Number(hasDynamicSegment(prev.url)) - Number(hasDynamicSegment(next.url)),
  );
};

/**
 * True when the URL path contains a dynamic segment (":param").
 * Splits on "/" so a scheme/port colon in the base URL (e.g. "https://" or ":8443") is never mistaken for a dynamic segment.
 */
const hasDynamicSegment = (url: string): boolean =>
  url.split('/').some(segment => segment.startsWith(':'));
