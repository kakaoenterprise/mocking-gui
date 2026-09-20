import { sharedHandlers } from '@shared/mocks';
import { BASE_ENDPOINT } from '@/constants/api';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * Handlers specific to this example. Shared handlers live in `examples/shared/mocks` and
 * are reused as-is; add example-only endpoints here.
 */
const localHandlers: HandlerConfigOption[] = [
  {
    name: 'Get SSR Health',
    description: 'Example-local handler, resolved on both server and client',
    url: `${BASE_ENDPOINT}/health`,
    method: 'get',
    responseVariants: [
      { name: 'Healthy', status: 200, body: { status: 'ok', renderer: 'ssr' } },
      { name: 'Degraded', status: 503, body: { status: 'degraded', renderer: 'ssr' } },
    ],
  },
];

export const handlers: HandlerConfigOption[] = [...sharedHandlers, ...localHandlers];
