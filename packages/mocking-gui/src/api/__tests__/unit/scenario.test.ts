import { describe, expect, it } from 'vitest';

import { HandlerType } from '../../../types/handler';
import { isValidScenario } from '../../../utils/scenario';
import { defineHandler, defineHandlers } from '../../define';
import { defineScenario, extendScenario } from '../../scenario';

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

const quotaHandler = defineHandler({
  name: 'Quota',
  url: '/api/quota',
  method: 'get',
  responseVariants: [
    { name: 'Plenty', status: 200 },
    { name: 'Exhausted', status: 429 },
  ],
});

describe('defineScenario', () => {
  it('builds configs keyed by the internal handler key', () => {
    const result = defineScenario('Admin view', [usersHandler.pick('Admin')]);

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
    const result = defineScenario('Mixed', [
      registry.pick('Users', 'Admin'),
      notebooksHandler.pick('Empty'),
    ]);

    expect(Object.keys(result.configs)).toEqual(['get./api/users', 'get./api/notebooks']);
  });

  it('preserves a Korean name as a slug id', () => {
    expect(defineScenario('관리자 사용자', [usersHandler.pick('Admin')]).id).toBe('관리자-사용자');
  });

  it('carries delay through into the stored config', () => {
    const result = defineScenario('Slow', [usersHandler.pick('Admin', { delay: 750 })]);
    expect(result.configs['get./api/users'].delay).toBe(750);
  });

  it('throws when the same handler is picked twice', () => {
    const selections = [usersHandler.pick('Success'), usersHandler.pick('Admin')];

    expect(() => defineScenario('Oops', selections)).toThrowError(
      /handler "Users" is picked twice in scenario "Oops"/,
    );
  });

  it('rejects a duplicate pick at compile time', () => {
    expect(() =>
      defineScenario('Oops', [
        usersHandler.pick('Success'),
        // @ts-expect-error - picking the same handler twice is a duplicate
        usersHandler.pick('Admin'),
      ]),
    ).toThrow();
  });

  it('uses explicit id, description and createdAt when given', () => {
    const result = defineScenario('Admin view', [usersHandler.pick('Admin')], {
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
    expect(defineScenario('No description', [usersHandler.pick('Admin')])).not.toHaveProperty(
      'description',
    );
  });

  it('falls back to a stable id when the name has no sluggable characters', () => {
    expect(defineScenario('!!! ???', [usersHandler.pick('Admin')]).id).toBe('scenario');
  });

  it('accepts a dynamically built array (runtime backstop only)', () => {
    const selections: Selection[] = [usersHandler.pick('Admin')];
    expect(defineScenario('Dynamic', selections).id).toBe('dynamic');
  });
});

describe('extendScenario', () => {
  const base = defineScenario('Base', [usersHandler.pick('Admin')], { description: 'shared premise' });

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
    const plainBase = defineScenario('Plain', [usersHandler.pick('Admin')]);
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

describe('extendScenario chaining', () => {
  const authBase = defineScenario('Admin auth', [usersHandler.pick('Admin')], {
    description: 'admin is signed in',
  });

  it('accumulates handlers across three levels', () => {
    const withQuota = extendScenario(authBase, 'Admin + quota', [quotaHandler.pick('Plenty')]);
    const withNotebooks = extendScenario(withQuota, 'Admin + quota + notebooks', [
      notebooksHandler.pick('Success'),
    ]);

    expect(Object.keys(withNotebooks.configs)).toEqual([
      'get./api/users',
      'get./api/quota',
      'get./api/notebooks',
    ]);
  });

  it('lets a later link override a handler set by an earlier one', () => {
    const withQuota = extendScenario(authBase, 'Admin + quota', [quotaHandler.pick('Plenty')]);
    const exhausted = extendScenario(withQuota, 'Quota exhausted', [
      quotaHandler.pick('Exhausted'),
    ]);

    expect(exhausted.configs['get./api/quota'].variant).toBe('Exhausted');
    // The link it was derived from keeps its own value.
    expect(withQuota.configs['get./api/quota'].variant).toBe('Plenty');
  });

  it('carries the root description down the whole chain', () => {
    const link1 = extendScenario(authBase, 'L1', [quotaHandler.pick('Plenty')]);
    const link2 = extendScenario(link1, 'L2', [notebooksHandler.pick('Success')]);

    expect(link2.description).toBe('admin is signed in');
  });

  it('produces a valid Scenario at every link', () => {
    const link1 = extendScenario(authBase, 'L1', [quotaHandler.pick('Plenty')]);
    const link2 = extendScenario(link1, 'L2', [notebooksHandler.pick('Success')]);

    expect([authBase, link1, link2].every(isValidScenario)).toBe(true);
  });

  it('keeps delay through inheritance', () => {
    const slow = extendScenario(authBase, 'Slow quota', [
      quotaHandler.pick('Plenty', { delay: 900 }),
    ]);

    expect(slow.configs['get./api/quota'].delay).toBe(900);
    expect(slow.configs['get./api/users'].delay).toBeUndefined();
  });
});

describe('duplicate picks', () => {
  it('rejects a duplicate reached through two different entry paths', () => {
    const registry = defineHandlers([usersHandler]);

    expect(() =>
      defineScenario('cross entry', [
        registry.pick('Users', 'Success'),
        // @ts-expect-error - the registry and the handler resolve to the same ref
        usersHandler.pick('Admin'),
      ]),
    ).toThrowError(/handler "Users" is picked twice in scenario "cross entry"/);
  });

  it('names the offending handler and the scenario in the message', () => {
    expect(() =>
      defineScenario('reported', [
        notebooksHandler.pick('Success'),
        // @ts-expect-error - picking the same handler twice is a duplicate
        notebooksHandler.pick('Empty'),
      ]),
    ).toThrowError(/handler "Notebooks" is picked twice in scenario "reported"/);
  });

  it('allows the same display name when the refs differ', () => {
    const topics = defineHandlers([
      { name: 'List', url: '/topics', method: 'get', responseVariants: [] },
    ] as const);
    const subs = defineHandlers([
      { name: 'List', url: '/subs', method: 'get', responseVariants: [] },
    ] as const);

    const result = defineScenario('both lists', [
      topics.pick('List', 'anything'),
      subs.pick('List', 'anything'),
    ]);

    expect(Object.keys(result.configs)).toEqual(['get./topics', 'get./subs']);
  });

  it('rejects a duplicate introduced by a dynamically built selection list', () => {
    // A runtime-built array is not a tuple, so `Unique` cannot see it — the
    // runtime check is the only line of defence here.
    const selections = [notebooksHandler, notebooksHandler].map(handler => handler.pick('Empty'));

    expect(() => defineScenario('dynamic', selections)).toThrowError(
      /handler "Notebooks" is picked twice/,
    );
  });
});
