---
version: 1.0.0
name: 'Integrity Validation Report: Standalone mock server'
type: report
status: complete
run_id: 2026-11-19-standalone-mock-server
date: 2026-11-19
owner: 'Claude'
related_adr: ADR-0009-standalone-mock-server
---

# Integrity Validation Report

Scope: `createMockServer` under `src/api/standalone/`, exported from
`./experimental` only; `responseVariantsFn` allowed to be async, with the
existing Auto handler awaiting it; the `createMockServer` section in the API
guide.

Two kinds of results are kept apart below. Sections 1–5 were run on the code as
it is in this run. Section 6 holds the performance figures of the proof of
concept, which were taken while the same server code sat behind a separate
entry name. Section 5 is what ties the two together.

## 1. Lint and format

```
$ pnpm lint
@kakaocloud/mocking-gui:lint: > tsc --noEmit && tsc --noEmit -p tsconfig.test.json && eslint .
 Tasks:    4 successful, 4 total

$ pnpm format:check
All matched files use Prettier code style!
```

## 2. Unit tests

```
$ pnpm test
@kakaocloud/mocking-gui:test:  Test Files  35 passed (35)
@kakaocloud/mocking-gui:test:       Tests  317 passed (317)
```

New in this run:

- `src/api/standalone/__tests__/unit/` — 103 tests in 7 files: session value and isolation, control API, picks (`delay`, `after`, `times`), response functions and streaming, the `/s/<id>` path prefix, the health `root`, and the `node:http` bridge over real sockets
- `src/api/standalone/__tests__/types/mocks-input.types.test.ts` — 3 tests: a registry and a scenario declared with the scenario API, an `as const` collection, a plain `HandlerConfigOption[]`
- `src/utils/handler/convertToMsw.test.ts` — 1 test: the Auto handler awaits a resolver that reads the request body
- `src/__tests__/entries/experimental.surface.test.ts` — `createMockServer` added to the expected exports; the file runs without a DOM

## 3. Build

```
$ pnpm build
@kakaocloud/mocking-gui:build: ✓ built in 2.51s
next-app-router:build: ✓ Compiled successfully in 354ms
react-csr:build: ✓ built in 912ms
showcase:build: ✓ built in 928ms
 Tasks:    5 successful, 5 total
```

- `package.json` `exports`, `vite.config.ts` and `tsconfig.test.json` are unchanged.
- `dist/experimental.js` is 35.5 KB (gzip 11.0 KB); in 1.0.9 it is 4.0 KB. It now imports `msw` and the shared `convertToMsw` chunk.
- No `import` or `require` of a `node:` module is left in `dist/`. `listen()` reads `node:http` through `process.getBuiltinModule`.
- `react-csr` imports `./experimental` in browser code and builds with Vite without an externalization warning.

## 4. What the unit tests do not cover

- Swagger handlers: the server answers them with 501 `swagger_unsupported`
- `listen()` on a runtime other than Node.js 22.3 or later
- A consumer bundled with webpack 5 (the examples cover Vite and Next.js)

## 5. Consumer verification after the move

The build of this run was installed into app A (Next.js 16.4.4 App Router, 170
handlers, 66 scenarios, 145 Playwright tests) with yalc. App A's wiring: the API
base URL points at the mock server, and its Playwright fixture creates a session
per test through the control API. Machine: Apple M4 Max, 14 cores, 36 GB, Node
24.18.0.

| Check                                                   | Result                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Typecheck of app A, app B and their shared data package | pass                                                                              |
| Unit tests of the shared data package                   | 366 passed                                                                        |
| Unit tests of app A / app B                             | 6 351 passed / 9 196 passed                                                       |
| App B's test for an async `responseVariantsFn`          | passed without the patch app B applies to 1.0.9                                   |
| Mock server alone                                       | 1 000 concurrent requests over two sessions, none crossed; response median 1.5 ms |
| E2E on the worker path, 4 workers, dev server           | 138 passed, 7 failed — the same seven as before the move                          |
| E2E on the mock server path, 4 workers, dev server      | 138 passed, 7 failed — the same seven                                             |
| Production build of app A against the mock server       | `next build` succeeded; 40 SSR requests answered 200, 80 mock requests served     |
| JS a page receives on the worker path                   | 2 625 KB; 2 553 KB with 1.0.9. The 72 KB include app A's wiring for the new path  |

The seven failing tests fail on both paths and on 1.0.9. They belong to app A.

## 6. Proof-of-concept measurements

Taken on mocking-gui `016da2f` plus the server code of this run behind a
separate entry name, on app A and on the mock definitions of app B (402
handlers, 232 scenarios). Same machine as section 5. Dev server unless noted;
each E2E figure is one run.

| Metric                                                                 | Worker path                         | Mock server                |
| ---------------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| A tool sets up one screen state                                        | 1 561 ms (temp test file, 18 lines) | 3.3 ms (2 HTTP calls)      |
| APIs a page called, SSR included                                       | not observable                      | 2 HTTP calls, 3.3 ms       |
| Cookie that carries the mock state, app B all enabled                  | 3 806 bytes, 119 overrides dropped  | 25 bytes                   |
| List page complete, new browser context (median of 10)                 | 500.8 ms                            | 286.8 ms                   |
| List page complete, same context                                       | 443.4 ms                            | 212.2 ms                   |
| JS the page receives                                                   | 2 553 KB                            | 1 731 KB                   |
| Visible characters in the SSR HTML                                     | 35                                  | 1 342                      |
| Mock handling per SSR request (n = 300)                                | 1.8 ms app A, 4.5 ms app B          | 1.5 ms round trip          |
| E2E, 145 tests, 4 workers (load average 10.4 / 15.3)                   | 112.6 s                             | 92.4 s                     |
| E2E against a production build, 1 worker                               | not possible                        | 137 of 145 passed, 173.2 s |
| Capture: preparing the baseline state (median of 5)                    | 1 510 ms                            | 4 ms                       |
| Capture: one case without an error                                     | 2 113 ms                            | 1 854 ms                   |
| Capture: one case with a failing list API                              | 6 078 ms                            | 4 320 ms                   |
| Dev servers for 4 capture workers (about 2.7 GB of RSS each after E2E) | 4                                   | 1 (40 captures in 29.6 s)  |

The server's own cost:

| Metric                        | Value                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Response time (n = 300)       | median 1.5 ms, p95 1.8 ms                                                                  |
| Throughput at concurrency 100 | 9 733 requests per second                                                                  |
| Start (median of 5)           | 1 019 ms; 926 ms of it loads app A's TypeScript mock definitions, 49 ms creates the server |
| Heap after `listen()`         | 115.7 MB; 4.5 MB added by the server, the rest is the loaded definitions                   |
| One session                   | 1.48 ms to create, 4.3 KB of heap                                                          |

Findings that went against the expectation:

- The worker path also ran the 145 tests with 4 workers and the same result (324.3 s with 1 worker, 110.6 s with 4). Parallel E2E is not what the server adds; the 18% above is.
- The eight production-build failures come from app A: seven need its mock-only streaming route, one expects a behavior that exists only in mock mode.
- With the `/s/<id>` prefix, 12 test files that compare the exact request path stopped matching. The production-build run used the default session instead.
- An agent that got only the control API description produced five of five screen states (22 control calls, 386.5 s). The handler list of app A is 71 098 bytes and exceeded the agent tool's output limit.

## 7. Not verified

- Timings after the move. Section 5 checks that results are the same, not how long they take.
- App B connected to the server. Only its definitions were read.
- A full capture round, and the capture tool wired to the server.
- Repeated E2E runs. Each figure is a single run under a different machine load.
