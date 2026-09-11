# Entry Point Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `./testing` subpath shipped in `1.0.6-alpha.1` with an `./experimental` staging entry, rename `defineHandlers` → `defineRegistry`, expose the Readonly/Scenario types from root, guard every entry's export surface with a test, and document the policy.

**Architecture:** All scenario code moves under `src/api/scenario/` so that graduation to a future `./scenario` entry is a one-line barrel change. `src/experimental.ts` is the only barrel that re-exports it today. Root (`src/index.ts`) stays type-only. Each of the entries (`index`, `browser`, `server`, `experimental`) gets a surface snapshot test under `src/__tests__/entries/`.

**Tech Stack:** TypeScript 5, Vite 5 lib mode (`vite.config.ts` `build.lib.entry`), vitest 1 (default `node` environment, `globals: true`), pnpm workspace, eslint with `import/order`.

**Spec:** `agent-artifacts/workstreams/2026-09-11-entry-point-policy/spec.md` (§3.3 items A–I map to tasks below).

## Global Constraints

- Branch: `feat/entry-point-policy` (based on `upstream/test/v1.0.6-alpha.1`). Run everything from `/Users/ria.ang/orca/workspaces/mocking-gui/delta`.
- Package dir: `packages/mocking-gui`. Commands: `pnpm --filter @kakaocloud/mocking-gui <script>`; scripts are `lint` (`tsc --noEmit && tsc --noEmit -p tsconfig.test.json && eslint .`), `test` (`vitest`, use `vitest run` for one-shot), `build` (`tsc && vite build`).
- No `any`. Strict TypeScript. Follow eslint `import/order` groups: builtin, external, internal, [parent, sibling, index], object, type — with a blank line between groups; `import type` lines last.
- Root entry `src/index.ts` exports **types only**. Never add a value export there.
- `./testing` must not exist after Task 3: no `src/testing.ts`, no `package.json` entry, no vite entry.
- `tsconfig.test.json` includes `src/api/**/*` and typechecks tests with `@ts-expect-error` assertions. Moving test files must keep them under `src/api/`, or extend `include`.
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

---

## File Structure

| Path | Responsibility | Action |
| --- | --- | --- |
| `src/api/scenario/define.ts` | `defineRegistry`, `defineHandler`, registry types | move from `src/api/define.ts`, rename export |
| `src/api/scenario/scenario.ts` | `defineScenario`, `extendScenario`, `Unique` | move from `src/api/scenario.ts` |
| `src/api/scenario/serialize.ts` | `serializeScenario`, `serializeScenarioCookie` | move from `src/api/serialize.ts` |
| `src/api/scenario/adapter.ts` | `applyScenario`, `InitScriptCapable` | move from `src/api/adapter.ts`, relax cookie method |
| `src/api/scenario/index.ts` | Domain barrel: the exact surface a future `./scenario` entry will expose | create |
| `src/api/scenario/__tests__/**` | existing tests | move from `src/api/__tests__/**`, fix relative imports |
| `src/experimental.ts` | Staging barrel; re-exports `./api/scenario` with `@experimental` JSDoc | create |
| `src/testing.ts` | — | delete |
| `src/index.ts` | Type-only root; add `ReadonlyHandlerConfig`, `Scenario` | modify |
| `src/__tests__/entries/*.surface.test.ts` | Per-entry export surface guards | create (4 files) |
| `package.json`, `vite.config.ts`, `tsconfig.test.json` | entry wiring | modify |
| `docs/guide/usage/api-guide.md`, `docs/guide/usage/scenario-guide.md`, `packages/mocking-gui/README.md` | policy + usage docs | modify |
| `examples/react-csr/src/mocks/handlers.ts`, `config.ts` | prove `registry.handlers` → `mocks` reuse compiles | modify |

---

### Task 1: Move scenario code into `src/api/scenario/` and add the domain barrel

**Files:**
- Move: `src/api/{define,scenario,serialize,adapter}.ts` → `src/api/scenario/`
- Move: `src/api/__tests__/` → `src/api/scenario/__tests__/`
- Create: `src/api/scenario/index.ts`
- Modify: `src/testing.ts` (temporary — re-point imports; deleted in Task 3)

**Interfaces:**
- Produces: module `src/api/scenario/index.ts` exporting `applyScenario`, `defineHandlers` (renamed in Task 2), `defineScenario`, `extendScenario`, `serializeScenario` and the types `HandlerRegistry`, `Selection`, `HandlerRef`, `VariantName`, `HandlerNameOf`, `HandlerByName`, `DefinedHandler`, `ScenarioOptions`, `ApplyScenarioOptions`, `InitScriptCapable`, `ScenarioStateEntry`.

- [ ] **Step 1: Move files with git so history is preserved**

```bash
cd packages/mocking-gui
git mv src/api/define.ts src/api/scenario/define.ts 2>/dev/null || { mkdir -p src/api/scenario && git mv src/api/define.ts src/api/scenario/define.ts; }
git mv src/api/scenario.ts src/api/scenario/scenario.ts
git mv src/api/serialize.ts src/api/scenario/serialize.ts
git mv src/api/adapter.ts src/api/scenario/adapter.ts
git mv src/api/__tests__ src/api/scenario/__tests__
```

- [ ] **Step 2: Fix relative imports that reach outside the moved folder**

In the four source files, every `'../types/…'`, `'../utils/…'`, `'../constants/…'` becomes `'../../types/…'`, `'../../utils/…'`, `'../../constants/…'`. Sibling imports (`'./define'`, `'./serialize'`) are unchanged.

```bash
cd packages/mocking-gui/src/api/scenario
sed -i '' "s#from '\.\./types/#from '../../types/#g; s#from '\.\./utils/#from '../../utils/#g; s#from '\.\./constants/#from '../../constants/#g" define.ts scenario.ts serialize.ts adapter.ts
```

In test files, every `'../../../'` (which pointed at `src/`) becomes `'../../../../'`. Sibling-of-parent imports (`'../../define'` etc.) are unchanged because `__tests__` moved together with the sources.

```bash
cd packages/mocking-gui/src/api/scenario/__tests__
grep -rl "from '\.\./\.\./\.\./" . | xargs sed -i '' "s#from '\.\./\.\./\.\./#from '../../../../#g"
```

`integration/public-api.test.ts` imported `'../../../testing'`; after the sed it reads `'../../../../testing'`, which is correct for now (deleted in Task 3).

- [ ] **Step 3: Create the domain barrel**

`src/api/scenario/index.ts`:

```ts
export { applyScenario } from './adapter';
export { defineHandlers } from './define';
export { defineScenario, extendScenario } from './scenario';
export { serializeScenario } from './serialize';

export type { ApplyScenarioOptions, InitScriptCapable } from './adapter';
export type {
  DefinedHandler,
  HandlerByName,
  HandlerNameOf,
  HandlerRef,
  HandlerRegistry,
  Selection,
  VariantName,
} from './define';
export type { ScenarioOptions } from './scenario';
export type { ScenarioStateEntry } from './serialize';
```

- [ ] **Step 4: Re-point `src/testing.ts` at the barrel (temporary)**

```ts
export {
  applyScenario,
  defineHandlers,
  defineScenario,
  extendScenario,
  serializeScenario,
} from './api/scenario';
export type { Scenario } from './types/handler';
```

- [ ] **Step 5: Run lint and tests**

Run: `pnpm --filter @kakaocloud/mocking-gui lint && pnpm --filter @kakaocloud/mocking-gui exec vitest run`
Expected: lint clean; all existing tests pass (same count as before the move).

- [ ] **Step 6: Commit**

```bash
git add -A packages/mocking-gui/src
git commit -m "refactor(scenario): move scenario API under src/api/scenario with domain barrel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Rename `defineHandlers` → `defineRegistry` and expose `registry.handlers`

**Files:**
- Modify: `src/api/scenario/define.ts`
- Modify: `src/api/scenario/index.ts`, `src/testing.ts`
- Modify: all files under `src/api/scenario/__tests__/` that reference `defineHandlers`
- Test: `src/api/scenario/__tests__/unit/define.test.ts`

**Interfaces:**
- Produces: `export function defineRegistry<const T extends readonly ReadonlyHandlerConfig[]>(handlers: T & NoUnknownKeys<T>): HandlerRegistry<T>`; `HandlerRegistry<T>` gains `readonly handlers: T`.

- [ ] **Step 1: Write the failing tests**

Append to `src/api/scenario/__tests__/unit/define.test.ts` (inside the existing `describe('defineHandlers', …)` block, which Step 3 renames):

```ts
  it('exposes the original handler collection as `handlers` for runtime reuse', () => {
    const handlers = [
      { name: 'Users', url: '/api/users', method: 'get', responseVariants: [{ name: 'Success', status: 200 }] },
    ] as const;
    const registry = defineRegistry(handlers);

    expect(registry.handlers).toBe(handlers);
    // Type-level: assignable to MockingConfig['mocks']
    const mocks: MockingConfig['mocks'] = registry.handlers;
    expect(mocks).toHaveLength(1);
  });
```

Add to the file's type imports: `import type { MockingConfig } from '../../../../types/config';` (merge into the existing `import type { … } from '../../../../types/config'` line).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kakaocloud/mocking-gui exec vitest run src/api/scenario/__tests__/unit/define.test.ts`
Expected: FAIL — `defineRegistry is not defined` (ReferenceError / TS error).

- [ ] **Step 3: Rename and add `handlers`**

In `src/api/scenario/define.ts`:

1. Add to `HandlerRegistry<T>` interface, as the first member:
   ```ts
     /**
      * The handler collection this registry was built from, unchanged.
      *
      * Lets a registry be the single declaration for both runtime mocking and
      * scenario authoring: pass `registry.handlers` to `MockingConfig.mocks`.
      */
     readonly handlers: T;
   ```
2. Rename `export function defineHandlers` → `export function defineRegistry`. Update the JSDoc first line to `Wraps an existing handler collection in a registry so its members can be picked by name, …`.
3. In the `registry` object literal add `handlers,` as the first property.
4. Update the error message in `defineRegistry` that mentions "within a registry" (no change needed; keep).

Rename all call sites:

```bash
cd packages/mocking-gui
grep -rl "defineHandlers" src | xargs sed -i '' 's/defineHandlers/defineRegistry/g'
```

This also updates `src/api/scenario/index.ts`, `src/testing.ts`, the test `describe` titles and the `EXPECTED_RUNTIME_EXPORTS` list in `public-api.test.ts`. Re-sort that list alphabetically: `['applyScenario', 'defineRegistry', 'defineScenario', 'extendScenario', 'serializeScenario']`.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @kakaocloud/mocking-gui lint && pnpm --filter @kakaocloud/mocking-gui exec vitest run`
Expected: PASS. `grep -rn defineHandlers packages/mocking-gui/src` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A packages/mocking-gui/src
git commit -m "feat(scenario)!: rename defineHandlers to defineRegistry and expose registry.handlers

The function returns a HandlerRegistry, not handlers. registry.handlers lets one
declaration feed both MockingConfig.mocks and scenario authoring.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Add the `./experimental` entry and remove `./testing`

**Files:**
- Create: `src/experimental.ts`
- Delete: `src/testing.ts`
- Modify: `package.json` (`exports`, `typesVersions`), `vite.config.ts` (`build.lib.entry`)
- Move+modify: `src/api/scenario/__tests__/integration/public-api.test.ts` → `src/__tests__/entries/experimental.surface.test.ts`
- Modify: `tsconfig.test.json` (`include`)

**Interfaces:**
- Produces: subpath `@kakaocloud/mocking-gui/experimental` exporting exactly the five functions plus the types from `src/api/scenario/index.ts` and `Scenario`.

- [ ] **Step 1: Write the surface test (move + rewrite the existing one)**

```bash
mkdir -p packages/mocking-gui/src/__tests__/entries
git mv packages/mocking-gui/src/api/scenario/__tests__/integration/public-api.test.ts packages/mocking-gui/src/__tests__/entries/experimental.surface.test.ts
rmdir packages/mocking-gui/src/api/scenario/__tests__/integration
```

Replace the file's content with:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import * as experimental from '../../experimental';

/**
 * Guards the export surface of `@kakaocloud/mocking-gui/experimental`.
 *
 * Runs in the plain `node` environment on purpose: the entry is consumed from
 * test runners and build scripts, so importing it must never touch `window`
 * or `document` at module load. A regression there fails this file.
 *
 * Adding, moving (graduating) or removing a symbol must change this list — that
 * is the point. See ADR-0006.
 */
const EXPECTED_RUNTIME_EXPORTS = [
  'applyScenario',
  'defineRegistry',
  'defineScenario',
  'extendScenario',
  'serializeScenario',
] as const;

describe('experimental entry surface', () => {
  it('exports exactly the documented runtime symbols', () => {
    expect(Object.keys(experimental).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS]);
  });

  it('exposes every export as a callable function', () => {
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      expect(typeof experimental[name]).toBe('function');
    }
  });

  it('can author, serialize and apply a scenario without a DOM', async () => {
    const registry = experimental.defineRegistry([
      {
        name: 'Users',
        url: '/api/users',
        method: 'get',
        responseVariants: [{ name: 'Success', status: 200 }],
      },
    ]);
    const scenario = experimental.defineScenario('smoke', [registry.pick('Users', 'Success')]);
    const calls: unknown[] = [];
    await experimental.applyScenario(
      {
        addInitScript: async (_script, arg) => {
          calls.push(arg);
        },
        addCookies: async cookies => {
          calls.push(cookies);
        },
      },
      scenario,
      { origin: 'http://localhost:5173', ssr: true },
    );
    expect(calls).toHaveLength(2);
    expect(typeof window).toBe('undefined');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kakaocloud/mocking-gui exec vitest run src/__tests__/entries/experimental.surface.test.ts`
Expected: FAIL — `Cannot find module '../../experimental'`.

- [ ] **Step 3: Create `src/experimental.ts`, delete `src/testing.ts`**

```ts
/**
 * `@kakaocloud/mocking-gui/experimental`
 *
 * Staging entry for features published under the `alpha` / `beta` dist-tags.
 * Everything exported here is **outside semver guarantees**: a minor release may
 * change or remove it. When a feature graduates it moves to its domain entry
 * (e.g. `@kakaocloud/mocking-gui/scenario`) and stays here as a `@deprecated`
 * re-export for one minor release. See ADR-0006.
 */

/** @experimental Scenario authoring & injection API. Graduates to `./scenario`. */
export {
  applyScenario,
  defineRegistry,
  defineScenario,
  extendScenario,
  serializeScenario,
} from './api/scenario';

/** @experimental */
export type {
  ApplyScenarioOptions,
  DefinedHandler,
  HandlerByName,
  HandlerNameOf,
  HandlerRef,
  HandlerRegistry,
  InitScriptCapable,
  ScenarioOptions,
  ScenarioStateEntry,
  Selection,
  VariantName,
} from './api/scenario';
export type { Scenario } from './types/handler';
```

```bash
git rm packages/mocking-gui/src/testing.ts
```

- [ ] **Step 4: Wire the entry in `package.json` and `vite.config.ts`**

`package.json` — replace the `"./testing"` block in `exports` with:

```json
    "./experimental": {
      "types": "./dist/experimental.d.ts",
      "import": "./dist/experimental.js",
      "require": "./dist/experimental.cjs"
    },
```

and in `typesVersions["*"]` replace `"testing": ["dist/testing.d.ts"]` with `"experimental": ["dist/experimental.d.ts"]`.

`vite.config.ts` — in `build.lib.entry` replace `testing: resolve(__dirname, 'src/testing.ts'),` with `experimental: resolve(__dirname, 'src/experimental.ts'),`.

- [ ] **Step 5: Extend `tsconfig.test.json` include**

```json
  "include": ["src/api/**/*", "src/__tests__/**/*"],
```

- [ ] **Step 6: Run tests, lint, build; verify dist**

Run: `pnpm --filter @kakaocloud/mocking-gui lint && pnpm --filter @kakaocloud/mocking-gui exec vitest run && pnpm --filter @kakaocloud/mocking-gui build && ls packages/mocking-gui/dist | grep -E '^(experimental|testing)'`
Expected: all pass; `ls` prints `experimental.cjs experimental.d.ts experimental.js` (plus `.map`) and **no** `testing.*`. Also `grep -rn '"./testing"\|src/testing' packages/mocking-gui/package.json packages/mocking-gui/vite.config.ts` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -A packages/mocking-gui
git commit -m "feat(experimental)!: add ./experimental staging entry and remove ./testing

Pre-release features are exported only from ./experimental (outside semver).
The alpha.1 ./testing path is dropped without alias per the pre-release contract.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Root type exports and surface tests for `index`, `server`, `browser`

**Files:**
- Modify: `src/index.ts`
- Create: `src/__tests__/entries/index.surface.test.ts`, `server.surface.test.ts`, `browser.surface.test.ts`

**Interfaces:**
- Produces: root exports `ReadonlyHandlerConfig` and `Scenario` types.

- [ ] **Step 1: Write the failing root surface test**

`src/__tests__/entries/index.surface.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import * as root from '../../index';

import type {
  HandlerConfigOption,
  MockingConfig,
  ReadonlyHandlerConfig,
  Scenario,
  SwaggerSourceConfigOption,
} from '../../index';

/**
 * The root entry is a type-only contract (ADR-0006). It must never export a
 * runtime value. The pinned type set is asserted by the type imports above:
 * `tsconfig.test.json` typechecks this file, so a removed type fails lint.
 */
export type RootTypes = {
  HandlerConfigOption: HandlerConfigOption;
  MockingConfig: MockingConfig;
  ReadonlyHandlerConfig: ReadonlyHandlerConfig;
  Scenario: Scenario;
  SwaggerSourceConfigOption: SwaggerSourceConfigOption;
};

describe('root entry surface', () => {
  it('exports no runtime values', () => {
    expect(Object.keys(root)).toEqual([]);
  });

  it('accepts an as-const handler collection as MockingConfig.mocks', () => {
    const handlers = [
      { name: 'Users', url: '/api/users', method: 'get', responseVariants: [{ name: 'Success', status: 200 }] },
    ] as const satisfies readonly ReadonlyHandlerConfig[];
    const config: MockingConfig = { mocks: handlers };
    expect(config.mocks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kakaocloud/mocking-gui exec vitest run src/__tests__/entries/index.surface.test.ts`
Expected: FAIL (vitest with esbuild will not typecheck, so it may PASS at runtime; the authoritative failure is) `pnpm --filter @kakaocloud/mocking-gui exec tsc --noEmit -p tsconfig.test.json` → `Module '"../../index"' has no exported member 'ReadonlyHandlerConfig'` / `'Scenario'`.

- [ ] **Step 3: Add the root type exports**

`src/index.ts`:

```ts
export type {
  HandlerConfigOption,
  MockingConfig,
  ReadonlyHandlerConfig,
  SwaggerSourceConfigOption,
} from './types';
export type { Scenario } from './types/handler';
```

Verify `src/types/index.ts` re-exports `ReadonlyHandlerConfig` from `./config`; if it uses `export *` nothing is needed, otherwise add it.

- [ ] **Step 4: Write the server and browser surface tests**

`src/__tests__/entries/server.surface.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import * as server from '../../server';

describe('server entry surface', () => {
  it('exports exactly setupMockingServer', () => {
    expect(Object.keys(server).sort()).toEqual(['setupMockingServer']);
    expect(typeof server.setupMockingServer).toBe('function');
  });
});
```

`src/__tests__/entries/browser.surface.test.ts` — type-level only, because the browser barrel pulls React components and CSS that are not meant to load in `node`:

```ts
import { describe, expect, it } from 'vitest';

import type * as browser from '../../browser';

/**
 * Type-level surface guard for `@kakaocloud/mocking-gui/browser`. The module is
 * not imported at runtime (it drags in React components and CSS); the type of
 * the module namespace is asserted instead.
 */
type BrowserExports = keyof typeof browser;
type Expected = 'MockingGUIBoundary';
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe('browser entry surface', () => {
  it('exports exactly MockingGUIBoundary', () => {
    const exact: Exact<BrowserExports, Expected> = true;
    expect(exact).toBe(true);
  });
});
```

- [ ] **Step 5: Run lint (includes test typecheck) and tests**

Run: `pnpm --filter @kakaocloud/mocking-gui lint && pnpm --filter @kakaocloud/mocking-gui exec vitest run src/__tests__/entries`
Expected: PASS, 4 surface files.

- [ ] **Step 6: Commit**

```bash
git add -A packages/mocking-gui/src
git commit -m "feat(types): export ReadonlyHandlerConfig and Scenario from root; add per-entry surface tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Accept `setCookies` as well as `addCookies` in `applyScenario`

**Files:**
- Modify: `src/api/scenario/adapter.ts`
- Test: `src/api/scenario/__tests__/unit/adapter.test.ts`

**Interfaces:**
- Produces: `InitScriptCapable` = `{ addInitScript(...) } & ({ addCookies(...) } | { setCookies(...) })`. `applyScenario` signature unchanged.

- [ ] **Step 1: Write the failing test**

Append to `adapter.test.ts` after the `FakeContext` class:

```ts
class FakeWdioBrowser {
  addInitScriptCalls: Array<{ script: (arg: InitScriptArg) => void; arg: InitScriptArg }> = [];
  setCookiesCalls: Array<{ name: string; value: string; url: string }[]> = [];

  async addInitScript(script: (arg: InitScriptArg) => void, arg: InitScriptArg): Promise<void> {
    this.addInitScriptCalls.push({ script, arg });
  }

  async setCookies(cookies: { name: string; value: string; url: string }[]): Promise<void> {
    this.setCookiesCalls.push(cookies);
  }
}
```

and inside `describe('applyScenario', …)`:

```ts
  it('uses setCookies when the driver exposes that instead of addCookies (WebdriverIO shape)', async () => {
    const browser = new FakeWdioBrowser();
    await applyScenario(browser, scenario, { origin: ORIGIN, ssr: true });

    expect(browser.addInitScriptCalls).toHaveLength(1);
    expect(browser.setCookiesCalls).toHaveLength(1);
    expect(browser.setCookiesCalls[0][0]).toMatchObject({ url: ORIGIN });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @kakaocloud/mocking-gui exec tsc --noEmit -p tsconfig.test.json`
Expected: error — `FakeWdioBrowser` is not assignable to `InitScriptCapable` (missing `addCookies`).

- [ ] **Step 3: Relax the structural type and dispatch**

In `src/api/scenario/adapter.ts` replace the `InitScriptCapable` interface with:

```ts
type InitScriptArg = { key: string; value: string; origin: string };
type CookieRecord = { name: string; value: string; url: string };

interface InitScriptHost {
  addInitScript(script: (arg: InitScriptArg) => void, arg: InitScriptArg): Promise<unknown>;
}

/**
 * Structural subset of a browser-automation driver needed to inject a
 * serialized scenario before app boot. Dependency-free on purpose — any driver
 * exposing these methods works:
 *
 * - Playwright `BrowserContext`: `addInitScript` + `addCookies`
 * - WebdriverIO v9 `browser`: `addInitScript` + `setCookies`
 *
 * Methods return `Promise<unknown>` rather than `Promise<void>` because
 * Playwright's `addInitScript` resolves to a `Disposable` (1.49+).
 */
export type InitScriptCapable = InitScriptHost &
  ({ addCookies(cookies: CookieRecord[]): Promise<unknown> } | { setCookies(cookies: CookieRecord[]): Promise<unknown> });

const writeCookies = (context: InitScriptCapable, cookies: CookieRecord[]): Promise<unknown> =>
  'addCookies' in context ? context.addCookies(cookies) : context.setCookies(cookies);
```

and change the `if (options.ssr)` block to:

```ts
  if (options.ssr) {
    await writeCookies(context, [{ ...serializeScenarioCookie(scenario), url: options.origin }]);
  }
```

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @kakaocloud/mocking-gui lint && pnpm --filter @kakaocloud/mocking-gui exec vitest run src/api/scenario/__tests__/unit/adapter.test.ts src/__tests__/entries`
Expected: PASS (the existing Playwright-shaped `FakeContext` still compiles).

- [ ] **Step 5: Commit**

```bash
git add -A packages/mocking-gui/src
git commit -m "feat(scenario): accept setCookies-shaped drivers in applyScenario

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Prove runtime reuse in the `react-csr` example

**Files:**
- Modify: `examples/react-csr/src/mocks/handlers.ts`, `examples/react-csr/src/mocks/config.ts`

**Interfaces:**
- Consumes: `defineRegistry` from `@kakaocloud/mocking-gui/experimental`, `registry.handlers`.

- [ ] **Step 1: Read the current handlers file**

Run: `sed -n '1,30p' examples/react-csr/src/mocks/handlers.ts`
Note the exported symbol name (`handlers`) and its `HandlerConfigOption[]` annotation.

- [ ] **Step 2: Wrap the collection in a registry**

In `handlers.ts`: remove the `: HandlerConfigOption[]` annotation from the array, append `as const` after the closing `]`, and add at the bottom:

```ts
import { defineRegistry } from '@kakaocloud/mocking-gui/experimental';

/**
 * One declaration for two consumers: `registry.handlers` feeds
 * `MockingConfig.mocks`; `registry.pick(...)` authors scenarios.
 */
export const registry = defineRegistry(handlers);
```

Place the `import` at the top of the file per `import/order` (external group). Remove the now-unused `import type { HandlerConfigOption }` if nothing else uses it.

If any handler in the file uses a `responseVariantsFn` or a non-literal expression that `as const` cannot pin, keep it — the registry degrades that handler's names to `string`, which is documented behaviour.

In `config.ts` replace `mocks: handlers,` with `mocks: registry.handlers,` and update the import to `import { registry } from '@/mocks/handlers';`.

- [ ] **Step 3: Typecheck and lint the example**

Run: `pnpm --filter @kakaocloud/mocking-gui build && pnpm --filter react-csr exec tsc --noEmit && pnpm --filter react-csr lint`
(If the example's package name differs, read it from `examples/react-csr/package.json` `name`.)
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add examples/react-csr/src/mocks
git commit -m "docs(examples): declare react-csr handlers through defineRegistry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Documentation — entry points, experimental policy, programmatic scenarios

**Files:**
- Modify: `docs/guide/usage/api-guide.md`, `docs/guide/usage/scenario-guide.md`, `packages/mocking-gui/README.md`

- [ ] **Step 1: Add an "Entry Points" section to `api-guide.md`**

Insert directly after the intro line (`Definitions of key types …`) and before `## Configuration`:

````markdown
## Entry Points

The package is split into subpaths by **domain and runtime**, never by assumed usage. The root entry contains types only.

| Import path | Nature | Exports |
| --- | --- | --- |
| `@kakaocloud/mocking-gui` | Shared type contract (types only) | `MockingConfig`, `HandlerConfigOption`, `ReadonlyHandlerConfig`, `SwaggerSourceConfigOption`, `Scenario` |
| `@kakaocloud/mocking-gui/browser` | Browser runtime | `MockingGUIBoundary` |
| `@kakaocloud/mocking-gui/server` | Node / SSR runtime | `setupMockingServer` |
| `@kakaocloud/mocking-gui/experimental` | Pre-release features (see below) | currently: scenario authoring & injection API |

### Experimental features

Features published under the `alpha` / `beta` npm dist-tags are exported **only** from `@kakaocloud/mocking-gui/experimental`.

- This entry is **outside semver guarantees**: a minor release may change or remove anything in it. Pin an exact version if you depend on it.
- Exported symbols carry an `@experimental` JSDoc tag.
- When a feature graduates it moves to its domain entry in a minor release (the scenario API is planned for `@kakaocloud/mocking-gui/scenario` in `1.1.0`). The old export stays in `/experimental` as `@deprecated` for **one minor release**, then is removed.
- Install pre-releases with `npm i @kakaocloud/mocking-gui@alpha` (or `@beta`).

### Readonly handler declarations

`MockingConfig.mocks` accepts `readonly ReadonlyHandlerConfig[]`, so handler collections may be declared with `as const`. That is what lets the scenario API infer handler and variant names as literals.

```ts
import type { ReadonlyHandlerConfig } from '@kakaocloud/mocking-gui';

// Preferred: declare inline in defineRegistry — no `as const`, no `satisfies` needed.
const registry = defineRegistry([
  { name: 'Users', url: '/api/users', method: 'get', responseVariants: [{ name: 'Success', status: 200 }] },
]);

// When the array lives in its own variable:
export const handlers = [
  { name: 'Users', url: '/api/users', method: 'get', responseVariants: [{ name: 'Success', status: 200 }] },
] as const satisfies readonly ReadonlyHandlerConfig[];

// Existing arrays annotated as HandlerConfigOption[] still work; only name
// autocomplete degrades to `string`. Runtime validation is unchanged.
```
````

Also update the `MockingConfig` snippet in the same file: `mocks?: HandlerConfigOption[];` → `mocks?: readonly ReadonlyHandlerConfig[];` with the comment `/** Handler collection. Accepts \`as const\` declarations. */`.

- [ ] **Step 2: Add a "Programmatic Scenarios" section to `scenario-guide.md`**

Append at the end of the file:

````markdown
## Programmatic Scenarios & Test Injection (experimental)

> Exported from `@kakaocloud/mocking-gui/experimental`. See [Entry Points](./api-guide#entry-points) for the stability policy.

Scenarios can be declared in code with full type inference and injected into a browser before the app boots, so E2E runs, screenshot jobs or Storybook stories start from a known mock state.

### 1. Declare a registry

```ts
// src/mocks/registry.ts
import { defineRegistry } from '@kakaocloud/mocking-gui/experimental';

export const registry = defineRegistry([
  {
    name: 'Users',
    url: '/api/users',
    method: 'get',
    responseVariants: [
      { name: 'Success', status: 200, body: { items: [{ id: 1, name: 'kim' }] } },
      { name: 'Empty', status: 200, body: { items: [] } },
      { name: 'Error', status: 500, body: { message: 'internal error' } },
    ],
  },
]);

// The same declaration drives the GUI at runtime:
export const mockConfig = { mocks: registry.handlers };
```

Handler and variant names are literal types, so `registry.pick('Usres', …)` or `registry.pick('Users', 'Nope')` fail to compile.

### 2. Compose scenarios

```ts
import { defineScenario, extendScenario } from '@kakaocloud/mocking-gui/experimental';
import { registry } from '../src/mocks/registry';

export const happy = defineScenario('happy path', [registry.pick('Users', 'Success')]);
export const slow = defineScenario('slow list', [registry.pick('Users', 'Success', { delay: 3000 })]);
export const failing = extendScenario(happy, 'list fails', [registry.pick('Users', 'Error')]);
```

Picking the same handler twice inside one `defineScenario` is a compile error; use `extendScenario` to override deliberately.

### 3. Inject before boot

**Playwright / WebdriverIO v9** (any driver with `addInitScript` and `addCookies` or `setCookies`):

```ts
import { applyScenario } from '@kakaocloud/mocking-gui/experimental';

test('renders users', async ({ context, page }) => {
  await applyScenario(context, happy, { origin: 'http://localhost:5173', ssr: true });
  await page.goto('http://localhost:5173');
});
```

`ssr: true` also writes the sync cookie so a server-rendered first paint sees the same scenario.

**Cypress, Storybook, or anything running inside the page**: use `serializeScenario` and write the pair to `localStorage` yourself.

```ts
import { serializeScenario } from '@kakaocloud/mocking-gui/experimental';

const { key, value } = serializeScenario(happy);
cy.visit('/', { onBeforeLoad: win => win.localStorage.setItem(key, value) });
```
````

- [ ] **Step 3: Add an "Entry points" pointer to the package README**

In `packages/mocking-gui/README.md`, after the `### 2. Integration` code block (line ~95, before `## Development`), add:

```markdown
### 3. Entry points

| Path | Contents |
| --- | --- |
| `@kakaocloud/mocking-gui` | types only |
| `@kakaocloud/mocking-gui/browser` | `MockingGUIBoundary` |
| `@kakaocloud/mocking-gui/server` | `setupMockingServer` |
| `@kakaocloud/mocking-gui/experimental` | pre-release features, outside semver — see the [API guide](https://kakaoenterprise.github.io/mocking-gui/guide/usage/api-guide#entry-points) |
```

Check the docs site base URL in `docs/.vitepress/config.ts` (`base`) and adjust the link if it differs.

- [ ] **Step 4: Lint markdown (prettier) and commit**

Run: `pnpm --filter @kakaocloud/mocking-gui exec prettier --check ../../docs/guide/usage/api-guide.md ../../docs/guide/usage/scenario-guide.md README.md` (fix with `--write` if needed).

```bash
git add docs/guide/usage packages/mocking-gui/README.md
git commit -m "docs: document entry point policy, experimental lifecycle, and programmatic scenarios

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Quality gate and run artifacts

**Files:**
- Modify: `agent-artifacts/workstreams/2026-09-11-entry-point-policy/manifest.yaml`
- Create: `agent-artifacts/workstreams/2026-09-11-entry-point-policy/reports/integrity-validation.md`, `reports/release-briefing.md`

- [ ] **Step 1: Full gate from repo root**

Run: `pnpm --filter @kakaocloud/mocking-gui lint && pnpm --filter @kakaocloud/mocking-gui exec vitest run && pnpm --filter @kakaocloud/mocking-gui build && pnpm -r --filter './examples/*' exec tsc --noEmit`
Expected: all clean. Record exact test count and dist listing.

- [ ] **Step 2: Verify package surface from the built artefacts**

```bash
cd packages/mocking-gui
node -e "import('./dist/experimental.js').then(m=>console.log(Object.keys(m).sort()))"
node -e "console.log(Object.keys(require('./dist/experimental.cjs')).sort())"
node -e "console.log(Object.keys(require('./package.json').exports))"
```
Expected: both print `[ 'applyScenario', 'defineRegistry', 'defineScenario', 'extendScenario', 'serializeScenario' ]`; exports keys are `.`, `./browser`, `./server`, `./experimental`, `./style.css`.

- [ ] **Step 3: Write `reports/integrity-validation.md`**

Contents: the exact commands from Steps 1–2 and their output (test count, dist files, exports keys). One section per gate (Lint / Test / Build / Examples / Package surface).

- [ ] **Step 4: Write `reports/release-briefing.md`**

Sections:
- **Version**: `1.0.6-alpha.2` (bump is done by release-it, not in this branch).
- **Breaking for alpha.1 users**: `./testing` → `./experimental`; `defineHandlers` → `defineRegistry`. Provide the two-line codemod:
  ```bash
  grep -rl "mocking-gui/testing" src e2e | xargs sed -i '' 's#mocking-gui/testing#mocking-gui/experimental#g; s/defineHandlers/defineRegistry/g'
  ```
- **New**: `registry.handlers`, `ReadonlyHandlerConfig`/`Scenario` from root, WebdriverIO-shaped drivers in `applyScenario`, per-entry surface tests.
- **Policy**: link ADR-0006; graduation target `./scenario` in `1.1.0`.
- **Not in this release**: dynamic `responseVariantsFn` scenarios, Puppeteer helper.

- [ ] **Step 5: Update manifest and commit**

In `manifest.yaml`: `current_phase: 4`, `status: completed`.

```bash
git add agent-artifacts/workstreams/2026-09-11-entry-point-policy
git commit -m "docs(artifacts): add integrity validation and release briefing for entry point policy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Promote the spec**

```bash
cp agent-artifacts/workstreams/2026-09-11-entry-point-policy/spec.md agent-artifacts/specs/entry-point-policy.md
```
In the run copy set frontmatter `status: promoted` and add `promoted_to: specs/entry-point-policy.md`; in the `specs/` copy set `status: active` and add `origin_run: 2026-09-11-entry-point-policy`. Commit:

```bash
git add agent-artifacts
git commit -m "docs(artifacts): promote entry-point-policy spec

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§3.3 A–I):** A → Task 3. B, C → Task 2. D → Task 4. E → Task 1. F → Task 3 (node-environment surface test with end-to-end `applyScenario`). G → Tasks 3–4. H → Task 7. I → Task 5. §5 verification → Task 8; the example-app criterion is satisfied at compile level by Task 6 (no Playwright dependency exists in `examples/`, so a live E2E run is out of scope and stated so in the release briefing).

**Type consistency:** `defineRegistry` is the name used from Task 2 onward everywhere (barrel, experimental entry, surface test, docs, example). `InitScriptCapable` remains the exported type name after Task 5; the surface test in Task 3 passes an object with `addCookies`, which still satisfies the union.

**Ordering note:** Task 3's surface test object literal uses `addInitScript: async (_script, arg) => …`; parameter types are inferred from `InitScriptCapable`, so no explicit annotations are required.
