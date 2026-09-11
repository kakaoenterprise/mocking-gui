# Mocking GUI

Mocking GUI is a GUI library based on MSW (Mock Service Worker) that provides a dedicated DevTools panel for managing mocks, testing scenarios, and inspecting Swagger/OpenAPI integrations.

## Features

- **MSW Integration**: Zero-config mocking based on MSW.
- **GUI Control**: Toggle mocks, change response variants, and inject delays in real-time.
- **Swagger/OpenAPI Support**: Auto-generate realistic response mocks from Swagger/OpenAPI specifications
- **Shareable Scenarios**: Group specific mock states into "Scenarios" for easy reproduction.
- **Server-side Sync**: Sync browser mock state to server components via cookies (prevents Hydration errors).

## Tech Stack

- React + TypeScript
- MSW (Mock Service Worker)
- Tailwind CSS + shadcn/ui
- Vite

## Requirements

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- React >= 19.2.1

## Installation

```bash
# Install dependency
$ pnpm add -D @kakaocloud/mocking-gui
```

## Usage

### 1. Configuration (Recommended)

Create a configuration file (e.g., `config.ts`) to manage your mock settings.

```typescript
// config.ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockingConfig: MockingConfig = {
  // 1. Mocks: Define your manual key-based request handlers
  mocks: [
    // ... your MSW handlers or handler state objects
  ],

  // 2. onDemandHandlers: Native MSW RequestHandlers (NOT GUI Controlled)
  // Useful for GraphQL, WebSocket or handlers that you don't want to control via GUI.
  onDemandHandlers: [...graphqlHandlers],

  // 3. Swagger: Configure Swagger sources for auto-generated mocks
  swagger: [
    {
      name: 'My Service API',
      configUrl: 'https://api.example.com/swagger/doc.json',
      serverUrl: 'https://api.example.com',
    },
  ],

  // 4. Worker: Configure the MSW Service Worker
  worker: {
    serviceWorker: {
      /**
       * The URL path where the MSW Service Worker script is served.
       * Defaults to '/mockServiceWorker.js'.
       */
      url: `${SERVICE_BASE_PATH}/mockServiceWorker.js`,
      options: {
        scope: './',
      },
    },
    onUnhandledRequest: 'bypass',
  },
};
```

### 2. Integration

Import `MockingGUIBoundary` and use it in your root component (e.g., `_app.tsx` or `main.tsx`).

```tsx
import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';
import { mockConfig } from './config';

function App() {
  return (
    <MockingGUIBoundary config={mockConfig}>
      <AppContent />
    </MockingGUIBoundary>
  );
}
```

### 3. Entry points

| Path                                   | Contents                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `@kakaocloud/mocking-gui`              | types only                                                                                                                                   |
| `@kakaocloud/mocking-gui/browser`      | `MockingGUIBoundary`                                                                                                                         |
| `@kakaocloud/mocking-gui/server`       | `setupMockingServer`                                                                                                                         |
| `@kakaocloud/mocking-gui/experimental` | pre-release features, outside semver — see the [API guide](https://kakaoenterprise.github.io/mocking-gui/guide/usage/api-guide#entry-points) |

## Development

```bash
# Install dependencies
$ pnpm i

# Initialize MSW
$ npx msw init <PUBLIC_DIR> [options]

# Start development server
$ pnpm dev

# Build
$ pnpm build
```

## Project Structure

```
src/
├── components/     # UI components
├── hooks/          # Logic hooks (useSetupMockingGUIWorker, etc.)
├── store/          # State management
├── styles/         # CSS files
├── utils/          # Helper functions
├── browser.ts      # Browser entry point
└── index.ts        # Main entry point
```
