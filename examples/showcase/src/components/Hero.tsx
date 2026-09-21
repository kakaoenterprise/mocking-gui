const SETUP_SNIPPET = `import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';

<MockingGUIBoundary config={{ mocks: handlers }}>
  <App />
</MockingGUIBoundary>`;

export function Hero() {
  return (
    <header className="border-b border-stone-200 pb-8">
      <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">
        Live demo · @kakaocloud/mocking-gui
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        Every API state, without touching the backend
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
        This page is a real React app with{' '}
        <strong className="font-semibold text-stone-800">no server behind it</strong>. Every request
        below is answered by MSW inside your browser, and the panel on the right edge is what
        decides the answer. Change something there, send a request here, and watch it change.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white">
          ← Open the panel using the tab on the screen edge
        </span>
        <a
          href="https://github.com/kakaoenterprise/mocking-gui"
          className="text-xs font-medium text-stone-600 underline decoration-stone-300 hover:text-stone-900"
        >
          Source & docs
        </a>
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
        <p className="mb-2 font-mono text-[11px] tracking-widest text-stone-400 uppercase">
          That panel costs you this much setup
        </p>
        <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-stone-700">
          {SETUP_SNIPPET}
        </pre>
      </div>
    </header>
  );
}
