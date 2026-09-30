import { HTTPBIN_ENDPOINTS } from '@/mocks/constants/endpoints';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * The handler the opening section drives.
 *
 * Both sit on a real, reachable API, which is the whole point: switching them
 * off does not produce an error, it produces the genuine response. A visitor
 * can therefore see the same URL answered by the internet and by their own
 * fixture without ever meeting a failure state.
 *
 * `firstRunHandlerKeys` is exported because it must start **off** — the first
 * thing the page shows should be the real network, so that turning the mock on
 * is the moment something changes.
 *
 * A second hand-written handler for `/status/429` used to sit here. The httpbin
 * document generates one for `/status/{codes}` with five variants named after
 * the status classes, which covers the same ground without two handlers
 * competing for the same request.
 */
export const firstRunHandlers: HandlerConfigOption[] = [
  {
    name: 'Echo (real API)',
    description: 'Starts OFF so the first request you send is a genuine one.',
    url: HTTPBIN_ENDPOINTS.ECHO,
    method: 'get',
    responseVariants: [
      {
        name: 'Mocked echo',
        status: 200,
        body: {
          args: { mocked: 'true' },
          headers: { Host: 'httpbin.org', 'User-Agent': 'whatever-you-want/1.0' },
          origin: '203.0.113.7',
          url: 'https://httpbin.org/get',
          note: 'This did not leave your browser. The IP is made up.',
        },
      },
      {
        name: 'Empty result',
        status: 200,
        body: { args: {}, headers: {}, origin: null, url: 'https://httpbin.org/get' },
      },
    ],
  },
];

export const firstRunHandlerKeys = firstRunHandlers.map(
  handler => `${handler.method}.${handler.url}`,
);
