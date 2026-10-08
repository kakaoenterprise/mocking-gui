/**
 * Sanitizes an OpenAPI param name into a path-to-regexp-safe identifier.
 * `path-to-regexp` (used internally by MSW) reads a named param token only
 * up to the first non-word character, so e.g. "kubeflow-id" would silently
 * compile to param "kubeflow" + literal "-id", which never matches a real
 * request. Every run of non-word characters is collapsed to an underscore
 * ("_" is a word char, so it stays inside the token), which keeps the name
 * close to the original and also handles leading/trailing separators.
 */
const toSafeParamName = (name: string) => name.replace(/[^a-zA-Z0-9_]+/g, '_');

/**
 * Normalize dynamic parameters in Swagger/OpenAPI path to MSW style
 * - "{id}" -> ":id"
 * - "{kubeflow-id}" -> ":kubeflow_id"
 */
export const normalizePathParams = (path: string) => {
  if (!path) return path;
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => `:${toSafeParamName(name)}`);
};

/**
 * Splits a handler url into `[origin, path]` without going through `new URL`.
 * `origin` is `scheme://host[:port]` (scheme may contain `*`) or a bare `*`;
 * everything else is the path. Path-only urls get an empty origin.
 */
const splitOrigin = (url: string): [string, string] => {
  const match = url.match(/^(?:[a-z*][a-z0-9+.*-]*:\/\/[^/]*|\*)/i);
  return match ? [match[0], url.slice(match[0].length)] : ['', url];
};

/**
 * Handler url format (library contract):
 * - `:name` at the start of a segment is a path parameter (same as MSW).
 * - any other `:` in the path is a literal colon (e.g. the `:cancel` action in
 *   `/subscriptions/:id:cancel`). Users do not need path-to-regexp's `\:` escape.
 * - a legacy `\:` is accepted and means the same literal colon.
 */
const PARAM_TOKEN = /(?<=^|\/):[A-Za-z0-9_]+(\([^)]*\))?[?*+]?/g;
const LITERAL_COLON = /(?<=[^/\\]):/g;

/**
 * Converts a library-format url into what MSW (path-to-regexp 6) expects:
 * every literal colon in the path is escaped as `\:`. Idempotent — an already
 * escaped `\:` is left alone. The origin (and its port colon) is never touched.
 * Apply this only where a url is handed to `http[method](...)`.
 */
export const toMswPath = (url: string) => {
  if (!url) return url;
  const [origin, path] = splitOrigin(url);
  return origin + path.replace(LITERAL_COLON, '\\:');
};

/**
 * Mask path parameter tokens (`:something`) by index, leaving literal text in
 * the same segment intact.
 * e.g.: /v1/:a/:b/users → /v1/:param1/:param2/users
 *       /v1/:id:cancel  → /v1/:param1:cancel
 */
export const maskDynamicSegmentsIndexed = (path: string) => {
  if (!path) return path;
  let index = 1;
  const masked = path.replace(PARAM_TOKEN, () => `:param${index++}`);
  // Clean up duplicate slashes
  return masked.replace(/\/{2,}/g, '/');
};

/**
 * Returns a key string combining normalized path from full URL string.
 * Brace params are normalized and the legacy `\:` escape is folded into a plain
 * colon before parsing, so the url never contains a backslash by the time it
 * reaches `new URL` (which would otherwise turn `\` into `/`).
 * - Performs only path normalization on original string if it fails
 */
export const generateNormalizedUrl = (url: string) => {
  const libraryUrl = normalizePathParams(url.replace(/\\:/g, ':'));
  try {
    const urlObj = new URL(libraryUrl);
    return `${urlObj.origin}${maskDynamicSegmentsIndexed(urlObj.pathname)}`;
  } catch {
    const [origin, path] = splitOrigin(libraryUrl);
    return origin + maskDynamicSegmentsIndexed(path.replace(/[?#].*$/, ''));
  }
};
