import { describe, it, expect, vi, afterEach } from 'vitest';

import { isDomRuntime, isNodeRuntime } from './runtime';

/**
 * Runtime detection predicate tests (node environment)
 * Validates: Node detection via process.versions.node, DOM detection via window + document
 */

describe('runtime predicates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isNodeRuntime', () => {
    it('should be true in a plain Node environment', () => {
      expect(isNodeRuntime()).toBe(true);
    });

    it('should be false when process is undefined (browser)', () => {
      vi.stubGlobal('process', undefined);

      expect(isNodeRuntime()).toBe(false);
    });

    it('should be false for a Next.js client style process that only has env', () => {
      vi.stubGlobal('process', { env: {} });

      expect(isNodeRuntime()).toBe(false);
    });

    it('should be false for a process/browser shim whose versions is empty', () => {
      vi.stubGlobal('process', { versions: {} });

      expect(isNodeRuntime()).toBe(false);
    });
  });

  describe('isDomRuntime', () => {
    it('should be false in a node environment without a DOM', () => {
      expect(isDomRuntime()).toBe(false);
    });

    it('should be true when both window and document exist', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});

      expect(isDomRuntime()).toBe(true);
    });

    it('should be false when only window exists', () => {
      vi.stubGlobal('window', {});

      expect(isDomRuntime()).toBe(false);
    });
  });
});
