import { BASE_ENDPOINT, ENDPOINTS, PETSTORE_ENDPOINTS } from '@/mocks/constants/endpoints';
import { handlers } from '@/mocks/handlers';

import type { StoredHandlerVariants } from '@/mocks/scenarios';

/**
 * A callable stand-in for a handler.
 *
 * Scenarios address handlers by `${method}.${url}`, and that url is a pattern
 * (`/v1/users/:userId`). To actually send the request the page needs a concrete
 * url, a method and, for POSTs, a body — none of which the scenario carries.
 * This registry supplies them, keyed so a scenario entry maps straight onto one.
 */
export type Probe = {
  /** `${method}.${url}` — the same key the library and the scenarios use. */
  key: string;
  group: string;
  title: string;
  method: 'GET' | 'POST';
  /** Shortened for display; the origin is noise on every row. */
  path: string;
  url: string;
  body?: unknown;
};

export const PROBES: Probe[] = [
  {
    key: `get.${ENDPOINTS.USER}`,
    group: 'identity',
    title: 'Get user',
    method: 'GET',
    path: '/v1/users/u_1024',
    url: `${BASE_ENDPOINT}/users/u_1024`,
  },
  {
    key: `post.${ENDPOINTS.CHECKOUT}`,
    group: 'payments',
    title: 'Checkout',
    method: 'POST',
    path: '/v1/checkout',
    url: ENDPOINTS.CHECKOUT,
    body: { cartId: 'cart_9', amount: 42000, currency: 'KRW' },
  },
  {
    key: `get.${ENDPOINTS.NOTIFICATIONS}`,
    group: 'activity',
    title: 'Notifications',
    method: 'GET',
    path: '/v1/notifications',
    url: ENDPOINTS.NOTIFICATIONS,
  },
  {
    key: `get.${ENDPOINTS.DASHBOARD_STATS}`,
    group: 'reporting',
    title: 'Dashboard stats',
    method: 'GET',
    path: '/v1/dashboard/stats',
    url: ENDPOINTS.DASHBOARD_STATS,
  },
  {
    key: `get.${ENDPOINTS.EXPORT_CSV}`,
    group: 'reporting',
    title: 'Export CSV',
    method: 'GET',
    path: '/v1/reports/export.csv',
    url: ENDPOINTS.EXPORT_CSV,
  },
  {
    key: `get.${ENDPOINTS.SEARCH}`,
    group: 'discovery',
    title: 'Search',
    method: 'GET',
    path: '/v1/search?q=m',
    url: `${ENDPOINTS.SEARCH}?q=m&page=1&pageSize=2`,
  },
  {
    key: `get.${PETSTORE_ENDPOINTS.FIND_BY_STATUS}`,
    group: 'discovery',
    title: 'Find pets',
    method: 'GET',
    path: '/pet/findByStatus',
    url: PETSTORE_ENDPOINTS.FIND_BY_STATUS,
  },
];

export const GROUP_ORDER = ['identity', 'payments', 'activity', 'reporting', 'discovery'] as const;

const PROBES_BY_KEY = new Map(PROBES.map(probe => [probe.key, probe]));

export const findProbe = (key: string): Probe | undefined => PROBES_BY_KEY.get(key);

const HANDLERS_BY_KEY = new Map(
  handlers.map(handler => [`${handler.method}.${handler.url}`, handler]),
);

/**
 * What a scenario claims will happen, resolved against the handler definitions
 * MSW actually serves — so the "expected" column is derived from the same source
 * of truth as the response, not typed in by hand.
 */
export type Expectation = {
  kind: 'manual' | 'auto' | 'unknown';
  status?: number;
  variant?: string;
  delayMs?: number;
};

export const resolveExpectation = (key: string, config: StoredHandlerVariants): Expectation => {
  const delayMs = config.delay && config.delay > 0 ? config.delay : undefined;

  if (config.type === 'Auto') return { kind: 'auto', delayMs };

  const handler = HANDLERS_BY_KEY.get(key);
  const variant = config.variant;
  if (!handler || !variant) return { kind: 'unknown', variant, delayMs };

  const match = handler.responseVariants?.find(candidate => candidate.name === variant);
  return match
    ? { kind: 'manual', status: match.status, variant, delayMs }
    : { kind: 'unknown', variant, delayMs };
};
