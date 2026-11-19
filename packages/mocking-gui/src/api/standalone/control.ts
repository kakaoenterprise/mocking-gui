import { ControlError, errorJson, json, readJsonObject } from './http';
import { parsePick, requireHandler } from './pick';
import { addRule, parseConfigs, readLog, waitForRequests } from './session';
import { CONTROL_PREFIX, SESSION_COOKIE, SESSION_HEADER } from './types';
import { getVariantKey } from '../../utils/common/keys';

import type { HandlerMatcher } from './matcher';
import type { CreateSessionInput, Rule, Session, SessionStore } from './session';
import type { Scenario } from '../../types/handler';

export interface ControlContext {
  matcher: HandlerMatcher;
  scenarios: ReadonlyMap<string, Scenario>;
  sessions: SessionStore;
  /** Folder the server was started for. Reported by the health endpoint when set. */
  root?: string;
}

export interface ControlApi {
  handle(request: Request, url: URL): Promise<Response>;
}

const DEFAULT_WAIT_TIMEOUT_MS = 5000;
const MAX_WAIT_TIMEOUT_MS = 60_000;

const noContent = (): Response => new Response(null, { status: 204 });

const optionalString = (body: Record<string, unknown>, field: string): string | undefined => {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value) {
    throw new ControlError(400, 'invalid_body', `"${field}" must be a non-empty string.`);
  }
  return value;
};

const requiredString = (body: Record<string, unknown>, field: string): string => {
  const value = optionalString(body, field);
  if (value === undefined) {
    throw new ControlError(400, 'invalid_body', `"${field}" is required.`);
  }
  return value;
};

const rejectUnknownFields = (body: Record<string, unknown>, allowed: readonly string[]) => {
  const unknown = Object.keys(body).filter(field => !allowed.includes(field));
  if (unknown.length > 0) {
    throw new ControlError(400, 'invalid_body', `Unknown field(s): ${unknown.join(', ')}.`, {
      allowed,
    });
  }
};

/** Reads a non-negative integer query parameter. */
const intParam = (url: URL, name: string, fallback: number, minimum = 0): number => {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new ControlError(
      400,
      'invalid_query',
      `"${name}" must be an integer of at least ${minimum}.`,
    );
  }
  return value;
};

const methodNotAllowed = (method: string) =>
  new ControlError(405, 'method_not_allowed', `${method} is not supported on this path.`);

const safeDecode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export const createControlApi = ({
  matcher,
  scenarios,
  sessions,
  root,
}: ControlContext): ControlApi => {
  const summaryOf = (session: Session) => ({
    id: session.id,
    label: session.label,
    scenario: session.scenario,
    createdAt: session.createdAt,
    requests: session.requests,
    lastScreen: session.lastScreen,
  });

  const ruleView = (rule: Rule) => ({
    id: rule.id,
    key: rule.key,
    handler: matcher.byKey(rule.key)?.handler.name ?? null,
    kind: rule.answer?.kind ?? 'delay',
    ...(rule.answer?.kind === 'variant' ? { variant: rule.answer.variant } : {}),
    ...(rule.answer?.kind === 'response' ? { response: rule.answer.response } : {}),
    ...(rule.delay !== undefined ? { delay: rule.delay } : {}),
    ...(rule.after
      ? {
          after: matcher.byKey(rule.after.key)?.handler.name ?? rule.after.key,
          armed: rule.after.armed,
        }
      : {}),
    ...(rule.times !== undefined ? { times: rule.times, remaining: rule.remaining } : {}),
  });

  const detailOf = (session: Session) => ({
    ...summaryOf(session),
    configs: session.configs,
    rules: session.rules.map(ruleView),
  });

  /** What a caller needs to attach a browser or a server to the new session. */
  const connectionOf = (session: Session) => ({
    id: session.id,
    label: session.label,
    scenario: session.scenario,
    header: { name: SESSION_HEADER, value: session.id },
    cookie: { name: SESSION_COOKIE, value: session.id },
    urlPrefix: `/s/${session.id}`,
  });

  const createSession = async (request: Request): Promise<Response> => {
    const body = await readJsonObject(request);
    rejectUnknownFields(body, ['scenario', 'from', 'configs', 'label']);

    const input: CreateSessionInput = {
      scenario: optionalString(body, 'scenario'),
      from: optionalString(body, 'from'),
      label: optionalString(body, 'label'),
      configs: body.configs === undefined ? undefined : parseConfigs(body.configs, matcher),
    };
    return json(connectionOf(sessions.create(input)), 201);
  };

  const sessionRoute = async (
    request: Request,
    url: URL,
    session: Session,
    action: string | undefined,
  ): Promise<Response> => {
    const { method } = request;

    if (action === undefined) {
      if (method === 'GET') return json(detailOf(session));
      if (method === 'DELETE') {
        sessions.delete(session.id);
        return noContent();
      }
      throw methodNotAllowed(method);
    }

    if (action === 'scenario') {
      if (method !== 'PUT') throw methodNotAllowed(method);
      const body = await readJsonObject(request);
      rejectUnknownFields(body, ['scenario']);
      sessions.applyScenario(session, requiredString(body, 'scenario'));
      return json({ id: session.id, scenario: session.scenario });
    }

    if (action === 'picks') {
      if (method === 'POST') {
        const rule = addRule(session, parsePick(await readJsonObject(request), matcher));
        return json({ ruleId: rule.id }, 201);
      }
      if (method === 'DELETE') {
        session.rules = [];
        return noContent();
      }
      throw methodNotAllowed(method);
    }

    if (action === 'mark') {
      if (method !== 'POST') throw methodNotAllowed(method);
      const body = await readJsonObject(request);
      rejectUnknownFields(body, ['screen']);
      session.lastScreen = requiredString(body, 'screen');
      return json({ seq: session.lastSeq });
    }

    if (action === 'log') {
      if (method !== 'GET') throw methodNotAllowed(method);
      const handlerRef = url.searchParams.get('handler');
      const entries = readLog(session, {
        since: intParam(url, 'since', 0),
        key: handlerRef ? requireHandler(matcher, handlerRef).key : undefined,
        screen: url.searchParams.get('screen') ?? undefined,
      });
      return json({ entries, pending: session.pending, lastSeq: session.lastSeq });
    }

    if (action === 'wait') {
      if (method !== 'GET') throw methodNotAllowed(method);
      const handlerRef = url.searchParams.get('handler');
      if (!handlerRef) {
        throw new ControlError(400, 'invalid_query', '"handler" is required.');
      }
      const result = await waitForRequests(
        session,
        requireHandler(matcher, handlerRef).key,
        intParam(url, 'count', 1, 1),
        intParam(url, 'since', 0),
        Math.min(intParam(url, 'timeout', DEFAULT_WAIT_TIMEOUT_MS), MAX_WAIT_TIMEOUT_MS),
      );
      return json(result);
    }

    throw new ControlError(404, 'not_found', 'No control API matches this path.');
  };

  const route = async (request: Request, url: URL, segments: string[]): Promise<Response> => {
    const { method } = request;
    const [resource, id, action, ...rest] = segments;

    if (resource === undefined || (resource === 'health' && id === undefined)) {
      if (method !== 'GET') throw methodNotAllowed(method);
      return json({
        ok: true,
        handlers: matcher.entries.length,
        scenarios: scenarios.size,
        sessions: sessions.list().length,
        ...(root !== undefined ? { root } : {}),
      });
    }

    if (resource === 'handlers' && id === undefined) {
      if (method !== 'GET') throw methodNotAllowed(method);
      return json(
        matcher.entries.map(({ handler, key, path }) => ({
          name: handler.name,
          description: handler.description ?? null,
          method: handler.method.toUpperCase(),
          path,
          key,
          variants: (handler.responseVariants ?? []).map(getVariantKey),
          auto: Boolean(handler.respond ?? handler.responseVariantsFn),
        })),
      );
    }

    if (resource === 'scenarios' && id === undefined) {
      if (method !== 'GET') throw methodNotAllowed(method);
      return json(
        Array.from(scenarios.values()).map(scenario => ({
          id: scenario.id,
          name: scenario.name,
          description: scenario.description ?? null,
        })),
      );
    }

    if (resource === 'sessions' && id === undefined) {
      if (method === 'GET') return json(sessions.list().map(summaryOf));
      if (method === 'POST') return createSession(request);
      throw methodNotAllowed(method);
    }

    if (resource === 'sessions' && id !== undefined && rest.length === 0) {
      return sessionRoute(request, url, sessions.require(id), action);
    }

    throw new ControlError(404, 'not_found', 'No control API matches this path.');
  };

  return {
    async handle(request, url) {
      try {
        const segments = url.pathname
          .slice(CONTROL_PREFIX.length)
          .split('/')
          .filter(Boolean)
          .map(safeDecode);
        return await route(request, url, segments);
      } catch (error) {
        if (error instanceof ControlError) {
          return errorJson(error.status, error.code, error.message, error.extra);
        }
        throw error;
      }
    },
  };
};
