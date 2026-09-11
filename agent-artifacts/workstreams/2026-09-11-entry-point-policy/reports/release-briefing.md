---
version: 1.0.0
name: 'Entry Point Policy Release Briefing'
description: 'User-facing release briefing for the entry-point restructuring in @kakaocloud/mocking-gui: experimental staging path, defineHandlers→defineRegistry rename, and the graduation policy for the scenario API.'
run_id: 2026-09-11-entry-point-policy
related_adr: ADR-0006-entry-point-policy
---

# Release Briefing: Entry Point Policy

## Version

`1.0.6-alpha.2` (the version bump itself is performed by `release-it`, not
by this branch).

## Breaking for alpha.1 users

- `./testing` → `./experimental`
- `defineHandlers` → `defineRegistry`

Portable two-step codemod for consumers migrating from `1.0.6-alpha.1`:

```bash
grep -rl "mocking-gui/testing" src e2e | xargs perl -pi -e 's#mocking-gui/testing#mocking-gui/experimental#g'
grep -rl "defineHandlers" src e2e | xargs perl -pi -e 's/\bdefineHandlers\b/defineRegistry/g'
```

## New

- `registry.handlers` — exposes the original handler collection, so one
  declaration feeds both `MockingConfig.mocks` and scenario authoring.
- `ReadonlyHandlerConfig` / `Scenario` types exported from the package root.
- `applyScenario` accepts WebdriverIO-shaped drivers (`addCookies` or
  `setCookies`), not only Playwright-shaped ones.
- Per-entry surface tests under `src/__tests__/entries/` guard the exported
  shape of `./experimental`, `./browser`, and `./server` against accidental
  drift.
- `src/api/scenario/index.ts` exports six extra types (`DefinedHandler`,
  `HandlerByName`, `HandlerNameOf`, `HandlerRef`, `VariantName`,
  `ScenarioStateEntry`) beyond spec §3.1 because they appear in public
  signatures and are needed for declaration emit.

## Policy

Experimental/alpha-beta features are staged under `./experimental` until
graduated. See ADR-0006 (`agent-artifacts/decisions/ADR-0006-entry-point-policy.md`)
for the full graduation policy and rationale. Graduation target for the
scenario API: a dedicated `./scenario` subpath in `1.1.0`.

## Not in this release

- Dynamic `responseVariantsFn` scenarios.
- The Puppeteer helper for `applyScenario`.

## Deferred to PR #21 (repo automation)

- CI `Test & Coverage` job will run the surface tests.
- `CHANGELOG.md` via release-it will carry the breaking-change notes.

## Verification scope note

Per the spec's §5 self-review, the example-app criterion is satisfied at
compile level only: both `examples/react-csr` and `examples/next-app-router`
typecheck cleanly against the built package (see
`reports/integrity-validation.md`, §4). No Playwright dependency exists in
`examples/`, so a live end-to-end run was out of scope for this run and is
noted here rather than silently skipped.
