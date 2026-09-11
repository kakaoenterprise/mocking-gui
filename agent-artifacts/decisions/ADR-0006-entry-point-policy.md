---
version: 1.0.0
name: 'ADR-0006: Subpath entry policy — type-only root, domain subpaths, and an experimental staging entry'
type: adr
status: proposed
run_id: 2026-09-11-entry-point-policy
description: 'Public API is exposed through domain-named subpaths; root stays type-only; pre-release features ship only from ./experimental and graduate by moving one barrel line'
---

# ADR-0006: Subpath entry policy — type-only root, domain subpaths, and an experimental staging entry

**Status**: Proposed
**Date**: 2026-09-11
**Deciders**: Project Owner, System Architect, PR #18 reviewers
**Affected Stakeholders**: Library users on `alpha` dist-tag, Release Manager, Frontend Engineer
**Links**: `workstreams/2026-09-11-entry-point-policy/spec.md`, https://github.com/kakaoenterprise/mocking-gui/pull/18

---

## Context

### Background (Why?)

PR #18 shipped a scenario authoring and injection API (`defineHandlers`, `defineScenario`,
`extendScenario`, `serializeScenario`, `applyScenario`) under a new `./testing` subpath as
`1.0.6-alpha.1`. Review surfaced three structural questions the package had no policy for:

1. **How are pre-release (alpha/beta) features marked?** Only the npm dist-tag says "alpha".
   The import path, the symbol names and the JSDoc do not. Moving the API at graduation
   would break alpha users without any prior signal.
2. **Is `./testing` the right home?** The five functions are not test-only. The authoring
   functions produce the same `Scenario`/handler types the GUI consumes at runtime;
   `serializeScenario` is a pure localStorage encoder usable from Cypress, Storybook, or a
   dev-server preset URL; `applyScenario` targets any browser-automation driver exposing
   an init-script hook (Playwright, WebdriverIO v9 via WebDriver BiDi preload scripts), which
   are also used for screenshot/PDF generation outside test suites.
3. **Should functions move to root?** A reviewer proposed that. Root is currently type-only.
   Mixing values and types in root blurs the maintenance boundary and abandons the
   "root = minimal shared contract" identity.

### Technical Evaluation Criteria

- Migration cost for alpha users at graduation (high)
- Clarity of ownership per entry — one entry, one nature (high)
- Consistency with ecosystem conventions users already know (medium)
- Build/test tooling overhead per additional entry (low)

### Options considered

| Option | Experimental marker | Graduated home of scenario API | Verdict |
| --- | --- | --- | --- |
| A | `./experimental` subpath | root (values + types) | Rejected: root loses type-only identity; management point diffuses |
| B | `./experimental` subpath | root for pure declarations, `./testing` for adapters | Rejected: `testing` asserts a usage, not a nature; adapters are not test-only |
| C | `./experimental` subpath | `./scenario` for declarations + serializer, `./playwright` (later `./automation`) for adapter | Rejected: adapter body is tens of lines; not a management unit worth its own entry. The BiDi-standardized shape means one structural type covers Playwright and WebdriverIO |
| **D** | **`./experimental` subpath** | **`./scenario` for the whole domain (declare, serialize, inject)** | **Chosen** |
| E | `unstable_` symbol prefix (React/Remix) | any | Rejected as sole marker: requires renames at graduation and puts unstable symbols into stable entries' surface |
| F | JSDoc `@experimental` only (Angular) | any | Rejected as sole marker: invisible at the import site; kept as a secondary annotation |

Ecosystem references: msw (`msw` / `msw/browser` / `msw/node`), vitest (`vitest/config`,
`vitest/node`, `vitest/browser`), react-dom (`/client`, `/server`, `/test-utils`),
`@apollo/client/testing` (test-only helpers only), Remix/React `unstable_` graduation with a
one-minor deprecated alias.

---

## Decision

### Final Choice (What?)

**We choose Option D.**

| Entry | Nature | Contents (after graduation, target 1.1.0) |
| --- | --- | --- |
| `.` | Type-only shared contract | existing types + `ReadonlyHandlerConfig`, `Scenario` |
| `./browser` | Browser runtime | `MockingGUIBoundary` |
| `./server` | Node SSR runtime | `setupMockingServer` |
| `./scenario` | Scenario domain: authoring, serialization, driver injection | `defineRegistry`, `defineScenario`, `extendScenario`, `serializeScenario`, `applyScenario` + their types |
| `./experimental` | Staging entry, excluded from semver | every alpha/beta feature |

Policy:

1. Root never exports values. Subpaths are named by **domain or runtime**, never by assumed
   usage (`testing`, `e2e`).
2. Pre-release features are exported **only** from `./experimental`, tagged `@experimental`
   in JSDoc, and published under `alpha` → `beta` dist-tags. Implementation files live in
   their final domain directory from day one so graduation is a one-line barrel change.
3. On graduation the symbols move to their domain subpath in a minor release;
   `./experimental` keeps `@deprecated` re-exports for **one minor**, then removes them.
   `./experimental` is documented as outside semver guarantees.
4. Every entry has an export-surface snapshot test so any add/move/remove is an explicit,
   reviewed change.
5. `./testing` is removed in `1.0.6-alpha.2` without alias (pre-release contract).
6. `defineHandlers` is renamed `defineRegistry` to match its return type and the
   `define*` family; `HandlerRegistry.handlers` is added so declared handlers feed
   `MockingConfig.mocks` directly.

### Rationale (Why this?)

1. **Graduation cost**: with a dedicated staging path, graduation changes only import
   paths, and the deprecated re-export window makes even that non-urgent. The path itself
   is the warning, so experimental code can ride along in `latest` safely.
2. **One entry, one nature**: `serializeScenario` and `applyScenario` are two layers of the
   same injection concern (pure encoder vs. driver adapter). Splitting them by tool would
   multiply entries faster than the code justifies; folding them into root would mix values
   into the type contract. `./scenario` is the smallest unit that owns the whole concern.
3. **Ecosystem fit**: mirrors msw/vitest domain subpaths users already know, and follows the
   Apollo rule that a `testing` path must contain only things meaningful solely in tests —
   which none of these functions are.

### Consequences

- Positive: stable root identity; a single, predictable place for scenario tooling; a
  repeatable procedure for every future experimental feature.
- Negative: alpha.1 users must change `./testing` → `./experimental` in alpha.2, and again
  to `./scenario` at 1.1.0 (with a one-minor grace window). Accepted because alpha carries
  no compatibility promise and the population is internal.
- Follow-up: Puppeteer/Cypress-specific helpers, if ever needed, are added inside
  `./scenario` (e.g. `applyScenarioToPage`), not as new entries.
