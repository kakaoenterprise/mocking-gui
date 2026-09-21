import { useCallback, useState } from 'react';

export type ResponseKind = 'json' | 'text' | 'html' | 'xml' | 'formData' | 'binary' | 'empty';

export type CallResult = {
  status: number;
  statusText: string;
  contentType: string | null;
  headers: Record<string, string>;
  kind: ResponseKind;
  preview: string;
  durationMs: number;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

const classify = (contentType: string | null): ResponseKind => {
  if (!contentType) return 'empty';
  if (contentType.includes('application/json')) return 'json';
  if (contentType.includes('text/html')) return 'html';
  if (contentType.includes('xml')) return 'xml';
  if (contentType.includes('multipart/form-data')) return 'formData';
  if (contentType.includes('text/')) return 'text';
  return 'binary';
};

/**
 * Reads the body according to its content type rather than assuming JSON —
 * without this, the `rawBody` handlers (csv, html, xml, formData, arrayBuffer)
 * cannot be told apart in the UI.
 */
const readBody = async (response: Response, kind: ResponseKind): Promise<string> => {
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

export const useApiCall = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (url: string, init?: RequestInit) => {
    setLoading(true);
    setError(null);
    const startedAt = performance.now();

    try {
      const response = await fetch(url, init);
      const contentType = response.headers.get('content-type');
      const kind = classify(contentType);

      setResult({
        status: response.status,
        statusText: response.statusText,
        contentType,
        headers: Object.fromEntries(response.headers.entries()),
        kind,
        preview: await readBody(response, kind),
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      // A handler toggled off falls through to the real network, which cannot
      // resolve this demo origin. That failure is the intended lesson.
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, result, error };
};
