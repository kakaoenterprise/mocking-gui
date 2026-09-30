---
version: 1.0.0
name: 'Integrity Validation: showcase demo'
type: report
status: pass
run_id: 2026-09-21-showcase-demo
date: 2026-09-21
owner: 'Testing Specialist (Claude)'
---

# Integrity Validation

Verified against the **production build served at its real deployment sub-path**
(`vitepress preview` → `http://localhost:4173/mocking-gui/demo/`), not the dev
server, so Service Worker scope and asset base paths are exercised as they will
be on GitHub Pages. Driven through a real Chromium instance.

## Quality gate

| Command                                               | Result                                                                                             |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                           | 4/4 tasks pass, **0 errors** (3 pre-existing `no-explicit-any` warnings in the library, untouched) |
| `pnpm --filter @kakaocloud/mocking-gui test -- --run` | **46 passed**, 4 files                                                                             |
| `pnpm build`                                          | **5/5 tasks pass** (library, docs, both prior examples, `showcase`)                                |

TypeScript is strict with no `any` in the new code. Three errors surfaced on the
first build and were fixed: `vite/client` types missing for `import.meta.env`,
and a literal-union widening issue in the header presets (`satisfies` checks but
does not widen — an explicit annotation was needed).

## Deployment plumbing

| Check                            | Result                                                                                                        |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Demo lands in the docs bundle    | `docs/.vitepress/dist/demo/` — index.html, assets, `mockServiceWorker.js`, `openapi.json`                     |
| `mockServiceWorker.js` MIME type | `200 text/javascript`                                                                                         |
| `openapi.json` reachable         | `200 application/json`                                                                                        |
| Service Worker scope             | `http://localhost:4173/mocking-gui/demo/` — scoped to the sub-path, no `Service-Worker-Allowed` header needed |
| Page errors                      | none                                                                                                          |
| Cards rendered                   | 15                                                                                                            |

## First-run behaviour

Measured after `localStorage.clear()` + unregistering all Service Workers.

| Check                   | Before seeding                                      | After seeding                                           |
| :---------------------- | :-------------------------------------------------- | :------------------------------------------------------ |
| Handlers active on load | **0 / 13** — every request in sections 01–05 failed | **11 / 13** (the 2 Swagger handlers stay off by design) |
| First click on the page | network failure                                     | mocked response                                         |

## Response matrix

All fourteen probes issued from the live page.

| Capability                  | Request                                | Result                                                                           |
| :-------------------------- | :------------------------------------- | :------------------------------------------------------------------------------- |
| `MANUAL`                    | `GET /v1/users/u_1024`                 | `200 application/json`, role `viewer`                                            |
| `AUTO` query params         | `GET /v1/search?q=m&page=1&pageSize=2` | `200`, `total: 3`, `hasNext: true`                                               |
| `AUTO` no match             | `GET /v1/search?q=zzz`                 | `404 NO_RESULTS`                                                                 |
| `AUTO` header absent        | `GET /v1/session/tenant_42`            | `401 NO_TOKEN`                                                                   |
| `AUTO` header + path param  | same + `x-demo-role: admin`            | `200`, `tenantId: tenant_42`, role `admin`                                       |
| `MANUAL` POST               | `POST /v1/checkout`                    | `201`, `orderId: ord_5512`                                                       |
| `rawBody` text              | `GET /v1/reports/export.csv`           | `200 text/plain`, CSV rows intact                                                |
| `rawBody` html              | `GET /v1/reports/invoice.html`         | `200 text/html`, markup not stringified                                          |
| `rawBody` xml               | `GET /v1/reports/feed.xml`             | `200 text/xml`                                                                   |
| `rawBody` formData          | `POST /v1/reports/upload`              | `201 multipart/form-data`, entries parse back                                    |
| `rawBody` arrayBuffer       | `GET /v1/reports/archive.bin`          | `200 application/octet-stream`, bytes **`4D 4F 43 4B 00 01 02 03`** — byte-exact |
| `onDemandHandlers` GraphQL  | `POST /graphql` `query Me`             | `200`, `data.me.role: editor`                                                    |
| `onDemandHandlers` http     | `GET /graphql/health`                  | `200`, unaffected by panel state                                                 |
| `SWAGGER` before activation | `GET /v2/projects`                     | passthrough → network failure (intended)                                         |

`text/xml` differs from the `application/xml` the card text originally claimed;
the copy was corrected to match observed behaviour rather than the reverse.

## GUI → response loop

Driven by clicking the real panel (rendered inside a Shadow DOM), then issuing
the request from the page.

| Action in the panel          | Observed                                                                                          |
| :--------------------------- | :------------------------------------------------------------------------------------------------ |
| Panel opens                  | 4 tabs, `13 APIs`, `11 / 13 Active`, one row per handler                                          |
| Variant dropdown, "Get user" | all 7 variants listed with status codes                                                           |
| Select `429 Rate limited`    | response `429` with `Retry-After: 30` and `X-RateLimit-Remaining: 0` — **custom headers survive** |
| Set delay to `1200` ms       | stored `delay: 1200`; measured round trip **1203 ms**                                             |
| Toggle handler off           | `active: false`, request passes through to the real network and fails                             |
| Toggle back on               | `429` again                                                                                       |
| Enable a Swagger handler     | `200` with `items[0].id: prj_31`, `total: 2` — generated from the OpenAPI `example` values        |

Radix-style tabs and buttons in the panel do not respond to a bare
`.click()`; a full `pointerdown → mousedown → pointerup → mouseup → click`
sequence is required. Relevant to anyone automating this panel — including
agent-driven E2E.

## Scenario round trip

| Step                                                            | Result                                         |
| :-------------------------------------------------------------- | :--------------------------------------------- |
| Paste a 680-char base64 scenario code into _Scenarios → Import_ | accepted                                       |
| Confirm                                                         | saved as "Payment provider outage", 3 handlers |
| Apply                                                           | `activeScenarioId: demo-payment-outage`        |
| `POST /v1/checkout`                                             | `503` with `Retry-After: 120`                  |
| `GET /v1/dashboard/stats`                                       | `206` with `degraded: ["p95LatencyMs"]`        |

One paste moved three handlers at once, which is the workflow the presets on the
page are meant to advertise.

## Not verified here

- **SSR cookie sync.** Needs a Node host; GitHub Pages cannot serve it. Covered by the `next-app-router` example, and the demo footer says so.
- **Cross-browser.** Chromium only. Safari and Firefox Service Worker behaviour on a sub-path should be checked before the link is promoted publicly.
- **Scenario export to file and JSON upload import.** Only the code path was exercised.

---

# Addendum — live API and rewritten scenarios (2026-09-22)

Quality gate re-run after the changes: **lint 4/4 (0 errors) · 46 tests passed ·
build 5/5**.

## Live OpenAPI source

| Check                                                 | Result                                                                                             |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| Petstore document loaded in-browser at startup        | **19 handlers generated**                                                                          |
| Handler keys                                          | `get.https://petstore3.swagger.io/api/v3/pet/findByStatus`, `…/pet/:petId`, `…/store/inventory`, … |
| Panel grouping                                        | two origin groups — `11 / 13 Active` and `1 / 19 Active`                                           |
| Merge with the hand-written handler on the same route | confirmed: 12 + 19 + 2 = 33 defined, **32** rows                                                   |

## Mock ↔ real API toggle

| Phase                     | Status | Count                                | Time       |
| :------------------------ | :----- | :----------------------------------- | :--------- |
| Handler on (mocked)       | `200`  | 3 pets — Mochi, Pepper, Biscuit      | ~2 ms      |
| Handler off (passthrough) | `200`  | **3,515 pets** from the live sandbox | **777 ms** |
| Handler on again          | `200`  | back to the same 3                   | ~2 ms      |

This is the first verification in this workstream where `passthrough()` reaches
a real service rather than failing at DNS.

## Scenario driving a live-URL handler

Imported the "Brand new account" code (788 chars) through the panel and applied it:

| Endpoint                          | After applying                         |
| :-------------------------------- | :------------------------------------- |
| `activeScenarioId`                | `demo-first-run`                       |
| Notifications                     | `items: 0`, `unreadCount: 0`           |
| Export CSV                        | 1 line — header row only               |
| **Find pets (real Petstore URL)** | **`[]`** — variant pinned to `No pets` |
| User                              | `role: viewer`                         |

Four handlers moved from one paste, including the one on a real API.

## UI fix found by looking at the screenshot

Scenario card headers used `flex-wrap`, so a long `Use when:` line pushed the
copy button onto its own row on 2 of 5 cards. Changed to a non-wrapping header
with `flex-1 min-w-0` on the text block; the button now stays right-aligned on
every card. Verified visually after the fix.

## Still not verified

- Cross-browser (Chromium only).
- Behaviour when the Petstore sandbox is fully down — the error path is read from source (`useSwaggerHandlerSetup` catches per source) but was not reproduced, since the sandbox was up throughout.

---

# Addendum — Service Worker scope bug (2026-09-30)

Reported from the preview build: every request failed with `Failed to fetch`
while the page, the panel and the console all looked healthy.

## Root cause

The page had been opened at `/mocking-gui/demo` — **without the trailing
slash**. The worker registers at `<base>mockServiceWorker.js`, so its scope is
`/mocking-gui/demo/`, and scope is a plain path-prefix match. `/mocking-gui/demo`
is one character outside it, so the client was never claimed.

Evidence, same build, two URLs:

| URL                  | registration                          | `navigator.serviceWorker.controller` | request           |
| :------------------- | :------------------------------------ | :----------------------------------- | :---------------- |
| `/mocking-gui/demo`  | activated, scope `/mocking-gui/demo/` | **null**                             | `Failed to fetch` |
| `/mocking-gui/demo/` | activated, same scope                 | controlled                           | `200`             |

MSW diagnosed it correctly in the console —
`[MSW] Cannot intercept requests on this page because it's outside of the
worker's scope` — and then logged `Mocking enabled` anyway. `MockingGUIBoundary`
also resolved `isMockingReady` and lifted the loading screen, so nothing in the
UI reflected that no interception would happen.

`vitepress preview` (sirv) serves the slash-less path with `200` and no redirect,
which is what allowed landing there. **Production is not affected**: GitHub Pages
answers the same shape of request with a `301` to the slashed form, verified
against the live docs site (`/mocking-gui/guide` → `301` →
`/mocking-gui/guide/`).

## Fixes

1. **Canonicalise the path before anything loads** (`src/main.tsx`). If the
   pathname equals the base without its trailing slash, `location.replace()` to
   the base. This removes the dependency on the host issuing the redirect.
2. **Corrected misleading copy** (`ApiCard.tsx`). The failure message asserted
   "this is what a disabled handler looks like", which is what sent the reader
   looking in the wrong place. It now states what happened, gives the likely
   cause without claiming it, and points at the banner.
3. **Surfaced the condition** (`ScopeWarning.tsx`). `controller === null` after
   startup now renders a banner above the page instead of leaving the only
   honest signal in the console.

## Verification

| Case                     | Expected                           | Result                                                                                                                                               |
| :----------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open `/mocking-gui/demo` | redirected, controlled, mocks work | lands on `/mocking-gui/demo/`, controlled, manual/rawBody/live-url all `200`                                                                         |
| Healthy page             | no banner                          | `bannerShown: false`                                                                                                                                 |
| **Forced out-of-scope**  | banner appears                     | worker moved to `<base>sw/` by a temporary source change and rebuild: scope `…/demo/sw/`, `controller: null`, **`bannerShown: true`**, request `ERR` |

The out-of-scope case was reproduced properly rather than assumed. A first
attempt patched the built bundle in place, which the browser ignored because the
filename — and therefore the cache key — had not changed; rebuilding from source
produced new hashes and a valid test. The temporary change was reverted and
`git diff` confirmed clean before committing.

Gate after the fix: lint 4/4 (0 errors) · 46 tests · build 5/5.
