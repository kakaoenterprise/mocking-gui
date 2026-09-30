import { useState } from 'react';

import { HTTPBIN_ENDPOINTS } from '@/mocks/constants/endpoints';

type Call = {
  at: string;
  status: number;
  durationMs: number;
  origin: string | null;
  mocked: boolean;
  body: string;
};

/**
 * The one thing a first-time visitor should do.
 *
 * Everything else on this page is a catalogue, and a catalogue cannot teach the
 * idea. The idea is that one switch decides who answers — so this section sends
 * a single request, twice, and puts the two answers side by side.
 *
 * It runs against a real API rather than the demo's fictional origin for two
 * reasons: switching the handler off produces a genuine response instead of a
 * failure, and `httpbin.org/get` echoes the caller's own IP back. Seeing your
 * own address appear, then be replaced by a number you chose, settles what
 * happened more convincingly than any wording.
 */
export function FirstRun() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setLoading(true);
    setError(null);
    const startedAt = performance.now();

    try {
      const response = await fetch(HTTPBIN_ENDPOINTS.ECHO);
      const json = await response.json();
      const body = JSON.stringify(json, null, 2);

      setCalls(previous =>
        [
          {
            at: new Date().toLocaleTimeString(),
            status: response.status,
            durationMs: Math.round(performance.now() - startedAt),
            origin: typeof json.origin === 'string' ? json.origin : null,
            // The fixture says so itself; the page does not have to guess.
            mocked: typeof json.note === 'string',
            body,
          },
          ...previous,
        ].slice(0, 2),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const [latest, previous] = calls;
  const changed = latest && previous && latest.mocked !== previous.mocked;

  return (
    <section className="rounded-lg border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-5 py-4">
        <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">Start here</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Send the same request twice and change who answers it
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">
          This one goes to a real API. Send it, then switch its handler on in the panel and send it
          again — the URL and the code stay exactly the same.
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <ol className="space-y-2.5">
          <Step n={1} done={calls.length > 0}>
            Send the request below. It leaves your browser and comes back with{' '}
            <strong className="font-semibold text-stone-800">your own IP address</strong>.
          </Step>
          <Step n={2} done={Boolean(latest?.mocked)}>
            Open the panel — the round button at the bottom-left corner — find{' '}
            <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">GET /get</code> and
            switch it <strong className="font-semibold text-stone-800">on</strong>.
          </Step>
          <Step n={3} done={Boolean(changed)}>
            Send it again. Same URL, same code — a different answer.
          </Step>
        </ol>

        <div className="flex flex-wrap items-center gap-3 rounded-md bg-stone-50 px-3 py-2.5">
          <code className="font-mono text-xs text-stone-700">GET {HTTPBIN_ENDPOINTS.ECHO}</code>
          <button
            onClick={send}
            disabled={loading}
            className="ml-auto rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-300"
          >
            {loading ? 'Sending…' : calls.length === 0 ? 'Send request' : 'Send again'}
          </button>
        </div>

        {error && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            The real API could not be reached ({error}). It is a public service and occasionally
            unavailable — the rest of this page does not depend on it.
          </p>
        )}

        {calls.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Oldest first: the pair reads as before → after, left to right. */}
            {[...calls].reverse().map((call, index) => (
              <CallCard key={call.at + index} call={call} isLatest={index === calls.length - 1} />
            ))}
          </div>
        )}

        {changed && (
          <p className="rounded-md bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-900 ring-1 ring-emerald-200">
            <strong className="font-semibold">That is the whole idea.</strong> Your application code
            never changed, the URL never changed, and no server was reconfigured. A switch decided
            whether the network or your fixture answered — and everything below is a variation on
            that one move.
          </p>
        )}
      </div>
    </section>
  );
}

function Step({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${
          done ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <span
        className={`text-sm leading-relaxed ${done ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-700'}`}
      >
        {children}
      </span>
    </li>
  );
}

function CallCard({ call, isLatest }: { call: Call; isLatest: boolean }) {
  return (
    // `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so
    // without it the wide <pre> below sizes the track and the page scrolls
    // sideways on a phone.
    <article
      className={`min-w-0 rounded-md border px-3 py-2.5 ${
        call.mocked ? 'border-stone-900 bg-stone-900' : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-mono text-[11px] font-semibold ${call.mocked ? 'text-emerald-300' : 'text-stone-700'}`}
        >
          {call.mocked ? 'MOCKED' : 'REAL NETWORK'}
        </span>
        <span
          className={`font-mono text-[10px] ${call.mocked ? 'text-stone-400' : 'text-stone-400'}`}
        >
          {isLatest ? 'latest' : 'previous'} · {call.durationMs}ms
        </span>
      </div>

      <p
        className={`mt-1 font-mono text-[11px] ${call.mocked ? 'text-stone-300' : 'text-stone-600'}`}
      >
        origin: {call.origin ?? '—'}
      </p>

      <pre
        className={`mt-2 max-h-40 overflow-auto rounded font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all ${
          call.mocked ? 'text-stone-200' : 'text-stone-500'
        }`}
      >
        {call.body}
      </pre>
    </article>
  );
}
