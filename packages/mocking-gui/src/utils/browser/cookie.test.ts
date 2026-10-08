import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  syncStateToCookie,
  getCookie,
  COOKIE_KEY,
  COOKIE_BUDGET,
  encodeSyncState,
  setSsrSyncEnabled,
} from './cookie';
import { installCookieStore } from '../../test/cookieStore';
import { HandlerType } from '../../types/handler';
import { getHandlerKey, hashHandlerKey } from '../common/keys';

import type { HandlerState, StoredHandlerVariants } from '../../types/handler';

/**
 * Cookie synchronization tests (issue #45)
 * Validates: v2 compact format, default omission, cleanup of previous cookies,
 * single-cookie budget, priority truncation, error handling
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
/** Supports both Manual and Swagger: default type is Manual */
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

const LONG_VARIANT = '404-with-a-fairly-long-variant-name-to-grow-the-payload';

const fixtures = (count: number, type: HandlerType, variant = '200') => {
  const list: HandlerState[] = [];
  const configs: Record<string, StoredHandlerVariants> = {};
  for (let i = 0; i < count; i++) {
    const variants = [
      { name: '200', status: 200, body: {} },
      { name: LONG_VARIANT, status: 404, body: {} },
    ];
    const handler: HandlerState = {
      name: `${type}-${i}`,
      method: 'get',
      url: `${ORIGIN}/v1/projects/:param0/resources-${i}/:param1`,
      ...(type === HandlerType.SWAGGER
        ? { swaggerResponseVariants: variants }
        : { responseVariants: variants }),
    };
    list.push(handler);
    configs[key(handler)] = { active: true, type, variant };
  }
  return { list, configs };
};
const swaggerFixtures = (count: number, variant = '200') =>
  fixtures(count, HandlerType.SWAGGER, variant);

describe('syncStateToCookie', () => {
  let cookies: ReturnType<typeof installCookieStore>;

  beforeEach(() => {
    cookies = installCookieStore();
    setSsrSyncEnabled(true);
    vi.restoreAllMocks();
  });

  describe('ssrSync: false', () => {
    const activeConfigs = {
      [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '200-default' },
    };

    it('writes no cookie when SSR sync is disabled', () => {
      setSsrSyncEnabled(false);

      syncStateToCookie(activeConfigs, handlers);

      expect(cookies.names()).toEqual([]);
    });

    it('removes cookies left by earlier writes when SSR sync is disabled', () => {
      cookies.seed(COOKIE_KEY, 'v2~abc');
      cookies.seed(`${COOKIE_KEY}_0`, '%5B%5D');
      cookies.seed('unrelated', '1');
      setSsrSyncEnabled(false);

      syncStateToCookie(activeConfigs, handlers);

      expect(cookies.names()).toEqual(['unrelated']);
    });

    it('resumes writing once SSR sync is enabled again', () => {
      setSsrSyncEnabled(false);
      syncStateToCookie(activeConfigs, handlers);
      setSsrSyncEnabled(true);

      syncStateToCookie(activeConfigs, handlers);

      expect(cookies.names()).toEqual([COOKIE_KEY]);
    });
  });

  describe('v2 format', () => {
    it('writes a single versioned cookie and never writes chunks', () => {
      syncStateToCookie(
        {
          [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '200-default' },
        },
        handlers,
      );

      expect(cookies.names()).toEqual([COOKIE_KEY]);
      expect(getCookie(document.cookie, COOKIE_KEY)).toMatch(/^v2~/);
    });

    it('serializes an active entry with default type and variant as the hash only', () => {
      const encoded = encodeSyncState(
        {
          [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '200-default' },
        },
        handlers,
      );

      expect(encoded).toBe(`v2~${hash(manualHandler)}`);
    });

    it('includes the variant only when it differs from the default', () => {
      const encoded = encodeSyncState(
        { [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '400-error' } },
        handlers,
      );

      expect(encoded).toBe(`v2~${hash(manualHandler)}..400-error`);
    });

    it('includes the type only when it differs from the determined default', () => {
      const encoded = encodeSyncState(
        { [key(dualHandler)]: { active: true, type: HandlerType.SWAGGER, variant: '200' } },
        handlers,
      );

      expect(encoded).toBe(`v2~${hash(dualHandler)}.S.200`);
    });

    it('omits inactive entries and keeps active ones in config order', () => {
      const encoded = encodeSyncState(
        {
          [key(manualHandler)]: { active: false, type: HandlerType.MANUAL, variant: '400-error' },
          [key(swaggerHandler)]: { active: true, type: HandlerType.SWAGGER, variant: '200' },
          [key(autoHandler)]: { active: true, type: HandlerType.AUTO },
        },
        handlers,
      );

      expect(encoded).toBe(`v2~${hash(swaggerHandler)}~${hash(autoHandler)}`);
    });

    it('writes type and variant explicitly for a key with no registered handler', () => {
      const unknownKey = `get.${ORIGIN}/unknown`;
      const encoded = encodeSyncState(
        { [unknownKey]: { active: true, type: HandlerType.MANUAL, variant: '200' } },
        handlers,
      );

      expect(encoded).toBe(`v2~${hashHandlerKey(unknownKey)}.M.200`);
    });

    it('writes a variant outside [A-Za-z0-9_-] as marked base64url', () => {
      const encoded = encodeSyncState(
        {
          [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: 'a~b.c d 한글' },
        },
        handlers,
      );

      expect(encoded).toBe(`v2~${hash(manualHandler)}..!YX5iLmMgZCDtlZzquIA`);
    });

    it('is byte-stable when a cookie API re-encodes the value (Next.js cookies().toString())', () => {
      const { list, configs } = swaggerFixtures(20, LONG_VARIANT);
      const encoded = encodeSyncState(
        {
          ...configs,
          [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: 'a~b.c d 한글' },
          [key(dualHandler)]: { active: true, type: HandlerType.SWAGGER, variant: '200' },
        },
        [...list, ...handlers],
      );

      expect(encodeURIComponent(encoded)).toBe(encoded);
      expect(decodeURIComponent(encoded)).toBe(encoded);
      expect(encoded).not.toMatch(/[\s",;\\%]/);
    });
  });

  describe('cleanup of previous cookies (issue #45 defect 1)', () => {
    it('removes legacy single and chunk cookies left by older versions before writing', () => {
      cookies.seed(COOKIE_KEY, encodeURIComponent(JSON.stringify([['GET./old', 'M', '200']])));
      for (let i = 0; i < 6; i++) cookies.seed(`${COOKIE_KEY}_${i}`, 'x'.repeat(3000));
      cookies.seed('unrelated_cookie', 'keep-me');
      cookies.seed(`${COOKIE_KEY}_custom`, 'not-ours');

      syncStateToCookie(
        {
          [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '200-default' },
        },
        handlers,
      );

      expect(cookies.names().sort()).toEqual([
        COOKIE_KEY,
        `${COOKIE_KEY}_custom`,
        'unrelated_cookie',
      ]);
      expect(cookies.get('unrelated_cookie')).toBe('keep-me');
    });

    it('leaves exactly one cookie after shrinking and growing the active set', () => {
      const { list, configs } = swaggerFixtures(300);
      const subset = (n: number) => Object.fromEntries(Object.entries(configs).slice(0, n));

      syncStateToCookie(subset(200), list);
      syncStateToCookie(subset(20), list);
      syncStateToCookie(subset(150), list);

      expect(cookies.names()).toEqual([COOKIE_KEY]);
      expect(cookies.totalBytes()).toBeLessThanOrEqual(COOKIE_BUDGET + COOKIE_KEY.length);
    });

    it('clears the cookie when no handler is active', () => {
      syncStateToCookie(
        {
          [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '200-default' },
        },
        handlers,
      );
      syncStateToCookie(
        {
          [key(manualHandler)]: { active: false, type: HandlerType.MANUAL, variant: '200-default' },
        },
        handlers,
      );

      expect(cookies.names()).toEqual([]);
    });
  });

  describe('budget (issue #45 defect 3)', () => {
    it('fits 300 active Swagger handlers with absolute URLs within the budget', () => {
      const { list, configs } = swaggerFixtures(300);

      syncStateToCookie(configs, list);

      const value = getCookie(document.cookie, COOKIE_KEY) ?? '';
      expect(value.length).toBeLessThanOrEqual(COOKIE_BUDGET);
      expect(value.split('~').length - 1).toBe(300);
    });

    it('drops Swagger entries first and keeps Manual/Auto entries when over budget', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { list, configs } = swaggerFixtures(600, LONG_VARIANT);
      const all = {
        ...configs,
        [key(manualHandler)]: { active: true, type: HandlerType.MANUAL, variant: '400-error' },
        [key(autoHandler)]: { active: true, type: HandlerType.AUTO },
      };

      syncStateToCookie(all, [...list, ...handlers]);

      const value = getCookie(document.cookie, COOKIE_KEY) ?? '';
      expect(value.length).toBeLessThanOrEqual(COOKIE_BUDGET);
      expect(value).toContain(`${hash(manualHandler)}..400-error`);
      expect(value).toContain(hash(autoHandler));
      expect(cookies.names()).toEqual([COOKIE_KEY]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/Dropped \d+ Swagger/);
    });

    it('keeps the original entry order after truncation', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { list, configs } = swaggerFixtures(600, LONG_VARIANT);
      const entries = Object.entries(configs);
      const interleaved = Object.fromEntries([
        ...entries.slice(0, 10),
        [key(manualHandler), { active: true, type: HandlerType.MANUAL, variant: '400-error' }],
        ...entries.slice(10),
      ]);

      const encoded = encodeSyncState(interleaved, [...list, ...handlers]);

      const hashes = encoded
        .slice(3)
        .split('~')
        .map(entry => entry.split('.')[0]);
      expect(hashes.indexOf(hash(manualHandler))).toBe(10);
      expect(hashes.slice(0, 10)).toEqual(list.slice(0, 10).map(hash));
    });

    it('warns when Manual/Auto entries alone exceed the budget', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { list, configs } = fixtures(600, HandlerType.MANUAL, LONG_VARIANT);

      const encoded = encodeSyncState(configs, list);

      expect(encoded.length).toBeGreaterThan(COOKIE_BUDGET);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/exceeds the \d+ byte cookie budget even/);
    });
  });

  describe('error handling', () => {
    it('throws in development on invalid config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => syncStateToCookie(null as never, handlers)).toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('logs and does not throw in production on invalid config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => syncStateToCookie(null as never, handlers)).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
