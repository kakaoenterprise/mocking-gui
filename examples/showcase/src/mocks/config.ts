import { OPENAPI_DOC_URL, SWAGGER_SERVER_URL } from '@/mocks/constants/endpoints';
import { handlers } from '@/mocks/handlers';
import { onDemandHandlers } from '@/mocks/onDemand';

import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  swagger: [
    {
      name: 'Demo API v2',
      configUrl: OPENAPI_DOC_URL,
      serverUrl: SWAGGER_SERVER_URL,
    },
  ],
  onDemandHandlers,
  worker: {
    /**
     * The demo is served from a sub-path (`/mocking-gui/demo/`) on GitHub Pages,
     * so the worker script and its scope must both live there. `BASE_URL` is
     * `/` during local development, which keeps both cases on one line.
     */
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: false,
  },
};
