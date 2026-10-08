/**
 * Minimal `document.cookie` double for tests.
 * Honors `expires` in the past as a delete, which the real browser does and
 * the sync writer relies on for cleanup.
 */
export const installCookieStore = () => {
  const store: Record<string, string> = {};

  if (typeof window === 'undefined') {
    (globalThis as { window?: unknown }).window = {};
  }
  Object.defineProperty(globalThis, 'document', {
    value: {},
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document, 'cookie', {
    enumerable: true,
    configurable: true,
    get() {
      return Object.entries(store)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
    set(raw: string) {
      const [rawName, ...rest] = raw.split('=');
      const name = rawName.trim();
      if (!name) return;
      const value = rest.join('=').split(';')[0];
      const expires = /expires=([^;]+)/.exec(raw)?.[1];
      if (expires && new Date(expires).getTime() <= Date.now()) {
        delete store[name];
        return;
      }
      store[name] = value;
    },
  });

  return {
    names: () => Object.keys(store),
    get: (name: string) => store[name] ?? null,
    seed: (name: string, value: string) => {
      store[name] = value;
    },
    totalBytes: () => Object.entries(store).reduce((sum, [k, v]) => sum + k.length + v.length, 0),
  };
};
