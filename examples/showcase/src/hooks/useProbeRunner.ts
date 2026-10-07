import { useCallback, useState } from 'react';

import { readBodySafely } from '@/lib/responseBody';

import type { Probe } from '@/mocks/probes';

export type ProbeResult =
  | { state: 'idle' }
  | { state: 'loading' }
  | {
      state: 'done';
      status: number;
      statusText: string;
      contentType: string | null;
      durationMs: number;
      preview: string;
    }
  | { state: 'failed'; durationMs: number; error: string };

const IDLE: ProbeResult = { state: 'idle' };

const runProbe = async (probe: Probe): Promise<ProbeResult> => {
  const startedAt = performance.now();
  try {
    const response = await fetch(probe.url, {
      method: probe.method,
      ...(probe.body
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(probe.body) }
        : {}),
    });
    return {
      state: 'done',
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      durationMs: Math.round(performance.now() - startedAt),
      preview: await readBodySafely(response),
    };
  } catch (err) {
    // A handler that is off falls through to the real network. For the demo's
    // own origin that fails outright; for the one probe pointed at a real API it
    // does not, which is why nothing here claims to know why.
    return {
      state: 'failed',
      durationMs: Math.round(performance.now() - startedAt),
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

/** Fires a set of probes in parallel and keeps the per-probe outcome. */
export const useProbeRunner = () => {
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const run = useCallback(async (probes: Probe[]) => {
    setRunning(true);
    setResults(
      Object.fromEntries(probes.map(probe => [probe.key, { state: 'loading' } as ProbeResult])),
    );

    const settled = await Promise.all(
      probes.map(async probe => [probe.key, await runProbe(probe)] as const),
    );

    setResults(Object.fromEntries(settled));
    setRanAt(new Date().toLocaleTimeString());
    setRunning(false);
  }, []);

  const resultFor = useCallback((key: string): ProbeResult => results[key] ?? IDLE, [results]);

  return { results, resultFor, run, running, ranAt };
};

export const slowestOf = (results: ProbeResult[]): number =>
  results.reduce(
    (max, result) =>
      result.state === 'done' || result.state === 'failed' ? Math.max(max, result.durationMs) : max,
    0,
  );
