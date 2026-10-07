# Mocking GUI Examples

This directory contains examples demonstrating how to integrate Mocking GUI with different frameworks and rendering strategies.

## Examples

### 1. React + Vite (CSR)

- **Path**: [`react-csr`](./react-csr)
- **Features**: Client-Side Rendering (CSR), React, Vite.
- **Key Concept**: Service Worker interception in the browser.
- **Structure**:
  - `src/features/user`: Feature-based module containing API logic, hooks, and UI components.
  - `src/mocks`: mock handlers and configuration.

### 2. Next.js App Router (SSR + CSR)

- **Path**: [`next-app-router`](./next-app-router)
- **Features**: Server-Side Rendering (SSR), React Server Components (RSC), Next.js App Router.
- **Key Concept**: Synchronization between Server (via cookies) and Client (via Service Worker).
- **Structure**:
  - `app/features/user`: Contains both Server (`UserProfileServer`) and Client (`UserProfileClient`) components.
  - `app/components/ui`: Shared UI components like `APITester`.

### 3. Showcase (live demo)

- **Path**: [`showcase`](./showcase)
- **Features**: Every capability in one page — Manual/Auto/Swagger handler types, all five `rawBody` kinds, per-handler delay, passthrough, `onDemandHandlers`, shareable scenarios.
- **Key Concept**: This is the app published at
  [kakaoenterprise.github.io/mocking-gui/demo](https://kakaoenterprise.github.io/mocking-gui/demo/).
  It is bundled into the docs site by `pnpm demo:build`, which builds it with
  `base=/mocking-gui/demo/` into `docs/public/demo`.
- **Structure**:
  - `src/mocks/{constants,factories,handlers}`: the mandated layer separation, doubling as a reference for how to organize mock data.
  - `src/mocks/seedDefaults.ts`: activates handlers on a visitor's first load (see its comment for why this is needed).

## How to Run

Each example is a workspace package. You can run them from the root:

```bash
# Run React + Vite example (CSR)
pnpm --filter react-csr dev

# Run Next.js App Router example (SSR/RSC)
pnpm --filter next-app-router dev

# Run the showcase demo
pnpm demo:dev

# Build the showcase exactly as it is published, then preview it at
# http://localhost:4173/mocking-gui/demo/
pnpm demo:build && pnpm docs:build && pnpm docs:preview
```

> When previewing, restart `docs:preview` after every rebuild — it caches its
> file listing at startup and will otherwise serve the previous bundle.

## Testing with Mocking GUI

1. Open the example application in your browser.
2. Click the **Mocking GUI button** (bottom-left corner) to open the Mocking GUI Panel.
3. Navigate to the **Mocks** tab.
4. Modify the response **Variant** (e.g., Success -> Error).
5. Click **Refetch** in the UI to see the updated response.
   - For CSR: Updates instantly.
   - For SSR: Updates on page refresh (or router refresh), demonstrating cookie synchronization.
