---
version: 1.0.0
name: 'ADR-0009: Standalone mock server with per-session state (experimental)'
type: adr
status: proposed
run_id: 2026-11-19-standalone-mock-server
description: 'Add a mock server that runs outside the host app, keeps the mock state per session id and is driven over HTTP; ship it only from ./experimental'
---

# ADR-0009: Standalone mock server with per-session state (experimental)

**Status**: Proposed
**Date**: 2026-11-19
**Deciders**: Project Owner, reviewers of the pull request that introduces this ADR
**Affected Stakeholders**: Library users who run E2E tests, capture tools or AI agents against a mocked app; Release Manager
**Links**: `agent-artifacts/workstreams/2026-11-19-standalone-mock-server/spec.md` · ADR-0001 · ADR-0007 · ADR-0008

---

## Context

### Background (Why?)

The mock state lives in the browser. The panel persists it in localStorage, the worker answers browser requests from it, and ADR-0001 mirrors it to the server through the `mocking_gui_sync` cookie so that `setupMockingServer` can rebuild the handlers for each SSR request. ADR-0008 bounded that cookie and recorded a "server-side store keyed by a session-id cookie" as a separate candidate. Inside the host app it was rejected: it needs a route there, loses its state on HMR and exists once per worker process.

The mocks now have consumers this model was not built for: test runners with parallel workers, capture tools that walk through hundreds of screen states, and AI agents that set up a state and inspect what the app requested. The points below were measured on a Next.js 16 App Router app with 170 handlers, 66 scenarios and 145 Playwright tests (app A) and on the mock definitions of a second app with 402 handlers (app B). Conditions are in the run's `reports/integrity-validation.md`.

1. **The state has no address outside one browser.** A tool that is not that browser can neither set nor read it. Producing one screen state took a throwaway test file of 18 lines and a test-runner start: 1 561 ms (median of 3). Which APIs the server called while rendering a page cannot be observed from outside.
2. **The cookie is still a budget.** With all 402 handlers of app B enabled, 119 overrides are dropped to stay under 3 800 bytes.
3. **A production build cannot be verified with mocks.** The quick start has an app enable the worker, the panel and the in-process server only under `NODE_ENV === 'development'`, so a production build carries none of them. "Build output with a mocked API" is not a configuration that exists.
4. **Server-side state is one per process.** `setupMockingServer` applies the cookie of the current request to a process-wide MSW server. Parallel requests with different states worked in practice (1 280 concurrent requests, none crossed), but a unit experiment that awaits between applying the state and answering crossed 190 of 400 responses. Nothing in the structure prevents it.
5. **The page waits for the worker.** `MockingGUIBoundary` renders its children only after the worker is ready, so the SSR HTML of a list page carried 35 visible characters and the page was complete after 500.8 ms (median of 10, dev server).
6. **A handler cannot stream.** It answers with a variant object, so a streaming or file response needs a route in the host app.

### Technical Evaluation Criteria

- Mock state addressable by tools other than the browser: **Critical**
- Works with a production build of the host app that carries no mock code: **Critical**
- Reuses existing `mocks` and scenarios unchanged: High
- No change to the worker and `setupMockingServer` paths: High
- Follows the staging policy of ADR-0007: High

---

## Decision

### Final Choice (What?)

**Add `createMockServer`: an HTTP server that runs outside the host app, keeps the mock state per session id and is driven over HTTP. Ship it only from `@kakaocloud/mocking-gui/experimental`.**

- The server takes `mocks` and `scenarios` as they are. The host app points its API base URL at the server and carries no mock code.
- A session is one isolated state: the configs of a scenario plus the picks laid over them. The session id is read from the `x-mogu-session` header, then a `/s/<id>` path prefix, then the `mogu_session` cookie, then the `default` session when `defaultScenario` is set.
- The control API under `/__mogu` creates, copies and deletes sessions, switches the scenario, adds picks (`variant`, `auto`, an inline `response`, `fail`, with `delay`, `after` and `times`), returns the request log and waits for requests.
- A request that no enabled mock answers gets a 501 with the reason and the nearest handler names. Nothing is passed through to a real backend.
- The core is `handle(request: Request): Promise<Response>`. `listen()` is a Node adapter that gets `node:http` through `process.getBuiltinModule`, because browser bundles load the same entry.
- A handler may add `respond(request, { params })`, which returns a web `Response`. `responseVariantsFn` may be async on every path.
- The implementation lives in `src/api/standalone/` and is exported from `src/experimental.ts` only (ADR-0007 rule 2). The worker path and `setupMockingServer` keep working as they do today.

### Rationale (Why this?)

1. **A process outside the host app removes the objections ADR-0008 recorded.** There is no route in the host app, no state lost on HMR, and one store for every worker process.
   - Evidence: 1 000 concurrent requests over two sessions, none crossed. One dev server served four capture workers (40 captures in 29.6 s); the capture tool had been running one dev server per worker because the cookie model gives no isolation guarantee.
2. **HTTP is the one interface every consumer already has.** A Playwright fixture, a shell script and an agent use the same calls.
   - Evidence: one screen state in 3.3 ms with two calls (was 1 561 ms). An agent that was given only the description of the control API produced five of five requested screen states without reading the source.
3. **Moving the mocks out of the app makes the production build testable and takes the worker out of the page.**
   - Evidence: 137 of 145 E2E tests passed against the production build; the eight failures depend on mock-only code of app A. On the dev server the list page was complete in 286.8 ms instead of 500.8 ms, received 32% less JS, and its SSR HTML carried 1 342 visible characters instead of 35.
4. **Existing definitions keep their behavior.** The server builds each answer with the converters the worker uses, so `rawBody`, headers and delay follow the same rules.
   - Evidence: the 145 E2E tests of app A gave the same pass/fail list on both paths without a change to a test file.

### Alternatives Considered

| Option                                                   | Why not                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Session store inside the host app (ADR-0008's candidate) | Needs a route in the host app, state lost on HMR, one store per worker process                       |
| Keep the cookie sync and raise the header limit          | Gives tools no address for the state and does nothing for production builds                          |
| Intercept in the test runner (`page.route`)              | Covers browser requests only; SSR requests still need a second mechanism                             |
| A new stable subpath (`./standalone`) right away         | ADR-0007: pre-release features are exported only from `./experimental`                               |
| A separate package                                       | Doubles the release work before the API is settled. It stays an option for the graduation, see below |

---

## Consequences

### Positive Effects (Pros)

- Tests, capture workers and agents share one server without sharing state
- On this path the cookie carries only the session id (25 bytes)
- A production build can be exercised with mocks
- A streaming or file response is mocked by the handler itself

### Negative Effects (Cons)

- `dist/experimental.js` grows from 4.0 KB to 35.5 KB and imports `msw`. Browser bundles that use the scenario API load it
- A second way to serve mocks exists beside the worker and `setupMockingServer`
- The control API has no authentication and CORS allows any origin
- Swagger handlers are not served, and the panel cannot drive a session

### Mitigations

| Risk                               | Severity | Mitigation Strategy                                                                                                                                       |
| ---------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server code inside browser bundles | Medium   | The module graph has no Node import (`process.getBuiltinModule`). Whether Node-only pre-release features get their own entry is decided before graduation |
| Control API reachable by others    | Medium   | `listen()` binds 127.0.0.1 by default; the docs limit the server to local development and tests                                                           |
| The two paths drift apart          | Medium   | Answers are built by the existing converters, and a type test keeps `mocks` accepting what `MockingConfig.mocks` accepts                                  |

### Open Questions (to settle before graduation)

- Where it graduates to: `./standalone`, another subpath name, or a separate package
- The names `/__mogu`, `x-mogu-session` and `mogu_session` against the `mocking_gui_*` names used elsewhere
- Whether the worker path stays for manual use or the panel attaches to the server
- Swagger handlers, a command-line entry and session expiry
