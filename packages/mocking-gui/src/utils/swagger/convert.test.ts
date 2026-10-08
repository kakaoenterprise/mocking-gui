import { describe, it, expect, vi } from 'vitest';
import { convertSwaggerToHandlers } from './convert';
import type { OpenAPI } from './convert';

describe('convertSwaggerToHandlers - Swagger Response Variants', () => {
  const baseUrl = 'http://localhost:3000/api';

  describe('Standard HTTP Status Codes', () => {
    it('should convert numeric status codes correctly', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              responses: {
                '200': { description: 'Success', schema: { type: 'object' } },
                '400': { description: 'Bad Request', schema: { type: 'object' } },
                '500': { description: 'Server Error', schema: { type: 'object' } },
              },
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      expect(handlers).toHaveLength(1);

      const variants = handlers[0].swaggerResponseVariants;
      expect(variants).toHaveLength(3);

      // Check status codes
      expect(variants[0].status).toBe(200);
      expect(variants[1].status).toBe(400);
      expect(variants[2].status).toBe(500);
    });
  });

  describe('Default Status Code (Bug #8)', () => {
    it('should handle "default" status code in responses', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              responses: {
                '200': { description: 'Success', schema: { type: 'object' } },
                default: { description: 'Error', schema: { type: 'object' } },
              },
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      expect(handlers).toHaveLength(1);

      const variants = handlers[0].swaggerResponseVariants;
      expect(variants).toHaveLength(2);

      // Check first variant (200)
      expect(variants[0].status).toBe(200);
      expect(variants[0].name).toBe('Success');

      // Check default variant - should NOT be NaN!
      expect(variants[1].status).not.toBe(NaN);
      expect(variants[1].name).toBe('Error');
      console.log('Default variant status:', variants[1].status);
    });

    it('should handle only "default" response', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/health': {
            get: {
              summary: 'Health check',
              responses: {
                default: { description: 'Health status', schema: { type: 'object' } },
              },
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      expect(handlers).toHaveLength(1);

      const variants = handlers[0].swaggerResponseVariants;
      expect(variants).toHaveLength(1);
      expect(variants[0].status).not.toBe(NaN);
      expect(variants[0].name).toBe('Health status');
    });

    it('should prefer numeric codes over "default"', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/data': {
            post: {
              summary: 'Create data',
              responses: {
                '201': { description: 'Created', schema: { type: 'object' } },
                '400': { description: 'Bad Request', schema: { type: 'object' } },
                default: { description: 'Server Error', schema: { type: 'object' } },
              },
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      const variants = handlers[0].swaggerResponseVariants;

      // Should have all three, with numeric codes as valid numbers
      expect(variants).toHaveLength(3);
      expect(variants[0].status).toBe(201);
      expect(variants[1].status).toBe(400);
      expect(variants[2].status).not.toBe(NaN);
    });
  });

  describe('OpenAPI 3.0 "default" Response', () => {
    it('should handle "default" in OpenAPI 3.0 spec', () => {
      const swagger: OpenAPI = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              summary: 'List items',
              responses: {
                '200': {
                  description: 'Successful response',
                  content: {
                    'application/json': {
                      schema: { type: 'array' },
                    },
                  },
                },
                default: {
                  description: 'Error response',
                  content: {
                    'application/json': {
                      schema: { type: 'object', properties: { error: { type: 'string' } } },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      const variants = handlers[0].swaggerResponseVariants;

      expect(variants).toHaveLength(2);
      expect(variants[0].status).toBe(200);
      expect(variants[1].status).not.toBe(NaN);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty responses', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/ping': {
            get: {
              summary: 'Ping',
              responses: {},
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      expect(handlers).toHaveLength(1);
      expect(handlers[0].swaggerResponseVariants).toHaveLength(0);
    });

    it('should handle responses without schema', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/delete': {
            delete: {
              summary: 'Delete resource',
              responses: {
                '204': { description: 'No Content' },
              },
            },
          },
        },
      };

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      const variants = handlers[0].swaggerResponseVariants;

      expect(variants).toHaveLength(1);
      expect(variants[0].status).toBe(204);
      expect(variants[0].body).toBeUndefined();
    });
  });

  describe('Handler Ordering (static-before-dynamic)', () => {
    const urlsOf = (handlers: ReturnType<typeof convertSwaggerToHandlers>) =>
      handlers.map(h => h.url);

    it('registers static paths before dynamic ones even when the spec declares dynamic first', () => {
      const swagger: OpenAPI = {
        openapi: '3.0.0',
        paths: {
          '/v1/kubeflows/{id}': { get: { responses: { '200': { description: 'ok' } } } },
          '/v1/kubeflows/health': { get: { responses: { '200': { description: 'ok' } } } },
        },
      };

      // Static '/health' must come before dynamic '/:id', otherwise MSW's
      // first-match-wins would let ':id' shadow the static route.
      expect(urlsOf(convertSwaggerToHandlers(baseUrl, swagger))).toEqual([
        `${baseUrl}/v1/kubeflows/health`,
        `${baseUrl}/v1/kubeflows/:id`,
      ]);
    });

    it('keeps original spec order within the static group and within the dynamic group (stable)', () => {
      const swagger: OpenAPI = {
        openapi: '3.0.0',
        paths: {
          '/v1/b/{id}': { get: { responses: { '200': { description: 'ok' } } } }, // dynamic
          '/v1/a': { get: { responses: { '200': { description: 'ok' } } } }, // static
          '/v1/a/{id}': { get: { responses: { '200': { description: 'ok' } } } }, // dynamic
          '/v1/b': { get: { responses: { '200': { description: 'ok' } } } }, // static
        },
      };

      // statics first in their original relative order (a, b),
      // then dynamics in their original relative order (b/:id, a/:id).
      expect(urlsOf(convertSwaggerToHandlers(baseUrl, swagger))).toEqual([
        `${baseUrl}/v1/a`,
        `${baseUrl}/v1/b`,
        `${baseUrl}/v1/b/:id`,
        `${baseUrl}/v1/a/:id`,
      ]);
    });

    it('does not misclassify a static path when baseUrl contains a scheme/port colon', () => {
      const portBaseUrl = 'https://api.example.com:8443';
      const swagger: OpenAPI = {
        openapi: '3.0.0',
        paths: {
          '/v1/{id}': { get: { responses: { '200': { description: 'ok' } } } },
          '/v1/status': { get: { responses: { '200': { description: 'ok' } } } },
        },
      };

      // The ':8443' in baseUrl must not make the static '/v1/status' look dynamic.
      expect(urlsOf(convertSwaggerToHandlers(portBaseUrl, swagger))).toEqual([
        `${portBaseUrl}/v1/status`,
        `${portBaseUrl}/v1/:id`,
      ]);
    });
  });

  describe('methods MSW cannot register', () => {
    it('skips a method MSW has no factory for instead of throwing', () => {
      const baseUrl = 'https://api.example.com';
      const swagger: OpenAPI = {
        swagger: '2.0',
        paths: {
          // `trace` is not hypothetical: httpbin's published document uses it,
          // and http.trace is undefined, so converting used to throw and take
          // the whole handler pass — and the host app — down with it.
          '/anything': {
            get: { responses: { '200': { description: 'ok' } } },
            trace: { responses: { '200': { description: 'traced' } } },
          },
        },
      };

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => convertSwaggerToHandlers(baseUrl, swagger)).not.toThrow();

      const handlers = convertSwaggerToHandlers(baseUrl, swagger);
      expect(handlers).toHaveLength(1);
      expect(handlers[0].method).toBe('get');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('TRACE /anything'));

      warn.mockRestore();
    });

    it('accepts an uppercase method key', () => {
      const swagger: OpenAPI = {
        openapi: '3.0.0',
        paths: { '/v1/a': { GET: { responses: { '200': { description: 'ok' } } } } },
      } as unknown as OpenAPI;

      const handlers = convertSwaggerToHandlers('https://api.example.com', swagger);
      expect(handlers).toHaveLength(1);
      expect(handlers[0].method).toBe('get');
    });
  });

  describe('statuses a Response cannot carry', () => {
    it('drops a 1xx variant rather than leaving one that throws when selected', () => {
      const swagger: OpenAPI = {
        swagger: '2.0',
        paths: {
          // httpbin documents /status/{codes} starting at 100, and a 1xx variant
          // would be both unusable and the default the handler activates with.
          '/status/{codes}': {
            get: {
              responses: {
                '100': { description: 'Informational responses' },
                '200': { description: 'Success' },
                '500': { description: 'Server Errors' },
              },
            },
          },
        },
      };

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const [handler] = convertSwaggerToHandlers('https://httpbin.org', swagger);

      expect(handler.swaggerResponseVariants?.map(variant => variant.status)).toEqual([200, 500]);
      expect(handler.swaggerResponseVariants?.[0].name).toBe('Success');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"100"'));

      warn.mockRestore();
    });
  });
});
