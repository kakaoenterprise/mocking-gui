import { describe, expect, it } from 'vitest';

import { defineHandler, defineHandlers } from '../../define';

import type { HandlerConfigOption, ReadonlyHandlerConfig } from '../../../types/config';

const usersHandler = defineHandler({
  name: 'Users',
  url: '/api/users',
  method: 'get',
  responseVariants: [
    { name: 'Success', status: 200 },
    { name: 'Admin', status: 200 },
  ],
});

const notebooksHandler = defineHandler({
  name: 'Notebooks',
  url: '/api/notebooks',
  method: 'get',
  responseVariants: [
    { name: 'Success', status: 200 },
    { name: 'Empty', status: 200 },
  ],
});

describe('defineHandler', () => {
  it('reports the handler name, the derived key and the variant on pick()', () => {
    expect(usersHandler.pick('Success')).toEqual({
      handlerName: 'Users',
      ref: ['get', '/api/users'],
      variant: 'Success',
    });
  });

  it('includes delay in the selection when provided', () => {
    expect(usersHandler.pick('Admin', { delay: 500 })).toEqual({
      handlerName: 'Users',
      ref: ['get', '/api/users'],
      variant: 'Admin',
      delay: 500,
    });
  });

  it('keeps the original config properties intact (same object augmented)', () => {
    expect(usersHandler.name).toBe('Users');
    expect(usersHandler.url).toBe('/api/users');
  });

  it('leaves pick() non-enumerable so the handler stays serializable', () => {
    expect(Object.keys(usersHandler)).not.toContain('pick');
    expect(JSON.parse(JSON.stringify(usersHandler))).not.toHaveProperty('pick');
  });

  it('rejects an unknown variant at runtime, listing what is available', () => {
    const widened = defineHandler({
      name: 'Widened',
      url: '/api/widened',
      method: 'get',
      responseVariants: [{ name: 'Success', status: 200 }],
    } as ReadonlyHandlerConfig);

    expect(() => widened.pick('Nope')).toThrowError(
      /handler "Widened" has no variant "Nope".*Available variants: "Success"/s,
    );
  });

  it('rejects invalid variant names at compile time', () => {
    // @ts-expect-error - 'nope' is not a valid variant name for this handler
    expect(() => usersHandler.pick('nope')).toThrow();
  });
});

describe('defineHandlers', () => {
  const registry = defineHandlers([usersHandler, notebooksHandler]);

  it('picks by handler name, never by the internal storage key', () => {
    expect(registry.pick('Users', 'Admin')).toEqual({
      handlerName: 'Users',
      ref: ['get', '/api/users'],
      variant: 'Admin',
    });
  });

  it('exposes handler names in declaration order', () => {
    expect(registry.names).toEqual(['Users', 'Notebooks']);
  });

  it('pulls a handler out for repeated picking via get()', () => {
    const notebooks = registry.get('Notebooks');
    expect(notebooks.pick('Empty').ref).toEqual(['get', '/api/notebooks']);
  });

  it('resolves a handler name to its storage key', () => {
    expect(registry.keyOf('Users')).toBe('get./api/users');
    expect(registry.keyOf('Notebooks')).toBe('get./api/notebooks');
  });

  it('accepts a name read back from names() without a cast', () => {
    expect(registry.names.map(name => registry.keyOf(name))).toEqual([
      'get./api/users',
      'get./api/notebooks',
    ]);
  });

  it('throws from keyOf for an unknown handler name', () => {
    // @ts-expect-error - 'Nope' is not a handler name in this registry
    expect(() => registry.keyOf('Nope')).toThrowError(/no handler named "Nope"/);
  });

  it('returns an equivalent handler on repeated get() calls', () => {
    expect(registry.get('Users')).toBe(registry.get('Users'));
    expect(registry.get('Users').pick('Admin')).toEqual(usersHandler.pick('Admin'));
  });

  it('throws for an unknown handler name, listing what is available', () => {
    // @ts-expect-error - 'Nope' is not a handler name in this registry
    expect(() => registry.pick('Nope', 'Success')).toThrowError(
      /no handler named "Nope".*Available: "Users", "Notebooks"/s,
    );
  });

  it('throws for an unknown variant of a known handler', () => {
    // @ts-expect-error - 'Empty' belongs to Notebooks, not Users
    expect(() => registry.pick('Users', 'Empty')).toThrowError(
      /handler "Users" has no variant "Empty"/,
    );
  });

  it('rejects two handlers sharing a name', () => {
    expect(() =>
      defineHandlers([
        { name: 'Dup', url: '/a', method: 'get' },
        { name: 'Dup', url: '/b', method: 'get' },
      ]),
    ).toThrowError(/duplicate handler name "Dup"/);
  });

  it('rejects two handlers resolving to the same method + url', () => {
    expect(() =>
      defineHandlers([
        { name: 'First', url: '/same', method: 'get' },
        { name: 'Second', url: '/same', method: 'get' },
      ]),
    ).toThrowError(/"First" and "Second" both resolve to "get.\/same"/);
  });
});

describe('tier degradation', () => {
  it('accepts an unmodified HandlerConfigOption[] collection', () => {
    const legacy: HandlerConfigOption[] = [
      { name: 'Quota', url: '/api/quota', method: 'get', responseVariants: [] },
    ];
    const registry = defineHandlers(legacy);

    expect(registry.pick('Quota', 'anything-goes').ref).toEqual(['get', '/api/quota']);
  });

  it('supports get() and keyOf() on a widened collection', () => {
    const legacy: HandlerConfigOption[] = [
      { name: 'Quota', url: '/api/quota', method: 'get', responseVariants: [] },
    ];
    const registry = defineHandlers(legacy);

    expect(registry.keyOf('Quota')).toBe('get./api/quota');
    expect(registry.names).toEqual(['Quota']);
    // Variant names were erased at the declaration site, so any string is accepted.
    expect(registry.get('Quota').pick('anything').variant).toBe('anything');
  });
});
