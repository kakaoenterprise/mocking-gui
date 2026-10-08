---
version: 1.0.0
name: 'Server runtime guard: stop treating jsdom as a browser'
type: run
description: 'Narrow the setupMockingServer browser guard so Node-family runtimes with a DOM shim (jsdom, happy-dom) create the server; warn when the guard skips'
run_id: 2026-09-29-server-runtime-guard-jsdom
workflow: harness-dev-pipeline
size: light
status: completed
created_by: ria.ang@kakaoenterprise.com
---

# RUN: Server runtime guard — stop treating jsdom as a browser

## 1. Background & Scope

`setupMockingServer` (`packages/mocking-gui/src/utils/server/setup.ts`) guards with
`if (typeof window !== 'undefined') return null;`. The intent is "do nothing when called from a
browser", but `window` is only a proxy for "browser". jsdom and happy-dom run inside Node and
define `window`, so in vitest/jest jsdom environments the call silently returns `null` and the
server is never created. There is no warning, so the failure is invisible (violates the
no-silent-failure rule of ADR-0004).

**In scope**: make the guard correct for Node-family runtimes and observable when it skips.
**Out of scope** (decided by user, 2026-09-29): exporting the internal `createMockingServer`
(`setupMockingServer` stays the single public server entry point); any new config option; any
cookie/state changes.

## 2. Decisions

- **Guard condition**: skip only when a DOM exists **and** the runtime is not Node.

  ```ts
  const isNodeRuntime = () => typeof process !== 'undefined' && Boolean(process.versions?.node);
  const isDomRuntime = () => typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isDomRuntime() && !isNodeRuntime()) { console.warn(...); return null; }
  ```

  - `process.versions.node` is the one `process` member browser shims do not set
    (`process/browser` → `versions = {}`; Next.js client `process` has only `env`; Vite `define`
    creates no `process` binding). Bundlers that partially inject `process` therefore still skip.
  - Requiring `isDomRuntime()` keeps the new condition a strict subset of the old one: every
    environment that proceeds today still proceeds (Node, Bun, Deno, edge runtimes); only
    jsdom/happy-dom move from skip → proceed. A pure `!isNodeRuntime()` check was rejected because
    it would newly skip on edge runtimes without Node compat, turning today's loud `msw/node`
    import failure into a silent `null`.

- **Observability**: one `console.warn` on skip naming the detected condition, so a false positive
  can never recur silently. Message does not recommend any alternative API.
- **Predicates live in `src/utils/common/runtime.ts`** so the guard and its tests share one
  definition. They are not exported from the package.
- **Semver**: behavioural bug fix, no API change → `fix(server):`, patch release (1.0.7).
- No ADR: this is a local bug fix, not an architecture decision.

## 3. Execution Log

Implemented 2026-09-30.

| File                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/mocking-gui/src/utils/common/runtime.ts`         | **new** — internal `isNodeRuntime()` / `isDomRuntime()` predicates exactly as in §2, with JSDoc recording why `process.versions.node` is the probe and why a DOM is required. Not exported from the package.                                                                                                                                                                              |
| `packages/mocking-gui/src/utils/server/setup.ts`           | Guard in `setupMockingServer` changed from `if (typeof window !== 'undefined') return null;` to `if (isDomRuntime() && !isNodeRuntime()) { console.warn(...); return null; }`; added the `../common/runtime` import. `createMockingServer` and the swagger loader are untouched.                                                                                                          |
| `packages/mocking-gui/src/utils/common/runtime.test.ts`    | **new** (node env, 7 tests) — `isNodeRuntime` true in Node, false for `process === undefined`, `{ env: {} }` (Next.js client) and `{ versions: {} }` (`process/browser`); `isDomRuntime` false in node, true only when both `window` and `document` exist. `vi.unstubAllGlobals()` after each test.                                                                                       |
| `packages/mocking-gui/src/utils/server/setup.test.ts`      | **new** (`// @vitest-environment jsdom`, 3 tests) — (a) jsdom creates a non-null `SetupServer` with no warning, (b) jsdom + `vi.stubGlobal('process', undefined)` returns `null` and warns exactly once with a message containing "skipped", (c) zero handlers still returns `null` with no warning. Closes the server and deletes `globalThis.__MOCKING_GUI_SSR_SERVER__` between tests. |
| `packages/mocking-gui/src/utils/server/setup.node.test.ts` | **new** (default node env, 2 tests) — DOM-less Node creates the server with no warning, and a second call reuses the cached global instance.                                                                                                                                                                                                                                              |
| `packages/mocking-gui/package.json`, `pnpm-lock.yaml`      | Added `jsdom@^30.1.1` to `packages/mocking-gui` devDependencies (`pnpm add -D jsdom`); it was not present in the package or at the workspace root.                                                                                                                                                                                                                                        |
| `docs/guide/troubleshooting.md`                            | New section "`setupMockingServer` returns null in jsdom tests" — fixed in this version; the warning appearing in a Node-based test env is a bug to report.                                                                                                                                                                                                                                |
| `docs/guide/usage/api-guide.md`                            | One sentence in the `setupMockingServer` section: returns `null` with a console warning only in a browser (DOM present, no Node.js runtime); jsdom/happy-dom create the server.                                                                                                                                                                                                           |

Key diff (`setup.ts`):

```diff
-  if (typeof window !== 'undefined') {
+  if (isDomRuntime() && !isNodeRuntime()) {
+    console.warn(
+      '[MockingGUI Server] setupMockingServer was skipped: a browser (DOM) runtime without Node.js was detected. If this is a server-side or Node-based test environment (jsdom/happy-dom), please report it to the project issue tracker.',
+    );
     return null;
   }
```

## 4. Validation

All run inside `packages/mocking-gui` on 2026-09-30.

| Command                                  | Result                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                              | **PASS** — 9 test files passed / 0 failed, 69 tests passed / 0 failed (up from 7 files / 57 tests). New: `runtime.test.ts` 7, `setup.test.ts` 3 (jsdom), `setup.node.test.ts` 2.   |
| `pnpm lint` (`tsc --noEmit && eslint .`) | **PASS** — 0 errors. 3 warnings, all pre-existing `@typescript-eslint/no-explicit-any` in `src/utils/browser/cookie.test.ts` (lines 16, 162, 174); none in the files changed here. |
| `pnpm build` (`tsc && vite build`)       | **PASS** — ESM + CJS bundles and declaration files emitted; `dist/server.js` 2.38 kB (gzip 1.20 kB).                                                                               |

Note: the first `pnpm lint` failed with `Cannot find package 'eslint-plugin-turbo'` because this worktree had never been fully installed (`config/eslint-config/node_modules` was missing). A workspace-root `pnpm install` resolved it; it was not caused by any change in this run.

## 5. Approval

| Item      | Value                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Decision  | approved                                                                                                |
| Approver  | ria.ang@kakaoenterprise.com                                                                             |
| Time      | 2026-09-30T00:00:00+09:00                                                                               |
| Rationale | User narrowed scope to the guard bug only ("ADR 문서 모두 제거하고, Node 가드 쪽만 다시 작성해서 진행") |
