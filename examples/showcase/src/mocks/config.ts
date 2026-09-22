import {
  OPENAPI_DOC_URL,
  PETSTORE_BASE,
  PETSTORE_DOCS_URL,
  PETSTORE_OPENAPI_URL,
  SWAGGER_SERVER_URL,
} from '@/mocks/constants/endpoints';
import { handlers } from '@/mocks/handlers';
import { onDemandHandlers } from '@/mocks/onDemand';

import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,

  /**
   * Two sources on purpose.
   *
   * The Petstore document is fetched from a live server at startup — it is a
   * real OpenAPI spec, not a fixture, and the handlers generated from it point
   * at an API you can actually reach.
   *
   * The second is served from this app's own `public/`, so the OpenAPI section
   * of the demo still has something to show if the public sandbox is down. A
   * failing source is isolated: it is marked with an error in the Swagger tab
   * and everything else carries on.
   */
  swagger: [
    {
      name: 'Petstore (live)',
      configUrl: PETSTORE_OPENAPI_URL,
      serverUrl: PETSTORE_BASE,
      docsUrl: PETSTORE_DOCS_URL,
    },
    {
      name: 'Demo API v2 (self-hosted)',
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
