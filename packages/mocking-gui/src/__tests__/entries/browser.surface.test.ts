import { describe, expect, it } from 'vitest';

import type * as browser from '../../browser';

/**
 * Type-level surface guard for `@kakaocloud/mocking-gui/browser`. The module is
 * not imported at runtime (it drags in React components and CSS); the type of
 * the module namespace is asserted instead.
 */
type BrowserExports = keyof typeof browser;
type Expected = 'MockingGUIBoundary';
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe('browser entry surface', () => {
  it('exports exactly MockingGUIBoundary', () => {
    const exact: Exact<BrowserExports, Expected> = true;
    expect(exact).toBe(true);
  });
});
