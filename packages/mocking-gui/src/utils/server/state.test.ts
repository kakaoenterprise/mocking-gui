import { describe, it, expect, vi, afterEach } from 'vitest';

import { reconstructHandlerConfigsFromCookie } from './state';
import { HandlerType } from '../../types/handler';
import { getHandlerKey, hashHandlerKey } from '../common/keys';

import type { HandlerState } from '../../types/handler';

/**
 * Server-side state reconstruction tests (issue #45)
 * Validates: v2 hash resolution with default restoration, legacy single/chunk reading,
 * chunk precedence over a stale single cookie, error handling
 */

const ORIGIN = 'https://api.example.com';

const manualHandler: HandlerState = {
  name: 'Get Users',
  method: 'get',
  url: `${ORIGIN}/users`,
  responseVariants: [
    { name: '200-default', status: 200, body: [] },
    { name: '400-error', status: 400, body: {} },
  ],
};
const swaggerHandler: HandlerState = {
  name: 'List Images',
  method: 'get',
  url: `${ORIGIN}/v1/images`,
  swaggerResponseVariants: [
    { name: '200', status: 200, body: [] },
    { name: '404', status: 404, body: {} },
  ],
};
const autoHandler: HandlerState = {
  name: 'Create User',
  method: 'post',
  url: `${ORIGIN}/users`,
  responseVariantsFn: () => ({ name: '201', status: 201, body: {} }),
};
const dualHandler: HandlerState = {
  name: 'Get Flavor',
  method: 'get',
  url: `${ORIGIN}/v1/flavors/:id`,
  responseVariants: [{ name: 'manual-200', status: 200, body: {} }],
  swaggerResponseVariants: [{ name: '200', status: 200, body: {} }],
};
const handlers = [manualHandler, swaggerHandler, autoHandler, dualHandler];

const key = (handler: HandlerState) => getHandlerKey(handler);
const hash = (handler: HandlerState) => hashHandlerKey(getHandlerKey(handler));
const legacy = (entries: [string, string, string][]) => encodeURIComponent(JSON.stringify(entries));

describe('reconstructHandlerConfigsFromCookie', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('v2 format', () => {
    it('restores default type and variant for a hash-only entry', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~${hash(manualHandler)}~${hash(swaggerHandler)}~${hash(autoHandler)}`,
        handlers,
      );

      expect(result[key(manualHandler)]).toMatchObject({
        active: true,
        type: HandlerType.MANUAL,
        variant: '200-default',
      });
      expect(result[key(swaggerHandler)]).toMatchObject({
        active: true,
        type: HandlerType.SWAGGER,
        variant: '200',
      });
      expect(result[key(autoHandler)]).toMatchObject({ active: true, type: HandlerType.AUTO });
      expect(result[key(dualHandler)]).toBeUndefined();
    });

    it('applies an explicit variant and keeps the default type', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~${hash(manualHandler)}..400-error`,
        handlers,
      );

      expect(result[key(manualHandler)]).toMatchObject({
        active: true,
        type: HandlerType.MANUAL,
        variant: '400-error',
      });
    });

    it('applies an explicit type and variant', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~${hash(dualHandler)}.S.200`,
        handlers,
      );

      expect(result[key(dualHandler)]).toMatchObject({
        active: true,
        type: HandlerType.SWAGGER,
        variant: '200',
      });
    });

    it('decodes a marked base64url variant', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~${hash(manualHandler)}..!YX5iLmMgZCDtlZzquIA`,
        handlers,
      );

      expect(result[key(manualHandler)]?.variant).toBe('a~b.c d 한글');
    });

    it('treats an explicit empty variant as no variant', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~${hash(manualHandler)}..`,
        handlers,
      );

      expect(result[key(manualHandler)]).toMatchObject({ active: true, variant: undefined });
    });

    it('ignores hashes that match no registered handler with one aggregated warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~zzzzz1~zzzzz2~zzzzz3~${hash(manualHandler)}`,
        handlers,
      );

      expect(Object.keys(result)).toEqual([key(manualHandler)]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('Ignored 3');
    });

    it('skips only the malformed entry and keeps the rest', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=v2~${hash(manualHandler)}..!***~${hash(swaggerHandler)}`,
        handlers,
      );

      expect(result[key(manualHandler)]).toBeUndefined();
      expect(result[key(swaggerHandler)]?.active).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('malformed');
    });

    it('reads the v2 cookie among other cookies', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `session=abc; mocking_gui_sync=v2~${hash(manualHandler)}; theme=dark`,
        handlers,
      );

      expect(result[key(manualHandler)]?.active).toBe(true);
    });

    it('returns an empty config for an empty v2 payload', () => {
      expect(reconstructHandlerConfigsFromCookie('mocking_gui_sync=v2~', handlers)).toEqual({});
    });
  });

  describe('legacy v1 format (cookies left by older versions)', () => {
    it('reads a legacy single cookie', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=${legacy([
          ['GET./users', 'M', '200-success'],
          ['POST./users', 'A', '201-created'],
        ])}`,
        handlers,
      );

      expect(result['GET./users']).toEqual({
        active: true,
        type: HandlerType.MANUAL,
        variant: '200-success',
      });
      expect(result['POST./users']).toEqual({
        active: true,
        type: HandlerType.AUTO,
        variant: '201-created',
      });
    });

    it('reads legacy chunk cookies in order', () => {
      const encoded = legacy([
        ['GET./api-1', 'M', '200'],
        ['GET./api-2', 'M', '200'],
        ['GET./api-3', 'S', '200'],
      ]);
      const cookieString = `mocking_gui_sync_0=${encoded.substring(0, 40)}; mocking_gui_sync_1=${encoded.substring(40)}`;

      const result = reconstructHandlerConfigsFromCookie(cookieString, handlers);

      expect(Object.keys(result)).toEqual(['GET./api-1', 'GET./api-2', 'GET./api-3']);
      expect(result['GET./api-3'].type).toBe(HandlerType.SWAGGER);
    });

    it('prefers chunks over a stale single cookie when both exist (issue #45 defect 2)', () => {
      const cookieString = `mocking_gui_sync=${legacy([['GET./stale', 'M', '200']])}; mocking_gui_sync_0=${legacy([['GET./fresh', 'M', '200']])}`;

      const result = reconstructHandlerConfigsFromCookie(cookieString, handlers);

      expect(result['GET./fresh']).toBeDefined();
      expect(result['GET./stale']).toBeUndefined();
    });

    it('prefers a v2 single cookie over leftover legacy chunks', () => {
      const cookieString = `mocking_gui_sync_0=${legacy([['GET./stale', 'M', '200']])}; mocking_gui_sync=v2~${hash(manualHandler)}`;

      const result = reconstructHandlerConfigsFromCookie(cookieString, handlers);

      expect(result[key(manualHandler)]).toBeDefined();
      expect(result['GET./stale']).toBeUndefined();
    });

    it('maps unknown type characters to Swagger', () => {
      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=${legacy([['h', 'X', 'v']])}`,
        handlers,
      );

      expect(result['h'].type).toBe(HandlerType.SWAGGER);
    });

    it('skips entries without key or type with a warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const encoded = encodeURIComponent(
        JSON.stringify([
          ['valid_key', 'M', 'variant'],
          [null, 'M', 'variant'],
          ['valid_key2', null, 'variant'],
        ]),
      );

      const result = reconstructHandlerConfigsFromCookie(`mocking_gui_sync=${encoded}`, handlers);

      expect(result['valid_key']).toBeDefined();
      expect(result['valid_key2']).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns an empty config when no sync cookie is present', () => {
      expect(reconstructHandlerConfigsFromCookie('other_cookie=value', handlers)).toEqual({});
      expect(reconstructHandlerConfigsFromCookie('', handlers)).toEqual({});
    });

    it('returns an empty config and logs on invalid legacy JSON', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = reconstructHandlerConfigsFromCookie(
        `mocking_gui_sync=${encodeURIComponent('invalid json')}`,
        handlers,
      );

      expect(result).toEqual({});
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse'),
        expect.any(Error),
      );
    });

    it('returns an empty config and logs on a corrupted cookie', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = reconstructHandlerConfigsFromCookie('mocking_gui_sync=%FF%FE%FD', handlers);

      expect(result).toEqual({});
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
