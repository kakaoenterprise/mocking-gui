import { HandlerType } from '../types/handler';

import { getHandlerKey } from '../utils/common/keys';

import type { HandlerRef, Selection } from './define';
import type { Scenario } from '../types/handler';

/* ────────────────────────────────────────────────────────────────────────────
 * Duplicate detection
 * ──────────────────────────────────────────────────────────────────────────── */

declare const DUPLICATE_PICK: unique symbol;

/**
 * An intentionally unsatisfiable type substituted at the position of a
 * duplicate selection, so the compiler reports the error on the offending
 * `.pick()` line rather than on the enclosing call.
 */
export type DuplicatePick<N extends string> = {
  readonly [DUPLICATE_PICK]: `handler "${N}" is picked twice. Remove one, or use extendScenario() to override.`;
};

type NameOf<S> = S extends Selection<infer N, HandlerRef> ? N : never;
type RefOf<S> = S extends Selection<string, infer R> ? R : never;

/**
 * Whether a ref survived as literals.
 *
 * A widened `url` becomes exactly `string`, which makes this guard reliable —
 * unlike a formatted key, which would widen to a template pattern that literals
 * are assignable to.
 */
type IsPinned<R> = R extends readonly [string, infer U]
  ? [string] extends [U]
    ? false
    : true
  : false;

/**
 * True only when `A` and `B` are mutually assignable.
 *
 * A plain `extends` check is wrong here: a widened key is not `string` but a
 * template pattern such as `` `get.${string}` ``, and a literal key *is*
 * assignable to that pattern. One unpinned handler would then make every later
 * selection look like a duplicate of it. Requiring assignability in both
 * directions admits only genuinely equal literals.
 */
type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Whether `R` exactly equals any member of the `Seen` union. */
type InSeen<R, Seen> = Seen extends unknown
  ? IsExact<R, Seen> extends true
    ? true
    : never
  : never;

/**
 * Rebuilds the selection tuple, replacing the first duplicate with
 * {@link DuplicatePick}. Non-tuple inputs (a dynamically built array) resolve
 * to `unknown` so the intersection at the call site stays a no-op and the
 * runtime backstop takes over.
 *
 * Compares handler *keys* so two handlers that merely share a display name are
 * not confused for one another, while quoting the *name* in the error.
 */
export type Unique<
  S extends readonly unknown[],
  Seen = never,
  Acc extends readonly unknown[] = [],
> = S extends readonly [infer H, ...infer Rest]
  ? IsPinned<RefOf<H>> extends true
    ? true extends InSeen<RefOf<H>, Seen>
      ? readonly [...Acc, DuplicatePick<NameOf<H> & string>, ...Rest]
      : Unique<Rest, Seen | RefOf<H>, [...Acc, H]>
    : Unique<Rest, Seen, [...Acc, H]>
  : unknown;

/**
 * Runtime backstop for the compile-time {@link Unique} check, which only
 * applies to literal array arguments. Uses the same wording as the type-level
 * error so both defences read identically.
 */
const assertNoDuplicates = (selections: readonly Selection[], scenarioName: string): void => {
  const seen = new Set<string>();
  for (const selection of selections) {
    // Keyed by the storage key derived from the ref, matching the compile-time
    // check: two handlers may share a display name without being the same
    // handler.
    if (seen.has(refToKey(selection.ref))) {
      throw new Error(
        `[mocking-gui] handler "${selection.handlerName}" is picked twice in scenario ` +
          `"${scenarioName}". Remove one, or use extendScenario() to override.`,
      );
    }
    seen.add(refToKey(selection.ref));
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * Scenario construction
 * ──────────────────────────────────────────────────────────────────────────── */

/** The one place a `Selection` is turned into a storage key. */
const refToKey = ([method, url]: HandlerRef): string => getHandlerKey({ method, url });

/** Fixed epoch constant used as the deterministic default `createdAt`. */
const DEFAULT_CREATED_AT = '1970-01-01T00:00:00.000Z';

export interface ScenarioOptions {
  id?: string;
  description?: string;
  createdAt?: string;
}

/**
 * Deterministic, pure lowercase-kebab slug of `name`.
 * Unicode-aware: non-ASCII letters (e.g. Korean) are preserved; only
 * whitespace/punctuation runs collapse to a single `-`. Falls back to
 * `'scenario'` when the result would otherwise be empty.
 */
const slug = (name: string): string => {
  const slugified = name
    .toLowerCase()
    .trim()
    .replace(/[\s!"#$%&'()*+,./:;<=>?@[\]^`{|}~-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slugified || 'scenario';
};

const toConfigs = (selections: readonly Selection[]): Scenario['configs'] => {
  const configs: Scenario['configs'] = {};
  for (const selection of selections) {
    configs[refToKey(selection.ref)] = {
      active: true,
      type: HandlerType.MANUAL,
      variant: selection.variant,
      ...(selection.delay != null ? { delay: selection.delay } : {}),
    };
  }
  return configs;
};

/**
 * Builds a `Scenario` from a name and a list of handler-variant selections.
 *
 * Picking the same handler twice is an error, not a silent override — a
 * duplicate is a typo far more often than an intention. Deliberate overrides
 * go through {@link extendScenario}, which makes the intent syntactically
 * visible.
 */
export function defineScenario<const S extends readonly Selection[]>(
  name: string,
  selections: S & Unique<S>,
  opts?: ScenarioOptions,
): Scenario {
  const list = selections as readonly Selection[];
  assertNoDuplicates(list, name);

  return {
    id: opts?.id ?? slug(name),
    name,
    ...(opts?.description !== undefined ? { description: opts.description } : {}),
    configs: toConfigs(list),
    createdAt: opts?.createdAt ?? DEFAULT_CREATED_AT,
  };
}

/**
 * Derives a new scenario from `base`, overriding the handlers named in
 * `selections`. `base` is left untouched.
 *
 * Overriding a handler already configured by `base` is expected here — that is
 * the whole point — while duplicates *within* `selections` remain an error.
 */
export function extendScenario<const S extends readonly Selection[]>(
  base: Scenario,
  name: string,
  selections: S & Unique<S>,
  opts?: ScenarioOptions,
): Scenario {
  const list = selections as readonly Selection[];
  assertNoDuplicates(list, name);

  return {
    id: opts?.id ?? slug(name),
    name,
    ...(opts?.description !== undefined
      ? { description: opts.description }
      : base.description !== undefined
        ? { description: base.description }
        : {}),
    configs: { ...base.configs, ...toConfigs(list) },
    createdAt: opts?.createdAt ?? base.createdAt,
  };
}
