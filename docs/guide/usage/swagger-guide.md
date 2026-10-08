# Swagger Automation

Most projects have far more endpoints than anyone will write handlers for, and
the ones nobody got around to are the ones that fail silently in a demo. If the
API already has an OpenAPI document, the handlers can come from it.

Point the panel at a document URL and handlers are generated from its response
schemas — registered alongside the ones you wrote by hand, which keep
precedence.

## Overview

- Swagger-based handlers are useful for **Status Code-centric testing** (e.g., UI state transitions or error message displays based on response codes).
- Response bodies are **automatically generated** from Swagger schemas.
- Supports multiple response variants (success, error, edge cases) with proper status codes.
- You can easily extract manual handler code via **JSON Convert** if you need full customization.

## Setup

Enter the Swagger document information as an array in the `swagger` property of the `config.ts` file.

```typescript
// config.ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  // Manual handlers
  mocks: [],

  // Swagger Configuration
  swagger: [
    {
      name: 'My Service API',
      configUrl: 'https://api.example.com/v3/api-docs', // Swagger JSON URL
    },
  ],
};
```

## Option Details

Each Swagger configuration object (`SwaggerSourceOption`) has the following properties:

| Property    | Type     | Description                                                                                                                      | Required |
| :---------- | :------- | :------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `name`      | `string` | Name of the Swagger source to distinguish in the panel.                                                                          | Yes      |
| `configUrl` | `string` | URL providing the Swagger/OpenAPI specification (JSON).                                                                          | Yes      |
| `docsUrl`   | `string` | URL of the human-readable documentation page (e.g., Swagger UI). If set, a link is provided in the swagger panel.                | Optional |
| `serverUrl` | `string` | The domain (Base URL) of the target server that MSW will actually intercept. If not set, follows `servers` info in Swagger spec. | Optional |

### Example: Overriding `serverUrl`

If the Swagger document defines `https://dev-api.example.com`, but you want to send requests to `http://localhost:8080` in the local environment, or mock only a specific environment's API, you can explicitly specify the target using `serverUrl`.

```typescript
swagger: [
  {
    name: 'Backend API',
    configUrl: 'https://dev-api.example.com/v3/api-docs',
    serverUrl: 'https://api.myapp.com', // MSW will intercept requests to this domain.
  },
],
```

## How It Works

1. When Mocking GUI starts, it sends a request to `configUrl` from the browser to fetch the Swagger JSON.
2. It analyzes the fetched specification and automatically generates Mock Handlers for all API endpoints.
3. The generated handlers can be viewed in the **Mocking GUI Panel > Swagger Tab**.
4. Each handler is set to return a `Success (200)` response by default, and you can configure error responses or delays in the panel.

## Caveats

- **CORS**: The address specified in `configUrl` must be directly accessible from the browser, and CORS must be configured.
- **JSON Format**: Currently, it supports the JSON format of the OpenAPI 3.0+ specification.
