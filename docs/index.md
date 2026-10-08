---
layout: home
hero:
  name: Mocking GUI
  text: Every state your API can return
  tagline: Empty lists, expired sessions, the 500 that only shows up in production. Switch between them from a panel inside your running app — no server to start, no database to seed, no code to change.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: Try the demo ↗
      link: /demo/
      target: _blank
      rel: noreferrer
features:
  - title: Visual Management
    details: Manage MSW handlers intuitively with GUI panel. Quickly find APIs with search and filtering capabilities.
  - title: Real-time Control
    details: Toggle mocks, switch response variants, and inject network delays instantly without code changes.
  - title: Universal State Sync
    details: Share mock states between Browser and Server (SSR/RSC) seamlessly via cookie propagation.
  - title: Swagger Integration
    details: Generate a complete mock server instantly from your OpenAPI/Swagger documents. No manual handler setup needed.
  - title: Scenario Management
    details: Capture complex bug reproduction steps as "Scenarios". Save, restore, and share them with your team.
  - title: Flexible Interface
    details: Customize the panel's size and position. Shadow DOM ensures zero style conflicts with your application.
---

## Get it running

Three steps, and the panel is in your app. The
[Installation guide](./guide/quick-start) covers Next.js, SSR and the parts this
page leaves out.

### 1. Install

```bash
pnpm add -D @kakaocloud/mocking-gui
```

### 2. Add MSW's service worker

```bash
npx msw init public
```

### 3. Declare an endpoint, and mount the panel

```tsx
// config.ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: [
    {
      name: 'Get User',
      url: '/api/user',
      method: 'get',
      responseVariants: [
        { name: 'Success', status: 200, body: { id: 1, name: 'John Doe' } },
        { name: 'Empty', status: 200, body: null },
        { name: 'Server error', status: 500, body: { message: 'Something went wrong' } },
      ],
    },
  ],
};
```

```tsx
// App.tsx — the dev check matters: without it the panel ships to production.
import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';
import { mockConfig } from './config';

const IS_DEV = import.meta.env.DEV;

function App() {
  const content = <AppContent />;

  return IS_DEV ? <MockingGUIBoundary config={mockConfig}>{content}</MockingGUIBoundary> : content;
}
```

Reload, and `GET /api/user` is a row in the panel. Switch it on, pick which of
the three responses it returns, give it a two-second delay — the screen follows,
and nothing in your code moved.

<a class="mg-cta" href="./guide/introduction">Read the documentation →</a>

## Start from a working example

<div class="mg-starters">
  <a href="https://github.com/kakaoenterprise/mocking-gui/tree/main/examples/next-app-router" target="_blank" rel="noreferrer">
    <strong>Next.js (App Router)</strong>
    <span>The client wrapper and the dev guard, with mock state reaching server components.</span>
  </a>
  <a href="https://github.com/kakaoenterprise/mocking-gui/tree/main/examples/react-csr" target="_blank" rel="noreferrer">
    <strong>React (Vite)</strong>
    <span>The smallest complete setup: one config file and one boundary.</span>
  </a>
</div>
