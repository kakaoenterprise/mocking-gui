// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { call, handlers, openSession, runsStart, scenarios } from './testkit.test.util';
import { createMockServer } from '../../server';

import type { LogEntry, MockServer } from '../../types';

const createServer = () => createMockServer({ mocks: handlers, scenarios });

const pick = (server: MockServer, session: string, body: Record<string, unknown>) =>
  call(server, `/__mogu/sessions/${session}/picks`, { method: 'POST', body });

const bodyOf = async (server: MockServer, session: string, path: string): Promise<unknown> =>
  (await call(server, path, { session })).json();

const startRun = (server: MockServer, session: string) =>
  call(server, '/v1/runs', { session, method: 'POST', body: { product: 'agent-7' } });

describe('standalone — times', () => {
  it('answers the first n requests, then falls through to the pick below', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'runs-status', variant: 'completed' });
    await pick(server, session, { handler: 'runs-status', variant: 'running', times: 2 });

    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push(await bodyOf(server, session, '/v1/runs/run-1'));
    }

    expect(statuses).toEqual([
      { status: 'running' },
      { status: 'running' },
      { status: 'completed' },
      { status: 'completed' },
    ]);
  });

  it('falls through to the scenario when no other pick is below', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'error', times: 1 });

    expect((await call(server, '/v1/products', { session })).status).toBe(500);

    const retry = await call(server, '/v1/products', { session });
    expect(retry.status).toBe(200);
    expect(retry.headers.get('x-mogu-source')).toBe('scenario');
  });

  it('counts a delay-only pick by the requests it delayed', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', delay: 80, times: 1 });

    const first = performance.now();
    await call(server, '/v1/products', { session });
    const firstTook = performance.now() - first;

    const second = performance.now();
    await call(server, '/v1/products', { session });
    const secondTook = performance.now() - second;

    expect(firstTook).toBeGreaterThanOrEqual(70);
    expect(secondTook).toBeLessThan(60);
  });

  it('does not spend a count on requests to other handlers', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'empty', times: 1 });

    await bodyOf(server, session, '/v1/terms').catch(() => undefined);
    await bodyOf(server, session, '/v1/products/agent-7');

    expect(await bodyOf(server, session, '/v1/products')).toEqual({ items: [] });
    expect(await bodyOf(server, session, '/v1/products')).toEqual({ items: ['a', 'b'] });
  });
});

describe('standalone — after', () => {
  it('starts answering once the named handler has been requested', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, {
      handler: 'runs-trial_usage',
      variant: 'usedUp',
      after: 'runs-start',
    });

    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 1, limit: 3 });

    expect((await startRun(server, session)).status).toBe(201);

    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 3, limit: 3 });
    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 3, limit: 3 });

    const log: { entries: LogEntry[] } = await (
      await call(server, `/__mogu/sessions/${session}/log?handler=runs-trial_usage`)
    ).json();
    expect(log.entries.map(entry => [entry.source, entry.variant, entry.ruleId])).toEqual([
      ['scenario', 'ok', null],
      ['rule', 'usedUp', 'r1'],
      ['rule', 'usedUp', 'r1'],
    ]);
  });

  it('applies from the next request when it names its own handler', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, {
      handler: 'products-list',
      variant: 'empty',
      after: 'products-list',
    });

    expect(await bodyOf(server, session, '/v1/products')).toEqual({ items: ['a', 'b'] });
    expect(await bodyOf(server, session, '/v1/products')).toEqual({ items: [] });
  });

  it('ignores requests that came before the pick was made', async () => {
    const server = createServer();
    const session = await openSession(server);
    await startRun(server, session);
    await pick(server, session, {
      handler: 'runs-trial_usage',
      variant: 'usedUp',
      after: 'runs-start',
    });

    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 1, limit: 3 });

    await startRun(server, session);
    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 3, limit: 3 });
  });

  it('is triggered even when the named handler is off', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'empty-list' });
    await pick(server, session, {
      handler: 'products-list',
      variant: 'error',
      after: 'runs-start',
    });

    expect((await startRun(server, session)).status).toBe(501);

    expect((await call(server, '/v1/products', { session })).status).toBe(500);
  });

  it('combines with times', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, {
      handler: 'runs-trial_usage',
      variant: 'usedUp',
      after: 'runs-start',
      times: 1,
    });

    await startRun(server, session);

    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 3, limit: 3 });
    expect(await bodyOf(server, session, '/v1/runs/trial-usage')).toEqual({ used: 1, limit: 3 });
  });

  it('describes a whole flow up front, with no scenario switch in between', async () => {
    const server = createServer();
    const session = await openSession(server);
    // Trial prep (C01): usage is fine → start → the run polls twice → done, and the quota is used up.
    await pick(server, session, { handler: 'runs-status', variant: 'completed' });
    await pick(server, session, { handler: 'runs-status', variant: 'running', times: 2 });
    await pick(server, session, {
      handler: 'runs-trial_usage',
      variant: 'usedUp',
      after: 'runs-start',
    });

    const seen = [
      await bodyOf(server, session, '/v1/runs/trial-usage'),
      await (await startRun(server, session)).json(),
      await bodyOf(server, session, '/v1/runs/run-1'),
      await bodyOf(server, session, '/v1/runs/run-1'),
      await bodyOf(server, session, '/v1/runs/run-1'),
      await bodyOf(server, session, '/v1/runs/trial-usage'),
    ];

    expect(seen).toEqual([
      { used: 1, limit: 3 },
      { id: 'run-1' },
      { status: 'running' },
      { status: 'running' },
      { status: 'completed' },
      { used: 3, limit: 3 },
    ]);
  });
});

describe('standalone — state and validation', () => {
  it('shows the trigger and the remaining count in the session detail', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, {
      handler: 'runs-trial_usage',
      variant: 'usedUp',
      after: 'runs-start',
      times: 2,
    });

    const rulesOf = async (): Promise<Record<string, unknown>[]> => {
      const detail: { rules: Record<string, unknown>[] } = await (
        await call(server, `/__mogu/sessions/${session}`)
      ).json();
      return detail.rules;
    };

    expect(await rulesOf()).toEqual([
      expect.objectContaining({
        id: 'r1',
        after: runsStart.name,
        armed: false,
        times: 2,
        remaining: 2,
      }),
    ]);

    await startRun(server, session);
    await bodyOf(server, session, '/v1/runs/trial-usage');

    expect(await rulesOf()).toEqual([
      expect.objectContaining({ armed: true, times: 2, remaining: 1 }),
    ]);
  });

  it('copies the trigger state and the remaining count to a session copy', async () => {
    const server = createServer();
    const source = await openSession(server);
    await pick(server, source, { handler: 'products-list', variant: 'empty', times: 2 });
    await bodyOf(server, source, '/v1/products');

    const copy = await openSession(server, { from: source });

    expect(await bodyOf(server, copy, '/v1/products')).toEqual({ items: [] });
    expect(await bodyOf(server, copy, '/v1/products')).toEqual({ items: ['a', 'b'] });
    // The copy spent its own count; the source still has one left.
    expect(await bodyOf(server, source, '/v1/products')).toEqual({ items: [] });
  });

  it('rejects a malformed after or times', async () => {
    const server = createServer();
    const session = await openSession(server);
    const statusOf = async (extra: Record<string, unknown>) =>
      (await pick(server, session, { handler: 'products-list', variant: 'ok', ...extra })).status;

    expect(await statusOf({ times: 0 })).toBe(400);
    expect(await statusOf({ times: 1.5 })).toBe(400);
    expect(await statusOf({ times: '2' })).toBe(400);
    expect(await statusOf({ after: 'nope' })).toBe(404);
    expect(await statusOf({ after: 7 })).toBe(400);
    expect(await statusOf({ after: 'runs-start', times: 3 })).toBe(201);
  });
});
