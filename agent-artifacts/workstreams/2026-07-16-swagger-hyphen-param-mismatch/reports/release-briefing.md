---
version: 1.0.0
name: 'Swagger Kebab-Case Path Param Fix Release Briefing'
description: 'User-facing release briefing for the Swagger path-param normalization bug fix (issue #11): feature summary, user impact, migration/usage, verification results, and known limitations.'
---

# Release Briefing: Swagger Kebab-Case Path Param Fix

**Target**: Mocking GUI Users (Developers) using Swagger/OpenAPI import
**Release Scope**: Bug fix — `normalizePathParams` param-name sanitization
**Status**: ✅ **Ready for Release**
**Related Issue**: [#11](https://github.com/kakaoenterprise/mocking-gui/issues/11)
**Supporting Artifacts**: `executions/phase1-analysis.md`, `executions/phase2-implementation.md`, `reports/integrity-validation.md`, `agent-artifacts/decisions/ADR-0005-normalize-kebab-case-path-params.md`

---

## 1. Feature Summary

Fixed a silent bug where Swagger/OpenAPI-imported handlers whose path
template uses a **kebab-case path parameter** (e.g. `{kubeflow-id}`,
`{group-name}`) never intercepted real requests, even when shown as
**active** in the GUI with a valid response variant selected.

**Root cause**: `normalizePathParams` converted `{kubeflow-id}` directly to
`:kubeflow-id`. MSW compiles routes with `path-to-regexp`, which reads a
named parameter token only up to the first non-word character — a hyphen
ends the token early, so `:kubeflow-id` silently compiled to parameter
`kubeflow` + literal text `-id`, which never matches a real request path. No
error was thrown and no console warning appeared; the handler simply never
fired.

**Fix**: `normalizePathParams` now sanitizes each captured brace-param name
into a `path-to-regexp`-safe identifier before prefixing with `:` — every run
of unsafe characters is collapsed to an underscore (`{kubeflow-id}` →
`:kubeflow_id`). A single-line `replace` that also handles leading/trailing
separators.

---

## 2. User Impact (Breaking Changes)

**No API-level breaking changes** — no signature, config shape, or import
path changes.

**One-time local-state impact** for users whose imported OpenAPI spec uses
hyphenated (kebab-case) path parameters:

- Persisted `handlerConfigs` store keys for those handlers change (e.g.
  `delete...../v1/kubeflows/:kubeflow-id` → `delete...../v1/kubeflows/:kubeflow_id`).
- Handlers under the old key will appear as "new" entries after upgrading and
  default to inactive. **They must be re-activated once** in the Mocking GUI
  panel (toggle on + select a response variant) after upgrading.
- This is judged acceptable: the old key never actually worked — no
  previously-functioning mock is being broken.
- Users whose OpenAPI specs only use non-hyphenated params (`{id}`,
  `{kubeflowId}`, `{kubeflow_id}`) are unaffected entirely.

---

## 3. Migration / Usage Pointers

No code changes required. After upgrading:

1. Open the Mocking GUI panel.
2. For any Swagger-imported endpoint whose OpenAPI path used a hyphenated
   parameter, re-check that it is toggled active and has a response variant
   selected (it will show as inactive/unconfigured post-upgrade if it was
   previously "active" under the old, broken key).
3. No changes needed to `mocks`, `swagger`, or any other `MockingConfig`
   field.

- **Root cause analysis**: [`executions/phase1-analysis.md`](../executions/phase1-analysis.md)
- **Implementation detail**: [`executions/phase2-implementation.md`](../executions/phase2-implementation.md)
- **Design decision**: `agent-artifacts/decisions/ADR-0005-normalize-kebab-case-path-params.md`

---

## 4. Verification Results Summary

Full detail in [`reports/integrity-validation.md`](./integrity-validation.md).

| Item                   | Result                                                                                                                    |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| Type Check (`tsc`)     | ✅ Clean                                                                                                                  |
| Lint (`eslint`)        | ✅ 0 errors (0 warnings in changed files)                                                                                 |
| Unit Tests             | ✅ 46/46 passed (8 `pathParams` tests, including an end-to-end MSW request-matching reproduction of the reported symptom) |
| Build                  | ✅ Success                                                                                                                |
| Manual Verification    | ✅ Built package verified via local `yalc` link into the reporting consumer project                                       |
| Backward Compatibility | ✅ No API changes; one-time re-activation needed only for affected hyphenated-param handlers                              |

---

## 5. Known Limitations

- **Name collision (theoretical, undocumented-in-code)**: if an OpenAPI
  spec's single path template contained two differently-punctuated params
  that collide after underscore sanitization (e.g. `{group-name}` and
  `{group_name}` in the same path — an already-ambiguous/duplicate spec), the
  second would silently shadow the first. Not defended against; judged out of
  scope since such a spec is malformed regardless.
- **Underscore-separated params** (`{kubeflow_id}`) were already safe for
  `path-to-regexp` before this fix and remain unchanged in output.
- This fix does not address the unrelated, still-in-progress onDemandHandlers
  precedence workstream (`2026-07-10-ondemand-handler-precedence`) — that
  ships separately.

---

**Written By**: Release Manager (Claude)
**Date**: 2026-07-16
**Approved**: Pending final human review before merge
