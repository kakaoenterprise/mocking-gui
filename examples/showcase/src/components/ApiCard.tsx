import { useState, type ReactNode } from 'react';

import { useApiCall } from '@/hooks/useApiCall';

type ApiCardProps = {
  title: string;
  method: 'GET' | 'POST';
  url: string;
  /** What to look for once the request comes back. */
  hint: string;
  /** Extra request controls (query string, headers) shown above the send button. */
  controls?: (state: {
    setSearch: (value: string) => void;
    search: string;
    setHeaders: (value: Record<string, string>) => void;
    headers: Record<string, string>;
  }) => ReactNode;
  badge?: string;
  /** JSON request body, sent for POST cards. */
  body?: unknown;
  children?: ReactNode;
};

const statusTone = (status: number) => {
  if (status >= 500) return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status >= 400) return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status >= 300) return 'bg-sky-50 text-sky-700 ring-sky-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
};

export function ApiCard({
  title,
  method,
  url,
  hint,
  controls,
  badge,
  body,
  children,
}: ApiCardProps) {
  const { call, loading, result, error } = useApiCall();
  const [search, setSearch] = useState('');
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [showHeaders, setShowHeaders] = useState(false);

  const requestUrl = search ? `${url}?${search}` : url;

  return (
    <article className="rounded-lg border border-stone-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
            {badge && (
              <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-stone-600 uppercase">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-stone-500">
            <span className="font-semibold text-stone-700">{method}</span> {url}
          </p>
        </div>
        <button
          onClick={() =>
            call(requestUrl, {
              method,
              headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
              ...(body ? { body: JSON.stringify(body) } : {}),
            })
          }
          disabled={loading}
          className="shrink-0 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-300"
        >
          {loading ? 'Sending…' : 'Send request'}
        </button>
      </header>

      <div className="space-y-3 px-4 py-3">
        <p className="text-xs leading-relaxed text-stone-600">{hint}</p>

        {controls && (
          <div className="space-y-2 rounded-md bg-stone-50 p-3">
            {controls({ search, setSearch, headers, setHeaders })}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
            <p className="font-semibold">Request failed: {error}</p>
            <p className="mt-1 text-rose-600">
              This is what a disabled handler looks like — MSW passed the request through to the
              real network, and this demo origin does not exist. In your app it would reach your
              actual server.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded px-2 py-0.5 font-mono font-semibold ring-1 ${statusTone(result.status)}`}
              >
                {result.status} {result.statusText}
              </span>
              <span className="font-mono text-stone-500">{result.contentType ?? 'no type'}</span>
              <span className="text-stone-400">{result.durationMs}ms</span>
              <button
                onClick={() => setShowHeaders(value => !value)}
                className="ml-auto text-stone-500 underline decoration-stone-300 hover:text-stone-800"
              >
                {showHeaders ? 'hide headers' : `headers (${Object.keys(result.headers).length})`}
              </button>
            </div>

            {showHeaders && (
              <pre className="overflow-x-auto rounded-md bg-stone-100 p-3 font-mono text-[11px] leading-relaxed text-stone-700">
                {Object.entries(result.headers)
                  .map(([name, value]) => `${name}: ${value}`)
                  .join('\n')}
              </pre>
            )}

            <pre className="max-h-72 overflow-auto rounded-md bg-stone-900 p-3 font-mono text-[11px] leading-relaxed text-stone-100">
              {result.preview}
            </pre>
          </div>
        )}

        {children}
      </div>
    </article>
  );
}
