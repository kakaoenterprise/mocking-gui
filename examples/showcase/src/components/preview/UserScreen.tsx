import { REQUEST_URL } from '@/hooks/useUserPreview';
import { PETSTORE_BASE } from '@/mocks/constants/endpoints';

import type { ResponseSource, UserPreview } from '@/hooks/useUserPreview';

/**
 * One request, and the answer to "who is talking to it right now".
 *
 * The same request can be answered three ways from one panel row: a Manual
 * variant written in this app, a Swagger variant generated from the Petstore
 * spec, or the real Petstore when the row is off. The strip on top says which;
 * the body underneath is the evidence, shown as it came back.
 */
export function UserScreen({ preview }: { preview: UserPreview }) {
  const { phase, source, status, ms, body, reload } = preview;

  return (
    <div className="overflow-hidden rounded-lg border border-stone-300 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
        <span className="min-w-0 truncate font-mono text-[11px] text-stone-600">
          <span className="font-semibold text-emerald-700">GET</span>{' '}
          {new URL(REQUEST_URL).pathname}
        </span>
        <button
          onClick={() => void reload()}
          disabled={phase === 'loading'}
          className="shrink-0 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 disabled:text-stone-400"
        >
          {phase === 'loading' ? 'Sending…' : 'Send again'}
        </button>
      </header>

      {source && <SourceStrip source={source} status={phase === 'done' ? status : null} ms={ms} />}

      <div className="p-3">
        <pre className="max-h-72 min-h-40 overflow-auto rounded-md bg-stone-900 p-3 font-mono text-[11px] leading-relaxed text-stone-100">
          {phase === 'loading'
            ? 'Waiting for a response…'
            : status === 0
              ? `No response — ${PETSTORE_HOST} could not be reached.`
              : body || '(empty body)'}
          {/* A generated error variant answers `null` when the spec gives that
              status no schema, which otherwise reads as if nothing happened. */}
          {phase === 'done' && source?.kind === 'swagger' && body === 'null' && (
            <span className="text-stone-500">
              {'\n// The spec documents no body for this status.'}
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}

const SOURCE_STYLE = {
  real: { label: 'Real API', dot: 'bg-sky-500', tone: 'border-sky-200 bg-sky-50 text-sky-900' },
  manual: {
    label: 'Manual mock',
    dot: 'bg-emerald-500',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  swagger: {
    label: 'Swagger mock',
    dot: 'bg-violet-500',
    tone: 'border-violet-200 bg-violet-50 text-violet-900',
  },
} as const;

const PETSTORE_HOST = new URL(PETSTORE_BASE).host;

function SourceStrip({
  source,
  status,
  ms,
}: {
  source: ResponseSource;
  status: number | null;
  ms: number | null;
}) {
  const style = SOURCE_STYLE[source.kind];

  return (
    <div
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${style.tone}`}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        {style.label}
      </span>
      <span className="font-mono text-[10px] opacity-70">
        {status === null ? 'waiting…' : status === 0 ? 'no answer' : `HTTP ${status}`}
        {status !== null && ms !== null && ` · ${ms} ms`}
      </span>
    </div>
  );
}
