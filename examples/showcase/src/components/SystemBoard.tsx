import { ResponseBody } from '@/components/ResponseBody';
import { slowestOf, useProbeRunner, type ProbeResult } from '@/hooks/useProbeRunner';
import { GROUP_ORDER, PROBES } from '@/mocks/probes';

/**
 * Every endpoint the scenarios touch, fired at once.
 *
 * A card with a single "Send request" button can never show the thing that
 * makes a scenario a scenario: several endpoints moving together. Run this
 * before importing anything, then again afterwards, and the coordinated change
 * is the difference between the two boards.
 */
const statusTone = (status: number) => {
  if (status >= 500) return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status >= 400) return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status >= 300) return 'bg-sky-50 text-sky-700 ring-sky-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
};

const barTone = (status: number) => {
  if (status >= 500) return 'bg-rose-400';
  if (status >= 400) return 'bg-amber-400';
  if (status >= 300) return 'bg-sky-400';
  return 'bg-emerald-400';
};

/** The status code is the headline, so it colours the whole tile, not just the badge. */
const accentTone = (result: ProbeResult) => {
  if (result.state !== 'done') return 'border-l-stone-200';
  if (result.status >= 500) return 'border-l-rose-400';
  if (result.status >= 400) return 'border-l-amber-400';
  if (result.status >= 300) return 'border-l-sky-400';
  return 'border-l-emerald-400';
};

export function SystemBoard() {
  const { results, resultFor, run, running, ranAt } = useProbeRunner();

  const collected = Object.values(results);
  const slowest = slowestOf(collected);
  const okCount = collected.filter(result => result.state === 'done' && result.status < 400).length;
  const badCount = collected.filter(
    result => result.state === 'failed' || (result.state === 'done' && result.status >= 400),
  ).length;

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-stone-900">System board</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {ranAt
              ? `${PROBES.length} requests · ${okCount} ok · ${badCount} failing · slowest ${slowest}ms · ${ranAt}`
              : `The ${PROBES.length} endpoints the scenarios below touch, all at once.`}
          </p>
        </div>
        <button
          onClick={() => run(PROBES)}
          disabled={running}
          className="shrink-0 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-300"
        >
          {running ? 'Running…' : `Run all ${PROBES.length}`}
        </button>
      </header>

      <div className="space-y-4 px-4 py-4">
        {GROUP_ORDER.map(group => (
          <section key={group}>
            <p className="mb-1.5 font-mono text-[10px] tracking-widest text-stone-400 uppercase">
              {group}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROBES.filter(probe => probe.group === group).map(probe => {
                const result = resultFor(probe.key);
                const failed = result.state === 'failed';

                return (
                  <article
                    key={probe.key}
                    className={`rounded-md border border-l-4 px-3 py-2 transition-colors ${accentTone(result)} ${
                      failed ? 'border-dashed border-stone-300 bg-stone-50' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium text-stone-800">
                        {probe.title}
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
                      {failed && (
                        <span className="shrink-0 font-mono text-[11px] text-stone-300">—</span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate font-mono text-[10px] text-stone-400">
                      {probe.method} {probe.path}
                    </p>

                    {result.state === 'done' && (
                      <>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className={`h-full rounded-full transition-all ${barTone(result.status)}`}
                            style={{
                              width: `${slowest > 0 ? Math.max(3, (result.durationMs / slowest) * 100) : 3}%`,
                            }}
                          />
                        </div>
                        <ResponseBody result={result} />
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
