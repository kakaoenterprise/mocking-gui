/**
 * Fills `:param` placeholders in a handler URL, so callers can build a concrete request
 * URL from the very same constant the handler is registered with.
 *
 * @example fillPath(ENDPOINTS.order, { orderId: 'order_001' })
 */
export const fillPath = (template: string, params: Record<string, string>): string =>
  template.replace(/:([A-Za-z0-9_]+)/g, (match, key: string) => params[key] ?? match);

/** Appends a query string, skipping empty values. */
export const withQuery = (url: string, query: Record<string, string | number>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== '') search.set(key, String(value));
  }

  const qs = search.toString();

  return qs ? `${url}?${qs}` : url;
};
