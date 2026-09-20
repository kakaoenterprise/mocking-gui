# Mocking GUI Examples

This directory contains examples demonstrating how to integrate Mocking GUI with different frameworks and rendering strategies.

## Examples

### 0. Shared Mocks

- **Path**: [`shared`](./shared)
- **What it is**: Mock data every example reuses — constants, factories, request utils and
  handlers. A plain directory reached through the `@shared/*` alias, **not** a workspace
  package.
- **Why**: each example used to declare its own handlers, so fixtures drifted apart. Shared
  handlers now live in one place; each example adds only its own extras.

### 1. React + Vite (CSR)

- **Path**: [`react-csr`](./react-csr)
- **Features**: Client-Side Rendering (CSR), React, Vite.
- **Key Concept**: Service Worker interception in the browser.
- **Structure**:
  - `src/features/user`: Feature-based module containing API logic, hooks, and UI components.
  - `src/mocks`: composes [`shared`](./shared) handlers with example-local ones.

### 2. Next.js App Router (SSR + CSR)

- **Path**: [`next-app-router`](./next-app-router)
- **Features**: Server-Side Rendering (SSR), React Server Components (RSC), Next.js App Router.
- **Key Concept**: Synchronization between Server (via cookies) and Client (via Service Worker).
- **Structure**:
  - `app/features/user`: Contains both Server (`UserProfileServer`) and Client (`UserProfileClient`) components.
  - `app/components/ui`: Shared UI components like `APITester`.
  - `mocks`: composes [`shared`](./shared) handlers with example-local ones.

## How to Run

Each example is a workspace package. You can run them from the root:

```bash
# Run React + Vite example (CSR)
pnpm --filter react-csr dev

# Run Next.js App Router example (SSR/RSC)
pnpm --filter next-app-router dev
```

## Sharing mock data between examples

`examples/shared` is a plain directory, not a package. Examples reach it via `@shared/*`:

- `tsconfig.json` → `compilerOptions.paths` (Next.js resolves straight from this)
- `vite.config.ts` → `resolve.alias` (Vite additionally needs the bundler-side alias)

`@kakaocloud/mocking-gui` is also declared in the **root** `package.json`, so pnpm links it
at the workspace root and files under `shared/` can resolve it. See
[`shared/README.md`](./shared/README.md) for the layout and what each handler demonstrates.

## Testing with Mocking GUI

1. Open the example application in your browser.
2. Click the **Mocking GUI button** (bottom-left corner) to open the Mocking GUI Panel.
3. Navigate to the **Mocks** tab.
4. Modify the response **Variant** (e.g., Success -> Error).
5. Click **Refetch** in the UI to see the updated response.
   - For CSR: Updates instantly.
   - For SSR: Updates on page refresh (or router refresh), demonstrating cookie synchronization.
