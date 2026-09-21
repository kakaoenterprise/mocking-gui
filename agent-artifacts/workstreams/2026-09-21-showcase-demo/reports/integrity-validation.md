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
