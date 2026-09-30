import { HTTPBIN_ENDPOINTS } from '@/mocks/constants/endpoints';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * The two handlers the opening section drives.
 *
 * Both sit on a real, reachable API, which is the whole point: switching them
 * off does not produce an error, it produces the genuine response. A visitor
 * can therefore see the same URL answered by the internet and by their own
 * fixture without ever meeting a failure state.
 *
 * `firstRunHandlerKeys` is exported because these two must start **off** — the
 * first thing the page shows should be the real network, so that turning the
 * mock on is the moment something changes.
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
  {
    name: 'Rate limited (real API)',
    description: 'The real service returns a genuine 429 here — compare it with the mocked one.',
    url: HTTPBIN_ENDPOINTS.RATE_LIMITED,
    method: 'get',
    responseVariants: [
      {
        name: 'Mocked 429 with headers',
        status: 429,
        headers: { 'Retry-After': '30', 'X-RateLimit-Limit': '100', 'X-RateLimit-Remaining': '0' },
        body: { error: { code: 'RATE_LIMITED', message: 'Slow down. Retry in 30 seconds.' } },
      },
      {
        name: 'Recovered (200)',
        status: 200,
        body: { ok: true, note: 'The same URL, answering as if the limit had cleared.' },
      },
    ],
  },
];

export const firstRunHandlerKeys = firstRunHandlers.map(
  handler => `${handler.method}.${handler.url}`,
);
