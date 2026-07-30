---
version: 1.0.0
name: 'Phase 1 Analysis: Swagger kebab-case path param mismatch'
type: execution
status: complete
run_id: 2026-07-16-swagger-hyphen-param-mismatch
date: 2026-07-16
owner: 'System Architect (Claude)'
---

# Phase 1 — Root Cause Analysis

## Reported Symptom

Consumer project `kc-console/services/kubeflow` configures Swagger import
(`mogu.config.ts` → `swagger: [{ configUrl, serverUrl }]`). A Swagger-imported
`DELETE /v1/kubeflows/{kubeflow-id}` handler is shown as `active: true` with a
selected variant (`"ok"`) in the persisted handler store, yet the real request
`DELETE https://.../v1/kubeflows/a1f0c3d2-0001-4b2a-9c1e-1a2b3c4d0001` is not
intercepted — it reaches the real network with no console warning
(`onUnhandledRequest: 'bypass'`).

A manually-authored (non-Swagger) `GET /v1/kubeflows/:kubeflowId` handler,
using camelCase, works correctly for the same base path.

## Investigation Timeline (this session)

1. Ruled out: missing/unregistered handler config — confirmed present, active,
   variant selected (user-provided `localStorage` dump).
2. Ruled out: registration-time filtering (`isHandlerRegistrable`, introduced
   by the separate in-progress `2026-07-10-ondemand-handler-precedence`
   workstream) — config satisfies all conditions for `HandlerType.SWAGGER`.
3. Ruled out: precedence/ordering (`composeHandlerLayers`, same in-progress
   workstream) — no onDemand handler competes for this route.
4. Ruled out: method-case handling (`http[method]`) — OpenAPI `paths` keys are
   already lowercase; `httpMethod` cast in `convert.ts:66` is a passthrough,
   not a transform.
5. **Confirmed via direct reproduction** using the exact `path-to-regexp@6.3.0`
   version resolved by `msw@2.12.10` in this repo's lockfile:

   ```js
   const { match } = require('path-to-regexp');
   match('/v1/kubeflows/:kubeflow-id')('/v1/kubeflows/a1f0c3d2-0001-4b2a-9c1e-1a2b3c4d0001');
   // => false

   match('/v1/kubeflows/:kubeflowId')('/v1/kubeflows/a1f0c3d2-0001-4b2a-9c1e-1a2b3c4d0001');
   // => { params: { kubeflowId: '...' }, ... }
   ```

## Root Cause

`path-to-regexp` (used internally by `msw`'s `http.<method>()` for route
compilation) terminates a named parameter token at the first non-word
character. A hyphen is not a word character, so `:kubeflow-id` does not
compile to a single parameter named `kubeflow-id` — it compiles to parameter
`kubeflow` followed by the **literal string** `-id`, which will essentially
never appear at that position in a real request path.

`normalizePathParams` (`packages/mocking-gui/src/utils/handler/pathParams.ts:5-8`)
performs a naive brace-to-colon substitution and does not sanitize the
parameter name:

```ts
export const normalizePathParams = (path: string) => {
  if (!path) return path;
  return path.replace(/\{([^}]+)\}/g, ':$1');
};
```

Any OpenAPI spec using kebab-case path parameters (a common convention,
including this consumer's spec: `{kubeflow-id}`, `{group-name}`,
`{aggregation-path}`, `{flavor-id}`, `{cluster-name}`, `{email}`,
`{namespace-id}`, `{project-cluster}` when hyphenated) produces a Swagger
handler whose MSW route can **never** match the real request. This affects
every Swagger-imported handler in the consumer's store keyed with a
hyphenated `:xxx-yyy` segment — confirmed present in dozens of entries in the
user-supplied `handlerConfigs` dump (e.g. `:kubeflow-id`, `:group-name`,
`:aggregation-path`, `:flavor-id`, `:cluster-name`, `:project-cluster`,
`:project-id`).

Manually-authored handlers (`HandlerType.MANUAL`/`AUTO`) are unaffected
because developers write camelCase params (`:kubeflowId`) by convention —
this is why the user's manually-written `GET /v1/kubeflows/:kubeflowId`
worked while every Swagger-derived sibling silently failed.

## Prior-PR Check (user recollection)

The user recalled fixing "similar code" in a previous PR. Verified across all
local and remote branches/tags/reflog:

```
git log --all --oneline -- packages/mocking-gui/src/utils/handler/pathParams.ts
=> 2719a1a feat(core): initialize library core for public transition   (only commit, ever)

git log --all --oneline -S"replace(/-" -- packages/mocking-gui/src
=> (no results)

grep -rl "kebab|hyphen|path-to-regexp" agent-artifacts/
=> (no results)
```

**Conclusion: no such fix was ever merged, drafted as an ADR, or referenced in
any prior workstream/decision doc in this repository.** `pathParams.ts` has
had exactly one commit since the library's public-transition initialization.
The user's recollection likely refers to work done in a different repo/branch
that was never carried over here, or a fix that was proposed and lost (e.g. in
an unpushed local stash — also checked, `git stash list` is empty). Treating
this as a net-new defect, not a regression.

## Scope of Fix

Single point of change: `normalizePathParams` must convert each captured
brace-param name to a `path-to-regexp`-safe identifier (letters, digits,
underscore) before prefixing with `:`.

> **Note (2026-07-23)**: this analysis originally recommended camelCase
> conversion. Code review changed the chosen format to underscore replacement
> (`:kubeflow_id`); see ADR-0005. This does not affect the defect analysis
> above, only the identifier format used by the fix.

Not in scope: `maskDynamicSegmentsIndexed` (already operates on `:`-prefixed
segments post-normalization and is unaffected by the param-name charset),
`convert.ts` handler generation logic (charset-agnostic), and any handler
matching logic in `convertToMsw.ts` (operates on already-normalized URLs).
