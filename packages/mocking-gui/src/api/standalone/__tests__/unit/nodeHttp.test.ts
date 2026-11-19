// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';

import {
  BASE,
  handlers,
  manual,
  openSession as openSessionOn,
  scenarioOf,
  scenarios,
} from './testkit.test.util';
import { createMockServer } from '../../server';

import type { HandlerConfigOption } from '../../../../types/config';
import type { MockServer } from '../../types';

/**
 * Real-socket tests for the `node:http` bridge. Everything else is covered
 * through `handle()`; this file only checks what the bridge itself does.
 */

const open: MockServer[] = [];

const start = async (server: MockServer): Promise<string> => {
  open.push(server);
  const { url } = await server.listen();
  return url;
};

const openSession = async (url: string, body: Record<string, unknown>): Promise<string> => {
  const response = await fetch(`${url}/__mogu/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const created: { id: string } = await response.json();
  return created.id;
};

afterEach(async () => {
  await Promise.all(open.splice(0).map(server => server.close()));
});

describe('standalone — node http bridge', () => {
  it('listens on a free port and serves mock and control requests', async () => {
    const url = await start(createMockServer({ mocks: handlers, scenarios }));
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const session = await openSession(url, { scenario: 'basic' });

    const list = await fetch(`${url}/v1/products`, { headers: { 'x-mogu-session': session } });
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ items: ['a', 'b'] });

    const run = await fetch(`${url}/v1/runs`, {
      method: 'POST',
      headers: { 'x-mogu-session': session, 'content-type': 'application/json' },
      body: JSON.stringify({ product: 'agent-7' }),
    });
    expect(run.status).toBe(201);
    expect(await run.json()).toEqual({ id: 'run-1' });
  });

  it('keeps sessions apart over real connections', async () => {
    const url = await start(createMockServer({ mocks: handlers, scenarios }));
    const basic = await openSession(url, { scenario: 'basic' });
    const empty = await openSession(url, { scenario: 'empty-list' });

    const counts = await Promise.all(
      Array.from({ length: 30 }, async (_, index) => {
        const session = index % 2 === 0 ? basic : empty;
        const response = await fetch(`${url}/v1/products`, {
          headers: { 'x-mogu-session': session },
        });
        const body: { items: string[] } = await response.json();
        return body.items.length === (session === basic ? 2 : 0);
      }),
    );

    expect(counts.every(Boolean)).toBe(true);
  });

  it('sends no body for HEAD and keeps every Set-Cookie header', async () => {
    const cookies: HandlerConfigOption = {
      name: 'cookies',
      url: `${BASE}/v1/cookies`,
      method: 'all',
      responseVariants: [
        {
          name: 'ok',
          status: 200,
          headers: [
            ['set-cookie', 'a=1; Path=/'],
            ['set-cookie', 'b=2; Path=/'],
          ],
          body: { ok: true },
        },
      ],
    };
    const url = await start(
      createMockServer({
        mocks: [cookies],
        scenarios: [scenarioOf('cookies', [[cookies, manual('ok')]])],
        defaultScenario: 'cookies',
      }),
    );

    const response = await fetch(`${url}/v1/cookies`);
    expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);

    const head = await fetch(`${url}/v1/cookies`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('drops the connection for a "fail" pick', async () => {
    const url = await start(createMockServer({ mocks: handlers, scenarios }));
    const session = await openSession(url, { scenario: 'basic' });
    await fetch(`${url}/__mogu/sessions/${session}/picks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handler: 'products-list', fail: 'network' }),
    });

    await expect(
      fetch(`${url}/v1/products`, { headers: { 'x-mogu-session': session } }),
    ).rejects.toThrow();

    // The server keeps serving after dropping one connection.
    const next = await fetch(`${url}/v1/terms`, { headers: { 'x-mogu-session': session } });
    expect(await next.text()).toBe('plain terms');
  });

  it('ends a pending wait when the server closes', async () => {
    const server = createMockServer({ mocks: handlers, scenarios });
    const session = await openSessionOn(server);

    const waiting = server.handle(
      new Request(
        `http://mock.test/__mogu/sessions/${session}/wait?handler=products-list&timeout=5000`,
      ),
    );
    await server.close();

    expect(await (await waiting).json()).toEqual({ ok: false, count: 0 });
  });

  it('refuses to listen twice and can listen again after close', async () => {
    const server = createMockServer({ mocks: handlers, scenarios });
    await start(server);

    await expect(server.listen()).rejects.toThrow(/already listening/);

    await server.close();
    const { url } = await server.listen();
    expect((await fetch(`${url}/__mogu/health`)).status).toBe(200);
  });
});
