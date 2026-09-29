# Mocking GUI System Integration

Integration standard between the @kakaocloud/mocking-gui library architecture and MSW/Service Worker.

---

## 1. Layered Architecture

Mocking GUI aims for a layered structure that goes beyond simple MSW handler usage.

- **Handlers** (`HandlerConfigOption[]`): Defines network entry points that the GUI can recognize.
- **Factories**: Mock data generators (using faker.js, etc.). Injected into `responseVariantsFn` or `responseVariants`.
- **Constants**: Manages fixed Base URLs, API paths, and default response values.
- **Scenario Manager**: `draftScenario` → save as `Scenario`, apply via `activateScenario()`.

---

## 2. HandlerState → MSW Conversion Flow

```
HandlerConfigOption (mocks[])
  + swaggerResponseVariants (merged after Swagger loading)
  → HandlerState[]
  → convertToMswHandler(handlers, handlerConfigs)
  → HttpHandler[]
  → worker.resetHandlers(...handlers)
```

- `handlerConfigs[key].active = false` → `passthrough()` (forwarded to the real server)
- If `rawBody` is present, `HttpResponse.text/html/xml/formData/arrayBuffer` is used instead of `HttpResponse.json()`

---

## 3. State Sync Patterns

- **LocalStorage → Worker**: `worker.resetHandlers()` is re-called every time `handlerConfigs` changes.
- **Browser → SSR (Cookie Bridge)**: `syncStateToCookie()` with 300ms debounce → refreshes the `mocking_gui_sync` cookie → parsed server-side by `setupMockingServer({ cookie })`.
- **Swagger Loading**: `useSwaggerHandlerSetup` → parallel fetch → `mergeHandlersWithSwagger()` → `setupInitialState()`.

---

## 4. Constraint

- All HTTP handlers must be registered in `mocks[]` as `HandlerConfigOption` format to be GUI-controllable.
- Use MSW's `HttpResponse` factory instead of directly creating `new Response()`.
- Service Worker configuration is managed in `worker.serviceWorker.url` (path to `mockServiceWorker.js`).
- Cross-origin requests require an absolute URL including domain. Same-origin requests may use relative paths.
- GraphQL/WebSocket handlers are not GUI-managed; pass them via `onDemandHandlers`. They are appended after the converted `mocks` in `worker.resetHandlers(...)`, never appear in the panel, and are not applied by `setupMockingServer`.
- Never register the same endpoint in `mocks` and `onDemandHandlers`: `mocks` wins, and a disabled `mocks` entry returns `passthrough()` (MSW stops there), so the duplicate is unreachable.
