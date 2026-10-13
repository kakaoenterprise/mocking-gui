import { UserScreen } from '@/components/preview/UserScreen';
import { useUserPreview } from '@/hooks/useUserPreview';
import { PETSTORE_ENDPOINTS } from '@/mocks/constants/endpoints';

/**
 * The opening.
 *
 * Earlier versions asked a visitor to press Send and read a JSON body, which
 * taught the wrong thing: nobody mocks an API to change a payload. So the
 * opening is a screen, and the lesson is the one decision the panel actually
 * makes — who answers a request. One Petstore row can be answered by a Manual
 * mock written in this app, a Swagger mock generated from the spec, or the real
 * server, and the screen says which every time.
 *
 * A list of things to try left a first-time visitor to find the order alone, so
 * the one thing to do — change the response — is laid out as two numbered
 * steps. Next to it, the two kinds of mock are compared on the same terms,
 * since "Manual or Swagger?" is the question the dropdown's two groups raise.
 */

/** A row as the panel prints it: method, then the path without the origin. */
const USER_ROW = `GET ${new URL(PETSTORE_ENDPOINTS.USER_BY_NAME).pathname}`;

/**
 * Manual and Swagger side by side, in the docs' own words (gui-guide,
 * handler-guide, swagger-guide), so the page and the docs explain them the same
 * way.
 */
const MOCK_KINDS = [
  {
    label: 'Manual mock',
    text: 'Custom defined cases. A handler you write lists a fixed set of pre-defined responses — responseVariants — and you pick one in the panel. Use it when you need the exact shape of an answer.',
  },
  {
    label: 'Swagger mock',
    text: "Generated from the API's OpenAPI document: response bodies come from its schemas, with a variant for each documented status code. Useful for status-code-centric testing, like UI state transitions or error messages. Handlers you wrote by hand keep precedence, and JSON Convert turns one into manual handler code when you need full customization.",
  },
  {
    label: 'Real API',
    text: 'Switch the row off and the real server answers. Use it to check your mocks against what the API actually returns.',
  },
] as const;

export function FirstRun() {
  const preview = useUserPreview();

  return (
    <section className="rounded-lg border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-5 py-4">
        <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">Start here</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Change what your app receives, without touching its code
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">
          Below, this page asks the Petstore API for the user <Code>user1</Code>. One row in the
          panel decides what comes back: a mock written in this app (Manual), a mock generated from
          the API&apos;s OpenAPI spec (Swagger), or the real server. The strip above the response
          always says which.
        </p>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          <Step n={1} title="Open the panel">
            Click the round button at the bottom-left. It opens on the API tab.
          </Step>
          <Step n={2} title="Change the response">
            Search <Code>username</Code>, then on the <Code>{USER_ROW}</Code> row pick another
            response from the dropdown — try <Code>404 User not found</Code>.
          </Step>
        </ol>
      </header>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <UserScreen preview={preview} />

        <div>
          <p className="font-mono text-[10px] tracking-widest text-stone-400 uppercase">
            Manual or Swagger?
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-4 text-[11px] leading-relaxed text-stone-600 marker:text-stone-400">
            {MOCK_KINDS.map(mock => (
              <li key={mock.label}>
                <span className="font-semibold text-stone-900">{mock.label}</span> — {mock.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

type StepProps = {
  n: number;
  title: string;
  children: React.ReactNode;
};

function Step({ n, title, children }: StepProps) {
  return (
    <li className="flex gap-2.5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 font-mono text-[10px] font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-stone-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{children}</p>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] [overflow-wrap:anywhere] text-stone-900">
      {children}
    </span>
  );
}
