---
sidebar_position: 1
---

# Introduction

Some screens are hard to build because the backend will not cooperate. The empty
list that a real account grows out of in a day. The session that expires halfway
through a form. The plan that has run out of seats. The response that takes three
seconds. You can reach each of them by editing a handler, reloading, and editing
it back — which is why most people check them once and hope.

Mocking GUI puts a panel on top of [MSW](https://mswjs.io) so you can reach them
from the running app instead. Pick a different response for an endpoint and the
screen follows; your code never moves.

> Prefer to see it rather than read it? The <a href="/mocking-gui/demo/" target="_self">live demo</a> is a real app
> with no server behind it — open the panel, change what an endpoint returns,
> and watch the screen follow.

## What it changes

Without it, the states above live in code: an error you temporarily hard-code, a
delay you add and forget to remove, a fixture you edit to be empty. With it they
live in a panel, which has three consequences worth the setup.

**You can check the states you would otherwise skip.** Error, empty and loading
stop being a detour and become a dropdown, so they get looked at as often as the
happy path.

**A bug can be handed over instead of described.** A scenario captures several
endpoints at once — payment declined _and_ metrics degraded _and_ alerts
unread — as one code you paste into a ticket. Whoever opens it lands in the state
you were in.

**The server sees the same mocks.** Panel state is mirrored into a cookie, so a
Next.js server component renders against what the browser is showing rather than
against the real API.

## What it is, technically

It is a layer over MSW, not a replacement for it. Handlers you already have keep
working; the panel reads them and gives you a way to drive them.

- Built on MSW 2.x's `http` namespace.
- Intercepts `fetch`, `XMLHttpRequest` and the rest, across `GET`, `POST`,
  `PUT`, `PATCH` and `DELETE`.
- Responses can be a fixed list of variants, a function of the request, or
  generated from an OpenAPI document.
- The panel renders in a Shadow DOM, so none of its styles reach your app.

## Getting Started

Ready to introduce Mocking GUI to your project?

👉 **[Installation & Setup Guide](./quick-start)** - Get started in 3 minutes with detailed installation instructions and framework integration examples.

For advanced usage:

- **[Swagger Automation](./usage/swagger-guide)** - Connect your existing API docs for instant mock generation
- **[Usage Guides](./usage/api-guide)** - Learn about handlers, scenarios, and advanced features
