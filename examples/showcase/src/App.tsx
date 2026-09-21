import { ApiCard } from '@/components/ApiCard';
import { Hero } from '@/components/Hero';
import { ScenarioPresets } from '@/components/ScenarioPresets';
import { Section } from '@/components/Section';
import {
  BASE_ENDPOINT,
  ENDPOINTS,
  GRAPHQL_ENDPOINT,
  SWAGGER_SERVER_URL,
} from '@/mocks/constants/endpoints';

const HEADER_PRESETS: { label: string; value: Record<string, string> }[] = [
  { label: 'no headers → 401', value: {} },
  { label: 'authorization only → viewer', value: { Authorization: 'Bearer demo-token' } },
  {
    label: '+ x-demo-role: admin',
    value: { Authorization: 'Bearer demo-token', 'x-demo-role': 'admin' },
  },
];

const USER_URL = `${BASE_ENDPOINT}/users/u_1024`;
const SESSION_URL = `${BASE_ENDPOINT}/session/tenant_42`;

function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Hero />

        <div className="mt-10 space-y-12">
          <Section
            step="01 · response variants"
            title="One endpoint, every state it can return"
            lede="Open the API tab in the panel, find “Get user”, and switch its variant. Then send the request again. No rebuild, no code edit — the 404 and the 500 are one click away."
          >
            <ApiCard
              title="Get user"
              badge="manual"
              method="GET"
              url={USER_URL}
              hint="Seven variants, including a 429 that carries Retry-After and X-RateLimit-* headers — open “headers” below to check they arrived."
            />
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
            step="02 · dynamic handlers"
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
            step="03 · states you cannot reach"
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
            step="04 · not everything is json"
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
            step="05 · openapi import"
            title="Handlers nobody wrote by hand"
            lede="The Swagger tab in the panel imported an OpenAPI document at startup and generated these handlers from its response schemas. They start inactive — switch one on in the panel first, then send."
          >
            <ApiCard
              title="List projects"
              badge="swagger"
              method="GET"
              url={`${SWAGGER_SERVER_URL}/projects`}
              hint="Generated from the 200 and 403 schemas in the document. Until you activate it in the Swagger tab, this request passes through and fails."
            />
            <ApiCard
              title="Get project"
              badge="swagger"
              method="GET"
              url={`${SWAGGER_SERVER_URL}/projects/prj_31`}
              hint="The document declares this path as {project-id}. Hyphenated OpenAPI params are normalized on import — that is why this matches at all."
            />
          </Section>

          <Section
            step="06 · outside the panel"
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
            step="07 · scenarios"
            title="Send a bug report that reproduces itself"
            lede="A scenario is a named snapshot of several handlers at once. Copy a code below, open Scenarios → Import in the panel, paste it, and activate — the whole app moves to that state. This is what a teammate would paste into a ticket."
          >
            <ScenarioPresets />
            <p className="text-xs leading-relaxed text-stone-500">
              You can also build your own: switch a few handlers into an interesting combination,
              save it as a scenario, and use the panel&apos;s share button to get a code just like
              these.
            </p>
          </Section>
        </div>

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
