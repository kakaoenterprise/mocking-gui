import { sharedHandlers } from '@shared/mocks';
import { BASE_ENDPOINT } from '@/constants/api';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * Handlers specific to this example. Shared handlers live in `examples/shared/mocks` and
 * are reused as-is; add example-only endpoints here.
 */
const localHandlers: HandlerConfigOption[] = [
  {
    name: 'Get CSR Health',
    description: 'Example-local handler, showing shared and local mocks side by side',
    url: `${BASE_ENDPOINT}/health`,
    method: 'get',
    responseVariants: [
      { name: 'Healthy', status: 200, body: { status: 'ok', renderer: 'csr' } },
      { name: 'Degraded', status: 503, body: { status: 'degraded', renderer: 'csr' } },
    ],
  },
];

export const handlers: HandlerConfigOption[] = [...sharedHandlers, ...localHandlers];
