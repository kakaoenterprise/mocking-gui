/**
 * A deliberately non-routable origin. Every request below is intercepted by the
 * Service Worker, so nothing ever leaves the browser. Turning a handler off in
 * the panel makes MSW `passthrough()` the request, which then fails at DNS —
 * that failure is the proof the mock was the only thing answering.
 */
export const API_ORIGIN = 'https://api.mocking-gui.demo';

export const BASE_ENDPOINT = `${API_ORIGIN}/v1`;

/** Swagger-imported handlers are pinned to a separate version prefix. */
export const SWAGGER_SERVER_URL = `${API_ORIGIN}/v2`;

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

/** Served from this app's own `public/` folder, so the demo works offline. */
export const OPENAPI_DOC_URL = `${import.meta.env.BASE_URL}openapi.json`;

export const GRAPHQL_ENDPOINT = `${API_ORIGIN}/graphql`;
