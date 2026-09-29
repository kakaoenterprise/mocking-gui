# Handler Guide

This guide explains how to write handlers for Mocking GUI.

## Basic Structure

Handlers define a URL and method, along with multiple possible pre-defined responses (`responseVariants`).

```typescript
import { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export const userHandlers: HandlerConfigOption[] = [
  {
    // 1. Basic Information
    name: 'Get User Profile', // Name displayed in the panel
    url: `${BASE_URL}/api/user/:id`, // Path (supports path parameters)
    method: 'get', // HTTP Method

    // 2. Response Variants List (for Manual Mode)
    responseVariants: [
      {
        name: 'Success', // Default success response
        status: 200,
        body: { id: 1, name: 'Alice', role: 'user' },
      },
      {
        name: 'Admin User', // Different data case
        status: 200,
        body: { id: 2, name: 'Bob', role: 'admin' },
      },
      {
        name: 'Unauthorized', // Error case
        status: 401,
        body: { message: 'Login required' },
      },
    ],

    // 3. Dynamic Response Generation (for Auto Mode) - Optional
    // Use when you want to generate responses dynamically based on request parameters or logic
    responseVariantsFn: ({ params }) => {
      const { id } = params;
      return {
        name: 'Dynamic User',
        status: 200,
        body: { id: Number(id), name: `User ${id}`, role: 'user' },
      };
    },
  },
];
```

## Field Details

### `HandlerState`

| Field                | Type                       | Description                                                      |
| -------------------- | -------------------------- | ---------------------------------------------------------------- |
| `name`               | `string`                   | Handler name displayed in the Mocking GUI Panel list             |
| `url`                | `string`                   | URL path to intercept. Supports Path Parameters (`:id`)          |
| `method`             | `'get' \| 'post' \| ...`   | HTTP Method                                                      |
| `responseVariants`   | `HandlerResponseVariant[]` | (Manual) List of selectable responses                            |
| `responseVariantsFn` | `Function`                 | (Auto) Function for dynamic response generation based on request |
| `category`           | `string` (Optional)        | Category for grouping/filtering handlers                         |

### `HandlerResponseVariant`

| Field     | Type                     | Description                                          |
| --------- | ------------------------ | ---------------------------------------------------- |
| `name`    | `string`                 | Name of the response case (e.g., Success, Error 500) |
| `status`  | `number`                 | HTTP Status Code                                     |
| `body`    | `any`                    | Response Body (JSON)                                 |
| `headers` | `Record<string, string>` | Response Headers (Optional)                          |
| `delay`   | `number`                 | Response delay time (ms) (Optional)                  |

## Swagger Integration

Instead of manually writing handlers, you can load Swagger (OpenAPI) documents to automatically generate handlers.

`config.ts`:

```typescript
export const mockConfig: MockingConfig = {
  mocks: [], // Can be used together with manual handlers
  swagger: [
    {
      name: 'Petstore API',
      configUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
      // Set if the API server Base URL differs from the Swagger document
      serverUrl: 'https://api.petstore.com',
    },
  ],
};
```

## Escape Hatch: `onDemandHandlers`

Mocking GUI only manages the MSW `http` namespace. If your project also uses MSW features that Mocking GUI does not provide — `graphql.*`, `ws.*`, or a handler you intentionally do not want to control from the panel — pass those native `RequestHandler`s through `onDemandHandlers`.

```typescript
import { graphql, HttpResponse } from 'msw';
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  // ✅ Every http.* handler belongs here — visible and controllable in the panel
  mocks: [userHandlers, orderHandlers].flat(),

  // ✅ Only what Mocking GUI cannot express
  onDemandHandlers: [
    graphql.query('GetViewer', () => HttpResponse.json({ data: { viewer: { id: '1' } } })),
  ],
};
```

### What `onDemandHandlers` does (and does not) do

`onDemandHandlers` is passed **straight to MSW**. The handlers never enter Mocking GUI's handler store, so:

| Behavior                                     | `mocks` (`HandlerConfigOption`) | `onDemandHandlers` (native MSW) |
| -------------------------------------------- | ------------------------------- | ------------------------------- |
| Listed in the API tab of the panel           | ✅                              | ❌ Never                        |
| Toggle on/off, pick variant, add delay       | ✅                              | ❌ Always on, as you wrote it   |
| Included in Scenarios                        | ✅                              | ❌                              |
| Applied on the server (`setupMockingServer`) | ✅                              | ❌ Browser worker only          |
| Supports `graphql.*` / `ws.*`                | ❌                              | ✅                              |

> [!WARNING]
> A handler that is in `onDemandHandlers` but not in the panel is **not a bug** — it is the defining property of `onDemandHandlers`. If you expected to see it in the panel, it belongs in `mocks`.

### Migrating an existing MSW project

When converting legacy `setupWorker(...handlers)` code, apply this rule per handler:

| Legacy MSW handler                           | Where it goes                                          |
| -------------------------------------------- | ------------------------------------------------------ |
| `http.get / post / put / patch / delete / …` | Convert to `HandlerConfigOption` and put it in `mocks` |
| `graphql.query / mutation / …`               | Keep as-is, put it in `onDemandHandlers`               |
| `ws.link(...)`                               | Keep as-is, put it in `onDemandHandlers`               |

Do **not** drop an array of `http.*` handlers into `onDemandHandlers` to save conversion effort. It will "work" in the sense that requests are mocked, but the panel stays empty, nothing can be toggled, and the same handlers are silently missing on the server side. That is the exact situation that gets reported as "Mocking GUI is not showing my handlers".

### Registering the same endpoint in both `mocks` and `onDemandHandlers`

Do not do this. Mocking GUI registers its converted `mocks` **first**, then `onDemandHandlers`, and MSW stops at the first handler that returns a response. A `mocks` entry that is turned off in the panel does not fall through to the next handler — it returns `passthrough()`, which MSW also treats as a response.

| Panel state of the `mocks` entry | Which handler answers the request        |
| -------------------------------- | ---------------------------------------- |
| On, variant selected             | The `mocks` entry (selected variant)     |
| Off / no variant                 | Nobody — request goes to the real server |

In both cases the `onDemandHandlers` copy is dead code. Keep each endpoint in exactly one place.
