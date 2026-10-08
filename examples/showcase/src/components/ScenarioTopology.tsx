import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ResponseBody } from '@/components/ResponseBody';
import { useProbeRunner, type ProbeResult } from '@/hooks/useProbeRunner';
import { findProbe, resolveExpectation, type Expectation, type Probe } from '@/mocks/probes';

import type { Scenario } from '@/mocks/scenarios';

/**
 * One scenario, drawn as the set of calls it moves.
 *
 * The node column is built from the scenario's own `configs`, so it is not a
 * picture of the scenario — it is the scenario. Each node is coloured by the
 * status code that actually came back, so importing the scenario and testing
 * again repaints the whole column at once.
 */
type ScenarioTopologyProps = {
  scenario: Scenario;
};

const NODE_GAP = 8;
const CONNECTOR_WIDTH = 44;

const EDGE_COLORS = {
  idle: '#d6d3d1',
  ok: '#34d399',
  redirect: '#38bdf8',
  client: '#fbbf24',
  server: '#fb7185',
} as const;

const edgeColor = (result: ProbeResult): string => {
  if (result.state !== 'done') return EDGE_COLORS.idle;
  if (result.status >= 500) return EDGE_COLORS.server;
  if (result.status >= 400) return EDGE_COLORS.client;
  if (result.status >= 300) return EDGE_COLORS.redirect;
  return EDGE_COLORS.ok;
};

const statusTone = (status: number) => {
  if (status >= 500) return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status >= 400) return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status >= 300) return 'bg-sky-50 text-sky-700 ring-sky-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
};

/** The status code is the headline, so it colours the whole node, not just the badge. */
const accentTone = (result: ProbeResult) => {
  if (result.state !== 'done') return 'border-l-stone-200';
  if (result.status >= 500) return 'border-l-rose-400';
  if (result.status >= 400) return 'border-l-amber-400';
  if (result.status >= 300) return 'border-l-sky-400';
  return 'border-l-emerald-400';
};

/** Auto handlers have no declared status, so "not an error" is the strongest claim available. */
const isMatch = (expectation: Expectation, result: ProbeResult): boolean => {
  if (result.state !== 'done') return false;
  if (expectation.kind === 'auto') return result.status < 400;
  if (expectation.status === undefined) return false;
  return expectation.status === result.status;
};

/**
 * What the scenario declares for this call, in words.
 *
 * `resolveExpectation` already computed this to decide whether a result
 * matches, but nothing showed it — so before you pressed test, a node said only
 * which path it was, and the scenario's actual content stayed invisible. Now the
 * untested column reads as the scenario's intent and the tested one as evidence
 * against it.
 */
const expectationLabel = (expectation: Expectation): string => {
  const delay = expectation.delayMs ? ` · ${expectation.delayMs}ms delay` : '';

  if (expectation.kind === 'auto') return `computed per request${delay}`;
  if (expectation.kind === 'manual') return `${expectation.status} ${expectation.variant}${delay}`;
  return `${expectation.variant ?? 'unknown'}${delay}`;
};

type Node = {
  probe: Probe;
  expectation: Expectation;
};

type Geometry = { height: number; centers: number[] };

const sameGeometry = (a: Geometry, b: Geometry) =>
  a.height === b.height &&
  a.centers.length === b.centers.length &&
  a.centers.every((value, index) => value === b.centers[index]);

export function ScenarioTopology({ scenario }: ScenarioTopologyProps) {
  const { resultFor, run, running, ranAt } = useProbeRunner();
  const listRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry>({ height: 0, centers: [] });

  const nodes = useMemo<Node[]>(
    () =>
      Object.entries(scenario.configs).flatMap(([key, config]) => {
        const probe = findProbe(key);
        return probe ? [{ probe, expectation: resolveExpectation(key, config) }] : [];
      }),
    [scenario],
  );

  /**
   * The rows grow when a response body is expanded, so the connector endpoints
   * are measured from the DOM rather than computed from a fixed row height.
   */
  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const listRect = list.getBoundingClientRect();
    const next: Geometry = {
      height: listRect.height,
      centers: Array.from(list.children).map(child => {
        const rect = child.getBoundingClientRect();
        return rect.top - listRect.top + rect.height / 2;
      }),
    };

    setGeometry(current => (sameGeometry(current, next) ? current : next));
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    Array.from(list.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, [measure, nodes.length]);

  const matchCount = nodes.filter(node =>
    isMatch(node.expectation, resultFor(node.probe.key)),
  ).length;
  const allMatch = ranAt !== null && matchCount === nodes.length;

  return (
    <div className="rounded-md bg-stone-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-widest text-stone-400 uppercase">
          {nodes.length} calls this scenario moves
        </p>
        <div className="flex items-center gap-2">
          {ranAt && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ring-1 ${
                allMatch
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-stone-100 text-stone-600 ring-stone-200'
              }`}
            >
              {matchCount}/{nodes.length} as described
            </span>
          )}
          <button
            onClick={() => run(nodes.map(node => node.probe))}
            disabled={running}
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 disabled:text-stone-400"
          >
            {running ? 'Testing…' : 'Test this scenario'}
          </button>
        </div>
      </div>

      <div className="flex items-center">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-md border border-stone-300 bg-white px-2 py-3">
          <span className="font-mono text-[9px] tracking-widest text-stone-400 uppercase">
            this
          </span>
          <span className="text-xs font-semibold text-stone-800">page</span>
        </div>

        <svg
          width={CONNECTOR_WIDTH}
          height={geometry.height}
          viewBox={`0 0 ${CONNECTOR_WIDTH} ${geometry.height}`}
          className="shrink-0"
          aria-hidden="true"
        >
          {nodes.map((node, index) => {
            const nodeY = geometry.centers[index];
            if (nodeY === undefined) return null;
            const result = resultFor(node.probe.key);
            const centerY = geometry.height / 2;

            return (
              <path
                key={node.probe.key}
                d={`M 0 ${centerY} C ${CONNECTOR_WIDTH / 2} ${centerY}, ${CONNECTOR_WIDTH / 2} ${nodeY}, ${CONNECTOR_WIDTH} ${nodeY}`}
                fill="none"
                stroke={edgeColor(result)}
                strokeWidth={result.state === 'done' ? 2 : 1.5}
                strokeDasharray={result.state === 'failed' ? '3 3' : undefined}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>

        <div
          ref={listRef}
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap: `${NODE_GAP}px` }}
        >
          {nodes.map(node => {
            const result = resultFor(node.probe.key);

            return (
              <article
                key={node.probe.key}
                className={`flex min-h-14 flex-col justify-center rounded-md border border-l-4 bg-white px-3 py-2 transition-colors ${accentTone(result)} ${
                  result.state === 'failed' ? 'border-dashed border-stone-300' : 'border-stone-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-stone-700">
                    <span className="font-semibold">{node.probe.method}</span> {node.probe.path}
                  </span>
                  {result.state === 'done' && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ${statusTone(result.status)}`}
                    >
                      {result.status}
                    </span>
                  )}
                  {result.state === 'loading' && (
                    <span className="shrink-0 font-mono text-[10px] text-stone-400">…</span>
                  )}
                  {result.state === 'failed' && (
                    <span className="shrink-0 font-mono text-[11px] text-stone-300">—</span>
                  )}
                </div>

                {/* Edges colour by response class, which can read as "all fine"
                    while the badge says otherwise — so a node that answered
                    something the scenario did not ask for says so here. */}
                <p
                  className={`mt-0.5 truncate font-mono text-[10px] ${
                    result.state === 'done' && !isMatch(node.expectation, result)
                      ? 'text-amber-600'
                      : 'text-stone-400'
                  }`}
                >
                  scenario says: {expectationLabel(node.expectation)}
                  {result.state === 'done' && !isMatch(node.expectation, result) && ' — not yet'}
                </p>

                {result.state === 'done' && <ResponseBody result={result} />}
              </article>
            );
          })}
        </div>
      </div>

      {ranAt && !allMatch && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-stone-500">
          The responses do not match what this scenario describes yet — it is not active. Copy the
          code, import it in the panel, activate it, then test again.
        </p>
      )}
      {allMatch && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-emerald-700">
          Every call matches. This page is now in the state the scenario describes.
        </p>
      )}
    </div>
  );
}
