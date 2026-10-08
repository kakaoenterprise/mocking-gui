import { PETSTORE_ENDPOINTS } from '@/mocks/constants/endpoints';
import { createPet } from '@/mocks/factories/report';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * A handler pointed at a **real, reachable API**.
 *
 * Every other handler in this demo targets an origin that does not exist, so
 * turning one off just fails. This one is different: switch it off in the panel
 * and the request reaches Swagger's live Petstore sandbox, returning whatever
 * pets strangers have created there today. Switch it back on and you get the
 * three below, every time.
 *
 * That is the whole argument for mocking, visible in one toggle.
 */
export const liveApiHandlers: HandlerConfigOption[] = [
  {
    name: 'Find pets by status (real API)',
    description: 'Toggle this handler off to reach the live Petstore instead of these mocks.',
    url: PETSTORE_ENDPOINTS.FIND_BY_STATUS,
    method: 'get',
    responseVariants: [
      {
        name: 'Three pets',
        status: 200,
        body: [
          createPet(1001, 'Mochi', 'available'),
          createPet(1002, 'Pepper', 'available'),
          createPet(1003, 'Biscuit', 'pending'),
        ],
      },
      {
        name: 'No pets',
        status: 200,
        body: [],
      },
      {
        name: 'Upstream down (502)',
        status: 502,
        body: { code: 502, message: 'Upstream petstore is unreachable.' },
      },
    ],
  },
];
