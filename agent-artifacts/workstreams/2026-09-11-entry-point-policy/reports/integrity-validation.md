---
version: 1.0.0
name: 'Integrity Validation Report: Entry point policy'
type: report
status: complete
run_id: 2026-09-11-entry-point-policy
date: 2026-09-11
owner: 'Testing Specialist (Claude)'
related_adr: ADR-0006-entry-point-policy
---

# Integrity Validation Report

Scope: full restructuring of `@kakaocloud/mocking-gui` public entry points
(Tasks 1–7 of this run) — scenario API moved under `src/api/scenario/`,
`defineHandlers` → `defineRegistry` with `registry.handlers`, `./testing`
replaced by `./experimental`, root exports `ReadonlyHandlerConfig`/`Scenario`
types, per-entry surface tests under `src/__tests__/entries/`,
`applyScenario` accepting `addCookies`/`setCookies` drivers, `react-csr`
example updated to `defineRegistry`, and docs updated.

## 1. Lint

```
$ pnpm --filter @kakaocloud/mocking-gui lint
> @kakaocloud/mocking-gui@1.0.6-alpha.1 lint
> tsc --noEmit && tsc --noEmit -p tsconfig.test.json && eslint .
(no output — clean; exit 0)
```

Note: `tsconfig.test.json`'s `include` gained `src/vite-env.d.ts` during
Task 4 to close a test-typecheck gap (commit `59af604`); this run confirms
that fix keeps the test typecheck clean.

## 2. Unit Tests

```
$ pnpm --filter @kakaocloud/mocking-gui exec vitest run
 Test Files  15 passed (15)
      Tests  132 passed (132)
   Start at  15:26:23
   Duration  516ms
```

Includes the new per-entry surface tests:
- `src/__tests__/entries/experimental.surface.test.ts` (3 tests)
- `src/__tests__/entries/browser.surface.test.ts` (1 test)
- `src/__tests__/entries/server.surface.test.ts` (1 test)

and the relocated scenario API test suites under
`src/api/scenario/__tests__/**` (unit + types), all passing.

One pre-existing expected `stderr` line appears in
`src/utils/browser/cookie.test.ts` ("Task 3: Error Handling > should throw
error in development mode on invalid config") — this is the test
deliberately asserting a thrown error via console output, not a failure.

## 3. Build

```
$ pnpm --filter @kakaocloud/mocking-gui build
> tsc && vite build
✓ 1560 modules transformed.
[vite:dts] Declaration files built in 1389ms.
✓ built in 2.40s
```

`dist/` listing after build:

```
api/  components/  constants/  hooks/  lib/  store/  types/  utils/
browser.cjs  browser.cjs.map  browser.d.ts  browser.d.ts.map  browser.js  browser.js.map
experimental.cjs  experimental.cjs.map  experimental.d.ts  experimental.d.ts.map  experimental.js  experimental.js.map
index.cjs  index.cjs.map  index.d.ts  index.d.ts.map  index.js  index.js.map
server.cjs  server.cjs.map  server.d.ts  server.d.ts.map  server.js  server.js.map
handler-BOX929_g.cjs(.map)  handler-DH_PID6y.js(.map)
index-IAZDxE87.js(.map)  index-udKIn07T.cjs(.map)
key-D3hT_qqR.js(.map)  key-DTU97nSo.cjs(.map)
load-BzdQ9RAu.cjs(.map)  load-DG5c7gKd.js(.map)
```

Bundle sizes (gzip) reported by Vite:
`index.js` 0.04kB, `server.js` 2.03kB (1.03kB gz), `experimental.js` 4.01kB
(1.68kB gz), `browser.js` 313.58kB (76.68kB gz) — and matching `.cjs`
counterparts.

## 4. Examples Typecheck

```
$ pnpm -r --filter './examples/*' exec tsc --noEmit
(no output — clean; exit 0)
```

Both `react-csr` and `next-app-router` typecheck cleanly against the built
package (Step 1's build ran first, so `dist/*.d.ts` were current).

## 5. Package Surface (built artefacts)

```
$ cd packages/mocking-gui
$ node -e "import('./dist/experimental.js').then(m=>console.log(Object.keys(m).sort()))"
[
  'applyScenario',
  'defineRegistry',
  'defineScenario',
  'extendScenario',
  'serializeScenario'
]

$ node -e "console.log(Object.keys(require('./dist/experimental.cjs')).sort())"
[
  'applyScenario',
  'defineRegistry',
  'defineScenario',
  'extendScenario',
  'serializeScenario'
]

$ node -e "console.log(Object.keys(require('./package.json').exports))"
[ '.', './browser', './server', './experimental', './style.css' ]
```

All three outputs match the expected surface exactly.

## Verdict

**PASS.** All quality gates (lint, test, build, examples typecheck, package
surface) are green for the entry-point-policy restructuring.
