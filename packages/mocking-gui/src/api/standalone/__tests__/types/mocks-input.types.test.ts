// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { defineRegistry, defineScenario } from '../../../scenario';
import { createMockServer } from '../../server';

import type { HandlerConfigOption, ReadonlyHandlerConfig } from '../../../../types/config';

const ORIGIN = 'http://mock.test';

/**
 * `createMockServer` takes the collections `MockingConfig.mocks` takes, so one
 * declaration feeds the worker, `setupMockingServer` and the mock server. Each
 * case fails to compile if that stops being true.
 */
describe('createMockServer mocks input', () => {
  it('serves a registry and a scenario declared with the scenario API', async () => {
    const registry = defineRegistry([
      {
        name: 'Users',
        url: '/api/users',
        method: 'get',
        responseVariants: [
          { name: 'Listed', status: 200, body: [{ id: 1 }] },
          { name: 'Empty', status: 200, body: [] },
        ],
      },
    ]);
    const server = createMockServer({
      mocks: registry.handlers,
      scenarios: [defineScenario('empty list', [registry.pick('Users', 'Empty')])],
      defaultScenario: 'empty-list',
    });

    const response = await server.handle(new Request(`${ORIGIN}/api/users`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('accepts an as const pinned collection', () => {
    const handlers = [
      { name: 'Quota', url: '/quota', method: 'get', responseVariants: [] },
    ] as const satisfies readonly ReadonlyHandlerConfig[];

    expect(() => createMockServer({ mocks: handlers })).not.toThrow();
  });

  it('accepts a plain mutable HandlerConfigOption[]', () => {
    const handlers: HandlerConfigOption[] = [
      { name: 'Quota', url: '/quota', method: 'get', responseVariants: [] },
    ];

    expect(() => createMockServer({ mocks: handlers })).not.toThrow();
  });
});
