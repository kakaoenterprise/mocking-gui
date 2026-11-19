/**
 * Error raised by the control API. The router turns it into a JSON response
 * `{ error, message, ...extra }` with the given status.
 */
export class ControlError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ControlError';
  }
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const errorJson = (
  status: number,
  error: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response => json({ error, message, ...extra }, status);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a JSON object body. An empty body counts as `{}`.
 * Anything that is not a JSON object raises a 400.
 */
export const readJsonObject = async (request: Request): Promise<Record<string, unknown>> => {
  const text = await request.text();
  if (!text.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ControlError(400, 'invalid_body', 'The request body is not valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new ControlError(400, 'invalid_body', 'The request body must be a JSON object.');
  }
  return parsed;
};

/**
 * Sets headers on a response. Responses built in this process have mutable
 * headers; an immutable one (e.g. returned by `fetch`) is re-wrapped instead.
 */
export const setHeaders = (response: Response, values: Record<string, string>): Response => {
  if (response.type === 'error') return response;

  try {
    for (const [name, value] of Object.entries(values)) response.headers.set(name, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(values)) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
};

/** Reads one cookie value from a `Cookie` request header. */
export const readCookie = (header: string | null, name: string): string | null => {
  if (!header) return null;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;

    const value = pair.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
};
