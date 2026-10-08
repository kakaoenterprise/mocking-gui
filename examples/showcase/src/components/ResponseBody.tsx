import type { ProbeResult } from '@/hooks/useProbeRunner';

/**
 * The response body for one call, always visible.
 *
 * Summary chips used to stand in for this, but they could only ever paraphrase.
 * Several scenarios — "Brand new account" above all — answer 200 everywhere and
 * differ only in the body, so the body is the thing worth showing, and hiding it
 * behind a toggle only puts a click between the reader and the evidence.
 */
type ResponseBodyProps = {
  result: Extract<ProbeResult, { state: 'done' }>;
};

export function ResponseBody({ result }: ResponseBodyProps) {
  return (
    <div className="mt-1.5">
      <p className="mb-1 font-mono text-[10px] text-stone-400">
        {result.durationMs}ms · {result.contentType?.split(';')[0] ?? 'no content-type'}
      </p>
      {/* Capped so one long body cannot push the rest of the page out of reach. */}
      <pre className="max-h-56 overflow-auto rounded-md bg-stone-900 p-2.5 font-mono text-[10px] leading-relaxed text-stone-100">
        {result.preview}
      </pre>
    </div>
  );
}
