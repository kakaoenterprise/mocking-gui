// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { auto, BASE, call, openSession, scenarioOf } from './testkit.test.util';
import { createMockServer } from '../../server';

import type { LogEntry, StandaloneHandler } from '../../types';

/** Reads the request body, so the answer exists only after an await. */
const createRelease: StandaloneHandler = {
  name: 'Create release — POST /v1/releases',
  description: 'releases-create',
  url: `${BASE}/v1/releases`,
  method: 'post',
  responseVariantsFn: async ({ request }) => {
    const body: { version?: string } = await request.json();
    return body.version
      ? { name: 'created', status: 201, body: { version: body.version } }
      : { name: 'invalid', status: 422, body: { code: 'VERSION_REQUIRED' } };
  },
};

const withHeaders: StandaloneHandler = {
  name: 'Export — GET /v1/export/{id}',
  description: 'export-get',
  url: `${BASE}/v1/export/:id`,
  method: 'get',
  responseVariantsFn: ({ params, cookies }) => ({
    name: 'file',
    status: 200,
    headers: { 'content-disposition': `attachment; filename="${String(params.id)}.csv"` },
    rawBody: { kind: 'text', value: `id,locale\n${String(params.id)},${cookies?.locale ?? '-'}` },
  }),
};

const echo: StandaloneHandler = {
  name: 'Echo — PUT /v1/echo/{id}',
  description: 'echo-put',
  url: `${BASE}/v1/echo/:id`,
  method: 'put',
  responseVariantsFn: () => ({ name: 'unused', status: 500, body: { from: 'responseVariantsFn' } }),
  respond: async (request, { params }) =>
    Response.json(
      { id: params.id, method: request.method, url: request.url, body: await request.json() },
      { status: 202, headers: { 'x-echo': 'yes' } },
    ),
};

const encoder = new TextEncoder();

const sse: StandaloneHandler = {
  name: 'Recommend stream — POST /v1/recommend',
  description: 'recommend-stream',
  url: `${BASE}/v1/recommend`,
  method: 'post',
  respond: () => {
    const chunks = ['data: one\n\n', 'data: two\n\n', 'data: [DONE]\n\n'];
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of chunks) {
          await new Promise(resolve => setTimeout(resolve, 40));
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
  },
};

const notAResponse: StandaloneHandler = {
  name: 'Wrong — GET /v1/wrong',
  description: 'wrong-get',
  url: `${BASE}/v1/wrong`,
  method: 'get',
  respond: () => ({ status: 200 }) as unknown as Response,
};

const mocks = [createRelease, withHeaders, echo, sse, notAResponse];
const allAuto = scenarioOf(
  'auto',
  mocks.map(handler => [handler, auto()] as const),
);

const createServer = () => createMockServer({ mocks, scenarios: [allAuto] });

describe('standalone — response functions', () => {
  it('waits for an async responseVariantsFn that reads the request body', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'auto' });

    const created = await call(server, '/v1/releases', {
      session,
      method: 'POST',
      body: { version: '1.2.0' },
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ version: '1.2.0' });

    const invalid = await call(server, '/v1/releases', { session, method: 'POST', body: {} });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toEqual({ code: 'VERSION_REQUIRED' });
  });

  it('passes params and cookies and keeps the headers and rawBody of the result', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'auto' });

    const response = await call(server, '/v1/export/42', {
      session,
      headers: { cookie: 'locale=ko; theme=dark' },
    });

    expect(response.headers.get('content-disposition')).toBe('attachment; filename="42.csv"');
    expect(await response.text()).toBe('id,locale\n42,ko');
    expect(response.headers.get('x-mogu-variant')).toBe('auto');
  });

  it('prefers respond and hands it the web Request', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'auto' });

    const response = await call(server, '/v1/echo/7?dry=1', {
      session,
      method: 'PUT',
      body: { name: 'agent' },
    });

    expect(response.status).toBe(202);
    expect(response.headers.get('x-echo')).toBe('yes');
    expect(response.headers.get('x-mogu-handler')).toBe('echo-put');
    expect(await response.json()).toEqual({
      id: '7',
      method: 'PUT',
      url: `${BASE}/v1/echo/7?dry=1`,
      body: { name: 'agent' },
    });
  });

  it('delays a respond answer', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'auto' });
    await call(server, `/__mogu/sessions/${session}/picks`, {
      method: 'POST',
      body: { handler: 'echo-put', delay: 60 },
    });

    const startedAt = performance.now();
    await call(server, '/v1/echo/7', { session, method: 'PUT', body: {} });

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(50);
  });

  it('lists a respond-only handler as auto and lets a pick switch to it', async () => {
    const server = createServer();
    const session = await openSession(server, {});

    const listed: { description: string; auto: boolean }[] = await (
      await call(server, '/__mogu/handlers')
    ).json();
    expect(listed.find(handler => handler.description === 'recommend-stream')?.auto).toBe(true);

    const picked = await call(server, `/__mogu/sessions/${session}/picks`, {
      method: 'POST',
      body: { handler: 'echo-put', auto: true },
    });
    expect(picked.status).toBe(201);
    expect((await call(server, '/v1/echo/1', { session, method: 'PUT', body: {} })).status).toBe(
      202,
    );
  });

  it('answers 500 when respond returns something that is not a Response', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'auto' });

    const response = await call(server, '/v1/wrong', { session });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'handler_error' });

    const log: { entries: LogEntry[] } = await (
      await call(server, `/__mogu/sessions/${session}/log`)
    ).json();
    expect(log.entries[0]).toMatchObject({ operation: 'wrong-get', variant: 'auto', status: 500 });
  });
});

describe('standalone — streaming', () => {
  it('passes a stream body through handle() chunk by chunk', async () => {
    const server = createServer();
    const session = await openSession(server, { scenario: 'auto' });

    const response = await call(server, '/v1/recommend', { session, method: 'POST', body: {} });
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    for (;;) {
      const result = await reader?.read();
      if (!result || result.done) break;
      chunks.push(decoder.decode(result.value));
    }

    expect(chunks).toEqual(['data: one\n\n', 'data: two\n\n', 'data: [DONE]\n\n']);
  });

  it('sends each chunk over the socket as it is produced', async () => {
    const server = createServer();
    const { url } = await server.listen();

    try {
      const created: { id: string } = await (
        await fetch(`${url}/__mogu/sessions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenario: 'auto' }),
        })
      ).json();

      const startedAt = performance.now();
      const response = await fetch(`${url}/v1/recommend`, {
        method: 'POST',
        headers: { 'x-mogu-session': created.id, 'content-type': 'application/json' },
        body: '{}',
      });
      const headersAt = performance.now() - startedAt;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const arrivals: number[] = [];
      let text = '';
      for (;;) {
        const result = await reader?.read();
        if (!result || result.done) break;
        arrivals.push(performance.now() - startedAt);
        text += decoder.decode(result.value);
      }

      expect(text).toBe('data: one\n\ndata: two\n\ndata: [DONE]\n\n');
      // Three chunks 40 ms apart: the headers and the first chunk must arrive
      // well before the last one, or the body was buffered.
      expect(arrivals.length).toBeGreaterThanOrEqual(2);
      expect(headersAt).toBeLessThan(arrivals[arrivals.length - 1] - 30);
      expect(arrivals[arrivals.length - 1] - arrivals[0]).toBeGreaterThanOrEqual(50);
    } finally {
      await server.close();
    }
  });
});
