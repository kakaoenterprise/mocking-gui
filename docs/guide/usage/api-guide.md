# API Reference

Definitions of key types and interfaces used in Mocking GUI.

## Configuration

### `MockingConfig`

The configuration object used in `config.ts`.

```typescript
interface MockingConfig {
  /** List of manually defined handlers */
  mocks?: HandlerConfigOption[];

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
