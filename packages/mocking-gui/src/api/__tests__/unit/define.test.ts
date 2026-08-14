import { describe, expect, it } from 'vitest';

import { HandlerType } from '../../../types/handler';
import { isValidScenario } from '../../../utils/scenario';
import { defineHandler, defineHandlers } from '../../define';
import { extendScenario, scenario } from '../../scenario';

import type { ReadonlyHandlerConfig, HandlerConfigOption } from '../../../types/config';
import type { Selection } from '../../define';

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

describe('scenario', () => {
  it('builds configs keyed by the internal handler key', () => {
    const result = scenario('Admin view', [usersHandler.pick('Admin')]);

    expect(result).toEqual({
      id: 'admin-view',
      name: 'Admin view',
      configs: {
        'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Admin' },
      },
      createdAt: '1970-01-01T00:00:00.000Z',
    });
    expect(isValidScenario(result)).toBe(true);
  });

  it('accepts selections from both entry paths in one scenario', () => {
    const registry = defineHandlers([usersHandler, notebooksHandler]);
    const result = scenario('Mixed', [
      registry.pick('Users', 'Admin'),
      notebooksHandler.pick('Empty'),
    ]);

    expect(Object.keys(result.configs)).toEqual(['get./api/users', 'get./api/notebooks']);
  });

  it('preserves a Korean name as a slug id', () => {
    expect(scenario('관리자 사용자', [usersHandler.pick('Admin')]).id).toBe('관리자-사용자');
  });

  it('carries delay through into the stored config', () => {
    const result = scenario('Slow', [usersHandler.pick('Admin', { delay: 750 })]);
    expect(result.configs['get./api/users'].delay).toBe(750);
  });

  it('throws when the same handler is picked twice', () => {
    const selections = [usersHandler.pick('Success'), usersHandler.pick('Admin')];

    expect(() => scenario('Oops', selections)).toThrowError(
      /handler "Users" is picked twice in scenario "Oops"/,
    );
  });

  it('rejects a duplicate pick at compile time', () => {
    expect(() =>
      scenario('Oops', [
        usersHandler.pick('Success'),
        // @ts-expect-error - picking the same handler twice is a duplicate
        usersHandler.pick('Admin'),
      ]),
    ).toThrow();
  });

  it('uses explicit id, description and createdAt when given', () => {
    const result = scenario('Admin view', [usersHandler.pick('Admin')], {
      id: 'custom-id',
      description: 'for the admin dashboard',
      createdAt: '2026-08-13T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'custom-id',
      description: 'for the admin dashboard',
      createdAt: '2026-08-13T00:00:00.000Z',
    });
  });

  it('omits description entirely when none is given', () => {
    expect(scenario('No description', [usersHandler.pick('Admin')])).not.toHaveProperty(
      'description',
    );
  });

  it('falls back to a stable id when the name has no sluggable characters', () => {
    expect(scenario('!!! ???', [usersHandler.pick('Admin')]).id).toBe('scenario');
  });

  it('accepts a dynamically built array (runtime backstop only)', () => {
    const selections: Selection[] = [usersHandler.pick('Admin')];
    expect(scenario('Dynamic', selections).id).toBe('dynamic');
  });
});

describe('extendScenario', () => {
  const base = scenario('Base', [usersHandler.pick('Admin')], { description: 'shared premise' });

  it('merges base configs with the overrides', () => {
    const extended = extendScenario(base, 'Base + empty notebooks', [
      notebooksHandler.pick('Empty'),
    ]);

    expect(extended.configs).toEqual({
      'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Admin' },
      'get./api/notebooks': { active: true, type: HandlerType.MANUAL, variant: 'Empty' },
    });
  });

  it('lets an override replace a handler already set by the base', () => {
    const extended = extendScenario(base, 'Base but plain user', [usersHandler.pick('Success')]);

    expect(extended.configs['get./api/users'].variant).toBe('Success');
  });

  it('leaves the base scenario untouched', () => {
    extendScenario(base, 'Derived', [usersHandler.pick('Success')]);
    expect(base.configs['get./api/users'].variant).toBe('Admin');
  });

  it('inherits description and createdAt unless overridden', () => {
    const extended = extendScenario(base, 'Derived', [notebooksHandler.pick('Empty')]);
    expect(extended.description).toBe('shared premise');
    expect(extended.createdAt).toBe(base.createdAt);
  });

  it('prefers an explicit description over the inherited one', () => {
    const extended = extendScenario(base, 'Derived', [notebooksHandler.pick('Empty')], {
      description: 'its own premise',
    });

    expect(extended.description).toBe('its own premise');
  });

  it('omits description when neither the options nor the base carry one', () => {
    const plainBase = scenario('Plain', [usersHandler.pick('Admin')]);
    const extended = extendScenario(plainBase, 'Derived', [notebooksHandler.pick('Empty')]);

    expect(extended).not.toHaveProperty('description');
  });

  it('uses explicit id and createdAt when given', () => {
    const extended = extendScenario(base, 'Derived', [notebooksHandler.pick('Empty')], {
      id: 'derived-id',
      createdAt: '2026-08-13T00:00:00.000Z',
    });

    expect(extended).toMatchObject({ id: 'derived-id', createdAt: '2026-08-13T00:00:00.000Z' });
  });

  it('still rejects duplicates within its own selection list', () => {
    const selections = [notebooksHandler.pick('Success'), notebooksHandler.pick('Empty')];

    expect(() => extendScenario(base, 'Oops', selections)).toThrowError(
      /handler "Notebooks" is picked twice in scenario "Oops"/,
    );
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
