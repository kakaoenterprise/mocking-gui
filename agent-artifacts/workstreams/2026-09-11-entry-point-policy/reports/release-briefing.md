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

Two-line codemod for consumers migrating from `1.0.6-alpha.1`:

```bash
grep -rl "mocking-gui/testing" src e2e | xargs sed -i '' 's#mocking-gui/testing#mocking-gui/experimental#g; s/defineHandlers/defineRegistry/g'
```

## New

- `registry.handlers` — the handler list is now accessed as a property on
  the registry object returned by `defineRegistry`, rather than the
  registry itself being the handler list.
- `ReadonlyHandlerConfig` / `Scenario` types exported from the package root.
- `applyScenario` accepts WebdriverIO-shaped drivers (`addCookies` or
  `setCookies`), not only Playwright-shaped ones.
- Per-entry surface tests under `src/__tests__/entries/` guard the exported
  shape of `./experimental`, `./browser`, and `./server` against accidental
  drift.

## Policy

Experimental/alpha-beta features are staged under `./experimental` until
graduated. See ADR-0006 (`agent-artifacts/decisions/ADR-0006-entry-point-policy.md`)
for the full graduation policy and rationale. Graduation target for the
scenario API: a dedicated `./scenario` subpath in `1.1.0`.

## Not in this release

- Dynamic `responseVariantsFn` scenarios.
- The Puppeteer helper for `applyScenario`.

## Verification scope note

Per the spec's §5 self-review, the example-app criterion is satisfied at
compile level only: both `examples/react-csr` and `examples/next-app-router`
typecheck cleanly against the built package (see
`reports/integrity-validation.md`, §4). No Playwright dependency exists in
`examples/`, so a live end-to-end run was out of scope for this run and is
noted here rather than silently skipped.
