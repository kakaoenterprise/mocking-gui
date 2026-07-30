---
version: 1.1.0
name: 'ADR-0005: Normalize kebab-case OpenAPI path params to underscore identifiers'
type: adr
status: proposed
run_id: 2026-07-16-swagger-hyphen-param-mismatch
description: 'normalizePathParams must sanitize brace-param names into path-to-regexp-safe identifiers, since hyphenated names silently never match at request time'
---

# ADR-0005: Normalize kebab-case OpenAPI path params to underscore identifiers

**Status**: Proposed
**Date**: 2026-07-16 (revised 2026-07-23)
**Deciders**: System Architect, Project Owner (code review)
**Affected Stakeholders**: Frontend Engineer, Testing Specialist, library users importing kebab-case OpenAPI specs
**Links**: `workstreams/2026-07-16-swagger-hyphen-param-mismatch/executions/phase1-analysis.md`

---

## Context

### Background (Why?)

`normalizePathParams` (`utils/handler/pathParams.ts`) converts OpenAPI
`{param}` path templates to MSW's `:param` syntax via a direct string
substitution, without validating or sanitizing the captured parameter name.

OpenAPI specs commonly use kebab-case parameter names (`{kubeflow-id}`,
`{group-name}`). `path-to-regexp` (which `msw`'s `http.<method>()` compiles
routes with) reads a named parameter token only up to the first non-word
character. A hyphen ends the token early, so `:kubeflow-id` is compiled as
parameter `kubeflow` followed by the **literal** text `-id` — which never
appears in a real request path. The handler is registered successfully (no
thrown error, no lint/type failure) but can **never** match an incoming
request, so it silently falls through to the real network. This reproduced
concretely: `match('/v1/kubeflows/:kubeflow-id')('/v1/kubeflows/<uuid>')` →
`false` under `path-to-regexp@6.3.0` (the version resolved by this repo's
`msw@2.12.10`).

This is a silent correctness defect: the GUI shows the handler as
active/configured, which contradicts the actual runtime behavior. It is a
strictly worse failure mode than an inactive handler, because there the GUI
truthfully reflects "off"; here the GUI shows "on" while the route never
fires.

### Technical Evaluation Criteria

- Requests actually get intercepted for any valid OpenAPI param naming
  convention: **Critical**
- No behavior change for existing camelCase/snake_case params: **Critical**
- No change to persisted handler-key format beyond what's needed
  (`getHandlerKey`/`getHandlerUniqueKey` embed the URL, so a param-name change
  changes the store key — acceptable, treated as a one-time re-import): Medium
- Minimal, localized change: High

---

## Decision

### Final Choice (What?)

`normalizePathParams` converts each `{param-name}` to `:param_name` — every run
of `path-to-regexp`-unsafe characters inside the captured name is collapsed to a
single underscore (`_` is a word character, so it stays inside the compiled
param token):

```ts
export const normalizePathParams = (path: string) => {
  if (!path) return path;
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => `:${toSafeParamName(name)}`);
};

const toSafeParamName = (name: string) => name.replace(/[^a-zA-Z0-9_]+/g, '_');
```

> **Revision (2026-07-23)** — This ADR originally proposed camelCase conversion
> (`{kubeflow-id}` → `:kubeflowId`). Code review on branch `bug/issue-11`
> changed the choice to underscore replacement (`:kubeflow_id`) before this ADR
> was accepted. The Context (the underlying defect) is unchanged; only the
> chosen identifier format changed. camelCase is retained below as a considered
> alternative.

### Rationale (Why this?)

1. **Fixes the actual defect at its single source** — every Swagger-derived
   handler goes through `normalizePathParams`; no downstream code needs to
   change.
2. **Underscore, not camelCase** — the substitution is a single one-line
   `replace` with no capture group or callback, so it is markedly easier to
   read and reason about.
3. **More robust to edge cases** — collapsing runs of unsafe characters handles
   leading and **trailing** separators (`{-id-}` → `:_id_`, `{foo-}` → `:foo_`).
   The camelCase regex required a following alphanumeric to fire, so it silently
   left a trailing hyphen in place — re-introducing the very defect this ADR
   fixes.
4. **Closer to the original name** — `kubeflow-id` → `kubeflow_id` preserves the
   token structure, making the source-to-normalized mapping obvious when
   debugging.
5. **No externally observable regression for already-safe param names** —
   `{kubeflowId}` and `{kubeflow_id}` pass through unchanged (the regex only
   touches non-word runs).
6. **Param name is not consumed by identifier** — downstream code
   (`convert.ts`, then `maskDynamicSegmentsIndexed`, which rewrites params to
   `:param1`, `:param2`) never reads params by name, so the camelCase-vs-
   underscore choice has no runtime effect on matching; readability and
   robustness therefore decide it.

### Alternatives Considered

- **camelCase conversion (`:kubeflowId`)** — the original proposal, chosen to
  mirror manually-authored handlers. Changed on code review: underscore's
  readability and trailing-separator safety outweigh cosmetic consistency, and
  since params are never accessed by name (point 6) the consistency argument
  carries no runtime weight.
- **Leave hyphenated param names, rely on documentation** — rejected: this is
  a silent failure with no error surface; a doc note does not help a user who
  doesn't yet know this defect exists (as in this session).
- **Detect and warn instead of fixing** — rejected: a warning without a fix
  still leaves every kebab-case OpenAPI spec unusable through Swagger import,
  which defeats the feature's purpose.

---

## Consequences

- Persisted `handlerConfigs` keys for existing kebab-case Swagger handlers
  change (e.g. `delete...../v1/kubeflows/:kubeflow-id` →
  `delete...../v1/kubeflows/:kubeflow_id`). Existing users with such specs will
  see those handlers as "new" (default `active: false`) after upgrading, and
  must re-activate them once. This is judged acceptable: the
  old keys pointed at handlers that never worked, so there is no working
  behavior being broken.
- Must document in changelog as a bug fix with a migration note (re-toggle
  affected handlers once after upgrade).
