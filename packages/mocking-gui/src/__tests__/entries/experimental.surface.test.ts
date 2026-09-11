// @vitest-environment node
import { describe, expect, it } from 'vitest';

import * as experimental from '../../experimental';

/**
 * Guards the export surface of `@kakaocloud/mocking-gui/experimental`.
 *
 * Runs in the plain `node` environment on purpose: the entry is consumed from
 * test runners and build scripts, so importing it must never touch `window`
 * or `document` at module load. A regression there fails this file.
 *
 * Adding, moving (graduating) or removing a symbol must change this list — that
 * is the point. See ADR-0006.
 */
const EXPECTED_RUNTIME_EXPORTS = [
  'applyScenario',
  'defineRegistry',
  'defineScenario',
  'extendScenario',
  'serializeScenario',
] as const;

describe('experimental entry surface', () => {
  it('exports exactly the documented runtime symbols', () => {
    expect(Object.keys(experimental).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS]);
  });

  it('exposes every export as a callable function', () => {
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      expect(typeof experimental[name]).toBe('function');
    }
  });

  it('can author, serialize and apply a scenario without a DOM', async () => {
    const registry = experimental.defineRegistry([
      {
        name: 'Users',
        url: '/api/users',
        method: 'get',
        responseVariants: [{ name: 'Success', status: 200 }],
      },
    ]);
    const scenario = experimental.defineScenario('smoke', [registry.pick('Users', 'Success')]);
    const calls: unknown[] = [];
    await experimental.applyScenario(
      {
        addInitScript: async (_script, arg) => {
          calls.push(arg);
        },
        addCookies: async cookies => {
          calls.push(cookies);
        },
      },
      scenario,
      { origin: 'http://localhost:5173', ssr: true },
    );
    expect(calls).toHaveLength(2);
    expect(typeof window).toBe('undefined');
  });
});
