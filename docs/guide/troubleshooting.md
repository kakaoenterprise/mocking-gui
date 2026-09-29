# Troubleshooting

Common issues encountered while using the library and how to resolve them.

## Handler is enabled but mock is not applied

### Symptom

You enabled a handler and selected a response variant in the GUI panel, but requests are still being forwarded to the real server.

### Cause & Solution

**1. URL pattern does not match the actual request**

The handler's `url` must exactly match the actual request URL. Check whether the base URL is included.

```typescript
// Actual request: https://api.example.com/users/123
// ❌ Does not match
{ url: '/users/:id', method: 'get' }

// ✅ Matches
{ url: 'https://api.example.com/users/:id', method: 'get' }
```

---

## Handler is registered but does not appear in the panel

### Symptom

Requests are being mocked (you can see mocked responses in the Network tab), but the handler is missing from the API tab of the panel, cannot be toggled, and is not part of any scenario. This is common right after migrating from a plain MSW setup, especially when the migration was done by an AI agent.

### Cause & Solution

**1. The handler was put in `onDemandHandlers` instead of `mocks`**

`onDemandHandlers` is passed straight to MSW and never enters Mocking GUI's handler store, so by design it is **never shown in the panel**. It exists only for MSW features Mocking GUI does not provide (`graphql.*`, `ws.*`).

```typescript
// ❌ http.* handlers here are mocked but invisible and uncontrollable
onDemandHandlers: [http.get('/api/user', () => HttpResponse.json({ id: 1 }))],

// ✅ Convert to HandlerConfigOption and register in mocks
mocks: [
  {
    name: 'Get User',
    url: '/api/user',
    method: 'get',
    responseVariants: [{ name: 'Success', status: 200, body: { id: 1 } }],
  },
],
```

Every `http.*` handler should be converted to `HandlerConfigOption` and moved to `mocks`. See [Escape Hatch: `onDemandHandlers`](./usage/handler-guide#escape-hatch-ondemandhandlers) for the full migration rule.

**2. The same endpoint is registered in both `mocks` and `onDemandHandlers`**

The `mocks` entry always takes priority. Mocking GUI registers `mocks` before `onDemandHandlers`, and MSW stops at the first handler that returns a response. When the `mocks` entry is turned off in the panel it returns `passthrough()` — which MSW also counts as a response — so the request goes to the real server and the `onDemandHandlers` copy never runs.

Remove the duplicate from `onDemandHandlers`; keep each endpoint in exactly one place.

**3. Expecting `onDemandHandlers` to work on the server**

`setupMockingServer` only applies `mocks` and `swagger`. Handlers in `onDemandHandlers` are registered in the browser Service Worker only.

---

## Swagger source is added but fails to load

### Symptom

The source status in the Swagger tab stays as pending or shows an error.

### Cause & Solution

**1. CORS error**

If the `configUrl` server does not allow CORS, the browser will fail to fetch it. Check the response headers in the browser's Network tab.

**2. `configUrl` does not return a valid OpenAPI JSON**

The `configUrl` must be the direct URL to the OpenAPI spec JSON, not the Swagger UI page URL.

```typescript
// ❌ Swagger UI page URL
{
  configUrl: 'https://api.example.com/swagger-ui';
}

// ✅ OpenAPI JSON URL
{
  configUrl: 'https://api.example.com/v3/api-docs';
}
```

---

## Service Worker fails to install in a local HTTPS environment

### Symptom

The Service Worker is not installed and Mocking GUI does not work when running the local dev server over HTTPS.

### Cause & Solution

If your local HTTPS setup has an untrusted or self-signed certificate, the browser will block the Service Worker from being registered. Resolve the certificate issue first, then retry.

**Common fixes:**

- Use a tool like [mkcert](https://github.com/FiloSottile/mkcert) to generate a locally-trusted certificate and add it to your system's trust store.
- If using a self-signed certificate, manually trust it in your browser before accessing the dev server.
- Alternatively, run the dev server over HTTP during local development if HTTPS is not strictly required.

> **Note:** Service Workers require either `localhost` or a secure HTTPS origin with a valid certificate. An untrusted certificate is treated the same as an insecure origin.

---

## Still having issues?

If the above solutions didn't help, feel free to reach out through the following channels.

- **Issues**: [GitHub Issues](https://github.com/kakaoenterprise/mocking-gui/issues) — Bug reports and feature requests
- **Discussions**: [GitHub Discussions](https://github.com/kakaoenterprise/mocking-gui/discussions) — Usage questions and general feedback
