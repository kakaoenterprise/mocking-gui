import { setupServer } from 'msw/node';
import { MockingServerConfig as MockingServerConfig } from '@mocking-gui-types/config';

import { reconstructHandlerConfigsFromCookie } from './state';
import { isDomRuntime, isNodeRuntime } from '../common/runtime';
import { convertToMswHandler } from '../handler/convertToMsw';
import { loadSwaggerHandlers } from '../swagger/load';
import { mergeHandlersWithSwagger } from '../swagger/merge';

import type { StoredHandlerVariants } from '@mocking-gui-types/handler';
import type { SetupServer } from 'msw/node';

const getGlobal = () =>
  globalThis as unknown as {
    __MOCKING_GUI_SSR_SERVER__?: SetupServer;
  };

export const createMockingServer = async (
  config: MockingServerConfig = {},
): Promise<SetupServer | null> => {
  const { mocks = [], swagger = [], cookie } = config;

  const swaggerHandlers = (await Promise.all(swagger.map(loadSwaggerHandlersSafe))).flat();
  const finalHandlers = mergeHandlersWithSwagger([...mocks], swaggerHandlers);

  const finalConfigs: Record<string, StoredHandlerVariants> = cookie
    ? reconstructHandlerConfigsFromCookie(cookie, {})
    : {};

  const mswHandlers = convertToMswHandler(finalHandlers, finalConfigs);
  // Avoid patching fetch when there is nothing to mock
  if (!mswHandlers?.length) return null;

  const global = getGlobal();
  const serverInstance = global.__MOCKING_GUI_SSR_SERVER__;

  if (serverInstance) {
    serverInstance.resetHandlers(...mswHandlers);
    return serverInstance;
  } else {
    const server = setupServer(...mswHandlers);
    global.__MOCKING_GUI_SSR_SERVER__ = server;
    return server;
  }
};

const loadSwaggerHandlersSafe = async (source: { configUrl: string; serverUrl?: string }) => {
  try {
    return await loadSwaggerHandlers(source.configUrl, source.serverUrl);
  } catch {
    console.warn(`[MockingGUI Server] Failed to load swagger from ${source.configUrl}`);
    return [];
  }
};

export default async function setupMockingServer(
  config: MockingServerConfig = {},
): Promise<SetupServer | null> {
  if (isDomRuntime() && !isNodeRuntime()) {
    console.warn(
      '[MockingGUI Server] setupMockingServer was skipped: a browser (DOM) runtime without Node.js was detected. If this is a server-side or Node-based test environment (jsdom/happy-dom), please report it to the project issue tracker.',
    );
    return null;
  }
  return createMockingServer(config);
}
