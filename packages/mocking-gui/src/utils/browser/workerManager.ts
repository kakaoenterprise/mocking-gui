import { setupWorker } from 'msw/browser';

import type { SetupWorker } from 'msw/browser';

type WorkerStartOptions = Parameters<SetupWorker['start']>[0];

// Module-level state (Singleton behavior by javascript module nature)
let worker: SetupWorker | null = null;
let startPromise: Promise<void> | null = null;
let isHandlerStarted = false;
let lastStartOptions: WorkerStartOptions | undefined;

const getWorker = (): SetupWorker => {
  if (!worker) {
    worker = setupWorker();
  }
  return worker;
};

const start = async (options: WorkerStartOptions): Promise<void> => {
  // Return existing Promise if already starting or started
  if (startPromise) {
    return startPromise;
  }

  const currentWorker = getWorker();
  lastStartOptions = options;
  console.log('[MockingGUI] Starting MSW Worker...');

  startPromise = currentWorker.start(options).then(() => {
    isHandlerStarted = true;
    console.log('[MockingGUI] MSW Worker started successfully');
  });

  return startPromise;
};

const stop = (): void => {
  if (isHandlerStarted && worker) {
    worker.stop();
    isHandlerStarted = false;
    startPromise = null;
  }
};

/**
 * Re-sends the MOCK_ACTIVATE handshake on the existing worker.
 * The browser can idle-terminate the Service Worker (e.g. while its tab is
 * backgrounded), which wipes its in-memory active-client registry even
 * though this page's worker/registration is still alive. A plain reload
 * recovers because `start()` runs the handshake again; this lets a
 * visibility-change callback trigger the same recovery without reloading.
 */
const reactivate = (): void => {
  if (!worker || !isHandlerStarted) return;

  worker.start(lastStartOptions).catch(err => {
    console.error('[MockingGUI] Failed to reactivate MSW worker:', err);
  });
};

const MockingGUIWorkerManager = {
  get isStarted() {
    return isHandlerStarted;
  },
  getWorker,
  start,
  stop,
  reactivate,
};

export default MockingGUIWorkerManager;
