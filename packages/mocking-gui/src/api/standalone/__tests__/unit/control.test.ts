// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  BASE,
  call,
  handlers,
  MOCK_ORIGIN,
  openSession,
  productDetail,
  products,
  scenarios,
  trialUsage,
} from './testkit.test.util';
import { getHandlerKey } from '../../../../utils/common/keys';
import { createMockServer } from '../../server';

import type { HandlerConfigOption } from '../../../../types/config';
import type { LogEntry, MockServer } from '../../types';

const createServer = () => createMockServer({ mocks: handlers, scenarios });

const pick = (server: MockServer, session: string, body: Record<string, unknown>) =>
  call(server, `/__mogu/sessions/${session}/picks`, { method: 'POST', body });

const readLog = async (
  server: MockServer,
  session: string,
  query = '',
): Promise<{ entries: LogEntry[]; pending: number; lastSeq: number }> =>
  (await call(server, `/__mogu/sessions/${session}/log${query}`)).json();

describe('standalone — pick', () => {
  it('overrides the scenario for one session only', async () => {
    const server = createServer();
    const picked = await openSession(server);
    const other = await openSession(server);

    const created = await pick(server, picked, { handler: 'products-list', variant: 'empty' });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ ruleId: 'r1' });

    const response = await call(server, '/v1/products', { session: picked });
    expect(await response.json()).toEqual({ items: [] });
    expect(response.headers.get('x-mogu-source')).toBe('rule');
    expect(response.headers.get('x-mogu-variant')).toBe('empty');

    const untouched = await call(server, '/v1/products', { session: other });
    expect(await untouched.json()).toEqual({ items: ['a', 'b'] });
    expect(untouched.headers.get('x-mogu-source')).toBe('scenario');
  });

  it('finds the handler by key, name or description', async () => {
    const server = createServer();

    for (const handler of [getHandlerKey(products), products.name, 'products-list']) {
      const session = await openSession(server);
      expect((await pick(server, session, { handler, variant: 'error' })).status).toBe(201);
      expect((await call(server, '/v1/products', { session })).status).toBe(500);
    }
  });

  it('lets the newest pick win', async () => {
    const server = createServer();
    const session = await openSession(server);

    await pick(server, session, { handler: 'products-list', variant: 'empty' });
    await pick(server, session, { handler: 'products-list', variant: 'error' });

    expect((await call(server, '/v1/products', { session })).status).toBe(500);
  });

  it('switches a handler to its response function with "auto"', async () => {
    const server = createServer();
    const session = await openSession(server);

    await pick(server, session, { handler: 'products-list', auto: true });

    const response = await call(server, '/v1/products?q=x', { session });
    expect(await response.json()).toEqual({ q: 'x' });
    expect(response.headers.get('x-mogu-variant')).toBe('auto');
  });

  it('answers with an inline response', async () => {
    const server = createServer();
    const session = await openSession(server);

    await pick(server, session, {
      handler: 'runs-start',
      response: { status: 422, headers: { 'x-reason': 'quota' }, body: { code: 'QUOTA' } },
    });
    await pick(server, session, {
      handler: 'terms-get',
      response: { status: 200, text: 'inline text' },
    });

    const json = await call(server, '/v1/runs', { session, method: 'POST', body: {} });
    expect(json.status).toBe(422);
    expect(json.headers.get('x-reason')).toBe('quota');
    expect(json.headers.get('x-mogu-variant')).toBe('inline');
    expect(await json.json()).toEqual({ code: 'QUOTA' });

    const text = await call(server, '/v1/terms', { session });
    expect(await text.text()).toBe('inline text');
    expect(text.headers.get('content-type')).toContain('text/plain');
  });

  it('turns on a handler the scenario left off', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'empty-list' });

    await pick(server, session, { handler: 'products-detail', variant: 'notFound' });

    expect((await call(server, '/v1/products/x', { session })).status).toBe(404);
  });

  it('drops the connection with fail', async () => {
    const server = createServer();
    const session = await openSession(server);

    await pick(server, session, { handler: 'products-list', fail: 'network' });

    const response = await call(server, '/v1/products', { session });
    expect(response.type).toBe('error');
  });

  it('removes every pick with DELETE', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'empty' });

    const cleared = await call(server, `/__mogu/sessions/${session}/picks`, { method: 'DELETE' });
    expect(cleared.status).toBe(204);

    expect(await (await call(server, '/v1/products', { session })).json()).toEqual({
      items: ['a', 'b'],
    });
  });

  it('lists the picks in the session detail', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'empty', delay: 5 });
    await pick(server, session, { handler: 'products-detail', delay: 7 });

    const detail: { rules: Record<string, unknown>[] } = await (
      await call(server, `/__mogu/sessions/${session}`)
    ).json();

    expect(detail.rules).toEqual([
      expect.objectContaining({
        id: 'r1',
        key: getHandlerKey(products),
        handler: products.name,
        kind: 'variant',
        variant: 'empty',
        delay: 5,
      }),
      expect.objectContaining({ id: 'r2', handler: productDetail.name, kind: 'delay', delay: 7 }),
    ]);
  });
});

describe('standalone — pick validation', () => {
  it('answers 404 with the nearest handlers for an unknown handler', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await pick(server, session, { handler: 'products-lst', variant: 'ok' });

    expect(response.status).toBe(404);
    const body: { error: string; nearest: string[] } = await response.json();
    expect(body.error).toBe('unknown_handler');
    expect(body.nearest[0]).toBe(products.name);
  });

  it('answers 400 with the variant list for an unknown variant', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await pick(server, session, { handler: 'products-list', variant: 'nope' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'unknown_variant',
      variants: ['ok', 'empty', 'error'],
    });
  });

  it('rejects an ambiguous, empty or malformed pick', async () => {
    const server = createServer();
    const session = await openSession(server);
    const invalid = async (body: Record<string, unknown>) => {
      const response = await pick(server, session, body);
      const parsed: { error: string } = await response.json();
      return [response.status, parsed.error];
    };

    expect(await invalid({ variant: 'ok' })).toEqual([400, 'invalid_pick']);
    expect(await invalid({ handler: 'products-list' })).toEqual([400, 'invalid_pick']);
    expect(await invalid({ handler: 'products-list', variant: 'ok', auto: true })).toEqual([
      400,
      'invalid_pick',
    ]);
    expect(await invalid({ handler: 'runs-start', auto: true })).toEqual([400, 'invalid_pick']);
    expect(await invalid({ handler: 'products-list', fail: 'timeout' })).toEqual([
      400,
      'invalid_pick',
    ]);
    expect(await invalid({ handler: 'products-list', delay: -1 })).toEqual([400, 'invalid_pick']);
    expect(await invalid({ handler: 'products-list', response: { status: 99 } })).toEqual([
      400,
      'invalid_pick',
    ]);
    expect(
      await invalid({ handler: 'products-list', response: { status: 200, body: {}, text: 'x' } }),
    ).toEqual([400, 'invalid_pick']);
    expect(await invalid({ handler: 'products-list', variant: 'ok', bogus: 1 })).toEqual([
      400,
      'invalid_pick',
    ]);
  });

  it('answers 404 for a pick on an unknown session', async () => {
    const response = await pick(createServer(), 'nope', {
      handler: 'products-list',
      variant: 'ok',
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'unknown_session' });
  });
});

describe('standalone — delay', () => {
  const elapsed = async (run: () => Promise<unknown>) => {
    const startedAt = performance.now();
    await run();
    return performance.now() - startedAt;
  };

  it('delays whatever the scenario answers when given alone', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', delay: 60 });

    let body: unknown;
    const took = await elapsed(async () => {
      const response = await call(server, '/v1/products', { session });
      expect(response.headers.get('x-mogu-source')).toBe('scenario');
      body = await response.json();
    });

    expect(body).toEqual({ items: ['a', 'b'] });
    expect(took).toBeGreaterThanOrEqual(50);
  });

  it('delays its own answer when given with one', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'empty', delay: 60 });

    const took = await elapsed(() => call(server, '/v1/products', { session }));

    expect(took).toBeGreaterThanOrEqual(50);
  });

  it('stops applying an older delay once a newer pick answers', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', delay: 300 });
    await pick(server, session, { handler: 'products-list', variant: 'empty' });

    const took = await elapsed(() => call(server, '/v1/products', { session }));

    expect(took).toBeLessThan(200);
  });

  it('applies a newer delay on top of an older answer', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'empty' });
    await pick(server, session, { handler: 'products-list', delay: 60 });

    let body: unknown;
    const took = await elapsed(async () => {
      body = await (await call(server, '/v1/products', { session })).json();
    });

    expect(body).toEqual({ items: [] });
    expect(took).toBeGreaterThanOrEqual(50);
  });
});

describe('standalone — scenario switch', () => {
  it('replaces the base configs and clears the picks', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', variant: 'error' });

    const switched = await call(server, `/__mogu/sessions/${session}/scenario`, {
      method: 'PUT',
      body: { scenario: 'empty-list' },
    });
    expect(switched.status).toBe(200);
    expect(await switched.json()).toEqual({ id: session, scenario: 'empty-list' });

    expect(await (await call(server, '/v1/products', { session })).json()).toEqual({ items: [] });
    expect((await call(server, '/v1/terms', { session })).status).toBe(501);
  });

  it('answers 404 for an unknown scenario', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, `/__mogu/sessions/${session}/scenario`, {
      method: 'PUT',
      body: { scenario: 'nope' },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'unknown_scenario' });
  });
});

describe('standalone — request log', () => {
  it('records every mock request with what answered it', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-detail', variant: 'notFound' });

    await call(server, '/v1/products?q=1', {
      session,
      headers: { origin: 'http://127.0.0.1:3100' },
    });
    await call(server, '/v1/products/agent-7', { session });
    await call(server, '/v1/nothing', { session });

    const { entries, pending, lastSeq } = await readLog(server, session);

    expect(pending).toBe(0);
    expect(lastSeq).toBe(3);
    expect(entries).toEqual([
      expect.objectContaining({
        seq: 1,
        method: 'GET',
        path: '/v1/products',
        query: '?q=1',
        handler: products.name,
        operation: 'products-list',
        source: 'scenario',
        variant: 'ok',
        ruleId: null,
        status: 200,
        origin: 'browser',
        screen: null,
      }),
      expect.objectContaining({
        seq: 2,
        path: '/v1/products/agent-7',
        query: '',
        operation: 'products-detail',
        source: 'rule',
        variant: 'notFound',
        ruleId: 'r1',
        status: 404,
        origin: 'server',
      }),
      expect.objectContaining({
        seq: 3,
        path: '/v1/nothing',
        handler: null,
        operation: null,
        source: 'unhandled',
        variant: null,
        status: 501,
      }),
    ]);
    expect(Number.isNaN(Date.parse(entries[0].at))).toBe(false);
    expect(entries[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records an off handler as unhandled but keeps its name', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'empty-list' });

    await call(server, '/v1/terms', { session });

    const { entries } = await readLog(server, session);
    expect(entries[0]).toMatchObject({
      operation: 'terms-get',
      source: 'unhandled',
      variant: null,
      status: 501,
    });
  });

  it('records a dropped connection with status 0 and a handler error with 500', async () => {
    const broken: HandlerConfigOption = {
      name: 'Broken',
      description: 'broken-get',
      url: `${BASE}/v1/broken`,
      method: 'get',
      responseVariantsFn: () => {
        throw new Error('boom');
      },
    };
    const server = createMockServer({ mocks: [broken, ...handlers], scenarios });
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', fail: 'network' });
    await pick(server, session, { handler: 'broken-get', auto: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await call(server, '/v1/products', { session });
    await call(server, '/v1/broken', { session });
    errorSpy.mockRestore();

    const { entries } = await readLog(server, session);
    expect(entries.map(entry => [entry.operation, entry.variant, entry.status])).toEqual([
      ['products-list', 'fail', 0],
      ['broken-get', 'auto', 500],
    ]);
  });

  it('stamps requests with the last mark and filters by it', async () => {
    const server = createServer();
    const session = await openSession(server);
    const mark = (screen: string) =>
      call(server, `/__mogu/sessions/${session}/mark`, { method: 'POST', body: { screen } });

    await call(server, '/v1/products', { session });
    const marked = await mark('B01');
    expect(await marked.json()).toEqual({ seq: 1 });
    await call(server, '/v1/products', { session });
    await call(server, '/v1/terms', { session });
    await mark('B02');
    await call(server, '/v1/products/agent-7', { session });

    const all = await readLog(server, session);
    expect(all.entries.map(entry => entry.screen)).toEqual([null, 'B01', 'B01', 'B02']);

    const byScreen = await readLog(server, session, '?screen=B01');
    expect(byScreen.entries.map(entry => entry.seq)).toEqual([2, 3]);

    const since = await readLog(server, session, '?since=2');
    expect(since.entries.map(entry => entry.seq)).toEqual([3, 4]);

    const byHandler = await readLog(server, session, '?handler=products-list&since=1');
    expect(byHandler.entries.map(entry => entry.seq)).toEqual([2]);

    const summary: { lastScreen: string }[] = await (await call(server, '/__mogu/sessions')).json();
    expect(summary[0].lastScreen).toBe('B02');
  });

  it('does not record preflights or control requests', async () => {
    const server = createServer();
    const session = await openSession(server);

    await server.handle(
      new Request(`${MOCK_ORIGIN}/v1/products`, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://127.0.0.1:3100',
          'access-control-request-method': 'GET',
          'x-mogu-session': session,
        },
      }),
    );
    await call(server, `/__mogu/sessions/${session}`);

    expect((await readLog(server, session)).entries).toEqual([]);
  });

  it('counts requests that are still waiting for their answer as pending', async () => {
    const server = createServer();
    const session = await openSession(server);
    await pick(server, session, { handler: 'products-list', delay: 80 });

    const inFlight = call(server, '/v1/products', { session });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect((await readLog(server, session)).pending).toBe(1);

    await inFlight;
    const after = await readLog(server, session);
    expect(after.pending).toBe(0);
    expect(after.entries[0].durationMs).toBeGreaterThanOrEqual(70);
  });

  it('rejects a malformed log query', async () => {
    const server = createServer();
    const session = await openSession(server);

    expect((await call(server, `/__mogu/sessions/${session}/log?since=x`)).status).toBe(400);
    expect((await call(server, `/__mogu/sessions/${session}/log?handler=nope`)).status).toBe(404);
  });
});

describe('standalone — wait', () => {
  const wait = async (
    server: MockServer,
    session: string,
    query: string,
  ): Promise<{ ok: boolean; count: number }> =>
    (await call(server, `/__mogu/sessions/${session}/wait?${query}`)).json();

  it('answers at once when the count is already reached', async () => {
    const server = createServer();
    const session = await openSession(server);
    await call(server, '/v1/products', { session });

    expect(await wait(server, session, 'handler=products-list')).toEqual({ ok: true, count: 1 });
  });

  it('answers as soon as the awaited request completes', async () => {
    const server = createServer();
    const session = await openSession(server);

    const startedAt = performance.now();
    const waiting = wait(server, session, 'handler=products-list&count=3&timeout=2000');
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 15));
      await call(server, '/v1/products', { session });
    }

    expect(await waiting).toEqual({ ok: true, count: 3 });
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it('gives up after the timeout', async () => {
    const server = createServer();
    const session = await openSession(server);
    await call(server, '/v1/products', { session });

    const result = await wait(server, session, 'handler=products-list&count=2&timeout=40');

    expect(result).toEqual({ ok: false, count: 1 });
  });

  it('only counts requests after "since"', async () => {
    const server = createServer();
    const session = await openSession(server);
    await call(server, '/v1/products', { session });
    await call(server, '/v1/products', { session });

    expect(await wait(server, session, 'handler=products-list&since=1&timeout=20')).toEqual({
      ok: true,
      count: 1,
    });
    expect(await wait(server, session, 'handler=products-list&since=2&timeout=20')).toEqual({
      ok: false,
      count: 0,
    });
  });

  it('requires a known handler', async () => {
    const server = createServer();
    const session = await openSession(server);

    expect((await call(server, `/__mogu/sessions/${session}/wait`)).status).toBe(400);
    expect((await call(server, `/__mogu/sessions/${session}/wait?handler=nope`)).status).toBe(404);
  });

  it('releases waiters when the session is deleted', async () => {
    const server = createServer();
    const session = await openSession(server);

    const waiting = wait(server, session, 'handler=products-list&timeout=5000');
    await call(server, `/__mogu/sessions/${session}`, { method: 'DELETE' });

    expect(await waiting).toEqual({ ok: false, count: 0 });
  });
});

describe('standalone — session copy', () => {
  it('copies picks and the last mark but not the log', async () => {
    const server = createServer();
    const source = await openSession(server);
    await pick(server, source, { handler: 'runs-trial_usage', variant: 'usedUp' });
    await call(server, `/__mogu/sessions/${source}/mark`, {
      method: 'POST',
      body: { screen: 'C01' },
    });
    await call(server, '/v1/runs/trial-usage', { session: source });

    const copy = await openSession(server, { from: source });
    await pick(server, copy, { handler: 'products-list', variant: 'empty' });

    expect(await (await call(server, '/v1/runs/trial-usage', { session: copy })).json()).toEqual(
      trialUsage.responseVariants?.[2].body,
    );
    const copyLog = await readLog(server, copy);
    expect(copyLog.entries.map(entry => [entry.seq, entry.screen])).toEqual([[1, 'C01']]);

    // A pick made on the copy never reaches the source.
    expect(await (await call(server, '/v1/products', { session: source })).json()).toEqual({
      items: ['a', 'b'],
    });
    expect((await readLog(server, source)).entries).toHaveLength(2);
  });
});
