import { ENDPOINTS, fillPath, withQuery } from '../mocks';

/**
 * What the playground calls, declared rather than hand-written per card.
 *
 * URLs are built from the very constants the shared handlers are registered with, so a
 * change there cannot leave the playground pointing at a dead path.
 */
export interface ApiProbeConfig {
  id: string;
  group: string;
  title: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  init?: RequestInit;
  /** Fires once on mount. Reserved for safe reads — mutations stay manual. */
  autoFetch?: boolean;
  /**
   * Safe to run during server rendering. Mutations are excluded so an SSR pass never
   * fires a POST or DELETE.
   */
  serverSafe?: boolean;
}

export const API_PROBES: ApiProbeConfig[] = [
  {
    id: 'user-admin',
    group: 'User',
    title: 'Get User — admin',
    description: 'Auto mode resolves an Admin from the :username path param',
    method: 'GET',
    serverSafe: true,
    url: fillPath(ENDPOINTS.user, { username: 'ria-admin' }),
    autoFetch: true,
  },
  {
    id: 'user-missing',
    group: 'User',
    title: 'Get User — unknown username',
    description: 'Same handler, but Auto mode answers 404 for this username',
    method: 'GET',
    serverSafe: true,
    url: fillPath(ENDPOINTS.user, { username: 'nobody' }),
  },
  {
    id: 'user-report',
    group: 'User',
    title: 'Get User Report',
    description: 'Non-JSON body — switch the variant between Text, HTML, XML and CSV',
    method: 'GET',
    serverSafe: true,
    url: fillPath(ENDPOINTS.userReport, { username: 'ria-admin' }),
  },
  {
    id: 'user-avatar',
    group: 'User',
    title: 'Get User Avatar',
    description: 'Binary body (arrayBuffer), plus a 204 variant carrying nothing',
    method: 'GET',
    serverSafe: true,
    url: fillPath(ENDPOINTS.userAvatar, { username: 'ria-admin' }),
  },
  {
    id: 'session-anonymous',
    group: 'Session',
    title: 'Get Session — no credentials',
    description: 'No Authorization header and no cookie, so Auto mode answers 401',
    method: 'GET',
    serverSafe: true,
    url: ENDPOINTS.session,
  },
  {
    id: 'session-expired',
    group: 'Session',
    title: 'Get Session — expired token',
    description: 'Sends `Authorization: Bearer expired`',
    method: 'GET',
    serverSafe: true,
    url: ENDPOINTS.session,
    init: { headers: { authorization: 'Bearer expired' } },
  },
  {
    id: 'session-valid',
    group: 'Session',
    title: 'Get Session — valid token',
    description: 'Sends a usable bearer token and receives the signed-in user',
    method: 'GET',
    serverSafe: true,
    url: ENDPOINTS.session,
    init: { headers: { authorization: 'Bearer ria-token' } },
  },
  {
    id: 'orders-page',
    group: 'Orders',
    title: 'List Orders — page 2',
    description: 'Auto mode paginates from the query string',
    method: 'GET',
    serverSafe: true,
    url: withQuery(ENDPOINTS.orders, { page: 2, perPage: 5 }),
  },
  {
    id: 'order-detail',
    group: 'Orders',
    title: 'Get Order',
    description: 'Single order lookup, with a 404 variant',
    method: 'GET',
    serverSafe: true,
    url: fillPath(ENDPOINTS.order, { orderId: 'order_001' }),
  },
  {
    id: 'order-create',
    group: 'Orders',
    title: 'Create Order',
    description: '201 with a Location header, or 400 / 409 failures',
    method: 'POST',
    url: ENDPOINTS.orders,
    init: {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ sku: 'sku_001', quantity: 2 }] }),
    },
  },
  {
    id: 'order-replace',
    group: 'Orders',
    title: 'Replace Order',
    description: 'Full update via PUT',
    method: 'PUT',
    url: fillPath(ENDPOINTS.order, { orderId: 'order_001' }),
    init: {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paid', total: 120000 }),
    },
  },
  {
    id: 'order-patch',
    group: 'Orders',
    title: 'Update Order Status',
    description: 'Partial update via PATCH',
    method: 'PATCH',
    url: fillPath(ENDPOINTS.order, { orderId: 'order_001' }),
    init: {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    },
  },
  {
    id: 'order-cancel',
    group: 'Orders',
    title: 'Cancel Order',
    description: '204 No Content — a success with no body at all',
    method: 'DELETE',
    url: fillPath(ENDPOINTS.order, { orderId: 'order_001' }),
  },
];
