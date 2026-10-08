# Installation & Setup

You have an app that calls an API, and you want a panel in it. This takes a
package, a Service Worker file and one component — about three minutes, most of
which is the install.

## Requirements

Peer dependencies, taken from the package itself:

- **msw** `^2.8.0`
- **react** / **react-dom** `^18.0.0 || ^19.0.0`

Any package manager works. The Node and pnpm versions pinned in this repository
are for building it, not for using it.

## 1. Install Package

Install the package as a development dependency (`devDependencies`).

```bash
pnpm add -D @kakaocloud/mocking-gui
```

## 2. Initialize MSW

Mocking GUI uses MSW (Mock Service Worker) internally. You need to create a Service Worker script in your project's static file directory (e.g., `public/`).

```bash
npx msw init <PUBLIC_DIR> [options]
```

> **Note**: `public/` is the standard static file directory. Adjust the path according to your framework's structure (e.g., Next.js, Vite).

## 3. Create Configuration File (`config.ts`)

Create a configuration file in your project root or `mocks/` directory.

```typescript
// config.ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  // 1. Mocks: Define manual handlers (Optional)
  mocks: [
    {
      name: 'Get User',
      url: `${BASE_PATH}/api/user`,
      method: 'get',
      responseVariants: [
        {
          name: 'Success',
          status: 200,
          body: { id: 1, name: 'John Doe' },
        },
      ],
    },
  ],

  // 2. Swagger: Automatically load Swagger JSON (Optional)
  // Refer to the 'Swagger Management' guide for details.
  swagger: [],

  // 3. Worker: Service Worker configuration (Optional)
  // Required if the application uses a base path (e.g., /services)
  worker: {
    serviceWorker: {
      url: `${BASE_PATH}/mockServiceWorker.js`,
      options: {
        scope: './',
      },
    },
  },
};
```

## 4. Framework Integration

> [!WARNING]
> Always combine it with a `NODE_ENV === 'development'` check.
> If you rely solely on the env variable, the Mocking GUI Panel could be accidentally exposed in staging or production environments.

There are two recommended patterns depending on your needs:

- **Always enable in development** — If you want Mocking GUI active whenever `NODE_ENV === 'development'`, an `IS_DEV` check alone is sufficient. No extra env variable needed.
- **Opt-in within development** — If you want to control whether Mocking GUI is enabled even in a development environment (e.g., some developers on the team prefer it off by default), combine `IS_DEV` with an additional env variable like `VITE_ENABLE_MOCKING_GUI` or `NEXT_PUBLIC_ENABLE_MOCKING_GUI`.

> [!TIP]
> Not sure which to choose? Start with the `IS_DEV`-only approach. Add an env variable later if your team needs finer control.

### React (Vite, CRA)

Add `MockingGUIBoundary` to your top-level component (e.g., `App.tsx` or `main.tsx`).

```tsx
import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';
import { mockConfig } from './config';

const IS_DEV = import.meta.env.DEV;

function App() {
  const content = <AppContent />;

  return IS_DEV ? <MockingGUIBoundary config={mockConfig}>{content}</MockingGUIBoundary> : content;
}
```

```bash
# .env.local
VITE_ENABLE_MOCKING_GUI=true
```

### Next.js (App Router)

In Next.js App Router, you need to create a separate Client Component wrapper for compatibility with Server Components.

1. **Create Client Component Wrapper** (`components/MockingGUIWrapper.tsx`)

```tsx
'use client';

import dynamic from 'next/dynamic';
import { mockConfig } from '@/mocks/config';

// Use dynamic import to prevent loading browser-only modules during SSR
const MockingGUIBoundary = dynamic(
  () => import('@kakaocloud/mocking-gui/browser').then(module => module.MockingGUIBoundary),
  { ssr: false },
);

export default function MockingGUIWrapper({ children }: React.PropsWithChildren) {
  return <MockingGUIBoundary config={mockConfig}>{children}</MockingGUIBoundary>;
}
```

2. **Apply to Root Layout** (`app/layout.tsx`)

```tsx
import MockingGUIWrapper from '@/components/MockingGUIWrapper';

const IS_DEV = process.env.NODE_ENV === 'development';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{IS_DEV ? <MockingGUIWrapper>{children}</MockingGUIWrapper> : children}</body>
    </html>
  );
}
```
