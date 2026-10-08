import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import setupMockingServer from './setup';
import { getHandlerKey, hashHandlerKey } from '../common/keys';

import type { HandlerConfigOption } from '../../types/config';
import type { SetupServer } from 'msw/node';

/**
 * Server runtime guard tests (plain node environment, no DOM)
 * Validates: a DOM-less Node runtime always creates the server and never warns
 */

const getGlobal = () =>
  globalThis as unknown as {
    __MOCKING_GUI_SSR_SERVER__?: SetupServer;
  };

const manualHandler: HandlerConfigOption = {
  name: 'Get Users',
  url: 'https://api.example.com/users',
  method: 'get',
  responseVariants: [{ name: '200-default', status: 200, body: { users: [] } }],
};

describe('setupMockingServer runtime guard (node)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    const global = getGlobal();
    global.__MOCKING_GUI_SSR_SERVER__?.close();
    delete global.__MOCKING_GUI_SSR_SERVER__;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create a server without warning when no DOM is present', async () => {
    const server = await setupMockingServer({ mocks: [manualHandler] });

    expect(server).not.toBeNull();
    expect(typeof server?.listen).toBe('function');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should reuse the cached server instance on a second call', async () => {
    const first = await setupMockingServer({ mocks: [manualHandler] });
    const second = await setupMockingServer({ mocks: [manualHandler] });

    expect(second).toBe(first);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('setupMockingServer cookie synchronization (issue #45)', () => {
  const usersHandler: HandlerConfigOption = {
    name: 'Get Users',
    url: 'https://api.example.com/users',
    method: 'get',
    responseVariants: [
      { name: '200-default', status: 200, body: { users: [] } },
      { name: '500-error', status: 500, body: { message: 'boom' } },
    ],
  };
  const hash = hashHandlerKey(getHandlerKey(usersHandler));

  afterEach(() => {
    const global = getGlobal();
    global.__MOCKING_GUI_SSR_SERVER__?.close();
    delete global.__MOCKING_GUI_SSR_SERVER__;
    vi.restoreAllMocks();
  });

  const fetchUsers = async (cookie: string) => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const server = await setupMockingServer({ mocks: [usersHandler], cookie });
    server?.listen({ onUnhandledRequest: 'bypass' });
    try {
      return await fetch('https://api.example.com/users');
    } finally {
      server?.close();
    }
  };

  it('applies the variant referenced by a v2 cookie', async () => {
    const response = await fetchUsers(`mocking_gui_sync=v2~${hash}..500-error`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: 'boom' });
  });

  it('applies the default variant for a hash-only v2 entry', async () => {
    const response = await fetchUsers(`mocking_gui_sync=v2~${hash}`);

    expect(response.status).toBe(200);
  });

  it('applies a v2 cookie re-serialized by a framework cookie API (Next.js cookies().toString())', async () => {
    // Next's RequestCookies.toString() emits `${name}=${encodeURIComponent(value)}`
    const value = `v2~${hash}..500-error`;
    const response = await fetchUsers(`mocking_gui_sync=${encodeURIComponent(value)}`);

    expect(response.status).toBe(500);
  });

  it('still applies a legacy cookie written by an older version', async () => {
    const legacy = encodeURIComponent(
      JSON.stringify([[getHandlerKey(usersHandler), 'M', '500-error']]),
    );

    const response = await fetchUsers(`mocking_gui_sync=${legacy}`);

    expect(response.status).toBe(500);
  });
});
