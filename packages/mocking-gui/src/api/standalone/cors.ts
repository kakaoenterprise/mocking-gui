/**
 * The mock server is called from a page on another origin (the app under test),
 * so every response allows the calling origin and answers preflights itself.
 */

export const isPreflight = (request: Request): boolean =>
  request.method === 'OPTIONS' && request.headers.has('access-control-request-method');

/** Adds the CORS response headers when the request carries an `Origin`. */
export const withCors = (response: Response, request: Request): Response => {
  const origin = request.headers.get('origin');
  if (!origin || response.type === 'error') return response;

  let target = response;
  try {
    target.headers.set('access-control-allow-origin', origin);
  } catch {
    // Immutable headers (e.g. a response returned by `fetch`): re-wrap once.
    target = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
    target.headers.set('access-control-allow-origin', origin);
  }

  target.headers.set('access-control-allow-credentials', 'true');
  target.headers.set('access-control-expose-headers', '*');
  target.headers.append('vary', 'Origin');
  return target;
};

/** Answers a preflight by allowing exactly what the browser asked for. */
export const preflightResponse = (request: Request): Response => {
  const headers = new Headers({ 'access-control-max-age': '600' });

  const method = request.headers.get('access-control-request-method');
  if (method) headers.set('access-control-allow-methods', method);

  const requestedHeaders = request.headers.get('access-control-request-headers');
  if (requestedHeaders) headers.set('access-control-allow-headers', requestedHeaders);

  if (request.headers.get('access-control-request-private-network') === 'true') {
    headers.set('access-control-allow-private-network', 'true');
  }

  return withCors(new Response(null, { status: 204, headers }), request);
};
