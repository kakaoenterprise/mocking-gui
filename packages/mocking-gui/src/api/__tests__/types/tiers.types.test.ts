import { describe, expect, it } from 'vitest';

import { defineHandlers } from '../../define';

import type { HandlerConfigOption } from '../../../types/config';
import type { HandlerNameOf } from '../../define';

/**
 * Type-level regression tests for how a registry's name union degrades.
 *
 * Scope is the name union only — duplicate-detection semantics live in
 * `identity.types.test.ts`.
 *
 * The failure these lock down was real and silent: one handler declared without
 * `as const` in a mixed collection contributed `name: string`, which turned the
 * lookup map's `keyof` into `string` and disabled name checking for *every*
 * handler in that registry. `@ts-expect-error` is the assertion — if a case
 * stops erroring, the directive reports "unused" and this file fails to compile.
 */

const typedHandlers = [
  {
    name: 'Users',
    url: '/api/users',
    method: 'get',
    responseVariants: [
      { name: 'Success', status: 200 },
      { name: 'Admin', status: 200 },
    ],
  },
  {
    name: 'Notebooks',
    url: '/api/notebooks',
    method: 'get',
    responseVariants: [
      { name: 'Success', status: 200 },
      { name: 'Empty', status: 200 },
    ],
  },
] as const satisfies readonly HandlerConfigOption[];

const widenedHandlers: HandlerConfigOption[] = [
  {
    name: 'Quota',
    url: '/api/quota',
    method: 'get',
    responseVariants: [{ name: 'Success', status: 200 }],
  },
];

describe('HandlerNameOf — pinned collection', () => {
  const registry = defineHandlers(typedHandlers);

  it('accepts declared names and narrows variants to that handler', () => {
    expect(registry.pick('Users', 'Admin').variant).toBe('Admin');
    expect(registry.pick('Notebooks', 'Empty').variant).toBe('Empty');
  });

  it('rejects an undeclared handler name', () => {
    // @ts-expect-error - 'Nope' is not a handler name in this registry
    expect(() => registry.pick('Nope', 'Success')).toThrow();
  });

  it('rejects a variant belonging to a different handler', () => {
    // @ts-expect-error - 'Empty' is a Notebooks variant, not a Users one
    expect(() => registry.pick('Users', 'Empty')).toThrow();
  });

  it('rejects an arbitrary string as a handler name', () => {
    const name = 'anything' as string;
    // @ts-expect-error - the name union is a literal union, not string
    expect(() => registry.pick(name, 'Success')).toThrow();
  });
});

describe('HandlerNameOf — mixed collection', () => {
  // This is the shape that used to collapse: pinned handlers spread alongside
  // an annotated (widened) array.
  const registry = defineHandlers([...typedHandlers, ...widenedHandlers]);

  it('keeps checking the names that survived as literals', () => {
    expect(registry.pick('Users', 'Admin').variant).toBe('Admin');
  });

  it('still rejects an undeclared name — the collapse this file guards against', () => {
    // @ts-expect-error - must stay an error even though the collection is mixed
    expect(() => registry.pick('Nope', 'Success')).toThrow();
  });

  it('still narrows variants for the pinned handlers', () => {
    // @ts-expect-error - 'Empty' is not a Users variant
    expect(() => registry.pick('Users', 'Empty')).toThrow();
  });

  it('makes the widened handler a compile error to pick by name', () => {
    // @ts-expect-error - 'Quota' was declared without `as const`, so it is not
    // in the name union. Pin it, or give it its own registry.
    expect(registry.pick('Quota', 'Success').variant).toBe('Success');
  });
});

describe('HandlerNameOf — fully widened collection', () => {
  const registry = defineHandlers(widenedHandlers);

  it('falls back to string so an unmigrated codebase still works', () => {
    const name: HandlerNameOf<typeof widenedHandlers> = 'Quota';
    expect(registry.pick(name, 'Success').ref).toEqual(['get', '/api/quota']);
  });

  it('leaves variant typos to runtime validation', () => {
    expect(() => registry.pick('Quota', 'Typo')).toThrowError(
      /handler "Quota" has no variant "Typo"/,
    );
  });
});
