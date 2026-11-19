// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { call, handlers, scenarios } from './testkit.test.util';
import { createMockServer } from '../../server';

describe('standalone — launch folder', () => {
  it('reports the folder it was started for', async () => {
    const server = createMockServer({ mocks: handlers, scenarios, root: '/work/checkout-a' });

    const health: { root?: string } = await (await call(server, '/__mogu/health')).json();

    expect(health.root).toBe('/work/checkout-a');
  });

  it('leaves the field out when no folder was given', async () => {
    const server = createMockServer({ mocks: handlers, scenarios });

    const health: Record<string, unknown> = await (await call(server, '/__mogu/health')).json();

    expect('root' in health).toBe(false);
  });
});
