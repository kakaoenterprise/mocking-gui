/**
 * Runtime detection predicates shared by the server entry point and its tests.
 *
 * These are intentionally internal: they are not exported from the package.
 */

/**
 * Whether the current runtime is Node.js (or a runtime with full Node compatibility).
 *
 * `process.versions.node` is used rather than the mere existence of `process`
 * because it is the one `process` member that browser shims never set:
 * `process/browser` exposes `versions = {}`, the Next.js client build injects a
 * `process` that only carries `env`, and a Vite `define` replacement creates no
 * `process` binding at all. Bundlers that partially inject `process` therefore
 * still resolve to `false` here.
 */
export const isNodeRuntime = (): boolean =>
  typeof process !== 'undefined' && Boolean(process.versions?.node);

/**
 * Whether a DOM is present (both `window` and `document` are defined).
 *
 * The server guard requires this in addition to "not Node", which keeps the
 * guard a strict subset of the previous `typeof window !== 'undefined'` check:
 * every environment that creates a server today still creates one (Node, Bun,
 * Deno, edge runtimes), and only DOM-shimmed Node environments such as
 * jsdom/happy-dom move from "skip" to "proceed". A `!isNodeRuntime()`-only
 * check was rejected because it would newly skip on edge runtimes without Node
 * compatibility, turning a loud `msw/node` import failure into a silent `null`.
 */
export const isDomRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';
