import { BASE_ENDPOINT } from '@/constants/api';
import { registry } from '@/mocks/handlers';

import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: registry.handlers,
  swagger: [
    {
      name: 'Petstore',
      docsUrl: 'https://petstore3.swagger.io',
      configUrl: `${BASE_ENDPOINT}/openapi.json`,
      serverUrl: BASE_ENDPOINT,
    },
  ],
};
