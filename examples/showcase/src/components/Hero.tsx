/**
 * Short on purpose.
 *
 * The hero used to carry a setup snippet and an instruction to open the panel,
 * which gave a first-time visitor three things to do before anything had
 * happened. The snippet moved to the end of the page, where it answers "how
 * would I add this" — a question nobody has until they have seen it work.
 */
export function Hero() {
  return (
    <header className="pb-8">
      <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">
        Live demo · @kakaocloud/mocking-gui
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        A control panel for the API responses your app receives
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
        Mocking GUI sits on top of{' '}
        <a
          href="https://mswjs.io"
          className="underline decoration-stone-300 underline-offset-2 hover:text-stone-900"
        >
          MSW
        </a>{' '}
        and gives you a panel to change what your API returns while the app is running — a 500, an
        empty list, a three-second delay — without touching code or a server.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
        This page is a real React app. Start with the box below; the rest is a tour of what else the
        panel can do.
      </p>
    </header>
  );
}
