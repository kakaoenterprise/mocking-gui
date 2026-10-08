# API Reference

Definitions of key types and interfaces used in Mocking GUI.

## Entry Points

The package is split into subpaths by **domain and runtime**, never by assumed usage. The root entry contains types only.

| Import path                            | Nature                            | Exports                                                                                                  |
| -------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `@kakaocloud/mocking-gui`              | Shared type contract (types only) | `MockingConfig`, `HandlerConfigOption`, `ReadonlyHandlerConfig`, `SwaggerSourceConfigOption`, `Scenario` |
| `@kakaocloud/mocking-gui/browser`      | Browser runtime                   | `MockingGUIBoundary`                                                                                     |
| `@kakaocloud/mocking-gui/server`       | Node / SSR runtime                | `setupMockingServer`                                                                                     |
| `@kakaocloud/mocking-gui/experimental` | Pre-release features (see below)  | currently: scenario authoring & injection API                                                            |

### Experimental features

Features published under the `alpha` / `beta` npm dist-tags are exported **only** from `@kakaocloud/mocking-gui/experimental`.

- This entry is **outside semver guarantees**: a minor release may change or remove anything in it. Pin an exact version if you depend on it.
- Exported symbols carry an `@experimental` JSDoc tag.
- When a feature graduates it moves to its domain entry in a minor release (the scenario API is planned for `@kakaocloud/mocking-gui/scenario` in `1.1.0`). The old export stays in `/experimental` as `@deprecated` for **one minor release**, then is removed.
- Install pre-releases with `npm i @kakaocloud/mocking-gui@alpha` (or `@beta`).

### Readonly handler declarations

`MockingConfig.mocks` accepts `readonly ReadonlyHandlerConfig[]`, so handler collections may be declared with `as const`. That is what lets the scenario API infer handler and variant names as literals.

```ts
import { defineRegistry } from '@kakaocloud/mocking-gui/experimental';
import type { ReadonlyHandlerConfig } from '@kakaocloud/mocking-gui';

// Preferred: declare inline in defineRegistry — no `as const`, no `satisfies` needed.
const registry = defineRegistry([
  {
    name: 'Users',
    url: '/api/users',
    method: 'get',
    responseVariants: [{ name: 'Success', status: 200 }],
  },
]);

// When the array lives in its own variable:
export const handlers = [
  {
    name: 'Users',
    url: '/api/users',
    method: 'get',
    responseVariants: [{ name: 'Success', status: 200 }],
  },
] as const satisfies readonly ReadonlyHandlerConfig[];

// Existing arrays annotated as HandlerConfigOption[] still work; only name
// autocomplete degrades to `string`. Runtime validation is unchanged.
```

## Configuration

### `MockingConfig`

The configuration object used in `config.ts`.

```typescript
interface MockingConfig {
  /** Handler collection. Accepts `as const` declarations. */
  mocks?: readonly ReadonlyHandlerConfig[];

  /** List of Swagger/OpenAPI configurations */
  swagger?: SwaggerSourceConfigOption[];

  /** MSW Worker related settings */
  worker?: WorkerStartOptions;

  /**
   * Escape hatch: native MSW RequestHandlers passed straight to the worker.
   * Only for MSW features Mocking GUI does not provide (graphql.*, ws.*).
   * NOT shown in the panel, NOT toggleable, NOT applied on the server.
   * Every http.* handler belongs in `mocks`, not here.
   */
  onDemandHandlers?: RequestHandler[];

  /**
   * Mirror panel state into the `mocking_gui_sync` cookie read by
   * `setupMockingServer`. Default `true`. Set `false` in browser-only
   * projects to keep the cookie off every request.
   */
  ssrSync?: boolean;
}
```

#### `onDemandHandlers` vs `mocks`

| Behavior                              | `mocks` | `onDemandHandlers` |
| ------------------------------------- | ------- | ------------------ |
| Visible / controllable in the panel   | ✅      | ❌                 |
| Included in Scenarios                 | ✅      | ❌                 |
| Applied by `setupMockingServer` (SSR) | ✅      | ❌                 |
| Registration order in MSW             | first   | after `mocks`      |
| `graphql.*` / `ws.*` support          | ❌      | ✅                 |

Because `mocks` is registered first and a disabled `mocks` entry returns `passthrough()`, registering the same endpoint in both places makes the `onDemandHandlers` copy unreachable. See the [Handler Guide](./handler-guide#escape-hatch-ondemandhandlers) for the migration rule.

### `SwaggerSourceConfigOption`

```typescript
interface SwaggerSourceConfigOption {
  /** Name to display in the panel */
  name: string;

  /** URL of the Swagger JSON document */
  configUrl: string;

  /** (Optional) Base URL to send actual API requests to (use if different from the host in Swagger doc) */
  serverUrl?: string;
}
```

## Server-Side

### `setupMockingServer`

Sets up the mocking server in Node.js environments (e.g., Next.js SSR, RSC).

It returns `null` with a console warning only when called in a browser (a DOM is present and no Node.js runtime is detected); Node-based test environments such as `jsdom` and `happy-dom` create the server as usual.

```typescript
import { setupMockingServer } from '@kakaocloud/mocking-gui/server';

// Usage example
const server = await setupMockingServer({
  ...MockingConfig,
  cookie: '...', // Browser cookie string (for client state synchronization)
});

server.listen(); // Start intercepting requests
server.close(); // Stop intercepting requests
```

#### How `cookie` synchronization works

The GUI panel keeps the browser and the server in step through one cookie, `mocking_gui_sync`.

- It lists only the handlers that are **enabled** in the panel. Each entry is a short hash of the handler key plus the response type and variant, and those two are written only when they differ from the handler's default. Disabled handlers are not sent at all, so the cookie carries the delta from the default state.
- The server resolves each hash against the handlers it registered from `mocks` and `swagger`. Both sides must therefore be configured with the same handlers (same `url`, `method`, and Swagger `serverUrl`).
- Every write first removes any `mocking_gui_sync*` cookie a previous write left behind, so stale state never accumulates in the request header.
- The value is budgeted at 3 800 bytes (roughly 300 enabled handlers). Beyond that, Swagger handler overrides are dropped first and a warning naming them is logged in the browser console; if Manual/Auto overrides alone exceed the budget, trailing ones are dropped too so that the leading ones still sync, with a warning. The budget exists because request headers have a total limit (16 KB in Node, 8 KB in nginx) shared with every other cookie on the site.
- The value uses only characters that `encodeURIComponent` leaves untouched, so cookie APIs that re-serialize values (such as Next.js `cookies().toString()`) pass it through unchanged.
- If your project never calls `setupMockingServer`, pass `ssrSync: false` in `MockingConfig`. The cookie is then not written at all, and any `mocking_gui_sync*` cookie an earlier version left behind is removed on the next panel change.

## Types

### `HandlerConfigOption`

The core interface defining the state of each API handler.

```typescript
interface HandlerConfigOption {
  name: string;
  description?: string;
  url: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

  /**
   * (Manual Mode) List of statically defined response variants
   */
  responseVariants?: HandlerResponseVariant[];

  /**
   * (Auto Mode) Function to dynamically generate a response based on request info (params, request, etc.)
   */
  responseVariantsFn?: (info: HttpResolverInfo) => HandlerResponseVariant;

  /** Default delay time (ms) */
  delay?: number;
}
```

### `HandlerResponseVariant`

```typescript
interface HandlerResponseVariant {
  name: string;
  status: number;
  headers?: HeadersInit;
  body?: JsonBodyType; // JSON response body
  rawBody?: RawBody; // text, html, binary, etc.
}
```
