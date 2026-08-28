import { describe, expect, it } from 'vitest';

import { defineHandlers } from '../../define';

import type { ReadonlyHandlerConfig, HandlerConfigOption } from '../../../types/config';

/**
 * `ReadonlyHandlerConfig` is derived from `HandlerConfigOption` rather than
 * restated, so the fields cannot drift apart. What must keep working through
 * that derivation is the `as const satisfies` recipe the docs recommend — if it
 * regresses, every consumer silently loses literal inference.
 */
describe('ReadonlyHandlerConfig (derived)', () => {
  it('accepts an as const pinned collection (the T1 recipe)', () => {
    const handlers = [
      {
        name: 'Users',
        description: 'user endpoints',
        url: '/users',
        method: 'get',
        delay: 100,
        responseVariants: [
          { name: 'Success', status: 200, body: [{ id: 1 }, { id: 2 }] },
          { name: 'Empty', status: 200, body: [] },
        ],
      },
    ] as const satisfies readonly ReadonlyHandlerConfig[];

    const registry = defineHandlers(handlers);
    expect(registry.pick('Users', 'Empty').ref).toEqual(['get', '/users']);
    // @ts-expect-error - variant names stayed literal through the derived type
    expect(() => registry.pick('Users', 'Nope')).toThrow();
  });

  it('still accepts a plain mutable HandlerConfigOption[]', () => {
    const legacy: HandlerConfigOption[] = [
      { name: 'Quota', url: '/quota', method: 'get', responseVariants: [] },
    ];
    expect(defineHandlers(legacy).names).toEqual(['Quota']);
  });

  it('accepts every field the engine type declares', () => {
    const input: ReadonlyHandlerConfig = {
      name: 'X',
      description: 'd',
      url: '/x',
      method: 'post',
      delay: 5,
      responseVariantsFn: () => ({ name: 'S', status: 200 }),
      responseVariants: [{ name: 'S', status: 200 }],
    };
    expect(input.name).toBe('X');
  });
});
