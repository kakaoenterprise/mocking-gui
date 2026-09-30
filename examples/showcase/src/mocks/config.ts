import {
  HTTPBIN_BASE,
  HTTPBIN_OPENAPI_URL,
  PETSTORE_BASE,
  PETSTORE_DOCS_URL,
  PETSTORE_OPENAPI_URL,
} from '@/mocks/constants/endpoints';
import { handlers } from '@/mocks/handlers';
import { onDemandHandlers } from '@/mocks/onDemand';

import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,

  /**
   * Two live documents, no fixtures.
   *
   * Both are fetched from real servers at startup and both describe APIs you
   * can actually call, which is what makes switching a generated handler off a
   * comparison rather than a failure.
   *
   * They are deliberately unalike. Petstore carries response schemas, so its
   * handlers answer with sampled bodies. httpbin carries none — 73 operations,
   * every response documented only by a description — so its handlers answer
   * with the right status and a null body. That is worth seeing: an import is
   * only ever as good as the document behind it, and `/status/{codes}` shows
   * the useful half of that, arriving with five variants named after the
   * status classes.
   *
   * A failing source is isolated — marked with an error in the Swagger tab
   * while everything else carries on.
   */
  swagger: [
    {
      name: 'Petstore (live)',
      configUrl: PETSTORE_OPENAPI_URL,
      serverUrl: PETSTORE_BASE,
      docsUrl: PETSTORE_DOCS_URL,
    },
    {
      name: 'httpbin (live)',
      configUrl: HTTPBIN_OPENAPI_URL,
      serverUrl: HTTPBIN_BASE,
      docsUrl: HTTPBIN_BASE,
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
