// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import setupMockingServer from './setup';

import type { HandlerConfigOption } from '../../types/config';
import type { SetupServer } from 'msw/node';

/**
 * Server runtime guard tests (jsdom environment)
 * Validates: jsdom is treated as Node (server is created), a real browser skips with a warning
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

const cleanupServer = () => {
  const global = getGlobal();
  global.__MOCKING_GUI_SSR_SERVER__?.close();
  delete global.__MOCKING_GUI_SSR_SERVER__;
};

describe('setupMockingServer runtime guard (jsdom)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupServer();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create a server under jsdom because jsdom runs on Node', async () => {
    const server = await setupMockingServer({ mocks: [manualHandler] });

    expect(server).not.toBeNull();
    expect(typeof server?.listen).toBe('function');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should skip with a single warning when a DOM exists without a Node runtime', async () => {
    vi.stubGlobal('process', undefined);

    const server = await setupMockingServer({ mocks: [manualHandler] });

    expect(server).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('skipped');
  });

  it('should return null without warning when there are no handlers', async () => {
    const server = await setupMockingServer({});

    expect(server).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
