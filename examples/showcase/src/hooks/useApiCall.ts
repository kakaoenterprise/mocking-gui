import { useCallback, useState } from 'react';

import { classify, readBody, type ResponseKind } from '@/lib/responseBody';

export type CallResult = {
  status: number;
  statusText: string;
  contentType: string | null;
  headers: Record<string, string>;
  kind: ResponseKind;
  preview: string;
  durationMs: number;
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
