# Shared Example Mocks

Mock data reused by every example. This is a **plain directory, not a workspace package** —
there is no `package.json` here, so nothing to version, build or install. Each example
reaches it through a path alias.

## Why not a package

A workspace package would add a `package.json`, a build/exports story and an entry in the
lockfile, all so two examples can share a few fixtures. A path alias gives the same reuse
with none of that, and the files stay plain TypeScript that a reader can follow straight
from the example that imports them.

## Wiring

Both examples map `@shared/*` to this directory:

- `examples/*/tsconfig.json` → `compilerOptions.paths` (TypeScript, and Next.js resolves
  from it directly — no `transpilePackages` needed)
- `examples/react-csr/vite.config.ts` → `resolve.alias` (Vite needs the bundler-side alias
  in addition to the tsconfig one)

One more piece: `@kakaocloud/mocking-gui` is listed in the **root** `package.json` so pnpm
links it at the workspace root. Without that, files in this directory cannot resolve the
library — it is only linked inside each example's own `node_modules`.

## Layout

Follows the project's 4-layer separation:

| Layer | Path | Holds |
| --- | --- | --- |
| Constants | `mocks/constants` | Endpoint URLs, role/feature tables |
| Factories | `mocks/factories` | `createUser`, `createOrder`, `createOrderPage`, error envelopes |
| Utils | `mocks/utils` | Request readers for path params, query string, bearer token |
| Handlers | `mocks/handlers` | `HandlerConfigOption` definitions composed from the above |

## What the handlers cover

| Handler | Method | Demonstrates |
| --- | --- | --- |
| Get User | `get` | Manual variants **and** an Auto function on one handler — switchable from the panel |
| Get User Report | `get` | `rawBody` as text, HTML, XML and CSV |
| Get User Avatar | `get` | `rawBody` as `arrayBuffer` (binary), plus a 204 variant |
| Get Session | `get` | Auto mode reading the `Authorization` header and cookies → 200 / 401 / 403 |
| List Orders | `get` | Auto pagination from `?page` & `?perPage`; Manual variants pin first/last/empty pages |
| Get Order | `get` | Path-param lookup with a 404 variant |
| Create Order | `post` | 201 with a `Location` header, 400 validation, 409 conflict |
| Replace Order | `put` | Full update, 403 variant |
| Update Order Status | `patch` | Partial update, 409 variant |
| Cancel Order | `delete` | 204 No Content — a success carrying no body |

## Adding a handler

1. Put fixed values in `constants/`, builders in `factories/`.
2. Define the handler in `handlers/`, then add it to `sharedHandlers` in `handlers/index.ts`.
3. Keep `method` + `url` unique — the engine keys handlers on that pair, so a duplicate
   silently replaces the earlier one.

## Two engine behaviours worth knowing

- `responseVariantsFn` (Auto mode) is invoked **synchronously**, so a handler cannot read
  the request *body*. Path params, query string, headers and cookies are all fine.
- Auto mode applies `status` and the body only; `headers` declared in the returned variant
  are not sent. Use Manual variants when the response headers matter.
