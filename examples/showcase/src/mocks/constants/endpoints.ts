/**
 * A deliberately non-routable origin. Every request below is intercepted by the
 * Service Worker, so nothing ever leaves the browser. Turning a handler off in
 * the panel makes MSW `passthrough()` the request, which then fails at DNS —
 * that failure is the proof the mock was the only thing answering.
 */
export const API_ORIGIN = 'https://api.mocking-gui.demo';

export const BASE_ENDPOINT = `${API_ORIGIN}/v1`;

export const ENDPOINTS = {
  USER: `${BASE_ENDPOINT}/users/:userId`,
  SEARCH: `${BASE_ENDPOINT}/search`,
  SESSION: `${BASE_ENDPOINT}/session`,
  NOTIFICATIONS: `${BASE_ENDPOINT}/notifications`,
  DASHBOARD_STATS: `${BASE_ENDPOINT}/dashboard/stats`,
  CHECKOUT: `${BASE_ENDPOINT}/checkout`,
  EXPORT_CSV: `${BASE_ENDPOINT}/reports/export.csv`,
  INVOICE_HTML: `${BASE_ENDPOINT}/reports/invoice.html`,
  FEED_XML: `${BASE_ENDPOINT}/reports/feed.xml`,
  UPLOAD: `${BASE_ENDPOINT}/reports/upload`,
  ARCHIVE_BIN: `${BASE_ENDPOINT}/reports/archive.bin`,
} as const;

export const GRAPHQL_ENDPOINT = `${API_ORIGIN}/graphql`;

/**
 * A real, public API — Swagger's own Petstore sandbox.
 *
 * Everything above is fiction served by MSW. These two are not: the OpenAPI
 * document is fetched from the live server at startup, and switching the
 * handler off sends the request to the real API. That contrast is the point —
 * you can see the same request answered by the real service and by your mock,
 * one toggle apart.
 *
 * It is a shared public sandbox, so it is sometimes slow and sometimes broken.
 * Which is, in fairness, the argument for mocking it.
 */
export const PETSTORE_BASE = 'https://petstore3.swagger.io/api/v3';

export const PETSTORE_OPENAPI_URL = `${PETSTORE_BASE}/openapi.json`;

export const PETSTORE_DOCS_URL = 'https://petstore3.swagger.io';

export const PETSTORE_ENDPOINTS = {
  FIND_BY_STATUS: `${PETSTORE_BASE}/pet/findByStatus`,
} as const;

/**
 * httpbin — a real, no-auth, CORS-open API that answers deterministically.
 *
 * Chosen for the opening demonstration because `/get` echoes the caller back:
 * the real response contains the visitor's own IP and User-Agent, which settles
 * the question of whether a request actually left the browser far better than
 * any wording could. `/status/{code}` returns whatever code is asked for, so
 * the real service can stand next to a mocked error instead of a DNS failure.
 *
 * Its OpenAPI document is deliberately NOT imported: it declares 73 operations
 * with zero response schemas, so it would generate 73 empty handlers and make
 * the import feature look broken. Petstore is the spec source (73% schema
 * coverage); httpbin is the live endpoint.
 */
export const HTTPBIN_BASE = 'https://httpbin.org';

export const HTTPBIN_OPENAPI_URL = `${HTTPBIN_BASE}/spec.json`;

export const HTTPBIN_ENDPOINTS = {
  ECHO: `${HTTPBIN_BASE}/get`,
  /** Served by the handler the spec generates for `/status/{codes}`. */
  STATUS: `${HTTPBIN_BASE}/status/503`,
} as const;
