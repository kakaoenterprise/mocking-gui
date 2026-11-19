// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  auto,
  BASE,
  call,
  handlers,
  manual,
  MOCK_ORIGIN,
  openSession,
  productDetail,
  products,
  scenarioOf,
  scenarios,
} from './testkit.test.util';
import { HandlerType } from '../../../../types/handler';
import { getHandlerKey } from '../../../../utils/common/keys';
import { createMockServer } from '../../server';

import type { HandlerConfigOption } from '../../../../types/config';

const createServer = () => createMockServer({ mocks: handlers, scenarios });

describe('standalone — session value', () => {
  it('rejects a mock request without a session value', async () => {
    const response = await call(createServer(), '/v1/products');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'session_required' });
  });

  it('rejects an unknown session id', async () => {
    const response = await call(createServer(), '/v1/products', { session: 'nope' });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'unknown_session', session: 'nope' });
  });

  it('reads the session id from the header, then from the cookie', async () => {
    const server = createServer();
    const basic = await openSession(server, { scenario: 'basic' });
    const empty = await openSession(server, { scenario: 'empty-list' });

    const byCookie = await call(server, '/v1/products', {
      headers: { cookie: `theme=dark; mogu_session=${empty}` },
    });
    expect(await byCookie.json()).toEqual({ items: [] });

    const headerWins = await call(server, '/v1/products', {
      session: basic,
      headers: { cookie: `mogu_session=${empty}` },
    });
    expect(await headerWins.json()).toEqual({ items: ['a', 'b'] });
  });

  it('serves requests without a session value from the default scenario', async () => {
    const server = createMockServer({ mocks: handlers, scenarios, defaultScenario: 'empty-list' });

    const response = await call(server, '/v1/products');
    expect(await response.json()).toEqual({ items: [] });

    const list: { id: string; scenario: string }[] = await (
      await call(server, '/__mogu/sessions')
    ).json();
    expect(list).toEqual([expect.objectContaining({ id: 'default', scenario: 'empty-list' })]);
  });

  it('fails fast when the default scenario does not exist', () => {
    expect(() => createMockServer({ mocks: handlers, scenarios, defaultScenario: 'x' })).toThrow(
      /defaultScenario "x"/,
    );
  });
});

describe('standalone — session isolation', () => {
  it('keeps concurrent sessions apart', async () => {
    const server = createServer();
    const basic = await openSession(server, { scenario: 'basic' });
    const empty = await openSession(server, { scenario: 'empty-list' });

    const results = await Promise.all(
      Array.from({ length: 40 }, async (_, index) => {
        const session = index % 2 === 0 ? basic : empty;
        const response = await call(server, '/v1/products', { session });
        const body: { items: string[] } = await response.json();
        return { session, count: body.items.length };
      }),
    );

    expect(results.filter(result => result.session === basic).map(r => r.count)).toEqual(
      Array.from({ length: 20 }, () => 2),
    );
    expect(results.filter(result => result.session === empty).map(r => r.count)).toEqual(
      Array.from({ length: 20 }, () => 0),
    );
  });

  it('copies a session with "from" and keeps the copy after the source is deleted', async () => {
    const server = createServer();
    const source = await openSession(server, { scenario: 'empty-list', label: 'source' });
    const copy = await openSession(server, { from: source });

    expect((await call(server, `/__mogu/sessions/${source}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await call(server, '/v1/products', { session: source })).status).toBe(404);

    const response = await call(server, '/v1/products', { session: copy });
    expect(await response.json()).toEqual({ items: [] });

    const detail: { scenario: string; configs: Record<string, unknown> } = await (
      await call(server, `/__mogu/sessions/${copy}`)
    ).json();
    expect(detail.scenario).toBe('empty-list');
    expect(Object.keys(detail.configs)).toEqual([getHandlerKey(products)]);
  });

  it('lays "configs" over the scenario', async () => {
    const server = createServer();
    const session = await openSession(server, {
      scenario: 'basic',
      configs: { [getHandlerKey(products)]: manual('error') },
    });

    const response = await call(server, '/v1/products', { session });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 'INTERNAL' });
  });

  it('starts with every handler off when neither "scenario" nor "from" is given', async () => {
    const server = createServer();
    const session = await openSession(server, {});

    const response = await call(server, '/v1/products', { session });
    expect(response.status).toBe(501);
  });

  it('validates the session body', async () => {
    const server = createServer();
    const source = await openSession(server);
    const post = (body: Record<string, unknown>) =>
      call(server, '/__mogu/sessions', { method: 'POST', body });

    const both = await post({ scenario: 'basic', from: source });
    expect(both.status).toBe(400);

    const unknownScenario = await post({ scenario: 'missing' });
    expect(unknownScenario.status).toBe(404);
    expect(await unknownScenario.json()).toMatchObject({ error: 'unknown_scenario' });

    const unknownSource = await post({ from: 'missing' });
    expect(unknownSource.status).toBe(404);
    expect(await unknownSource.json()).toMatchObject({ error: 'unknown_session' });

    const unknownKey = await post({ configs: { 'get.https://api.example.com/v1/product': {} } });
    expect(unknownKey.status).toBe(404);
    expect(await unknownKey.json()).toMatchObject({
      error: 'unknown_handler',
      nearest: expect.arrayContaining([products.name]),
    });

    const badConfig = await post({ configs: { [getHandlerKey(products)]: { active: 'yes' } } });
    expect(badConfig.status).toBe(400);

    const unknownField = await post({ scenarioId: 'basic' });
    expect(unknownField.status).toBe(400);
  });
});

describe('standalone — responses', () => {
  it('answers with the picked variant and names it in the headers', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, '/v1/products', { session });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: ['a', 'b'] });
    expect(response.headers.get('x-mogu-handler')).toBe('products-list');
    expect(response.headers.get('x-mogu-variant')).toBe('ok');
    expect(response.headers.get('x-mogu-source')).toBe('scenario');
  });

  it('passes path params and the query to an Auto handler', async () => {
    const server = createMockServer({
      mocks: handlers,
      scenarios: [
        scenarioOf('auto', [
          [products, auto()],
          [productDetail, auto()],
        ]),
      ],
    });
    const session = await openSession(server, { scenario: 'auto' });

    const detail = await call(server, '/v1/products/agent-7', { session });
    expect(await detail.json()).toEqual({ slug: 'agent-7' });
    expect(detail.headers.get('x-mogu-variant')).toBe('auto');

    const list = await call(server, '/v1/products?q=hello', { session });
    expect(await list.json()).toEqual({ q: 'hello' });
  });

  it('tells a literal colon path from a path parameter', async () => {
    const server = createServer();
    const session = await openSession(server);

    const compare = await call(server, '/v1/products:compare', { session });
    expect(await compare.json()).toEqual({ compared: true });

    const detail = await call(server, '/v1/products/compare', { session });
    expect(await detail.json()).toEqual({ slug: 'compare' });
  });

  it('prefers rawBody and keeps the variant headers', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, '/v1/terms', { session });

    expect(await response.text()).toBe('plain terms');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('x-terms-version')).toBe('3');
  });

  it('waits for the configured delay', async () => {
    const server = createServer();
    const session = await openSession(server, {
      configs: { [getHandlerKey(products)]: manual('ok', 60) },
    });

    const startedAt = performance.now();
    await call(server, '/v1/products', { session });

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(50);
  });

  it('accepts a request body on a mocked POST', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, '/v1/runs', {
      method: 'POST',
      session,
      body: { product: 'agent-7' },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'run-1' });
  });

  it('counts the requests of a session', async () => {
    const server = createServer();
    const session = await openSession(server);

    await call(server, '/v1/products', { session });
    await call(server, '/v1/unknown', { session });

    const detail: { requests: number } = await (
      await call(server, `/__mogu/sessions/${session}`)
    ).json();
    expect(detail.requests).toBe(2);
  });
});

describe('standalone — unmocked requests', () => {
  it('answers 501 with the nearest handlers when no handler matches', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, '/v1/product', { session });

    expect(response.status).toBe(501);
    expect(response.headers.get('x-mogu-source')).toBe('unhandled');
    const body: { nearest: string[] } = await response.json();
    expect(body).toMatchObject({
      error: 'not_mocked',
      method: 'GET',
      path: '/v1/product',
      reason: 'no_handler',
    });
    expect(body.nearest.length).toBeGreaterThan(0);
    expect(body.nearest.length).toBeLessThanOrEqual(3);
  });

  it('ranks the handler with the longest shared path first', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, '/v1/runs/trial-usage/extra', { session });

    const body: { nearest: string[] } = await response.json();
    expect(body.nearest[0]).toBe('Trial usage — GET /v1/runs/trial-usage');
  });

  it('answers 501 when the matched handler is off', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'empty-list' });

    const response = await call(server, '/v1/products/agent-7', { session });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({
      reason: 'inactive',
      nearest: [productDetail.name],
    });
  });

  it('answers 501 when the picked variant does not exist', async () => {
    const server = createServer();
    const session = await openSession(server, {
      configs: { [getHandlerKey(products)]: manual('gone') },
    });

    const response = await call(server, '/v1/products', { session });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ reason: 'variant_missing' });
  });

  it('answers 501 for a Swagger config', async () => {
    const server = createServer();
    const session = await openSession(server, {
      configs: {
        [getHandlerKey(products)]: { active: true, type: HandlerType.SWAGGER, variant: '200' },
      },
    });

    const response = await call(server, '/v1/products', { session });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ reason: 'swagger_unsupported' });
  });

  it('turns an error thrown by a response function into a 500', async () => {
    const broken: HandlerConfigOption = {
      name: 'Broken',
      url: `${BASE}/v1/broken`,
      method: 'get',
      responseVariantsFn: () => {
        throw new Error('boom');
      },
    };
    const server = createMockServer({
      mocks: [broken],
      scenarios: [scenarioOf('broken', [[broken, auto()]])],
    });
    const session = await openSession(server, { scenario: 'broken' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await call(server, '/v1/broken', { session });
    errorSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'handler_error', message: 'boom' });
  });
});

describe('standalone — handler url bases', () => {
  const variants = [{ name: 'ok', status: 200, body: { ok: true } }];
  const pick = (handler: HandlerConfigOption) => scenarioOf('s', [[handler, manual('ok')]]);

  it('matches a wildcard-origin handler', async () => {
    const handler: HandlerConfigOption = {
      name: 'wild',
      url: '*/v1/wild/:id',
      method: 'get',
      responseVariants: variants,
    };
    const server = createMockServer({ mocks: [handler], scenarios: [pick(handler)] });
    const session = await openSession(server, { scenario: 's' });

    expect((await call(server, '/v1/wild/1', { session })).status).toBe(200);
  });

  it('matches a path-only handler', async () => {
    const handler: HandlerConfigOption = {
      name: 'relative',
      url: '/v1/relative',
      method: 'get',
      responseVariants: variants,
    };
    const server = createMockServer({ mocks: [handler], scenarios: [pick(handler)] });
    const session = await openSession(server, { scenario: 's' });

    expect((await call(server, '/v1/relative', { session })).status).toBe(200);
  });

  it('strips a base path given as baseUrl', async () => {
    const handler: HandlerConfigOption = {
      name: 'prefixed',
      url: `${BASE}/api/v1/prefixed`,
      method: 'get',
      responseVariants: variants,
    };
    const server = createMockServer({
      mocks: [handler],
      scenarios: [pick(handler)],
      baseUrl: `${BASE}/api`,
    });
    const session = await openSession(server, { scenario: 's' });

    expect((await call(server, '/v1/prefixed', { session })).status).toBe(200);
    expect((await call(server, '/api/v1/prefixed', { session })).status).toBe(501);
  });

  it('matches every method for an "all" handler and only its own method otherwise', async () => {
    const any: HandlerConfigOption = {
      name: 'any',
      url: `${BASE}/v1/any`,
      method: 'all',
      responseVariants: variants,
    };
    const server = createMockServer({
      mocks: [any, ...handlers],
      scenarios: [pick(any)],
    });
    const session = await openSession(server, { scenario: 's' });

    expect((await call(server, '/v1/any', { session, method: 'PUT' })).status).toBe(200);
    expect((await call(server, '/v1/any', { session, method: 'DELETE' })).status).toBe(200);

    const wrongMethod = await call(server, '/v1/products', { session, method: 'DELETE' });
    expect(await wrongMethod.json()).toMatchObject({ reason: 'no_handler' });
  });
});

describe('standalone — control API', () => {
  it('reports health, handlers and scenarios', async () => {
    const server = createServer();
    await openSession(server);

    expect(await (await call(server, '/__mogu/health')).json()).toEqual({
      ok: true,
      handlers: handlers.length,
      scenarios: scenarios.length,
      sessions: 1,
    });

    const listed: Record<string, unknown>[] = await (await call(server, '/__mogu/handlers')).json();
    expect(listed[0]).toEqual({
      name: products.name,
      description: 'products-list',
      method: 'GET',
      path: '/v1/products',
      key: getHandlerKey(products),
      variants: ['ok', 'empty', 'error'],
      auto: true,
    });

    expect(await (await call(server, '/__mogu/scenarios')).json()).toEqual([
      { id: 'basic', name: 'basic', description: null },
      { id: 'empty-list', name: 'empty-list', description: null },
    ]);
  });

  it('returns how to attach to a new session', async () => {
    const server = createServer();

    const response = await call(server, '/__mogu/sessions', {
      method: 'POST',
      body: { scenario: 'basic', label: 'capture-1' },
    });
    const created: { id: string } = await response.json();

    expect(response.status).toBe(201);
    expect(created.id).toMatch(/^[0-9a-f]{12}$/);
    expect(created).toEqual({
      id: created.id,
      label: 'capture-1',
      scenario: 'basic',
      header: { name: 'x-mogu-session', value: created.id },
      cookie: { name: 'mogu_session', value: created.id },
      urlPrefix: `/s/${created.id}`,
    });
  });

  it('answers 404 for an unknown control path and 405 for a wrong method', async () => {
    const server = createServer();

    expect((await call(server, '/__mogu/nope')).status).toBe(404);
    expect((await call(server, '/__mogu/handlers', { method: 'POST', body: {} })).status).toBe(405);
  });
});

describe('standalone — CORS', () => {
  it('allows the calling origin on every response', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, '/v1/products', {
      session,
      headers: { origin: 'http://127.0.0.1:3100' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3100');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('access-control-expose-headers')).toBe('*');
    expect(response.headers.get('vary')).toContain('Origin');
  });

  it('answers a preflight without touching the session', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await server.handle(
      new Request(`${MOCK_ORIGIN}/v1/runs`, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://127.0.0.1:3100',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,x-mogu-session',
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3100');
    expect(response.headers.get('access-control-allow-methods')).toBe('POST');
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'content-type,x-mogu-session',
    );
    expect(response.headers.get('access-control-max-age')).toBe('600');

    const detail: { requests: number } = await (
      await call(server, `/__mogu/sessions/${session}`)
    ).json();
    expect(detail.requests).toBe(0);
  });
});
