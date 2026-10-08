/**
 * Reads a response according to what it claims to be.
 *
 * Without this the `rawBody` handlers (csv, html, xml, formData, arrayBuffer)
 * cannot be told apart in the UI — everything would be rendered as if it were
 * JSON, or as a JSON string containing markup.
 *
 * Shared by the single-endpoint cards and by the scenario probes so the same
 * response is always rendered the same way.
 */
export type ResponseKind = 'json' | 'text' | 'html' | 'xml' | 'formData' | 'binary' | 'empty';

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

export const classify = (contentType: string | null): ResponseKind => {
  if (!contentType) return 'empty';
  if (contentType.includes('application/json')) return 'json';
  if (contentType.includes('text/html')) return 'html';
  if (contentType.includes('xml')) return 'xml';
  if (contentType.includes('multipart/form-data')) return 'formData';
  if (contentType.includes('text/')) return 'text';
  return 'binary';
};

export const readBody = async (response: Response, kind: ResponseKind): Promise<string> => {
  switch (kind) {
    case 'json': {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    }
    case 'formData': {
      const formData = await response.formData();
      return Array.from(formData.entries())
        .map(([name, value]) => `${name}: ${String(value)}`)
        .join('\n');
    }
    case 'binary': {
      const buffer = await response.arrayBuffer();
      return buffer.byteLength === 0
        ? '(empty body)'
        : `${buffer.byteLength} bytes\n${toHex(buffer)}`;
    }
    case 'empty':
      return '(no content-type, empty body)';
    default:
      return (await response.text()) || '(empty body)';
  }
};

/** Never throws: a body that cannot be read is not worth failing a row over. */
export const readBodySafely = async (response: Response): Promise<string> => {
  try {
    return await readBody(response, classify(response.headers.get('content-type')));
  } catch (err) {
    return `(could not read body: ${err instanceof Error ? err.message : String(err)})`;
  }
};
