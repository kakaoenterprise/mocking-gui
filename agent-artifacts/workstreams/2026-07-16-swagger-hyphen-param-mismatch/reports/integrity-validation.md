---
version: 1.0.0
name: 'Integrity Validation Report: Swagger kebab-case path param mismatch'
type: report
status: complete
run_id: 2026-07-16-swagger-hyphen-param-mismatch
date: 2026-07-16
owner: 'Testing Specialist (Claude)'
issue: 'https://github.com/kakaoenterprise/mocking-gui/issues/11'
---

# Integrity Validation Report

Scope of this fix (files that must pass the gate for issue #11):

- `packages/mocking-gui/src/utils/handler/pathParams.ts`
- `packages/mocking-gui/src/utils/handler/pathParams.test.ts` (new)
- `agent-artifacts/decisions/ADR-0005-normalize-kebab-case-path-params.md` (new)
- `agent-artifacts/decisions/INDEX.md` (ADR-0005 row only)
- `agent-artifacts/workstreams/2026-07-16-swagger-hyphen-param-mismatch/**` (new)

This report does **not** cover the unrelated, still-in-progress
onDemandHandlers precedence work (its own separate ADRs, pending its own
numbering once merged) also present in the working tree — that belongs to
workstream `2026-07-10-ondemand-handler-precedence` and is out of scope for
issue #11.

## 1. Type Safety

```
$ npx tsc --noEmit -p .
(no output — clean)
```

## 2. Lint

```
$ npx eslint .
✖ 3 problems (0 errors, 3 warnings)
```

All 3 warnings (`@typescript-eslint/no-explicit-any`) are in
`src/utils/browser/cookie.test.ts`, part of the unrelated pre-existing
working-tree state — zero errors/warnings in any file touched by this fix.

## 3. Unit Tests

```
$ npx vitest run
 Test Files  4 passed (4)
      Tests  46 passed (46)
```

Includes 8 tests in `pathParams.test.ts` (revised 2026-07-23 for the underscore
normalization — see ADR-0005 Revision note):

- brace-to-colon conversion for a simple param
- kebab-case param → underscore colon param (`{kubeflow-id}` → `:kubeflow_id`)
- multiple kebab-case params in one path
- already-safe camelCase param passes through unchanged
- already-safe snake_case param passes through unchanged
- trailing/leading separators produce no unsafe characters (`{-id-}` → `:_id_`)
- **end-to-end reproduction**: builds an MSW `http.delete()` handler from the
  normalized route and runs a real `Request` through `handler.run()`,
  asserting the exact symptom reported in issue #11
  (`DELETE /v1/kubeflows/{kubeflow-id}/groups/{group-name}`) is now matched
  and `params` are correctly extracted
- `generateNormalizedUrl` regression check (unaffected, as predicted in
  Phase 1 scope note)

## 4. Build

```
$ npm run build   # tsc && vite build
✓ 1555 modules transformed
✓ built in 2.54s
```

Declaration files (`vite:dts`) generated without error. No build regressions.

## 5. Manual/Local Verification

Built package pushed via `yalc push` and linked into the reporting consumer
project (`kc-console/kubeflow`) via `yalc add`, confirming the built
`dist/` reflects the fix (see workstream `phase2-implementation.md` for
detail). Live network-interception verification against the consumer's
staging endpoint was not re-run as part of this report; the automated
end-to-end test above is the authoritative regression guard going forward.

## Verdict

**PASS.** All quality gates (type-check, lint, test, build) are green for the
issue #11 fix.
