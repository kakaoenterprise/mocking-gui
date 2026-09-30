import { useEffect, useState } from 'react';

import { isHandlerActive } from '@/lib/mockState';
import { HTTPBIN_ENDPOINTS } from '@/mocks/constants/endpoints';

/** The panel addresses handlers as `${method}.${url}`. */
const ECHO_HANDLER_KEY = `get.${HTTPBIN_ENDPOINTS.ECHO}`;

/**
 * MSW's marker for "let this one through untouched".
 *
 * The service worker strips this `accept` value and forwards the request to the
 * network, which is how the page can show a genuine response while the handler
 * is switched on. Without it, a visitor arriving with the handler already
 * active — a returning one, most obviously — could never see the other half of
 * the comparison without going and turning it off.
 */
const PASSTHROUGH_HEADERS = { accept: 'msw/passthrough' };

const STORAGE_KEY = 'showcase:first-run';

type Call = {
  at: string;
  status: number;
  durationMs: number;
  origin: string | null;
  body: string;
};

type Pair = { real: Call | null; mocked: Call | null };

const EMPTY_PAIR: Pair = { real: null, mocked: null };

const safeParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** `origin` is only present when the real service answers; a fixture may omit it. */
const readOrigin = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null) return null;
  const origin = (body as Record<string, unknown>).origin;
  return typeof origin === 'string' ? origin : null;
};

const restore = (): Pair => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_PAIR, ...JSON.parse(raw) } : EMPTY_PAIR;
  } catch {
    return EMPTY_PAIR;
  }
};

/**
 * The one thing a first-time visitor should do.
 *
 * The idea is that one switch decides who answers, so this section keeps two
 * slots — the real response and the mocked one — and fills whichever the panel
 * currently produces. Holding them separately rather than as "the last two
 * calls" is what makes the comparison survive any starting point: a visitor who
 * arrives with the handler already on fills the mocked slot first and can pull
 * the real one directly, and both slots persist across a reload so coming back
 * does not wipe the result.
 */
export function FirstRun() {
  /**
   * Restored during the first render, not in an effect: an effect that restores
   * and an effect that persists run in declaration order, so the persisting one
   * wrote the still-empty initial state back over storage before the restored
   * value had committed, and a reload always came back blank.
   */
  const [pair, setPair] = useState<Pair>(restore);
  const [pending, setPending] = useState<'send' | 'real' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pair));
    } catch {
      // Private browsing — the comparison simply will not survive a reload.
    }
  }, [pair]);

  const run = async (mode: 'send' | 'real') => {
    setPending(mode);
    setError(null);
    const startedAt = performance.now();

    // Whether a call was mocked is a fact about the panel, not about the body:
    // a Swagger variant with no schema answers `null`, which no amount of
    // inspection could tell apart from a real response.
    const mocked = mode === 'send' && isHandlerActive(ECHO_HANDLER_KEY);

    try {
      const response = await fetch(
        HTTPBIN_ENDPOINTS.ECHO,
        mode === 'real' ? { headers: PASSTHROUGH_HEADERS } : undefined,
      );
      const raw = await response.text();
      const parsed = safeParse(raw);

      const call: Call = {
        at: new Date().toLocaleTimeString(),
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        origin: readOrigin(parsed),
        body: parsed === null ? raw || '(empty body)' : JSON.stringify(parsed, null, 2),
      };

      setPair(current => ({ ...current, [mocked ? 'mocked' : 'real']: call }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  const both = Boolean(pair.real && pair.mocked);

  return (
    <section className="rounded-lg border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-5 py-4">
        <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">Start here</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Send the same request twice and change who answers it
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">
          This one goes to a real API. Fill both slots below — the URL and the code stay exactly the
          same; only the panel changes.
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <ol className="space-y-2.5">
          <Step n={1} done={Boolean(pair.real)}>
            Get the <strong className="font-semibold text-stone-800">real</strong> answer — it
            leaves your browser and comes back with your own IP address.
          </Step>
          <Step n={2} done={Boolean(pair.mocked)}>
            Get the <strong className="font-semibold text-stone-800">mocked</strong> one. Open the
            panel — the round button at the bottom-left — find{' '}
            <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">GET /get</code>,
            switch it <strong className="font-semibold text-stone-800">on</strong>, then send again.
          </Step>
          <Step n={3} done={both}>
            Compare them. Same URL, same code — a different answer.
          </Step>
        </ol>

        <div className="flex flex-wrap items-center gap-2 rounded-md bg-stone-50 px-3 py-2.5">
          <code className="font-mono text-xs text-stone-700">GET {HTTPBIN_ENDPOINTS.ECHO}</code>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!pair.real && (
              <button
                onClick={() => void run('real')}
                disabled={pending !== null}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 disabled:text-stone-400"
              >
                {pending === 'real' ? 'Fetching…' : 'Fetch the real one'}
              </button>
            )}
            <button
              onClick={() => void run('send')}
              disabled={pending !== null}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-300"
            >
              {pending === 'send' ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </div>

        {!pair.real && (
          <p className="text-[11px] leading-relaxed text-stone-500">
            <strong className="font-semibold text-stone-700">Fetch the real one</strong> asks MSW to
            let a single request through untouched, so you can see the genuine response without
            switching the handler off first.
          </p>
        )}

        {error && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            The real API could not be reached ({error}). It is a public service and occasionally
            unavailable — the rest of this page does not depend on it.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Slot call={pair.real} kind="real" />
          <Slot call={pair.mocked} kind="mocked" />
        </div>

        {both && (
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

function Slot({ call, kind }: { call: Call | null; kind: 'real' | 'mocked' }) {
  const mocked = kind === 'mocked';

  if (!call) {
    return (
      <article className="flex min-h-32 min-w-0 flex-col justify-center rounded-md border border-dashed border-stone-300 px-3 py-2.5">
        <p className="font-mono text-[11px] font-semibold text-stone-400">
          {mocked ? 'MOCKED' : 'REAL NETWORK'}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
          {mocked
            ? 'Switch the handler on in the panel, then press Send request.'
            : 'Press Fetch the real one, or switch the handler off and send.'}
        </p>
      </article>
    );
  }

  return (
    <article
      className={`min-w-0 rounded-md border px-3 py-2.5 ${
        mocked ? 'border-stone-900 bg-stone-900' : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-mono text-[11px] font-semibold ${mocked ? 'text-emerald-300' : 'text-stone-700'}`}
        >
          {mocked ? 'MOCKED' : 'REAL NETWORK'}
        </span>
        <span className="font-mono text-[10px] text-stone-400">
          {call.at} · {call.durationMs}ms
        </span>
      </div>

      <p className={`mt-1 font-mono text-[11px] ${mocked ? 'text-stone-300' : 'text-stone-600'}`}>
        origin: {call.origin ?? '—'}
      </p>

      <pre
        className={`mt-2 max-h-40 overflow-auto rounded font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap ${
          mocked ? 'text-stone-200' : 'text-stone-500'
        }`}
      >
        {call.body}
      </pre>
    </article>
  );
}
