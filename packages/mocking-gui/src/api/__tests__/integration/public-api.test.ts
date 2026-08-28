import { describe, expect, it } from 'vitest';

import * as testingEntry from '../../../testing';

/**
 * Guards the shape of the `@kakaocloud/mocking-gui/testing` entry point.
 *
 * The barrel re-exports from several modules, so a rename or a module split can
 * silently drop a symbol from the public surface while every other test keeps
 * passing — they import from the modules directly. This asserts the surface
 * itself, so adding an export is a deliberate, visible change.
 *
 * Kept deliberately narrow: `defineHandler` stays internal because
 * `defineHandlers(...).get(name)` produces an identical `DefinedHandler` while
 * keeping the registry's duplicate-name and method+url checks; `serializeScenarioCookie` stays internal because
 * `applyScenario({ ssr: true })` is the only way it is needed, and
 * `isValidScenario` belongs with runtime scenario provisioning (config/props),
 * not with the test-injection entry point.
 */
const EXPECTED_RUNTIME_EXPORTS = [
  'applyScenario',
  'defineHandlers',
  'defineScenario',
  'extendScenario',
  'serializeScenario',
] as const;

describe('testing entry point', () => {
  it('exports exactly the documented runtime surface', () => {
    expect(Object.keys(testingEntry).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS]);
  });

  it('exposes every export as a callable function', () => {
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      expect(typeof testingEntry[name]).toBe('function');
    }
  });
});
