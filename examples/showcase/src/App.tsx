import { ApiCard } from '@/components/ApiCard';
import { FirstRun } from '@/components/FirstRun';
import { Hero } from '@/components/Hero';
import { PanelTour } from '@/components/PanelTour';
import { ScenarioCreateGuide } from '@/components/ScenarioCreateGuide';
import { ScenarioPresets } from '@/components/ScenarioPresets';
import { ScenarioWalkthrough } from '@/components/ScenarioWalkthrough';
import { ScopeWarning } from '@/components/ScopeWarning';
import { Section } from '@/components/Section';
import {
  BASE_ENDPOINT,
  ENDPOINTS,
  GRAPHQL_ENDPOINT,
  PETSTORE_BASE,
  PETSTORE_ENDPOINTS,
  PETSTORE_OPENAPI_URL,
} from '@/mocks/constants/endpoints';

const HEADER_PRESETS: { label: string; value: Record<string, string> }[] = [
  { label: 'no headers → 401', value: {} },
  { label: 'authorization only → viewer', value: { Authorization: 'Bearer demo-token' } },
  {
    label: '+ x-demo-role: admin',
    value: { Authorization: 'Bearer demo-token', 'x-demo-role': 'admin' },
  },
];

const SESSION_URL = `${BASE_ENDPOINT}/session/tenant_42`;

function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ScopeWarning />
        <Hero />

        <div className="mt-2">
          <FirstRun />
        </div>

        <div className="mt-12 space-y-12">
          <Section
            step="01 · the panel"
            title="What you are looking at"
            lede="The panel is the round button at the bottom-left corner. It reads the handlers your app declared and lets you drive them; nothing in it is specific to this demo."
          >
            <PanelTour />
          </Section>

          <Section
            step="02 · the same thing, as payloads"
            title="If you would rather see the response itself"
            lede="The screen above is what a variant is for. The rest of this page works at the level below it — the actual bodies, statuses and headers — because some of what the panel does only shows up there. Nothing here is required reading; skip to the panel tour if the screen already made the point."
          >
            <ApiCard
              title="Checkout"
              badge="manual"
              method="POST"
              url={ENDPOINTS.CHECKOUT}
              body={{ cartId: 'cart_9', amount: 42000, currency: 'KRW' }}
              hint="Card declined, idempotency conflict, gateway down. Try designing the retry UI against a real payment provider instead."
            />
          </Section>

          <Section
            step="03 · dynamic handlers"
            title="When the request has to shape the response"
            lede="These are Auto handlers: a function receives the request and returns the response, so there is no variant to pick. Change the inputs below and the same handler answers differently."
          >
            <ApiCard
              title="Search"
              badge="auto"
              method="GET"
              url={ENDPOINTS.SEARCH}
              hint="The handler reads q, page and pageSize off the query string and paginates a fixed corpus. An unmatched query returns 404."
              controls={({ search, setSearch }) => (
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] tracking-widest text-stone-500 uppercase">
                    query string
                  </label>
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="q=msw&page=1&pageSize=2"
                    className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 font-mono text-xs text-stone-800 outline-none focus:border-stone-900"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['q=m&page=1&pageSize=2', 'q=m&page=2&pageSize=2', 'q=nothing-here'].map(
                      preset => (
                        <button
                          key={preset}
                          onClick={() => setSearch(preset)}
                          className="rounded border border-stone-300 bg-white px-2 py-0.5 font-mono text-[10px] text-stone-600 hover:border-stone-900 hover:text-stone-900"
                        >
                          {preset}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            />
            <ApiCard
              title="Session"
              badge="auto"
              method="GET"
              url={SESSION_URL}
              hint="Reads the Authorization header (absent → 401), the x-demo-role header, and the :tenantId path param. Toggle the headers below and compare."
              controls={({ headers, setHeaders }) => (
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] tracking-widest text-stone-500 uppercase">
                    request headers
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {HEADER_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => setHeaders(preset.value)}
                        className="rounded border border-stone-300 bg-white px-2 py-0.5 font-mono text-[10px] text-stone-600 hover:border-stone-900 hover:text-stone-900"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-stone-400">
                    sending:{' '}
                    {Object.keys(headers).length === 0 ? '(none)' : Object.keys(headers).join(', ')}
                  </p>
                </div>
              )}
            />
          </Section>

          <Section
            step="04 · states you cannot reach"
            title="The empty list, the slow response, the expired token"
            lede="Set a delay on a handler in the panel (the control row next to the variant) and send again — the loading state finally holds still long enough to look at."
          >
            <ApiCard
              title="Dashboard stats"
              badge="manual"
              method="GET"
              url={ENDPOINTS.DASHBOARD_STATS}
              hint="Healthy, traffic spike, partial outage (206), and a 410 for an expired metrics window. Add a 3000ms delay to inspect your skeleton."
            />
            <ApiCard
              title="Notifications"
              badge="manual"
              method="GET"
              url={ENDPOINTS.NOTIFICATIONS}
              hint="Unread, all-read, empty, and a 401. The empty state is the one no real staging account will ever give you."
            />
          </Section>

          <Section
            step="05 · not everything is json"
            title="CSV, HTML, XML, form data and raw bytes"
            lede="rawBody sets the body and its content type directly. The viewer below reads each response according to what it claims to be, so you can tell them apart."
          >
            <ApiCard
              title="Export CSV"
              badge="rawBody · text"
              method="GET"
              url={ENDPOINTS.EXPORT_CSV}
              hint="text/plain with a Content-Disposition header. Switch to the “Empty export” variant for the header-only file."
            />
            <ApiCard
              title="Invoice"
              badge="rawBody · html"
              method="GET"
              url={ENDPOINTS.INVOICE_HTML}
              hint="text/html — returned as markup, not as a JSON string containing markup."
            />
            <ApiCard
              title="Release feed"
              badge="rawBody · xml"
              method="GET"
              url={ENDPOINTS.FEED_XML}
              hint="text/xml, for the legacy endpoint you still have to support."
            />
            <ApiCard
              title="Upload receipt"
              badge="rawBody · formData"
              method="POST"
              url={ENDPOINTS.UPLOAD}
              hint="multipart/form-data. The viewer parses it back into entries."
            />
            <ApiCard
              title="Archive"
              badge="rawBody · arrayBuffer"
              method="GET"
              url={ENDPOINTS.ARCHIVE_BIN}
              hint="Raw bytes, shown as hex. Expect 4D 4F 43 4B 00 01 02 03 — eight bytes, byte-exact."
            />
          </Section>

          <Section
            step="06 · a real api, a real spec"
            title="Everything above is fiction. This part is not."
            lede="Every other endpoint on this page targets an origin that does not exist. These two point at Swagger's live Petstore sandbox — a real public API with a real OpenAPI document, fetched at startup. Which makes this the one place you can see the same request answered by a real service and by your mock, one toggle apart."
          >
            <ApiCard
              title="Find pets by status"
              badge="manual · real url"
              method="GET"
              url={PETSTORE_ENDPOINTS.FIND_BY_STATUS}
              hint="Send it now and you get the same three pets every time, in a couple of milliseconds. Then switch this handler off in the panel and send again: the request leaves your browser and comes back with a few thousand pets that strangers created in the public sandbox, named things like “pet-64444”, after most of a second on the wire."
            >
              <p className="text-xs leading-relaxed text-stone-500">
                Same URL, same code, one toggle apart. The real answer is honest and useless for
                building a UI — you cannot write a screenshot test against it, and you certainly
                cannot ask it for an empty list. That is the whole argument for mocking, and it is
                the only place on this page where you can watch it happen.
              </p>
            </ApiCard>

            <ApiCard
              title="Get pet by id"
              badge="swagger · live doc"
              method="GET"
              url={`${PETSTORE_BASE}/pet/10`}
              hint="This handler was generated from the live OpenAPI document, not written by hand. It starts inactive, so right now the request reaches the real Petstore — which answers “Pet not found” for almost every id, because its data is wiped constantly. Activate it in the Swagger tab and you get a pet every time."
            />

            <p className="text-xs leading-relaxed text-stone-500">
              One detail worth noticing: the first card&apos;s endpoint also exists in the Petstore
              document, so the hand-written handler and the generated one merged into a single row
              in the panel. It carries both sets of responses, and the type selector switches
              between them.
            </p>

            <p className="text-xs leading-relaxed text-stone-500">
              How much a generated handler is worth depends entirely on the document behind it.
              Petstore declares response schemas, so its handlers arrive with sampled bodies; a
              document that declares none would still produce handlers, but with status codes and
              nothing else.{' '}
              <a
                href={PETSTORE_OPENAPI_URL}
                className="underline decoration-stone-300 hover:text-stone-800"
              >
                The spec
              </a>{' '}
              is public, so you can check what was generated against its source. It is listed in the
              panel&apos;s <strong>Swagger</strong> tab with its load status and handler count.
            </p>
          </Section>

          <Section
            step="07 · outside the panel"
            title="Handlers the panel does not manage"
            lede="onDemandHandlers are passed straight to MSW. They have no toggle and no variants, which is exactly what you want for GraphQL or always-on infrastructure routes."
          >
            <ApiCard
              title="GraphQL — query Me"
              badge="onDemand"
              method="POST"
              url={GRAPHQL_ENDPOINT}
              body={{ query: 'query Me { me { id name role } }' }}
              hint="Answered by an msw graphql.query handler. Look for it in the panel — it is not there, and it keeps working anyway."
            />
            <ApiCard
              title="Health check"
              badge="onDemand"
              method="GET"
              url={`${GRAPHQL_ENDPOINT}/health`}
              hint="Turn every handler in the panel off and send this again. It still answers."
            />
          </Section>

          <Section
            step="08 · scenarios"
            title="A scenario is a shape, not a setting"
            lede="Everything so far moved one endpoint at a time. A scenario moves a set of them together, and that set has a shape — which calls it covers and what each one answers. Every card below draws its own shape, built from the scenario itself rather than described alongside it."
          >
            <ScenarioWalkthrough />
            <ScenarioPresets />
            <ScenarioCreateGuide />
          </Section>
        </div>

        <section className="mt-12 rounded-lg border border-stone-200 bg-white p-4">
          <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">
            How this page is wired
          </p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600">
            Everything you just used comes from one component wrapped around the app, reading the
            handlers you already wrote.
          </p>
          <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-stone-700">
            {`import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';

<MockingGUIBoundary config={{ mocks: handlers }}>
  <App />
</MockingGUIBoundary>`}
          </pre>
        </section>

        <footer className="mt-14 border-t border-stone-200 pt-5 text-xs leading-relaxed text-stone-500">
          <p>
            Not shown here, because it needs a server: mock state also syncs to a cookie, so Next.js
            server components and SSR render against the same mocks the browser sees. See the{' '}
            <code className="font-mono text-stone-700">next-app-router</code> example.
          </p>
          <p className="mt-2">
            MIT licensed ·{' '}
            <a
              className="underline decoration-stone-300 hover:text-stone-800"
              href="https://github.com/kakaoenterprise/mocking-gui"
            >
              github.com/kakaoenterprise/mocking-gui
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
