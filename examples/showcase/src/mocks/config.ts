import {
  PETSTORE_BASE,
  PETSTORE_DOCS_URL,
  PETSTORE_OPENAPI_URL,
} from '@/mocks/constants/endpoints';
import { handlers } from '@/mocks/handlers';
import { onDemandHandlers } from '@/mocks/onDemand';
import { SCENARIO_PRESETS, encodeScenario } from '@/mocks/scenarios';

import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  /**
   * Every preset on the page, seeded into the panel at startup.
   *
   * Encoded from `SCENARIO_PRESETS` rather than pasted as literals so the codes
   * cannot drift from the definitions the page itself renders. The library
   * merges them by id and leaves anything already saved alone, so a returning
   * visitor keeps their own edits and whichever scenario they had active.
   */
  scenarios: SCENARIO_PRESETS.map(({ scenario }) => encodeScenario(scenario)),

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
