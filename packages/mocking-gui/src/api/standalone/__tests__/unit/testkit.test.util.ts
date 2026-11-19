import { HandlerType } from '../../../../types/handler';
import { getHandlerKey } from '../../../../utils/common/keys';

import type { HandlerConfigOption } from '../../../../types/config';
import type { Scenario, StoredHandlerVariants } from '../../../../types/handler';
import type { MockServer } from '../../types';

/**
 * Shared fixtures for the standalone tests. The file name carries `.test.` so
 * the build and the published types skip it, but does not end in `.test.ts`, so
 * Vitest does not collect it as a suite.
 */

export const BASE = 'https://api.example.com';

/** Host the tests call. It differs from `BASE` on purpose: the server must not care. */
export const MOCK_ORIGIN = 'http://mock.test';

export const products: HandlerConfigOption = {
  name: 'Product list — GET /v1/products',
  description: 'products-list',
  url: `${BASE}/v1/products`,
  method: 'get',
  responseVariants: [
    { name: 'ok', status: 200, body: { items: ['a', 'b'] } },
    { name: 'empty', status: 200, body: { items: [] } },
    { name: 'error', status: 500, body: { code: 'INTERNAL' } },
  ],
  responseVariantsFn: ({ request }) => ({
    name: 'resolved',
    status: 200,
    body: { q: new URL(request.url).searchParams.get('q') },
  }),
};

export const productDetail: HandlerConfigOption = {
  name: 'Product detail — GET /v1/products/{slug}',
  description: 'products-detail',
  url: `${BASE}/v1/products/:slug`,
  method: 'get',
  responseVariants: [
    { name: 'ok', status: 200, body: { slug: 'fixed' } },
    { name: 'notFound', status: 404, body: { code: 'NOT_FOUND' } },
  ],
  responseVariantsFn: ({ params }) => ({
    name: 'resolved',
    status: 200,
    body: { slug: params.slug },
  }),
};

export const productCompare: HandlerConfigOption = {
  name: 'Product compare — GET /v1/products:compare',
  description: 'products-compare',
  url: `${BASE}/v1/products:compare`,
  method: 'get',
  responseVariants: [{ name: 'ok', status: 200, body: { compared: true } }],
};

export const runsStart: HandlerConfigOption = {
  name: 'Run start — POST /v1/runs',
  description: 'runs-start',
  url: `${BASE}/v1/runs`,
  method: 'post',
  responseVariants: [{ name: 'ok', status: 201, body: { id: 'run-1' } }],
};

export const trialUsage: HandlerConfigOption = {
  name: 'Trial usage — GET /v1/runs/trial-usage',
  description: 'runs-trial_usage',
  url: `${BASE}/v1/runs/trial-usage`,
  method: 'get',
  responseVariants: [
    { name: 'ok', status: 200, body: { used: 1, limit: 3 } },
    { name: 'notStarted', status: 200, body: { used: 0, limit: 3 } },
    { name: 'usedUp', status: 200, body: { used: 3, limit: 3 } },
  ],
};

export const runStatus: HandlerConfigOption = {
  name: 'Run status — GET /v1/runs/{run_id}',
  description: 'runs-status',
  url: `${BASE}/v1/runs/:run_id`,
  method: 'get',
  responseVariants: [
    { name: 'running', status: 200, body: { status: 'running' } },
    { name: 'completed', status: 200, body: { status: 'completed' } },
  ],
};

export const terms: HandlerConfigOption = {
  name: 'Terms — GET /v1/terms',
  description: 'terms-get',
  url: `${BASE}/v1/terms`,
  method: 'get',
  responseVariants: [
    {
      name: 'text',
      status: 200,
      headers: { 'x-terms-version': '3' },
      body: { ignored: true },
      rawBody: { kind: 'text', value: 'plain terms' },
    },
  ],
};

export const handlers: HandlerConfigOption[] = [
  products,
  productCompare,
  productDetail,
  runsStart,
  trialUsage,
  runStatus,
  terms,
];

export const manual = (variant: string, delay = 0): StoredHandlerVariants => ({
  active: true,
  type: HandlerType.MANUAL,
  variant,
  delay,
});

export const auto = (): StoredHandlerVariants => ({
  active: true,
  type: HandlerType.AUTO,
  delay: 0,
});

export const scenarioOf = (
  id: string,
  picks: readonly (readonly [Pick<HandlerConfigOption, 'method' | 'url'>, StoredHandlerVariants])[],
): Scenario => ({
  id,
  name: id,
  configs: Object.fromEntries(picks.map(([handler, config]) => [getHandlerKey(handler), config])),
  createdAt: '2026-11-18T00:00:00.000Z',
});

export const scenarios: Scenario[] = [
  scenarioOf('basic', [
    [products, manual('ok')],
    [productCompare, manual('ok')],
    [productDetail, auto()],
    [runsStart, manual('ok')],
    [trialUsage, manual('ok')],
    [runStatus, manual('running')],
    [terms, manual('text')],
  ]),
  scenarioOf('empty-list', [[products, manual('empty')]]),
];

export interface CallInit {
  method?: string;
  session?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/** Sends one request through `handle()`, without a socket. */
export const call = (server: MockServer, path: string, init: CallInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (init.session) headers.set('x-mogu-session', init.session);
  if (init.body !== undefined) headers.set('content-type', 'application/json');

  return server.handle(
    new Request(`${MOCK_ORIGIN}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
};

/** Creates a session through the control API and returns its id. */
export const openSession = async (
  server: MockServer,
  body: Record<string, unknown> = { scenario: 'basic' },
): Promise<string> => {
  const response = await call(server, '/__mogu/sessions', { method: 'POST', body });
  if (response.status !== 201) {
    throw new Error(`session was not created: ${response.status} ${await response.text()}`);
  }
  const created: { id: string } = await response.json();
  return created.id;
};
