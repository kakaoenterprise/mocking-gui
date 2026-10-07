---
version: 1.0.0
name: 'Implementation: showcase demo app + docs-site deployment'
type: execution
status: complete
run_id: 2026-09-21-showcase-demo
date: 2026-09-21
owner: 'Frontend Engineer (Claude)'
baseline: '@kakaocloud/mocking-gui v1.0.4 (f772d3f)'
branch: feat/showcase-demo
---

# Implementation Record

## Goal

One public page that demonstrates every capability of the library, hosted
somewhere it will not break, so it can be linked from a promotion post.

## Hosting decision

Three candidates were evaluated. Two were rejected on grounds that have nothing
to do with the code.

| Option                                  | Verdict                                                                                                                                                                                                                                                                                                                                           |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitHub Pages via `release-docs.yml`** | **Chosen.** The workflow already publishes `docs/.vitepress/dist`; VitePress copies `docs/public/` verbatim to the dist root, so the demo needs no new workflow, account, secret or domain. Bandwidth is unmetered and the site never sleeps.                                                                                                     |
| Vercel Hobby                            | Rejected. Hobby is non-commercial only, and Vercel defines commercial use to include "a paid employee or consultant writing the code" — which describes this project. An OSS-program application or a paid plan would be required.                                                                                                                |
| CodeSandbox / StackBlitz                | Rejected on a structural conflict: MSW needs to register a Service Worker, and both platforms' browser runtimes register their own at root scope. CodeSandbox's free tier is exactly the runtime that breaks (Browser Sandboxes); the runtime that works (Devbox VM) consumes credits and freezes when they run out — unusable for a public link. |

The consequence: **SSR cannot be demonstrated live**, because GitHub Pages is
static. The footer says so and points at the `next-app-router` example. A short
screen recording is the cheaper way to prove the cookie-sync path.

## What was built

`examples/showcase` — a separate app rather than an extension of `react-csr`,
which stays the minimal "how do I start" example the README advertises.

Mock data follows the mandated layer separation:

```
src/mocks/
  constants/endpoints.ts   a single non-routable origin, api.mocking-gui.demo
  factories/{user,report}  deterministic body builders
  handlers/                manual · dynamic · network · rawBody
  onDemand.ts              graphql.query + an always-on http handler
  config.ts                MockingConfig
  scenarios.ts             three shareable presets + the base64 encoder
  seedDefaults.ts          first-run activation (see below)
```

Coverage, by section of the page:

| #   | Section              | Capability                                                                     |
| :-- | :------------------- | :----------------------------------------------------------------------------- |
| 01  | Response variants    | `MANUAL`, 7 variants incl. 404/500/429, custom response headers                |
| 02  | Dynamic handlers     | `AUTO` via `responseVariantsFn` — query params, path params, request headers   |
| 03  | Hard-to-reach states | empty list, 206 partial, 410, 401, per-handler `delay`                         |
| 04  | Non-JSON responses   | all five working `rawBody` kinds: text, html, xml, formData, arrayBuffer       |
| 05  | OpenAPI import       | `SWAGGER` handlers generated from a self-hosted `openapi.json`                 |
| 06  | Outside the panel    | `onDemandHandlers` (GraphQL + health) — unaffected by every toggle             |
| 07  | Scenarios            | three presets, copyable as the same base64 code the panel's share button emits |

The origin `https://api.mocking-gui.demo` is deliberately non-routable: turning a
handler off produces a visible network failure, which is the clearest possible
proof that the mock was the only thing answering. The OpenAPI document is served
from the app's own `public/`, so nothing external can take the demo down.

A content-type-aware fetch hook (`useApiCall`) was needed — reading every
response as JSON would make the five `rawBody` kinds indistinguishable, which is
the entire point of section 04.

## Build wiring

```jsonc
// package.json
"demo:build": "pnpm mocking-gui:build && DEMO_BASE=/mocking-gui/demo/ DEMO_OUT=../../docs/public/demo pnpm --filter showcase build"
```

`vite.config.ts` reads `DEMO_BASE`/`DEMO_OUT`, so local `dev` and `build` are
untouched. `release-docs.yml` gained one step before the docs build.
`docs/public/demo/` is gitignored — it is a build artifact.

Two wiring bugs were found and fixed during the work:

1. **`demo:build` did not build the library first.** It calls `pnpm --filter`
   directly rather than going through turbo, so in CI the example would have
   compiled against a missing `dist`. Fixed by prefixing `pnpm mocking-gui:build`.
   Routing through turbo instead was rejected: the output lands outside the
   package, so turbo's cache cannot track it, and `DEMO_*` would need declaring
   as passthrough env.
2. **Service Worker path under a sub-path.** The worker script and the page must
   share a scope, and GitHub Pages cannot send `Service-Worker-Allowed`, so the
   scope cannot be widened. Solved with one line through the public API —
   `worker: { serviceWorker: { url: \`${import.meta.env.BASE_URL}mockServiceWorker.js\` } }`—
which resolves to`/`locally and`/mocking-gui/demo/` in the demo build. No
   library change was required.

## The first-run problem

Every GUI-managed handler is seeded `active: false`
(`utils/handler/core.ts` → `initialStoredHandlerVariants`), and
`HandlerConfigOption` has no field to override that. Verified empirically: on a
clean load, every request in sections 01–05 failed, while the
`onDemandHandlers` health check returned 200. A visitor's first click would have
been a wall of errors.

There is no public API for this, so `seedDefaults.ts` writes the library's
persisted state directly (`MOCKING_GUI_HANDLERS`, a zustand `persist` envelope)
and only when no state exists, so returning visitors keep their own settings.

This took two attempts. The first placed the seed call in `main.tsx`'s module
body, which does not work: ES module imports are evaluated before any statement
in the importing module, and the library creates its store — rehydrating from
localStorage — at module-evaluation time. The seed wrote _after_ the store had
already read empty storage, and `setupInitialState` then persisted all-inactive
configs over it.

The first fix relied on import order (`import './mocks/seedDefaults'` before
`import './bootstrap'`). `eslint --fix` promptly deleted the protective
`eslint-disable` directive as unused, leaving the ordering defended only by a
comment. The final version removes the dependency on ordering altogether:

```ts
import { seedDefaultMockState } from './mocks/seedDefaults';
seedDefaultMockState();
void import('./bootstrap'); // dynamic → provably evaluated after the seed
```

## Findings for the library

Uncovered while building against the real API. None of these block the demo.

1. **No way to ship a handler active by default.** _(highest value)_ This is
   what forced the seeding workaround above, and it blocks more than demos —
   onboarding a new project, and any agent- or Playwright-driven setup, need the
   same thing. A `defaultActive` field on `HandlerConfigOption`, or a public
   `applyMockState(configs)`, would resolve it.
2. **`rawBody.kind: 'binary'` is declared but not handled.** The union in
   `types/handler.ts` lists six kinds; `resolveRawBodyResponse` branches on five.
   A `binary` rawBody silently falls through to `HttpResponse.json`, so the
   caller gets JSON where they asked for bytes — no error, no warning. Either
   implement it or remove it from the union.
3. **`AUTO` handlers drop response headers.** `createAutoHandler` destructures
   `{ status, body, rawBody }` and never forwards `headers`, while `MANUAL` and
   `SWAGGER` do. An `AUTO` handler cannot return `Retry-After` or a custom
   content type. Inconsistent rather than documented.
4. **Scenario types are not exported.** The package exports three symbols
   (`HandlerConfigOption`, `MockingConfig`, `SwaggerSourceConfigOption`), so a
   consumer writing or generating scenario JSON — the format is just base64 of
   the `Scenario` object — has no type to write against. `scenarios.ts` mirrors
   the shape locally as a stand-in.
5. **Swagger path params normalize to snake_case.** `{project-id}` in the
   document became `:project_id`, not `:projectId`. Matching works; worth
   confirming this is the intent recorded in ADR-0008 and documenting it, since
   consumers must reference the normalized form when calling the endpoint.
6. **Cookie sync runs in CSR-only apps.** `setCookie` writes with `path=/` on
   every config change, though the cookie exists solely for SSR. On a shared
   origin such as `kakaoenterprise.github.io` it is visible to every sibling
   project. Harmless here; an opt-out would be correct.

Item 4 also means the promotion plan's "agent-drivable mock state" angle is real
but currently undocumented and untyped — the cookie and the scenario code are
the only external entry points, and neither is public API.

## Operational note

`vitepress preview` (sirv) caches its directory listing at startup, so files
added by a later build return 404 and the browser silently runs the previous
bundle. Roughly twenty minutes went into chasing a "seeding does not work"
symptom that was this. Restart the preview server after every rebuild;
`pkill -f "vitepress preview"` does not match it (`vitepress.js preview`) —
kill the PID holding port 4173.

---

# Addendum — real API, real spec, concrete scenarios (2026-09-22)

Before publishing, two things were upgraded: the OpenAPI import now points at a
**live public API**, and the scenario presets were rewritten as **five specific
jobs** rather than generic combinations.

## Live API

`https://petstore3.swagger.io/api/v3` — Swagger's own Petstore sandbox. Verified
before adopting it:

| Check                                    | Result                                                          |
| :--------------------------------------- | :-------------------------------------------------------------- |
| `GET /openapi.json`                      | `200`, `Access-Control-Allow-Origin: *`                         |
| `GET /pet/findByStatus?status=available` | `200`, real data, CORS open                                     |
| `GET /store/inventory`                   | **`500`** — broken on the public sandbox                        |
| `GET /pet/{id}`                          | **`404 "Pet not found"`**, plain text, for essentially every id |

The instability is the point rather than a problem — but it must not be able to
break the page, so two mitigations are in place:

1. **A second, self-hosted OpenAPI source is kept.** `useSwaggerHandlerSetup`
   catches per source, marks it `status: 'error'` with a message and continues,
   so a Petstore outage costs one greyed-out source in the Swagger tab and
   nothing else. Passing two sources also exercises the array form of `swagger`.
2. **The live endpoint is mocked by default.** A hand-written handler
   (`handlers/liveApi.ts`) sits on the real URL with deterministic variants, so
   the first thing a visitor sees always works. Reaching the real API is an
   explicit opt-in: switch that handler off.

That opt-in is the most valuable demonstration on the page, and the numbers are
worth keeping in the copy:

|               | Mock on                | Mock off (real API)        |
| :------------ | :--------------------- | :------------------------- |
| Pets returned | 3                      | **3,515**                  |
| Response time | ~2 ms                  | **777 ms**                 |
| Names         | Mochi, Pepper, Biscuit | `pet-64444`, `pet-7634`, … |

Same URL, same application code, one toggle apart.

### An emergent behaviour worth knowing

The hand-written `GET /pet/findByStatus` handler and the one generated from the
Petstore document **merge into a single row** in the panel —
`mergeHandlersWithSwagger` keys on method + url. The merged handler carries both
`responseVariants` and `swaggerResponseVariants`, and the type selector switches
between them. Handler counts confirm it: 12 hand-written + 19 Petstore + 2
self-hosted = 33, but the panel shows **32**. This was not designed for; it is
good behaviour, and the page now points it out.

The panel also groups rows by origin, showing `11 / 13 Active` and
`1 / 19 Active` as separate group headers.

## Scenarios

The three generic presets became five, each tied to a job a frontend engineer
actually has, and each carrying `useWhen` and an `expect` list so the page states
what will visibly change:

| Scenario                          | Use when                                  |
| :-------------------------------- | :---------------------------------------- |
| Payment provider is down          | Designing the retry path and error banner |
| Brand new account                 | Building first-run and empty states       |
| Session expired mid-session       | Working on the re-authentication flow     |
| Everything on a slow connection   | Reviewing skeletons and spinners          |
| Seat limit reached, card declined | Building the upgrade prompt               |

A `Session expired (401)` variant was added to the user handler so the third one
could pin two endpoints to 401 while a third stays healthy — the partial-failure
case that breaks redirect logic.

"Brand new account" includes the handler on the **real Petstore URL**, which was
the interesting thing to verify: a scenario can pin a live-API endpoint to an
empty array. It does, and that combination — every list empty at once, including
one backed by a real service — is exactly what a staging environment will never
give you.
