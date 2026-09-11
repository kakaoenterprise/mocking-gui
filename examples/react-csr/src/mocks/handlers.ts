import { defineRegistry } from '@kakaocloud/mocking-gui/experimental';

import { BASE_ENDPOINT } from '@/constants/api';

export const handlers = [
  {
    name: 'User API',
    url: `${BASE_ENDPOINT}/user/:username`,
    method: 'get',
    responseVariants: [
      {
        name: 'Success',
        status: 200,
        body: {
          id: '1',
          name: 'Ria Ang',
          role: 'User',
          features: ['Dashboard'],
        },
      },
      {
        name: 'Admin',
        status: 200,
        body: {
          id: '2',
          name: 'Admin User',
          role: 'Admin',
          features: ['Dashboard', 'Settings'],
        },
      },
      {
        name: 'Unauthorized',
        status: 401,
        body: { error: 'Unauthorized' },
      },
    ],
  },
] as const;

/**
 * One declaration for two consumers: `registry.handlers` feeds
 * `MockingConfig.mocks`; `registry.pick(...)` authors scenarios.
 */
export const registry = defineRegistry(handlers);
