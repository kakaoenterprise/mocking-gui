import { ControlError, isRecord } from './http';
import { DEFAULT_SESSION_ID } from './types';
import { HandlerType } from '../../types/handler';

import type { HandlerMatcher } from './matcher';
import type { InlineResponse, LogEntry } from './types';
import type { Scenario, StoredHandlerVariants } from '../../types/handler';

/** What a pick answers with. */
export type RuleAnswer =
  | { kind: 'variant'; variant: string }
  | { kind: 'auto' }
  | { kind: 'response'; response: InlineResponse }
  | { kind: 'fail' };

/** One pick laid over the scenario. Rules are consulted newest first. */
export interface Rule {
  id: string;
  /** Key of the handler the rule applies to. */
  key: string;
  /** `null` for a delay-only rule, which leaves the answer to whatever is below it. */
  answer: RuleAnswer | null;
  delay?: number;
  /** The rule applies only after `armed` turns true: the handler `key` was requested. */
  after?: { key: string; armed: boolean };
  /** How many requests the rule was created for, and how many it can still be applied to. */
  times?: number;
  remaining?: number;
}

export type NewRule = Omit<Rule, 'id'>;

/** Which rules apply to one request. Both are `null` when the scenario answers untouched. */
export interface Decision {
  answerRule: Rule | null;
  delayRule: Rule | null;
}

interface LogRecord {
  /** Handler key, kept beside the entry so queries can filter without the name. */
  key: string | null;
  entry: LogEntry;
}

interface Waiter {
  key: string;
  since: number;
  count: number;
  finish(ok: boolean): void;
}

export interface WaitResult {
  ok: boolean;
  count: number;
}

/**
 * One isolated mock state. Each test, capture worker or agent gets its own, so
 * responses never leak between them even though they share one server.
 */
export interface Session {
  id: string;
  label: string | null;
  /** Scenario the base configs came from, if any. */
  scenario: string | null;
  createdAt: string;
  /** Handler key → stored config. A handler without an entry is off. */
  configs: Record<string, StoredHandlerVariants>;
  rules: Rule[];
  /** Number of rules ever added; the next rule id is `r${ruleCount + 1}`. */
  ruleCount: number;
  /** Number of mock requests received (501s included). */
  requests: number;
  /** Mock requests whose response is not ready yet. */
  pending: number;
  lastScreen: string | null;
  records: LogRecord[];
  lastSeq: number;
  waiters: Set<Waiter>;
}

export interface CreateSessionInput {
  scenario?: string;
  from?: string;
  configs?: Record<string, StoredHandlerVariants>;
  label?: string;
}

export interface LogFilter {
  since: number;
  key?: string;
  screen?: string;
}

export interface SessionStore {
  create(input: CreateSessionInput, id?: string): Session;
  get(id: string): Session | null;
  /** Like `get`, but raises a 404 `unknown_session`. */
  require(id: string): Session;
  delete(id: string): boolean;
  list(): Session[];
  /** Replaces the base configs with a scenario and drops every rule. */
  applyScenario(session: Session, scenarioId: string): void;
}

/** Oldest log entries are dropped past this size; `seq` keeps counting. */
const LOG_LIMIT = 5000;

const HANDLER_TYPES: readonly unknown[] = Object.values(HandlerType);

const cloneConfigs = (
  configs: Record<string, StoredHandlerVariants>,
): Record<string, StoredHandlerVariants> =>
  Object.fromEntries(Object.entries(configs).map(([key, config]) => [key, { ...config }]));

const isHandlerType = (value: unknown): value is HandlerType => HANDLER_TYPES.includes(value);

const parseStoredConfig = (key: string, value: unknown): StoredHandlerVariants => {
  const invalid = (detail: string) =>
    new ControlError(400, 'invalid_body', `configs["${key}"]: ${detail}`);

  if (!isRecord(value)) throw invalid('must be an object.');

  const { active, type, variant, delay } = value;
  if (typeof active !== 'boolean') throw invalid('"active" must be a boolean.');
  if (type !== null && !isHandlerType(type)) {
    throw invalid('"type" must be "Manual", "Auto", "Swagger" or null.');
  }
  if (variant !== undefined && typeof variant !== 'string') {
    throw invalid('"variant" must be a string.');
  }
  if (
    delay !== undefined &&
    delay !== 'real' &&
    delay !== 'infinite' &&
    !(typeof delay === 'number' && Number.isFinite(delay) && delay >= 0)
  ) {
    throw invalid('"delay" must be a non-negative number, "real" or "infinite".');
  }

  return {
    active,
    type,
    ...(variant !== undefined ? { variant } : {}),
    ...(delay !== undefined ? { delay } : {}),
  };
};

/** Validates a `configs` body: every key must be a known handler key. */
export const parseConfigs = (
  value: unknown,
  matcher: HandlerMatcher,
): Record<string, StoredHandlerVariants> => {
  if (!isRecord(value)) {
    throw new ControlError(
      400,
      'invalid_body',
      '"configs" must be an object keyed by handler key.',
    );
  }

  const configs: Record<string, StoredHandlerVariants> = {};
  for (const [key, config] of Object.entries(value)) {
    if (!matcher.byKey(key)) {
      throw new ControlError(404, 'unknown_handler', `No handler has the key "${key}".`, {
        handler: key,
        nearest: matcher.nearestByText(key),
      });
    }
    configs[key] = parseStoredConfig(key, config);
  }
  return configs;
};

export const addRule = (session: Session, rule: NewRule): Rule => {
  session.ruleCount += 1;
  const created: Rule = { ...rule, id: `r${session.ruleCount}` };
  session.rules.push(created);
  return created;
};

const isApplicable = (rule: Rule): boolean =>
  (rule.after === undefined || rule.after.armed) && rule.remaining !== 0;

/**
 * Picks the rules for one request to a handler, newest first, and spends one
 * count of each rule it applies. Rules waiting for their `after` handler or out
 * of `times` are skipped. The first rule with an answer decides the response.
 * The delay comes from the first rule that has one on the way down to it — so a
 * delay-only rule delays whatever answers below it, and stops applying once a
 * newer rule answers.
 */
export const decide = (session: Session, key: string): Decision => {
  let answerRule: Rule | null = null;
  let delayRule: Rule | null = null;

  for (let i = session.rules.length - 1; i >= 0; i--) {
    const rule = session.rules[i];
    if (rule.key !== key || !isApplicable(rule)) continue;

    if (rule.delay !== undefined && !delayRule) delayRule = rule;
    if (rule.answer) {
      answerRule = rule;
      break;
    }
  }

  const applied = new Set<Rule>();
  if (answerRule) applied.add(answerRule);
  if (delayRule) applied.add(delayRule);
  applied.forEach(rule => {
    if (rule.remaining !== undefined) rule.remaining -= 1;
  });

  return { answerRule, delayRule };
};

/**
 * Arms the rules waiting for this handler. Call it right after `decide` for the
 * same request, so a rule that waits for its own handler starts with the next one.
 */
export const armAfter = (session: Session, key: string): void => {
  for (const rule of session.rules) {
    if (rule.after && rule.after.key === key) rule.after.armed = true;
  }
};

const countLog = (session: Session, key: string, since: number): number =>
  session.records.filter(record => record.key === key && record.entry.seq > since).length;

/** Appends one answered request and releases the waiters it satisfies. */
export const appendLog = (
  session: Session,
  key: string | null,
  entry: Omit<LogEntry, 'seq'>,
): LogEntry => {
  session.lastSeq += 1;
  const logged: LogEntry = { seq: session.lastSeq, ...entry };
  session.records.push({ key, entry: logged });
  if (session.records.length > LOG_LIMIT) session.records.shift();

  if (key !== null) {
    session.waiters.forEach(waiter => {
      if (waiter.key === key && countLog(session, key, waiter.since) >= waiter.count) {
        waiter.finish(true);
      }
    });
  }
  return logged;
};

export const readLog = (session: Session, filter: LogFilter): LogEntry[] =>
  session.records
    .filter(
      ({ key, entry }) =>
        entry.seq > filter.since &&
        (filter.key === undefined || key === filter.key) &&
        (filter.screen === undefined || entry.screen === filter.screen),
    )
    .map(record => record.entry);

/**
 * Resolves once the handler has answered `count` requests after `since`, or
 * with `ok: false` when the timeout passes first.
 */
export const waitForRequests = (
  session: Session,
  key: string,
  count: number,
  since: number,
  timeoutMs: number,
): Promise<WaitResult> => {
  const current = countLog(session, key, since);
  if (current >= count) return Promise.resolve({ ok: true, count: current });

  return new Promise(resolve => {
    const waiter: Waiter = {
      key,
      since,
      count,
      finish(ok) {
        clearTimeout(timer);
        session.waiters.delete(waiter);
        resolve({ ok, count: countLog(session, key, since) });
      },
    };
    const timer = setTimeout(() => waiter.finish(false), timeoutMs);
    session.waiters.add(waiter);
  });
};

/** Ends every pending wait with `ok: false`. Called when the session or the server goes away. */
export const releaseWaiters = (session: Session): void => {
  Array.from(session.waiters).forEach(waiter => waiter.finish(false));
};

const newSessionId = (taken: (id: string) => boolean): string => {
  for (;;) {
    const id = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    if (!taken(id) && id !== DEFAULT_SESSION_ID) return id;
  }
};

export const createSessionStore = (scenarios: ReadonlyMap<string, Scenario>): SessionStore => {
  const sessions = new Map<string, Session>();

  const requireSession = (id: string): Session => {
    const session = sessions.get(id);
    if (!session) {
      throw new ControlError(404, 'unknown_session', `No session has the id "${id}".`, {
        session: id,
      });
    }
    return session;
  };

  const requireScenario = (id: string): Scenario => {
    const scenario = scenarios.get(id);
    if (!scenario) {
      throw new ControlError(404, 'unknown_scenario', `No scenario has the id "${id}".`, {
        scenario: id,
      });
    }
    return scenario;
  };

  return {
    create(input, id) {
      if (input.scenario !== undefined && input.from !== undefined) {
        throw new ControlError(400, 'invalid_body', 'Give either "scenario" or "from", not both.');
      }

      let scenario: string | null = null;
      let configs: Record<string, StoredHandlerVariants> = {};
      let rules: Rule[] = [];
      let ruleCount = 0;
      let lastScreen: string | null = null;

      if (input.scenario !== undefined) {
        const found = requireScenario(input.scenario);
        scenario = found.id;
        configs = cloneConfigs(found.configs);
      }

      if (input.from !== undefined) {
        const source = requireSession(input.from);
        scenario = source.scenario;
        configs = cloneConfigs(source.configs);
        rules = structuredClone(source.rules);
        ruleCount = source.ruleCount;
        lastScreen = source.lastScreen;
      }

      const session: Session = {
        id: id ?? newSessionId(candidate => sessions.has(candidate)),
        label: input.label ?? null,
        scenario,
        createdAt: new Date().toISOString(),
        configs: { ...configs, ...cloneConfigs(input.configs ?? {}) },
        rules,
        ruleCount,
        requests: 0,
        pending: 0,
        lastScreen,
        records: [],
        lastSeq: 0,
        waiters: new Set(),
      };
      sessions.set(session.id, session);
      return session;
    },

    get(id) {
      return sessions.get(id) ?? null;
    },

    require: requireSession,

    delete(id) {
      const session = sessions.get(id);
      if (!session) return false;
      releaseWaiters(session);
      return sessions.delete(id);
    },

    list() {
      return Array.from(sessions.values());
    },

    applyScenario(session, scenarioId) {
      const scenario = requireScenario(scenarioId);
      session.scenario = scenario.id;
      session.configs = cloneConfigs(scenario.configs);
      session.rules = [];
    },
  };
};
