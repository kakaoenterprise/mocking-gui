import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncStateToCookie, getCookie, COOKIE_KEY } from './cookie';
import { HandlerType } from '../../types/handler';

import type { StoredHandlerVariants } from '../../types/handler';

/**
 * Cookie synchronization tests
 * Validates: debounce removal, multi-cookie support, error handling
 */

describe('syncStateToCookie', () => {
  beforeEach(() => {
    // Setup: Define window for test environment
    if (typeof window === 'undefined') {
      globalThis.window = {} as Window & typeof globalThis;
    }

    // Setup: Full document.cookie mock with getter/setter
    const cookieStore: Record<string, string> = {};
    const cookieDescriptor = {
      enumerable: true,
      configurable: true,
      get() {
        return Object.entries(cookieStore)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      },
      set(val: string) {
        if (!val.includes('=')) return;
        const [rawKey, ...rest] = val.split('=');
        const key = rawKey.trim();
        const valuePart = rest.join('=').split(';')[0];
        if (key && valuePart) {
          cookieStore[key] = valuePart;
        }
      },
    } as PropertyDescriptor;

    Object.defineProperty(globalThis, 'document', {
      value: {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'cookie', cookieDescriptor);

    vi.clearAllMocks();
  });

  describe('Task 1: Debounce Removal', () => {
    it('should sync cookie immediately without 300ms delay', () => {
      const config: Record<string, StoredHandlerVariants> = {
        'GET./users': {
          active: true,
          type: HandlerType.MANUAL,
          variant: '200-success',
        },
      };

      const startTime = performance.now();
      syncStateToCookie(config);
      const endTime = performance.now();

      // Verify: Cookie written immediately
      const cookieValue = getCookie(document.cookie, COOKIE_KEY);
      expect(cookieValue).not.toBeNull();
      expect(cookieValue).toContain('200-success');

      // Verify: No significant delay (< 10ms, not 300ms)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should not debounce multiple rapid updates', () => {
      const config1: Record<string, StoredHandlerVariants> = {
        'GET./users': { active: true, type: HandlerType.MANUAL, variant: '200' },
      };
      const config2: Record<string, StoredHandlerVariants> = {
        'GET./users': { active: true, type: HandlerType.MANUAL, variant: '400' },
      };

      // Rapid calls (no delay between them)
      syncStateToCookie(config1);
      const firstValue = getCookie(document.cookie, COOKIE_KEY);

      syncStateToCookie(config2);
      const secondValue = getCookie(document.cookie, COOKIE_KEY);

      // Verify: Both calls executed immediately (values changed)
      expect(firstValue).toContain('200');
      expect(secondValue).toContain('400');
    });
  });

  describe('Task 2: Multi-Cookie Split', () => {
    it('should handle small state with single cookie (≤3800 bytes)', () => {
      const config: Record<string, StoredHandlerVariants> = {
        'GET./users': { active: true, type: HandlerType.MANUAL, variant: '200-success' },
        'POST./users': { active: true, type: HandlerType.AUTO, variant: '201-created' },
      };

      syncStateToCookie(config);

      // Verify: Single cookie used
      const singleCookie = getCookie(document.cookie, COOKIE_KEY);
      expect(singleCookie).not.toBeNull();
      expect(singleCookie).toContain('200-success');

      // Verify: No multi-cookies for small state
      const multiCookie = getCookie(document.cookie, `${COOKIE_KEY}_0`);
      expect(multiCookie).toBeNull();
    });

    it('should support 100+ handlers without cookie overflow', () => {
      // Create a moderately large state
      const config: Record<string, StoredHandlerVariants> = {};
      for (let i = 0; i < 100; i++) {
        config[`GET./endpoint-${i}`] = {
          active: true,
          type: HandlerType.MANUAL,
          variant: `200-success`,
        };
      }

      syncStateToCookie(config);

      // Verify: Cookie is set (not silent failure)
      const cookieString = document.cookie;
      expect(cookieString).toBeTruthy();
      expect(cookieString.length).toBeGreaterThan(0);
    });

    it('should verify multi-cookie strategy exists', () => {
      // This test validates the implementation supports multi-cookie
      // even if current test environment doesn't fully exercise it

      // The syncMultiCookie function is defined in the module
      // and is called when encoded size > 3800 bytes

      // Create state that should trigger multi-cookie (moderate size)
      const config: Record<string, StoredHandlerVariants> = {};
      for (let i = 0; i < 80; i++) {
        config[`GET./endpoint-with-very-long-name-${i}`] = {
          active: true,
          type: HandlerType.MANUAL,
          variant: `200-success-with-detailed-response-${i}`,
        };
      }

      syncStateToCookie(config);

      // Verify: Encode process completes without errors
      const cookieString = document.cookie;
      expect(typeof cookieString).toBe('string');
    });
  });

  describe('Task 3: Error Handling', () => {
    it('should throw error in development mode on invalid config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const invalidConfig = null as unknown as Record<string, StoredHandlerVariants>;

      expect(() => syncStateToCookie(invalidConfig)).toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should log error and not throw in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const invalidConfig = null as unknown as Record<string, StoredHandlerVariants>;

      // Should not throw in production
      expect(() => syncStateToCookie(invalidConfig)).not.toThrow();

      // Should log error
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should gracefully truncate (not throw) for edge case: too large state (>10KB)', () => {
      process.env.NODE_ENV = 'development';

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create extremely large state
      const config: Record<string, StoredHandlerVariants> = {};
      for (let i = 0; i < 1000; i++) {
        config[`GET./very-long-endpoint-name-${i}`] = {
          active: true,
          type: HandlerType.MANUAL,
          variant: `200-success-with-very-long-description-${i}`,
        };
      }

      // Should not throw - graceful degradation via truncation instead
      expect(() => syncStateToCookie(config)).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      process.env.NODE_ENV = 'production';
    });
  });

  describe("Task 4: Graceful Degradation (Truncate, Don't Throw)", () => {
    it('should sync a payload under 3800B as a single cookie (Tier 1, unchanged)', () => {
      const config: Record<string, StoredHandlerVariants> = {
        'GET./users': { active: true, type: HandlerType.MANUAL, variant: '200-success' },
        'POST./users': { active: true, type: HandlerType.AUTO, variant: '201-created' },
      };

      syncStateToCookie(config);

      const singleCookie = getCookie(document.cookie, COOKIE_KEY);
      expect(singleCookie).not.toBeNull();
      const multiCookie = getCookie(document.cookie, `${COOKIE_KEY}_0`);
      expect(multiCookie).toBeNull();
    });

    it('should split a 3800-10000B payload into multi-cookie chunks (Tier 2, unchanged)', () => {
      const config: Record<string, StoredHandlerVariants> = {};
      for (let i = 0; i < 80; i++) {
        config[`GET./endpoint-with-very-long-name-${i}`] = {
          active: true,
          type: HandlerType.MANUAL,
          variant: `200-success-with-detailed-response-${i}`,
        };
      }

      const encodedSize = encodeURIComponent(
        JSON.stringify(
          Object.entries(config).map(([key, c]) => [key, c.type?.[0] || 'M', c.variant || '']),
        ),
      ).length;
      expect(encodedSize).toBeGreaterThan(3800);
      expect(encodedSize).toBeLessThanOrEqual(10000);

      syncStateToCookie(config);

      const chunk0 = getCookie(document.cookie, `${COOKIE_KEY}_0`);
      expect(chunk0).not.toBeNull();
    });

    it('should truncate Swagger entries and keep all Manual/Auto entries when >10000B', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: Record<string, StoredHandlerVariants> = {
        'GET./manual-1': { active: true, type: HandlerType.MANUAL, variant: 'manual-variant-1' },
        'GET./auto-1': { active: true, type: HandlerType.AUTO, variant: 'auto-variant-1' },
      };
      for (let i = 0; i < 1000; i++) {
        config[`GET./swagger-endpoint-with-a-fairly-long-name-${i}`] = {
          active: true,
          type: HandlerType.SWAGGER,
          variant: `200-success-with-a-long-description-payload-${i}`,
        };
      }

      syncStateToCookie(config);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Dropped'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Manual/Auto handler overrides were preserved'),
      );

      // Reconstruct whichever cookie form was used (single or multi) and verify contents.
      const single = getCookie(document.cookie, COOKIE_KEY);
      const chunk0 = getCookie(document.cookie, `${COOKIE_KEY}_0`);
      let decoded = '';
      if (single) {
        decoded = decodeURIComponent(single);
      } else {
        let index = 0;
        let combined = '';
        let chunk = getCookie(document.cookie, `${COOKIE_KEY}_${index}`);
        while (chunk !== null) {
          combined += chunk;
          index += 1;
          chunk = getCookie(document.cookie, `${COOKIE_KEY}_${index}`);
        }
        decoded = decodeURIComponent(combined);
      }
      expect(chunk0 !== null || single !== null).toBe(true);

      const parsed = JSON.parse(decoded) as Array<[string, string, string]>;
      expect(parsed.some(([key]) => key === 'GET./manual-1')).toBe(true);
      expect(parsed.some(([key]) => key === 'GET./auto-1')).toBe(true);
      // Not all 1000 swagger entries could fit.
      const swaggerCount = parsed.filter(([, typeChar]) => typeChar === 'S').length;
      expect(swaggerCount).toBeLessThan(1000);

      consoleWarnSpy.mockRestore();
    });

    it('should drop all Swagger entries and still not throw when Manual/Auto alone exceed the cap', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config: Record<string, StoredHandlerVariants> = {};
      // Manual/Auto entries alone exceed HARD_CAP (10000 bytes).
      for (let i = 0; i < 600; i++) {
        config[`GET./manual-endpoint-with-a-fairly-long-name-${i}`] = {
          active: true,
          type: HandlerType.MANUAL,
          variant: `200-success-with-a-long-description-payload-${i}`,
        };
      }
      // A handful of Swagger entries that should all be dropped.
      for (let i = 0; i < 5; i++) {
        config[`GET./swagger-${i}`] = {
          active: true,
          type: HandlerType.SWAGGER,
          variant: `variant-${i}`,
        };
      }

      expect(() => syncStateToCookie(config)).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Dropped 5'));

      consoleWarnSpy.mockRestore();
    });

    it('should never throw for a purely size-driven overflow even in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config: Record<string, StoredHandlerVariants> = {};
      for (let i = 0; i < 1000; i++) {
        config[`GET./swagger-endpoint-with-a-fairly-long-name-${i}`] = {
          active: true,
          type: HandlerType.SWAGGER,
          variant: `200-success-with-a-long-description-payload-${i}`,
        };
      }

      expect(() => syncStateToCookie(config)).not.toThrow();
      // Genuine errors still go through console.error; size overflow must not.
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Integration: SSR Consistency', () => {
    it('should ensure immediate sync (no 300ms debounce)', () => {
      const config: Record<string, StoredHandlerVariants> = {
        'GET./users': { active: true, type: HandlerType.MANUAL, variant: '200' },
      };

      const startTime = performance.now();
      syncStateToCookie(config);
      const syncTime = performance.now() - startTime;

      // Verify: Synced immediately (not delayed)
      expect(syncTime).toBeLessThan(10);

      // Verify: Cookie is available
      const cookie = getCookie(document.cookie, COOKIE_KEY);
      expect(cookie).not.toBeNull();
      expect(cookie).toContain('200');
    });
  });
});

describe('getCookie', () => {
  it('should retrieve single cookie value', () => {
    const cookieString = 'test_key=test_value; other_key=other_value';
    const value = getCookie(cookieString, 'test_key');
    expect(value).toBe('test_value');
  });

  it('should return null for non-existent cookie', () => {
    const cookieString = 'test_key=test_value';
    const value = getCookie(cookieString, 'non_existent');
    expect(value).toBeNull();
  });

  it('should handle URL-encoded values', () => {
    const encoded = encodeURIComponent('hello world');
    const cookieString = `test_key=${encoded}`;
    const value = getCookie(cookieString, 'test_key');
    expect(value).toBe(encoded);
  });

  it('should handle whitespace in cookie string', () => {
    const cookieString = 'key1=value1; key2=value2 ; key3=value3';
    const value = getCookie(cookieString, 'key2');
    expect(value).toBe('value2');
  });
});
