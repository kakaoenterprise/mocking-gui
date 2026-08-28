import { useEffect, useMemo, useState } from 'react';

import { useHandlerStore } from '@store/useHandlerStore';
import MockingGUIWorkerManager from '@utils/browser/workerManager';
import { convertToMswHandler } from '@utils/handler/convertToMsw';
import { mergeHandlersWithSwagger } from '@utils/swagger/merge';

import useSwaggerHandlerSetup from './useSwaggerHandlerSetup';

import type { HandlerConfigOption, MockingConfig } from '@mocking-gui-types/config';
import type { SetupWorker as Worker } from 'msw/browser';

const useSetupMockingGUIWorker = (config: MockingConfig = {}) => {
  const {
    mocks = [],
    swagger = [],
    worker: workerStartOptions = {},
    onDemandHandlers = [],
  } = config;
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isHandlersReady, setIsHandlersReady] = useState(false);
  const [isMockingReady, setIsMockingReady] = useState(false);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const memoizedMocks = useMemo(() => {
    return (mocks as HandlerConfigOption[]).map(mock => {
      if (!mock.responseVariants) return mock;

      const variantsMap = new Map<string, (typeof mock.responseVariants)[number]>();
      mock.responseVariants.forEach(variant => {
        variantsMap.set(`${variant.status}-${variant.name}`, variant);
      });

      return {
        ...mock,
        responseVariants: Array.from(variantsMap.values()),
      };
    });
  }, [JSON.stringify(mocks)]);

  const memoizedSwaggerSources = useMemo(() => swagger, [JSON.stringify(swagger)]);

  const { swaggerHandlers, isSwaggerReady } = useSwaggerHandlerSetup(memoizedSwaggerSources);

  const setupInitialState = useHandlerStore(state => state.setupInitialState);
  const handlerConfigs = useHandlerStore(state => state.handlerConfigs);
  const storeHandlers = useHandlerStore(state => state.handlers);
  useEffect(() => {
    const setupMockingGUIWorker = async () => {
      try {
        const worker = MockingGUIWorkerManager.getWorker();
        setWorker(worker);

        if (!MockingGUIWorkerManager.isStarted) {
          await MockingGUIWorkerManager.start(workerStartOptions);
        }

        setIsWorkerReady(true);
      } catch (err) {
        console.error('[MockingGUI] Worker setup failed, mocking disabled:', err);
        setError(err as Error);
      }
    };

    (async () => {
      await setupMockingGUIWorker();
    })();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Backgrounded tabs can have their Service Worker idle-terminated by the
      // browser, which silently drops mocking until a reload. Re-run the
      // MOCK_ACTIVATE handshake as soon as the tab is visible again instead.
      if (document.visibilityState === 'visible') {
        MockingGUIWorkerManager.reactivate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isSwaggerReady) return;

    // Initialize with merged Handler State when Swagger handler is ready
    const configuredHandlers = mergeHandlersWithSwagger(memoizedMocks, swaggerHandlers);
    setupInitialState(configuredHandlers);
    setIsHandlersReady(true);
  }, [memoizedMocks, isSwaggerReady, swaggerHandlers, setupInitialState]);

  useEffect(() => {
    if (isWorkerReady && isHandlersReady && worker) {
      try {
        const convertedMswHandlers = convertToMswHandler(storeHandlers, handlerConfigs);
        // Merge mocking-gui handlers with on-demand (e.g. GraphQL) handlers
        worker.resetHandlers(...convertedMswHandlers, ...onDemandHandlers);
        setIsMockingReady(true);
      } catch (error) {
        console.error('[MockingGUI] Failed to reset handlers:', error);
        throw error;
      }
    }
  }, [handlerConfigs, isWorkerReady, worker, storeHandlers, isHandlersReady, onDemandHandlers]);

  return {
    isReady: isMockingReady,
    isWorkerReady,
    isHandlersReady,
    error,
  };
};

export default useSetupMockingGUIWorker;
