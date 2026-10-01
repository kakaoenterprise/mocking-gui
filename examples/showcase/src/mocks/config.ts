import {
  PETSTORE_BASE,
  PETSTORE_DOCS_URL,
  PETSTORE_OPENAPI_URL,
} from '@/mocks/constants/endpoints';
import { handlers } from '@/mocks/handlers';
import { onDemandHandlers } from '@/mocks/onDemand';

import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  scenarios: [
    'eyJpZCI6ImRlbW8tZmlyc3QtcnVuIiwibmFtZSI6IkJyYW5kIG5ldyBhY2NvdW50IiwiZGVzY3JpcHRpb24iOiJOb3RoaW5nIGhhcyBoYXBwZW5lZCBpbiB0aGlzIGFjY291bnQgeWV0LiBFdmVyeSBsaXN0IGlzIGVtcHR5IGF0IHRoZSBzYW1lIHRpbWUsIHdoaWNoIGlzIHRoZSBzdGF0ZSB0aGF0IG5ldmVyIHN1cnZpdmVzIG9uIGEgc2hhcmVkIHN0YWdpbmcgZW52aXJvbm1lbnQuIiwiY3JlYXRlZEF0IjoiMjAyNi0wOS0yMlQwMDowMDowMC4wMDBaIiwiY29uZmlncyI6eyJnZXQuaHR0cHM6Ly9hcGkubW9ja2luZy1ndWkuZGVtby92MS91c2Vycy86dXNlcklkIjp7ImFjdGl2ZSI6dHJ1ZSwidHlwZSI6Ik1hbnVhbCIsInZhcmlhbnQiOiJWaWV3ZXIifSwiZ2V0Lmh0dHBzOi8vYXBpLm1vY2tpbmctZ3VpLmRlbW8vdjEvbm90aWZpY2F0aW9ucyI6eyJhY3RpdmUiOnRydWUsInR5cGUiOiJNYW51YWwiLCJ2YXJpYW50IjoiRW1wdHkifSwiZ2V0Lmh0dHBzOi8vYXBpLm1vY2tpbmctZ3VpLmRlbW8vdjEvcmVwb3J0cy9leHBvcnQuY3N2Ijp7ImFjdGl2ZSI6dHJ1ZSwidHlwZSI6Ik1hbnVhbCIsInZhcmlhbnQiOiJFbXB0eSBleHBvcnQifSwiZ2V0Lmh0dHBzOi8vcGV0c3RvcmUzLnN3YWdnZXIuaW8vYXBpL3YzL3BldC9maW5kQnlTdGF0dXMiOnsiYWN0aXZlIjp0cnVlLCJ0eXBlIjoiTWFudWFsIiwidmFyaWFudCI6Ik5vIHBldHMifX19',
  ],

  /**
   * A live document, not a fixture.
   *
   * Swagger's Petstore spec is fetched from its own server at startup and the
   * handlers it generates point at an API you can actually reach, which is what
   * makes switching one off a comparison rather than a failure. A source that
   * fails to load is isolated — marked with an error in the Swagger tab while
   * everything else carries on.
   */
  swagger: [
    {
      name: 'Petstore (live)',
      configUrl: PETSTORE_OPENAPI_URL,
      serverUrl: PETSTORE_BASE,
      docsUrl: PETSTORE_DOCS_URL,
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
