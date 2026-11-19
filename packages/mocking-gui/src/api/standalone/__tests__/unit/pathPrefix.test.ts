// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { call, handlers, openSession, scenarios } from './testkit.test.util';
import { createMockServer } from '../../server';

import type { LogEntry } from '../../types';

const createServer = () => createMockServer({ mocks: handlers, scenarios });

describe('standalone — session in the url', () => {
  it('reads the session id from a /s/<id> path prefix', async () => {
    const server = createServer();
    const basic = await openSession(server, { scenario: 'basic' });
    const empty = await openSession(server, { scenario: 'empty-list' });

    const results = await Promise.all(
      Array.from({ length: 20 }, async (_, index) => {
        const session = index % 2 === 0 ? basic : empty;
        const response = await call(server, `/s/${session}/v1/products`);
        const body: { items: string[] } = await response.json();
        return body.items.length === (session === basic ? 2 : 0);
      }),
    );

    expect(results.every(Boolean)).toBe(true);
  });

  it('works with the urlPrefix a new session returns', async () => {
    const server = createServer();
    const created: { urlPrefix: string } = await (
      await call(server, '/__mogu/sessions', { method: 'POST', body: { scenario: 'basic' } })
    ).json();

    const response = await call(server, `${created.urlPrefix}/v1/products/agent-7?tab=price`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: 'agent-7' });
  });

  it('keeps the body and the query of a prefixed request', async () => {
    const server = createServer();
    const session = await openSession(server);
    await call(server, `/__mogu/sessions/${session}/picks`, {
      method: 'POST',
      body: { handler: 'products-list', auto: true },
    });

    const list = await call(server, `/s/${session}/v1/products?q=agent`);
    expect(await list.json()).toEqual({ q: 'agent' });

    const run = await call(server, `/s/${session}/v1/runs`, { method: 'POST', body: { a: 1 } });
    expect(run.status).toBe(201);
  });

  it('logs the path without the prefix', async () => {
    const server = createServer();
    const session = await openSession(server);

    await call(server, `/s/${session}/v1/products?q=1`);

    const log: { entries: LogEntry[] } = await (
      await call(server, `/__mogu/sessions/${session}/log`)
    ).json();
    expect(log.entries[0]).toMatchObject({ path: '/v1/products', query: '?q=1' });
  });

  it('answers 404 for an unknown session id in the path', async () => {
    const response = await call(createServer(), '/s/nope/v1/products');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'unknown_session', session: 'nope' });
  });

  it('lets the header win over the path, and the path over the cookie', async () => {
    const server = createServer();
    const basic = await openSession(server, { scenario: 'basic' });
    const empty = await openSession(server, { scenario: 'empty-list' });

    const headerWins = await call(server, `/s/${empty}/v1/products`, { session: basic });
    expect(await headerWins.json()).toEqual({ items: ['a', 'b'] });

    const pathWins = await call(server, `/s/${empty}/v1/products`, {
      headers: { cookie: `mogu_session=${basic}` },
    });
    expect(await pathWins.json()).toEqual({ items: [] });
  });

  it('serves the default session under /s/default', async () => {
    const server = createMockServer({ mocks: handlers, scenarios, defaultScenario: 'empty-list' });

    const response = await call(server, '/s/default/v1/products');

    expect(await response.json()).toEqual({ items: [] });
  });

  it('treats a bare /s/<id> as the root path of that session', async () => {
    const server = createServer();
    const session = await openSession(server);

    const response = await call(server, `/s/${session}`);

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ path: '/', reason: 'no_handler' });
  });

  it('serves an API base url that ends in the session prefix', async () => {
    const server = createServer();
    const { url } = await server.listen();

    try {
      const created: { urlPrefix: string } = await (
        await fetch(`${url}/__mogu/sessions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenario: 'empty-list' }),
        })
      ).json();
      // What an app gets as its API url in a built bundle: no header, no cookie.
      const apiUrl = `${url}${created.urlPrefix}`;

      const response = await fetch(`${apiUrl}/v1/products`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: [] });
    } finally {
      await server.close();
    }
  });
});
