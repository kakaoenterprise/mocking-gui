/**
 * Helpers for the `responseVariantsFn` (AUTO) handlers.
 *
 * Note: `responseVariantsFn` is called synchronously by the engine, so nothing here may
 * return a promise — the request *body* is therefore off limits. Path params, query
 * string, headers and cookies are all available synchronously.
 */

/** Mirrors MSW's `PathParams` value type without importing it. */
type PathParamValue = string | readonly string[] | undefined;

/** Path params arrive as `string | string[]`; collapse to the first value. */
export const readParam = (
  params: Record<string, PathParamValue>,
  key: string,
  fallback = '',
): string => {
  const value = params[key];

  if (Array.isArray(value)) return value[0] ?? fallback;

  return typeof value === 'string' ? value : fallback;
};

export const readQuery = (request: Request, key: string): string | null =>
  new URL(request.url).searchParams.get(key);

/** Reads a query param as a positive integer, falling back when absent or malformed. */
export const readNumericQuery = (request: Request, key: string, fallback: number): number => {
  const raw = readQuery(request, key);

  if (raw === null) return fallback;

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Extracts a bearer token from the `Authorization` header. */
export const readBearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization');

  if (!header?.toLowerCase().startsWith('bearer ')) return null;

  return header.slice('bearer '.length).trim() || null;
};
