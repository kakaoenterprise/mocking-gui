# Mocking GUI Atomic Specification: HandlerConfigOption

The atomic data specification that must be followed for the Mocking GUI library's core engine to recognize mocking and control it via the GUI.

---

## 1. Public API Entry Points

```typescript
// Browser environment entry point (browser.ts)
export { MockingGUIBoundary } from '@kakaoenterprise/mocking-gui/browser';

// Server environment entry point (server.ts)
export { setupMockingServer } from '@kakaoenterprise/mocking-gui/server';

// Common types (index.ts)
export type {
  HandlerConfigOption,
  MockingConfig,
  SwaggerSourceConfigOption,
} from '@kakaoenterprise/mocking-gui';
```

---

## 2. MockingConfig Interface (Actual Types)

```typescript
// Browser-side configuration
export type MockingConfig = {
  mocks?: HandlerConfigOption[]; // List of manual handlers
  swagger?: SwaggerSourceConfigOption[]; // Swagger auto-loading configuration
  worker?: WorkerStartOptions; // MSW Worker configuration (serviceWorker.url, etc.)
  onDemandHandlers?: RequestHandler[]; // Escape hatch: native MSW handlers (graphql.*, ws.*) — NOT GUI-managed
};

// Server-side configuration (for SSR/RSC)
export type MockingServerConfig = MockingConfig & {
  cookie?: string | null; // Browser cookie string (for SSR state synchronization)
};
```

> **CRITICAL — `onDemandHandlers` routing rule**
>
> - `onDemandHandlers` is an **escape hatch only** for MSW features Mocking GUI does not provide (`graphql.*`, `ws.*`). It is passed straight to `worker.resetHandlers(...)` **after** the converted `mocks`, never enters the handler store, and is therefore **never shown in the GUI panel**, not toggleable, not part of scenarios, and **ignored by `setupMockingServer`** (browser only).
> - **Every `http.*` handler MUST be converted to `HandlerConfigOption` and registered in `mocks`.** Putting `http.*` handlers in `onDemandHandlers` during a migration is a defect: it produces an empty panel that users report as "handlers not showing".
> - **Never register the same endpoint in both `mocks` and `onDemandHandlers`.** `mocks` is registered first; a disabled `mocks` entry returns `passthrough()`, which MSW treats as a response, so the `onDemandHandlers` copy is unreachable in every case.

---

## 3. HandlerConfigOption Interface

Mocking GUI engineers never call `msw`'s `http.get` etc. directly. Instead, they define objects with the structure below and inject them into the Mocking GUI engine.

```typescript
export interface HandlerConfigOption {
  name: string; // Handler identifier displayed in the GUI panel
  description?: string; // Detailed description
  url: string; // API path to intercept (absolute path required for cross-origin)
  method: keyof typeof http; // HTTP method (get/post/put/patch/delete, etc.)

  responseVariants?: HandlerResponseVariant[]; // Static response cases (Manual Mode)
  responseVariantsFn?: (info: HttpResolverInfo) => HandlerResponseVariant; // Dynamic response (Auto Mode)
  delay?: number; // Default delay time (ms)
}
```

---

## 4. HandlerResponseVariant (Response Cases)

```typescript
export interface HandlerResponseVariant {
  name: string; // Case name (e.g., "Success", "401 Unauthorized")
  status: number; // HTTP status code
  body?: JsonBodyType; // JSON response body (rawBody takes priority when used together)
  headers?: HeadersInit; // Response headers (Optional)
  rawBody?: RawBody; // Non-JSON response (see below)
}

// rawBody: used when a non-JSON response is required
export type RawBody =
  | { kind: 'text'; value: string }
  | { kind: 'html'; value: string }
  | { kind: 'xml'; value: string }
  | { kind: 'binary'; value: Uint8Array | ArrayBuffer }
  | { kind: 'arrayBuffer'; value: ArrayBuffer | SharedArrayBuffer }
  | { kind: 'formData'; value: FormData };
```

---

## 5. HandlerType Enum (Operation Modes)

```typescript
export enum HandlerType {
  MANUAL = 'Manual', // Based on responseVariants array - static response selection
  AUTO = 'Auto', // Based on responseVariantsFn - dynamically generated from request parameters
  SWAGGER = 'Swagger', // Based on swaggerResponseVariants automatically converted from Swagger JSON
}
```

**Mode determination priority**: `responseVariants` present → MANUAL, `responseVariantsFn` present → AUTO, `swaggerResponseVariants` present → SWAGGER.

---

## 6. HttpResolverInfo (Auto Mode Argument)

```typescript
export type HttpResolverInfo = {
  params: PathParams; // URL path parameters (:id, etc.)
  request: Request; // Original Request object
  cookies?: Record<string, string>; // Request cookies
};
```

---

## 7. SwaggerSourceConfigOption

```typescript
export interface SwaggerSourceConfigOption {
  name: string; // Identifier within the panel
  configUrl: string; // OpenAPI JSON URL (must be directly accessible; CORS required)
  docsUrl?: string; // Swagger UI page URL (for panel link)
  serverUrl?: string; // Domain targeted by MSW interception (specify when different from servers in Swagger spec)
}
```

---

## 8. Raw MSW → Mocking GUI Conversion Rules

**[BEFORE: Raw MSW]**

```typescript
http.get('/api/users', () => HttpResponse.json([{ id: 1 }]));
```

**[AFTER: Mocking GUI Spec]**

```typescript
{
  name: 'Get User List',
  url: 'https://api.example.com/api/users',  // Absolute path required for cross-origin
  method: 'get',
  responseVariants: [
    { name: 'Default Success', status: 200, body: [{ id: 1 }] },
    { name: 'Server Error', status: 500, body: { message: 'Internal Server Error' } },
  ]
}
```

---

## 9. MockingConfig Integration

```typescript
// config.ts
import type { MockingConfig } from '@kakaoenterprise/mocking-gui';

export const mockingConfig: MockingConfig = {
  mocks: [...handlers],
  swagger: [{ name: 'My API', configUrl: 'https://api.example.com/v3/api-docs' }],
  worker: {
    serviceWorker: {
      url: '/mockServiceWorker.js', // If base path exists: `${BASE_PATH}/mockServiceWorker.js`
    },
  },
};
```

All handlers must be registered in the `mocks` array for the Mocking GUI engine to recognize them and make them controllable from the GUI.
