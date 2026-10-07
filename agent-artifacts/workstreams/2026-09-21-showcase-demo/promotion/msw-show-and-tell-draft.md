<!--
Draft for github.com/mswjs/msw → Discussions → Show and tell
Modelled on the structure of discussions/2752 (problem → code → features → install → feedback ask).

BEFORE POSTING, fill in / confirm:
  [ ] DEMO_URL — not deployed yet (PR for feat/showcase-demo pending)
  [ ] a GIF or screenshot at the marked spot — the post needs one above the fold
  [ ] the "we use this at KakaoCloud" line — confirm you're comfortable stating it publicly
  [ ] whether the four "rough edges" are still open at posting time
-->

# Mocking GUI — a visual control panel for your MSW handlers

Hey folks 👋

We lean on MSW heavily for a fairly large console frontend, and over time two
frictions kept showing up:

1. **Switching a response meant editing code.** Wanting to see a 500, then a
   429, then an empty list was three edits and three reloads.
2. **Reproducing a teammate's bug meant rebuilding their mock setup by hand**
   from a description in a chat thread.

So we built a GUI layer over MSW and just open-sourced it under MIT. It doesn't
replace your handlers — it reads them and gives you a panel to drive them at
runtime.

<!-- GIF HERE: panel open on the left, response flipping from 200 to 429 on the right -->

**▶ Live demo: DEMO_URL** — there is no server behind that page. Every response
comes from MSW in your browser, and the panel is what decides it.

## Install

```bash
npm i -D @kakaocloud/mocking-gui
npx msw init public/     # if you haven't already
```

Peers: `msw@^2.8.0`, `react@^18 || ^19`.

## Setup

```tsx
import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';

import { mockConfig } from './mocks/config';

export default function App() {
  if (process.env.NODE_ENV !== 'development') return <AppContent />;

  return (
    <MockingGUIBoundary config={mockConfig}>
      <AppContent />
    </MockingGUIBoundary>
  );
}
```

The boundary starts the worker, holds rendering until mocking is ready — so no
real request leaks out before handlers are registered — and mounts the panel
inside a shadow root, so none of its CSS reaches your app.

## Declaring responses

A handler is your endpoint plus the list of states it can return. Each variant
becomes an option in a dropdown.

```ts
import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export const handlers: HandlerConfigOption[] = [
  {
    name: 'Get user',
    description: 'Shown next to the endpoint in the panel',
    url: 'https://api.example.com/v1/users/:userId',
    method: 'get',
    responseVariants: [
      { name: 'Viewer', status: 200, body: { role: 'viewer' } },
      { name: 'Admin', status: 200, body: { role: 'admin' } },
      { name: 'Not found', status: 404, body: { error: { code: 'USER_NOT_FOUND' } } },
      {
        name: 'Rate limited',
        status: 429,
        headers: { 'Retry-After': '30', 'X-RateLimit-Remaining': '0' },
        body: { error: { code: 'RATE_LIMITED' } },
      },
    ],
  },
];
```

Alongside the variant dropdown, every handler row gets an on/off switch — off
means `passthrough()` to your real server — and a delay field in milliseconds,
which is the shortest path to a loading state that actually holds still.

<details>
<summary><b>When a fixed list isn't enough — compute the response</b></summary>

Pass a function instead of a list. It receives the request, so the response can
depend on query params, path params, headers or cookies. These show up in the
panel as `Auto`, with no variant to pick.

```ts
{
  name: 'Search',
  url: `${BASE}/search`,
  method: 'get',
  responseVariantsFn: ({ request, params, cookies }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));

    const matched = CORPUS.filter(item => item.includes(query));
    if (query && matched.length === 0) {
      return { name: 'No matches', status: 404, body: { error: { code: 'NO_RESULTS' } } };
    }

    return {
      name: 'Page',
      status: 200,
      body: { query, page, total: matched.length, items: matched.slice((page - 1) * 20, page * 20) },
    };
  },
}
```

</details>

<details>
<summary><b>Responses that aren't JSON</b></summary>

`rawBody` sets the body and its content type directly — for file downloads,
legacy XML endpoints and `multipart/form-data` receipts.

```ts
responseVariants: [
  { name: 'CSV', status: 200, rawBody: { kind: 'text', value: csv } },
  { name: 'Invoice', status: 200, rawBody: { kind: 'html', value: html } },
  { name: 'Feed', status: 200, rawBody: { kind: 'xml', value: feed } },
  { name: 'Receipt', status: 201, rawBody: { kind: 'formData', value: formData } },
  { name: 'Archive', status: 200, rawBody: { kind: 'arrayBuffer', value: buffer } },
];
```

</details>

<details>
<summary><b>Generating handlers from an OpenAPI document</b></summary>

```ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  swagger: [
    {
      name: 'My API',
      configUrl: 'https://api.example.com/openapi.json',
      serverUrl: 'https://api.example.com', // the origin MSW should intercept
      docsUrl: 'https://api.example.com/docs', // optional, links out from the panel
    },
  ],
};
```

Handlers are sampled from the document's response schemas and merged with your
hand-written ones, which keep precedence. This is mostly for the long tail of
endpoints nobody got around to mocking — you get _something_ to toggle without
writing them out.

</details>

## Scenarios — the part we ended up using most

A scenario is a named snapshot of **several handlers at once**: _checkout
returns 503, metrics are degraded, notifications are unread_. You build one by
flipping handlers into an interesting combination and saving it, and you share
it as a code:

```
eyJpZCI6ImRlbW8tcGF5bWVudC1vdXRhZ2UiLCJuYW1lIjoiUGF5bWVudCBwcm92aWRlciBvdXRhZ2Ui...
```

That's base64 of a small JSON object. Paste it into **Scenarios → Import** and
the whole app moves to that state. Our bug reports now carry one of these
instead of a list of steps to re-follow.

## Handlers you don't want the panel to touch

```ts
import { graphql, HttpResponse } from 'msw';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  onDemandHandlers: [graphql.query('Me', () => HttpResponse.json({ data: { me } }))],
};
```

These are handed straight to MSW — no toggle, no variants. GraphQL, WebSocket
and always-on infrastructure routes keep working while you flip the REST
handlers around them.

## SSR / RSC

Panel state is mirrored into a cookie, so a server render can resolve the same
mocks the browser is seeing. In a Next.js App Router route:

```tsx
import { setupMockingServer } from '@kakaocloud/mocking-gui/server';
import { cookies } from 'next/headers';

export default async function Page() {
  const server = await setupMockingServer({
    ...mockingConfig,
    cookie: (await cookies()).toString(),
  });

  server?.listen();
  try {
    return await ServerComponent();
  } finally {
    server?.close();
  }
}
```

This was the fiddliest part to get right, and the reason the cookie exists at
all.

## Built on MSW's public API

`http` · `HttpResponse` · `passthrough` · `delay` · `setupWorker` ·
`setupServer` · `resetHandlers`. No MSW internals are patched, which is why
version bumps have been uneventful for us.

## Known rough edges

Rather than have you find these the hard way:

- **Handlers start inactive on a fresh browser.** You open the panel and switch
  on what you need. There is no way to declare a handler active by default yet —
  it's the single thing we most want to fix, since it also blocks scripted setup.
- **No programmatic API yet.** State lives in `localStorage` plus the sync
  cookie, so driving it from Playwright or a coding agent currently means
  writing those directly.
- `rawBody: { kind: 'binary' }` is in the type but not implemented — it falls
  through to a JSON response instead of erroring. Being fixed.
- `Auto` handlers don't forward response `headers` yet, unlike the variant-list
  ones.

## Links

- **Live demo:** DEMO_URL
- **GitHub:** https://github.com/kakaoenterprise/mocking-gui
- **npm:** https://www.npmjs.com/package/@kakaocloud/mocking-gui
- **Docs:** https://kakaoenterprise.github.io/mocking-gui

## Feedback I'd genuinely like

1. Does the scenario code feel like something you'd paste into an issue, or
   would a file or a URL parameter suit your workflow better?
2. For anyone driving MSW from tests or from a coding agent — would a
   programmatic `applyMockState(configs)` be the right shape, or would you
   rather set the cookie or storage yourself and keep the surface small?
3. Anything in the handler config shape that reads wrong against how you already
   organize MSW handlers? It's the part we're least sure generalizes beyond our
   own codebase.

Thanks for MSW — none of this exists without it. 🙏
