import { matchRequestUrl } from 'msw';

import { getHandlerKey } from '../../utils/common/keys';
import { toMswPath } from '../../utils/handler/pathParams';

import type { EngineHandler, StandaloneHandler } from './types';

/**
 * Same origin pattern as `splitOrigin` in `utils/handler/pathParams` (not exported
 * there): `scheme://host[:port]` (scheme may contain `*`) or a bare `*`.
 */
const ORIGIN_PATTERN = /^(?:[a-z*][a-z0-9+.*-]*:\/\/[^/]*|\*)/i;

/** Origin used only to turn route paths into absolute match patterns. */
const PROBE_ORIGIN = 'http://mogu.local';

const MATCH_CACHE_LIMIT = 5000;
const NEAREST_LIMIT = 3;

export interface HandlerEntry {
  index: number;
  handler: EngineHandler;
  /** `getHandlerKey` of the handler: the key scenarios and session configs use. */
  key: string;
  /** Lower-case handler method. `all` matches every request method. */
  method: string;
  /** Handler url without its base, e.g. `/v1/products/:id`. */
  path: string;
  /**
   * What the path was cut from: an origin (optionally with a base path), `*`, or
   * `''` for a path-only handler url. Requests are rebuilt on it before the
   * handler's own MSW matcher runs.
   */
  runBase: string;
}

export interface HandlerMatch {
  entry: HandlerEntry;
  params: Record<string, string>;
}

export interface HandlerMatcher {
  entries: readonly HandlerEntry[];
  /** First handler (in `mocks` order) whose method and route path match. */
  match(method: string, pathname: string): HandlerMatch | null;
  /** Looks an entry up by its exact key. */
  byKey(key: string): HandlerEntry | null;
  /** Looks an entry up by key, then name, then description (exact match). */
  byRef(ref: string): HandlerEntry | null;
  /** Up to three handler names whose route is closest to the given request. */
  nearestByPath(method: string, pathname: string): string[];
  /** Up to three handler names whose key, name or description is closest to the text. */
  nearestByText(text: string): string[];
}

const splitBase = (url: string, baseUrl: string | undefined): [string, string] => {
  if (baseUrl && baseUrl !== '*' && url.startsWith(baseUrl)) {
    const base = baseUrl.replace(/\/+$/, '');
    const rest = url.slice(base.length);
    return [base, rest.startsWith('/') ? rest : `/${rest}`];
  }

  const origin = url.match(ORIGIN_PATTERN)?.[0] ?? '';
  const rest = url.slice(origin.length);
  return [origin, rest.startsWith('/') ? rest : `/${rest}`];
};

const toParams = (params: Record<string, unknown> | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string') result[name] = value;
    else if (Array.isArray(value)) result[name] = value.join('/');
    else result[name] = '';
  }
  return result;
};

const segmentsOf = (path: string): string[] => path.split('?')[0].split('/').filter(Boolean);

/**
 * Scores how close a handler route is to a request path. Matching leading
 * segments weigh most, a path parameter counts as a partial match.
 */
const scorePath = (requestSegments: string[], handlerSegments: string[]): number => {
  const length = Math.min(requestSegments.length, handlerSegments.length);
  let score = 0;
  let isPrefix = true;

  for (let i = 0; i < length; i++) {
    const handlerSegment = handlerSegments[i];
    if (handlerSegment === requestSegments[i]) score += isPrefix ? 3 : 1;
    else if (handlerSegment.startsWith(':')) score += isPrefix ? 1.5 : 0.5;
    else isPrefix = false;
  }

  return score - Math.abs(requestSegments.length - handlerSegments.length) * 0.5;
};

const bigramsOf = (text: string): Map<string, number> => {
  const normalized = text.toLowerCase();
  const bigrams = new Map<string, number>();
  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }
  return bigrams;
};

/** Dice coefficient over character bigrams: 0 (nothing shared) to 1 (same text). */
const similarity = (a: string, b: string): number => {
  if (a.toLowerCase() === b.toLowerCase()) return 1;
  const left = bigramsOf(a);
  const right = bigramsOf(b);

  let leftSize = 0;
  let shared = 0;
  left.forEach((count, bigram) => {
    leftSize += count;
    shared += Math.min(count, right.get(bigram) ?? 0);
  });
  let rightSize = 0;
  right.forEach(count => {
    rightSize += count;
  });

  return leftSize + rightSize === 0 ? 0 : (2 * shared) / (leftSize + rightSize);
};

const topNames = (scored: { entry: HandlerEntry; score: number }[], minimum: number): string[] =>
  scored
    .filter(item => item.score > minimum)
    .sort((a, b) => b.score - a.score || a.entry.index - b.entry.index)
    .slice(0, NEAREST_LIMIT)
    .map(item => item.entry.handler.name);

export const createHandlerMatcher = (
  mocks: readonly StandaloneHandler[],
  baseUrl?: string,
): HandlerMatcher => {
  const entries: HandlerEntry[] = mocks.map((config, index) => {
    // Handler configs are only read, so the readonly input is safe in the engine's shape.
    const handler = config as EngineHandler;
    const [runBase, path] = splitBase(handler.url, baseUrl);
    return {
      index,
      handler,
      key: getHandlerKey(handler),
      method: handler.method.toLowerCase(),
      path,
      runBase,
    };
  });

  const patterns = entries.map(entry => PROBE_ORIGIN + toMswPath(entry.path));
  const byKeyMap = new Map(entries.map(entry => [entry.key, entry]));
  const cache = new Map<string, number>();

  const matchEntry = (entry: HandlerEntry, probeUrl: URL): HandlerMatch | null => {
    const result = matchRequestUrl(probeUrl, patterns[entry.index]);
    return result.matches ? { entry, params: toParams(result.params) } : null;
  };

  return {
    entries,

    match(method, pathname) {
      const requestMethod = method.toLowerCase();
      const cacheKey = `${requestMethod} ${pathname}`;
      const probeUrl = new URL(PROBE_ORIGIN + pathname);

      const cachedIndex = cache.get(cacheKey);
      if (cachedIndex !== undefined) {
        return cachedIndex === -1 ? null : matchEntry(entries[cachedIndex], probeUrl);
      }

      if (cache.size >= MATCH_CACHE_LIMIT) cache.clear();

      for (const entry of entries) {
        if (entry.method !== 'all' && entry.method !== requestMethod) continue;
        const match = matchEntry(entry, probeUrl);
        if (match) {
          cache.set(cacheKey, entry.index);
          return match;
        }
      }

      cache.set(cacheKey, -1);
      return null;
    },

    byKey(key) {
      return byKeyMap.get(key) ?? null;
    },

    byRef(ref) {
      return (
        byKeyMap.get(ref) ??
        entries.find(entry => entry.handler.name === ref) ??
        entries.find(entry => entry.handler.description === ref) ??
        null
      );
    },

    nearestByPath(method, pathname) {
      const requestMethod = method.toLowerCase();
      const requestSegments = segmentsOf(pathname);
      return topNames(
        entries.map(entry => ({
          entry,
          score:
            scorePath(requestSegments, segmentsOf(entry.path)) +
            (entry.method === requestMethod ? 0.75 : 0),
        })),
        0.75,
      );
    },

    nearestByText(text) {
      return topNames(
        entries.map(entry => ({
          entry,
          score: Math.max(
            similarity(text, entry.key),
            similarity(text, entry.handler.name),
            similarity(text, entry.handler.description ?? ''),
          ),
        })),
        0.2,
      );
    },
  };
};
