import { getHandlerKey } from '../utils/common/keys';

import type { HandlerConfigOption, ReadonlyHandlerConfig } from '../types/config';

/**
 * Variant names of a handler as a literal union — or `string` when the
 * handler's `responseVariants` were widened (no `as const`, or an explicit
 * `HandlerConfigOption[]` annotation).
 *
 * The degradation is deliberate: the same call site compiles in either case
 * and only loses autocomplete/typo protection, so adopting the API never
 * requires rewriting handler definitions first. Runtime validation covers the
 * widened case.
 */
export type VariantName<T> = T extends {
  readonly responseVariants: readonly { readonly name: infer N }[];
}
  ? [string] extends [N]
    ? string
    : N
  : string;

/** The pair that identifies a handler: its method and its url. */
export type HandlerRef = readonly [method: ReadonlyHandlerConfig['method'], url: string];

/**
 * A single handler→variant choice.
 *
 * Carries two identifiers, with distinct jobs:
 *
 * - `N`, the handler **name** — what humans read and write, and what error
 *   messages quote.
 * - `R`, the handler **ref** (`[method, url]`) — the true identity, used for
 *   duplicate detection. Two handlers in different registries may legitimately
 *   share a display name (`'목록 조회'` for topics and for subscriptions), so
 *   deduplicating on the name would reject a valid scenario.
 *
 * The ref is a pair rather than a formatted string on purpose: the storage-key
 * format (`method.url`) then lives only in `getHandlerKey`, with no type-level
 * restatement to drift out of step. Neither parameter ever appears as an
 * argument — `R` is inferred from the handler.
 */
export interface Selection<N extends string = string, R extends HandlerRef = HandlerRef> {
  readonly handlerName: N;
  readonly ref: R;
  readonly variant: string;
  readonly delay?: number;
}

const buildSelection = (
  handler: ReadonlyHandlerConfig,
  variant: string,
  opts?: { delay?: number },
): Selection => ({
  handlerName: handler.name,
  ref: [handler.method, handler.url],
  variant,
  ...(opts?.delay != null ? { delay: opts.delay } : {}),
});

/** Runtime guard shared by both entry paths: the variant must actually exist. */
const assertVariantExists = (handler: ReadonlyHandlerConfig, variant: string): void => {
  const variants = handler.responseVariants;
  if (!variants || variants.length === 0) return;

  if (!variants.some(candidate => candidate.name === variant)) {
    const available = variants.map(candidate => `"${candidate.name}"`).join(', ');
    throw new Error(
      `[mocking-gui] handler "${handler.name}" has no variant "${variant}". ` +
        `Available variants: ${available}.`,
    );
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * Entry path A — handler level
 * ──────────────────────────────────────────────────────────────────────────── */

export type DefinedHandler<T extends ReadonlyHandlerConfig> = T & {
  pick(
    variant: VariantName<T>,
    opts?: { delay?: number },
  ): Selection<T['name'], readonly [T['method'], T['url']]>;
};

/**
 * Augments a single handler config with a `.pick(variant)` helper.
 *
 * Internal: `HandlerRegistry.get()` is the public way to reach this. Going
 * through a registry keeps the duplicate-name and method+url checks that a
 * standalone handler would skip.
 *
 * Returns the same object reference (`pick` is attached as a non-enumerable
 * property), so the result can still be placed directly into `mocks` /
 * `initialHandlers` and survives `JSON.stringify`.
 *
 * NOTE: spreading (`{ ...handler }`) drops the non-enumerable `pick` at
 * runtime while the type still advertises it. Pass the handler by reference.
 */
export function defineHandler<const T extends ReadonlyHandlerConfig>(config: T): DefinedHandler<T> {
  const defined = config as DefinedHandler<T>;
  Object.defineProperty(defined, 'pick', {
    value: (variant: VariantName<T>, opts?: { delay?: number }) => {
      assertVariantExists(config, variant as string);
      return buildSelection(config, variant as string, opts) as Selection<
        T['name'],
        readonly [T['method'], T['url']]
      >;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return defined;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Entry path B — collection level (registry)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A handler's name when it survived as a literal, `never` when it was widened.
 *
 * Widened members must be dropped from the lookup map: a member whose `name` is
 * `string` contributes an index signature, `keyof` then collapses to `string`,
 * and a single unpinned handler would silently disable name checking for every
 * *other* handler in the same registry. Excluding it instead makes that handler
 * — and only that handler — a compile error to pick by name, which is loud and
 * actionable (pin it with `as const`, or give it its own registry).
 */
type LiteralName<H> = H extends { readonly name: infer N }
  ? [string] extends [N]
    ? never
    : N
  : never;

/** Handler union keyed by handler name, widened members excluded. */
type NameMap<T extends readonly ReadonlyHandlerConfig[]> = {
  [H in T[number] as LiteralName<H> & string]: H;
};

/**
 * Union of pickable handler names.
 *
 * Falls back to `string` only when *no* handler in the collection kept a
 * literal name — the fully-unmigrated case, where runtime validation is the
 * agreed trade-off. A partially migrated collection keeps checking the names it
 * can.
 */
export type HandlerNameOf<T extends readonly ReadonlyHandlerConfig[]> = [
  LiteralName<T[number]>,
] extends [never]
  ? string
  : LiteralName<T[number]> & string;

/**
 * The handler in `T` whose `name` is `N`.
 *
 * Falls back to {@link ReadonlyHandlerConfig} rather than `never` so a widened
 * collection still accepts any variant string instead of rejecting all of them.
 */
export type HandlerByName<
  T extends readonly ReadonlyHandlerConfig[],
  N extends string,
> = N extends keyof NameMap<T> ? NameMap<T>[N] : ReadonlyHandlerConfig;

export interface HandlerRegistry<T extends readonly ReadonlyHandlerConfig[]> {
  /**
   * Picks a variant by handler name. Choosing the name narrows the accepted
   * variant names to that handler's own.
   */
  pick<N extends HandlerNameOf<T>>(
    handler: N,
    variant: VariantName<HandlerByName<T, N>>,
    opts?: { delay?: number },
  ): Selection<N, readonly [HandlerByName<T, N>['method'], HandlerByName<T, N>['url']]>;
  /**
   * Pulls one handler out of the collection as a {@link DefinedHandler}, for
   * when the same handler is picked repeatedly.
   */
  get<N extends HandlerNameOf<T>>(
    handler: N,
  ): HandlerByName<T, N> extends ReadonlyHandlerConfig
    ? DefinedHandler<HandlerByName<T, N>>
    : never;
  /**
   * All handler names, in declaration order.
   *
   * Typed as the registry's own name union so a name read back from here can be
   * passed straight into {@link HandlerRegistry.pick} or
   * {@link HandlerRegistry.keyOf} without a cast.
   */
  readonly names: readonly HandlerNameOf<T>[];
  /**
   * The storage key a handler's config is filed under.
   *
   * Exposed so tooling can label a stored `Scenario.configs` entry with the
   * handler name it belongs to, without hard-coding the `method.url` rule.
   * Reading a scenario back is the only legitimate reason to need this.
   */
  keyOf<N extends HandlerNameOf<T>>(handler: N): string;
}

/**
 * Rejects properties that are not part of {@link HandlerConfigOption} by mapping
 * them to `never`, which no value can satisfy.
 *
 * TypeScript's own excess-property check only fires on *fresh* object literals,
 * and `as const` removes that freshness — so a misspelled `responseVarients`
 * would otherwise pass silently, both inline and via a variable. This check is
 * plain structural assignability, so it holds in either case and needs nothing
 * from the caller.
 *
 * `pick` is allowed alongside the engine's own fields so an already-wrapped
 * {@link DefinedHandler} can be collected back into a registry.
 */
type KnownHandlerKey = keyof HandlerConfigOption | 'pick';

type NoUnknownKeys<T extends readonly unknown[]> = {
  readonly [I in keyof T]: {
    readonly [K in keyof T[I]]: K extends KnownHandlerKey ? T[I][K] : never;
  };
};

/**
 * Wraps an existing handler collection so its members can be picked by name,
 * without modifying the handler definitions themselves.
 *
 * Throws when two handlers share a name, or when two handlers resolve to the
 * same `method.url` key — the latter cannot be surfaced as a type error
 * because key remapping silently keeps the last entry.
 */
export function defineHandlers<const T extends readonly ReadonlyHandlerConfig[]>(
  handlers: T & NoUnknownKeys<T>,
): HandlerRegistry<T> {
  const byName = new Map<string, ReadonlyHandlerConfig>();
  const byKey = new Map<string, ReadonlyHandlerConfig>();

  for (const handler of handlers) {
    const existingName = byName.get(handler.name);
    if (existingName) {
      throw new Error(
        `[mocking-gui] duplicate handler name "${handler.name}". ` +
          'Handler names are the identifier you write and must be unique within a registry.',
      );
    }
    byName.set(handler.name, handler);

    const key = getHandlerKey(handler);
    const existingKey = byKey.get(key);
    if (existingKey) {
      throw new Error(
        `[mocking-gui] handlers "${existingKey.name}" and "${handler.name}" both resolve to ` +
          `"${key}". A method + url pair may only be declared once.`,
      );
    }
    byKey.set(key, handler);
  }

  const resolve = (name: string): ReadonlyHandlerConfig => {
    const handler = byName.get(name);
    if (!handler) {
      const available = Array.from(byName.keys(), candidate => `"${candidate}"`).join(', ');
      throw new Error(
        `[mocking-gui] no handler named "${name}" in this registry. Available: ${available}.`,
      );
    }
    return handler;
  };

  // Built as a plain value and cast once at the boundary: the correspondence
  // between a name and its handler lives in `NameMap`, which cannot be
  // re-derived from the runtime Map, so no implementation can satisfy the
  // generic signature structurally.
  const registry = {
    names: handlers.map(handler => handler.name),
    pick: (name: string, variant: string, opts?: { delay?: number }): Selection => {
      const resolved = resolve(name);
      assertVariantExists(resolved, variant);
      return buildSelection(resolved, variant, opts);
    },
    get: (name: string) => defineHandler(resolve(name)),
    keyOf: (name: string) => getHandlerKey(resolve(name)),
  };

  return registry as unknown as HandlerRegistry<T>;
}
