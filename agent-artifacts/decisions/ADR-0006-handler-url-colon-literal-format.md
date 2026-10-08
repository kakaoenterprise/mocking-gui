---
version: 1.0.0
name: 'ADR-0006: Handler URL format — colon after a non-slash is a literal; MSW escaping happens only at the MSW boundary'
type: adr
status: proposed
run_id: 2026-10-07-escaped-colon-handler-key
description: 'Define a library-owned handler url format so colon-action endpoints work without path-to-regexp escaping, and confine the `\:` escape to the single place urls are handed to MSW'
---

# ADR-0006: Handler URL format — colon after a non-slash is a literal; MSW escaping happens only at the MSW boundary

**Status**: Proposed
**Date**: 2026-10-09
**Deciders**: System Architect, Project Owner
**Affected Stakeholders**: Library users mocking colon-action APIs (Google AIP-136 / OpenAPI `{id}:action`), Swagger import users, Frontend Engineer, Testing Specialist
**Links**: `workstreams/2026-10-07-escaped-colon-handler-key/RUN.md`, upstream issue #44

---

## Context

### Background (Why?)

`path-to-regexp` 6 (the router MSW compiles routes with) reads every `:` as the start of a named parameter. A literal colon must be written `\:`. Two problems followed:

1. Users who wrote `…/:id:cancel` naturally got an exception at match time (`Must have text between two parameters`) that turned **every** request into a 500, because the throw happens inside handler lookup.
2. Users who followed the MSW rule and wrote `…/:id\:cancel` lost handlers anyway: `generateNormalizedUrl` parsed the url with `new URL`, whose WHATWG path state turns `\` into `/`, and then masked every `:`-prefixed segment as `:paramN`. `\:cancel`, `\:accept-pending` and `\:reject-pending` all became `:param2`, `mergeHandlersWithSwagger` deduplicated them by that key, and the merged-away actions vanished from both the panel and MSW registration. Wildcard urls (`*/…`) skipped `new URL` but were still collapsed by the whole-segment masking.

Swagger-imported paths (`/subscriptions/{id}:cancel` → `/subscriptions/:id:cancel`) hit problem 1 with no user-side escape hatch at all.

### Technical Evaluation Criteria

- Compatibility with MSW matching semantics and `params` extraction: high
- No side effects outside MSW (panel text, stored keys, scenarios, exports): high
- Backward compatibility with urls already written as `\:`: high
- Implementation complexity / no new dependencies: medium

---

## Decision

### Final Choice (What?)

**The handler url is a library-owned format: a `:` immediately after `/` starts a path parameter; any other `:` in the path is a literal.** `\:` is accepted as a legacy spelling of the same literal.

The format is interpreted in exactly two pure functions in `utils/handler/pathParams.ts`:

- `toMswPath(url)` escapes literal colons as `\:` (idempotent, origin/port untouched) and is applied **only** in `convertToMswHandler` where urls are passed to `http[method](...)`.
- `generateNormalizedUrl(url)` (handler-unique key) folds `\:` into `:`, then masks **parameter tokens only** (`:name`, optional pattern/modifier) as `:paramN`, leaving literal text in the segment intact.

Panel display, `getHandlerKey` (persisted config key), scenarios and Swagger conversion keep using the user's url verbatim.

### Rationale (Why this?)

1. **MSW-identical runtime**: the string MSW receives is exactly what a user would have hand-written with `\:`. Verified with msw 2.12.10: action matches, sibling action does not, `params` extracted, `*` prefix and `host:port` origins unaffected.
2. **No side effects**: escaping lives at the one boundary that needs it. Keys and persisted state never see a backslash, so no migration.
3. **Fixes Swagger too**: `normalizePathParams` output already is the library format, so colon-action OpenAPI paths stop throwing without further changes.
4. **One rule users can hold in their head**: "colon after a slash is a param" matches how AIP-136 and OpenAPI templates read.

---

## Consequences

✅ Colon-action handlers register, display and toggle independently; the "every request 500" outage class disappears for `mocks` and Swagger sources.
✅ Existing `\:` urls keep working and share keys with the plain spelling.
❌ A `:` in the middle of a segment can no longer denote a parameter. This was never usable through MSW without a preceding literal, so no working configuration is affected.
❌ MSW first-match ordering still applies: a plain `/:id` handler listed before `/:id:cancel` captures `s1:cancel`. Documented; automatic reordering is out of scope because it would change the `mocks` order contract.

| Risk                                               | Severity | Mitigation                                                                           |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| Users writing `\:` see the backslash in the panel  | Low      | Docs recommend the plain colon; behavior identical                                   |
| Future url features needing `new URL` on raw input | Low      | `generateNormalizedUrl` folds `\:` first; `splitOrigin` handles the non-URL fallback |

---

## Alternatives Considered

### A: Keep requiring `\:`, only preserve it in key normalization (v1 design)

❌ Not chosen — forces an MSW implementation detail onto users and shows `\:` in the panel; Swagger paths still throw.

### B: Tokenize keys with path-to-regexp `parse()`

❌ Not chosen — adds a direct dependency pinned to MSW's version and requires reproducing MSW's `coercePath` for `*`; the single-rule format is sufficient.

### C: Escape at store load time (persist the escaped url)

❌ Not chosen — leaks `\:` into panel text, stored keys and scenario exports.

---

## Related ADRs

- ADR-0005: Normalize kebab-case OpenAPI path params (same file; its output is the input format of this ADR)

## Implementation Notes

- Files: `utils/handler/pathParams.ts`, `utils/handler/convertToMsw.ts`, tests in `pathParams.test.ts`, `convertToMsw.test.ts`, `swagger/merge.test.ts`; docs `handler-guide.md#url-format`, `troubleshooting.md`; `HandlerConfigOption.url` JSDoc.
- Testing: unit tables for `toMswPath` / `generateNormalizedUrl`, merge-level dedupe tests, and MSW runtime tests through `convertToMswHandler` (manual, auto and swagger types).

## Decision Log

| Date       | Owner            | Action                                                                 | Result                |
| ---------- | ---------------- | ---------------------------------------------------------------------- | --------------------- |
| 2026-10-07 | System Architect | v1 design (preserve `\:`) drafted                                      | Superseded by v2      |
| 2026-10-09 | Project Owner    | Direction: no `\:` trick for users, library format + boundary escaping | Approved, implemented |
