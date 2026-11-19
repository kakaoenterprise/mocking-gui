import type { MockServerAddress } from './types';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

/** Bridge between `node:http` and the fetch-style `handle(request)`. */

/**
 * Gets `node:http` without an import. The mock server ships in an entry that
 * browser bundles load too, and a bundler resolves every import it finds, even
 * one that never runs there.
 */
const loadNodeHttp = (): typeof import('node:http') => {
  const http = globalThis.process?.getBuiltinModule?.('node:http');
  if (!http) {
    throw new Error(
      '[MockingGUI] listen() needs Node.js 22.3 or later. On another runtime, pass handle(request) to its own server.',
    );
  }
  return http;
};

const textEncoder = new TextEncoder();

const readBody = async (incoming: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | null> => {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of incoming as AsyncIterable<unknown>) {
    const bytes =
      chunk instanceof Uint8Array
        ? chunk
        : typeof chunk === 'string'
          ? textEncoder.encode(chunk)
          : null;
    if (!bytes) continue;
    chunks.push(bytes);
    total += bytes.byteLength;
  }

  if (total === 0) return null;

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const toWebRequest = async (
  incoming: IncomingMessage,
  fallbackOrigin: string,
): Promise<Request> => {
  const host = incoming.headers.host;
  const url = new URL(incoming.url ?? '/', host ? `http://${host}` : fallbackOrigin);
  const method = (incoming.method ?? 'GET').toUpperCase();

  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }

  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await readBody(incoming) : null;

  return new Request(url, { method, headers, body });
};

const waitForDrain = (outgoing: ServerResponse): Promise<void> =>
  new Promise(resolve => {
    const done = () => {
      outgoing.off('drain', done);
      outgoing.off('close', done);
      resolve();
    };
    outgoing.once('drain', done);
    outgoing.once('close', done);
  });

/**
 * Writes a web `Response` to the socket. A stream body is written chunk by
 * chunk as it is produced, and a network-error response drops the connection.
 */
const writeWebResponse = async (
  outgoing: ServerResponse,
  response: Response,
  method: string,
): Promise<void> => {
  if (response.type === 'error') {
    outgoing.destroy();
    return;
  }

  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers['set-cookie'] = cookies;

  outgoing.writeHead(response.status, headers);

  if (!response.body || method === 'HEAD') {
    outgoing.end();
    return;
  }

  outgoing.flushHeaders();
  const reader = response.body.getReader();
  const cancel = () => void reader.cancel().catch(() => undefined);
  outgoing.once('close', cancel);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || outgoing.destroyed) break;
      if (!outgoing.write(value)) await waitForDrain(outgoing);
    }
  } finally {
    outgoing.off('close', cancel);
    outgoing.end();
  }
};

export interface NodeServerHandle {
  address: MockServerAddress;
  close(): Promise<void>;
}

export const listenNodeServer = async (
  handle: (request: Request) => Promise<Response>,
  port: number,
  host: string,
): Promise<NodeServerHandle> => {
  const { createServer } = loadNodeHttp();
  let origin = `http://${host}:${port}`;

  const server: Server = createServer((incoming, outgoing) => {
    const method = (incoming.method ?? 'GET').toUpperCase();

    toWebRequest(incoming, origin)
      .then(handle)
      .then(response => writeWebResponse(outgoing, response, method))
      .catch((error: unknown) => {
        if (outgoing.headersSent) {
          outgoing.destroy();
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        outgoing.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        outgoing.end(JSON.stringify({ error: 'internal_error', message }));
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const bound = server.address();
  const boundPort = typeof bound === 'object' && bound ? bound.port : port;
  origin = `http://${host.includes(':') ? `[${host}]` : host}:${boundPort}`;

  return {
    address: { url: origin, port: boundPort },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};
