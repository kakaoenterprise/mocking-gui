import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import setupMockingServer from './setup';

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
