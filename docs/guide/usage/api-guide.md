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
   * Additional MSW RequestHandlers that are not managed by Mocking GUI.
   * Useful for GraphQL or WebSocket handlers.
   */
  onDemandHandlers?: RequestHandler[];
}
```

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
