---
version: 1.0.0
name: 'Phase 2 Implementation: Swagger kebab-case path param mismatch'
type: execution
status: complete
run_id: 2026-07-16-swagger-hyphen-param-mismatch
date: 2026-07-16
owner: 'Frontend Engineer (Claude)'
---

# Phase 2 — Implementation

Per ADR-0005. Single-file fix, TDD.

## Changes

- `packages/mocking-gui/src/utils/handler/pathParams.ts`: `normalizePathParams`
  now sanitizes each captured `{param-name}` through `toSafeParamName`
  (collapses any non-`[a-zA-Z0-9_]` run to a single `_`) before prefixing with
  `:`. `{kubeflow-id}` → `:kubeflow_id`; `{id}`/`{kubeflowId}`/`{kubeflow_id}`
  unchanged. (Revised 2026-07-23 from the original camelCase conversion on code
  review — see ADR-0005 Revision note.)
- `packages/mocking-gui/src/utils/handler/pathParams.test.ts` (new): unit
  coverage for plain, kebab-case, multi-param paths, no-op on already-safe
  names, and one end-to-end assertion that MSW's `http.delete()` actually
  matches a real request through the normalized route (reproduces the exact
  symptom reported by the user and proves it's fixed).

## Verification

- `vitest run` (whole package on `bug/issue-11`): 46/46 passed (4 files),
  including the 8 `pathParams.test.ts` tests.
- `tsc --noEmit`: clean.
- `eslint` on changed files: clean.

## Not Changed

- `maskDynamicSegmentsIndexed`, `generateNormalizedUrl`: operate on
  already-`:`-prefixed segments; unaffected by param-name charset, covered by
  existing/added tests to confirm no regression.
- `convert.ts`, `convertToMsw.ts`, `merge.ts`: consume the now-sanitized URL
  as-is; no charset assumptions there to fix.

## Consumer-Side Action Required (kc-console/kubeflow)

Per ADR-0005 consequences: after upgrading, Swagger-derived handlers whose
OpenAPI path used kebab-case params get new `handlerConfigs` store keys
(`:kubeflow-id` → `:kubeflow_id` etc.). Their `active` state will reset to the
ADR-0006 default (`false`) since the old key's stored config no longer
matches. The user must re-activate affected handlers (e.g.
`DELETE /v1/kubeflows/{kubeflow-id}`, `.../groups/{group-name}`, and every
other kebab-case entry visible in their prior `handlerConfigs` dump) once in
the GUI panel after upgrading.
