/**
 * A response body normalized for display.
 *
 * Mock variants in this repo answer with JSON, plain text, HTML, XML, binary and 204 No
 * Content. Calling `res.json()` on any of the non-JSON ones throws, so the body is parsed
 * by Content-Type and tagged with how it was read.
 */
export type ResponseBody =
  | { kind: 'json'; value: unknown }
  | { kind: 'text'; value: string }
  | { kind: 'binary'; contentType: string; size: number }
  | { kind: 'empty' };

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ResponseBody;
}

/** Statuses the fetch spec forbids from carrying a body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

const isTextual = (contentType: string): boolean =>
  contentType.startsWith('text/') ||
  contentType.includes('json') ||
  contentType.includes('xml') ||
  contentType.includes('javascript') ||
  contentType.includes('x-www-form-urlencoded');

const readBody = async (response: Response): Promise<ResponseBody> => {
  if (NULL_BODY_STATUSES.has(response.status)) return { kind: 'empty' };

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';

  if (!isTextual(contentType)) {
    const blob = await response.blob();

    return { kind: 'binary', contentType: contentType || blob.type || 'unknown', size: blob.size };
  }

  const raw = await response.text();

  if (raw === '') return { kind: 'empty' };

  if (contentType.includes('json')) {
    try {
      return { kind: 'json', value: JSON.parse(raw) as unknown };
    } catch {
      // A handler may label a body as JSON without it being valid — show it verbatim.
      return { kind: 'text', value: raw };
    }
  }

  return { kind: 'text', value: raw };
};

const collectHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
};

/**
 * Performs a request and always resolves for any HTTP status.
 *
 * A 4xx/5xx is a perfectly valid thing to look at in a mocking playground, so it is
 * returned like any other response; only a network or parsing failure rejects.
 */
export const sendRequest = async (
  method: string,
  url: string,
  init?: RequestInit,
): Promise<ApiResponse> => {
  const response = await fetch(url, { ...init, method: method.toUpperCase() });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: collectHeaders(response),
    body: await readBody(response),
  };
};
