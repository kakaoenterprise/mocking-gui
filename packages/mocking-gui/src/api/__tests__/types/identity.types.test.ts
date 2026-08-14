import { describe, expect, it } from 'vitest';

import { defineHandler, defineHandlers } from '../../define';
import { defineScenario } from '../../scenario';

import type { HandlerConfigOption } from '../../../types/config';

/**
 * The single home for duplicate-detection semantics.
 *
 * A `Selection` is identified by its handler's `[method, url]` ref — not by the
 * handler's display name, and not by a formatted key. These cases pin every
 * property that choice has to satisfy, at both compile time and runtime.
 *
 * `@ts-expect-error` is the assertion here: if a compile-time guarantee
 * regresses, the directive becomes unused and `pnpm typecheck:tests` fails.
 */

const listUsers = defineHandler({
  name: 'Users',
  url: '/users',
  method: 'get',
  responseVariants: [
    { name: 'Success', status: 200 },
    { name: 'Error', status: 500 },
  ],
});

listUsers.pick('Error');

const createUser = defineHandler({
  name: 'Create user',
  url: '/users',
  method: 'post',
  responseVariants: [{ name: 'Success', status: 201 }],
});

describe('handler identity is the [method, url] ref', () => {
  it('rejects the same handler picked twice', () => {
    expect(() =>
      defineScenario('duplicate', [
        listUsers.pick('Success'),
        // @ts-expect-error - same ref, so this is a duplicate
        listUsers.pick('Error'),
      ]),
    ).toThrow();
  });

  it('quotes the display name, not the ref, in the runtime error', () => {
    const selections = [listUsers.pick('Success'), listUsers.pick('Error')];

    expect(() => defineScenario('duplicate', selections)).toThrowError(
      /handler "Users" is picked twice in scenario "duplicate"/,
    );
  });

  it('treats the same url under a different method as a distinct handler', () => {
    const result = defineScenario('same url', [listUsers.pick('Success'), createUser.pick('Success')]);

    expect(Object.keys(result.configs)).toEqual(['get./users', 'post./users']);
  });

  it('accepts distinct handlers that share a display name', () => {
    // Two domains naming their list endpoint the same thing is legitimate.
    const topics = defineHandlers([
      { name: 'List', url: '/topics', method: 'get', responseVariants: [] },
    ] as const satisfies readonly HandlerConfigOption[]);
    const subscriptions = defineHandlers([
      { name: 'List', url: '/subscriptions', method: 'get', responseVariants: [] },
    ] as const satisfies readonly HandlerConfigOption[]);

    const result = defineScenario('both', [
      topics.pick('List', 'anything'),
      subscriptions.pick('List', 'anything'),
    ]);

    expect(Object.keys(result.configs)).toEqual(['get./topics', 'get./subscriptions']);
  });

  it('catches the same handler reached through different entry paths', () => {
    const registry = defineHandlers([listUsers] as const);

    expect(() =>
      defineScenario('cross entry', [
        registry.pick('Users', 'Success'),
        // @ts-expect-error - registry and handler paths resolve to the same ref
        listUsers.pick('Error'),
      ]),
    ).toThrow();
  });

  it('does not report false duplicates when refs were widened', () => {
    // A widened collection loses its literal urls, so the compile-time check
    // steps aside; the runtime backstop must not misfire in its place.
    const legacy: HandlerConfigOption[] = [
      { name: 'A', url: '/a', method: 'get' },
      { name: 'B', url: '/b', method: 'get' },
    ];
    const registry = defineHandlers(legacy);

    const result = defineScenario('widened', [
      registry.pick('A', 'anything'),
      registry.pick('B', 'anything'),
    ]);

    expect(Object.keys(result.configs)).toEqual(['get./a', 'get./b']);
  });

  it('still catches a genuine duplicate in a widened collection', () => {
    const legacy: HandlerConfigOption[] = [{ name: 'A', url: '/a', method: 'get' }];
    const registry = defineHandlers(legacy);
    const selections = [registry.pick('A', 'x'), registry.pick('A', 'y')];

    expect(() => defineScenario('widened dup', selections)).toThrowError(/handler "A" is picked twice/);
  });
});
