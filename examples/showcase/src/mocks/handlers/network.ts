import { ENDPOINTS } from '@/mocks/constants/endpoints';
import { createNotification, createStats } from '@/mocks/factories/report';
import { createErrorBody } from '@/mocks/factories/user';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * States that are genuinely hard to reach against a healthy backend: the empty
 * list nobody has, the slow response that only happens in production, the
 * expired session. Set a delay per handler in the panel's control row.
 */
export const networkHandlers: HandlerConfigOption[] = [
  {
    name: 'Dashboard stats',
    description: 'Pair with a delay in the panel to see the loading state hold.',
    url: ENDPOINTS.DASHBOARD_STATS,
    method: 'get',
    responseVariants: [
      { name: 'Healthy', status: 200, body: createStats() },
      { name: 'Traffic spike', status: 200, body: createStats(14) },
      {
        name: 'Partial outage',
        status: 206,
        body: { ...(createStats() as object), degraded: ['p95LatencyMs'] },
      },
      {
        name: 'Gone (410)',
        status: 410,
        body: createErrorBody('METRICS_EXPIRED', 'This metrics window is no longer retained.'),
      },
    ],
  },
  {
    name: 'Notifications',
    description: 'The empty state you can never get a real account into.',
    url: ENDPOINTS.NOTIFICATIONS,
    method: 'get',
    responseVariants: [
      {
        name: 'Unread items',
        status: 200,
        body: { items: [1, 2, 3].map(id => createNotification(id, true)), unreadCount: 3 },
      },
      {
        name: 'All read',
        status: 200,
        body: { items: [1, 2, 3].map(id => createNotification(id, false)), unreadCount: 0 },
      },
      { name: 'Empty', status: 200, body: { items: [], unreadCount: 0 } },
      {
        name: 'Session expired (401)',
        status: 401,
        body: createErrorBody('TOKEN_EXPIRED', 'Your session has expired.'),
      },
    ],
  },
];
