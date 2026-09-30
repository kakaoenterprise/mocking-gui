import { seedDefaultMockState } from './mocks/seedDefaults';

/**
 * Canonicalise the path before anything else runs.
 *
 * A Service Worker only controls pages **inside its scope**, and scope is a
 * plain path-prefix match. This app registers its worker at
 * `<base>mockServiceWorker.js`, giving it the scope `<base>` — so a visitor who
 * lands on the base path *without* its trailing slash (`/mocking-gui/demo`) is
 * one character outside it. The worker registers, activates, and reports
 * success, but never sees a single request from that tab: every mock silently
 * passes through to the network.
 *
 * GitHub Pages issues a 301 to the slashed form, so production never hits this.
 * Static servers that skip that redirect — `vitepress preview`, plain `serve` —
 * do, and the failure is hard to read because nothing looks broken. One line
 * here removes the dependency on the host behaving a particular way.
 */
const base = import.meta.env.BASE_URL;

if (base !== '/' && window.location.pathname === base.slice(0, -1)) {
  window.location.replace(base + window.location.search + window.location.hash);
} else {
  /**
   * Seed before the library loads.
   *
   * The library creates its zustand store — and rehydrates it from localStorage —
   * at module-evaluation time. A static `import './bootstrap'` would therefore be
   * evaluated before this call and the seed would be ignored, so the app is pulled
   * in dynamically instead. This makes the ordering a property of the code rather
   * than of the import list, which a formatter is free to reorder.
   */
  seedDefaultMockState();

  void import('./bootstrap');
}
