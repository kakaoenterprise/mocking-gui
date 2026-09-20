'use client';

import { useCallback, useRef, useState } from 'react';

import { sendRequest } from '@shared/playground';

import type { ApiResponse } from '@shared/playground';

interface UseApiRequestResult {
  response: ApiResponse | null;
  /** Network or parsing failure only — an HTTP error status arrives in `response`. */
  error: string | null;
  loading: boolean;
  send: () => Promise<void>;
}

/**
 * One request state machine for any endpoint.
 *
 * Kept per-example rather than in `examples/shared`, because that directory is resolved
 * from the workspace root where `react` is not linked.
 */
export function useApiRequest(method: string, url: string, init?: RequestInit) {
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keeps `send` stable while still reading the latest request definition.
  const requestRef = useRef({ method, url, init });
  requestRef.current = { method, url, init };

  const send = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const current = requestRef.current;

      setResponse(await sendRequest(current.method, current.url, current.init));
    } catch (caught: unknown) {
      setResponse(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  const result: UseApiRequestResult = { response, error, loading, send };

  return result;
}
