import { createControlApi } from './control';
import { isPreflight, preflightResponse, withCors } from './cors';
import { ControlError, errorJson, json, readCookie, setHeaders } from './http';
import { createHandlerMatcher } from './matcher';
import { listenNodeServer } from './nodeHttp';
import { labelOf, resolveDecision } from './respond';
import { appendLog, armAfter, createSessionStore, decide, releaseWaiters } from './session';
import {
  CONTROL_PREFIX,
  DEFAULT_SESSION_ID,
  SESSION_COOKIE,
  SESSION_HEADER,
  SESSION_PATH_PATTERN,
} from './types';

import type { HandlerEntry, HandlerMatch } from './matcher';
import type { NodeServerHandle } from './nodeHttp';
import type { Resolution, RunRequest } from './respond';
import type { Session } from './session';
import type { LogEntry, MockServer, MockServerOptions, UnmockedReason } from './types';
import type { Scenario } from '../../types/handler';

/** What answered one mock request: the response plus the facts the log keeps about it. */
interface Outcome {
  response: Response;
  entry: HandlerEntry | null;
  source: LogEntry['source'];
  variant: string | null;
  ruleId: string | null;
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isControlPath = (pathname: string): boolean =>
  pathname === CONTROL_PREFIX || pathname.startsWith(`${CONTROL_PREFIX}/`);

const readBody = async (request: Request): Promise<ArrayBuffer | null> => {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : null;
};

/**
 * Rebuilds the request on the base the matched handler was declared with, so the
 * handler's own MSW matcher accepts it no matter which host the server runs on.
 */
const toRunRequest = (
  { entry, params }: HandlerMatch,
  request: Request,
  url: URL,
  pathname: string,
  body: ArrayBuffer | null,
): RunRequest => {
  const isOwnOrigin = entry.runBase === '' || entry.runBase === '*';
  const base = isOwnOrigin ? url.origin : entry.runBase;

  return {
    request: new Request(`${base}${pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body,
    }),
    params,
    baseUrl: entry.runBase === '' ? url.origin : undefined,
  };
};

const unmockedResponse = (
  method: string,
  path: string,
  reason: UnmockedReason,
  nearest: string[],
): Response =>
  setHeaders(
    json(
      {
        error: 'not_mocked',
        message: `No mock answered ${method} ${path} (${reason}).`,
        method,
        path,
        reason,
        nearest,
      },
      501,
    ),
    { 'x-mogu-source': 'unhandled' },
  );

const originOf = (request: Request): LogEntry['origin'] =>
  request.headers.has('origin') || request.headers.has('sec-fetch-mode') ? 'browser' : 'server';

/**
 * Creates a mock server that lives outside the app under test. It serves the
 * same handler configs and scenarios as the worker, but keeps the state per
 * session, so one server can serve many tests, capture workers and agents at once.
 */
export const createMockServer = (options: MockServerOptions): MockServer => {
  const matcher = createHandlerMatcher(options.mocks, options.baseUrl);
  const scenarios = new Map<string, Scenario>(
    (options.scenarios ?? []).map(scenario => [scenario.id, scenario]),
  );
  const sessions = createSessionStore(scenarios);
  const control = createControlApi({ matcher, scenarios, sessions, root: options.root });
  const { defaultScenario } = options;

  if (defaultScenario !== undefined && !scenarios.has(defaultScenario)) {
    throw new Error(
      `[MockingGUI] defaultScenario "${defaultScenario}" is not in the scenarios passed to createMockServer.`,
    );
  }

  /**
   * Finds the session of a mock request and the path to match. The id comes
   * from the header, then the `/s/<id>` path prefix, then the cookie, then the
   * default session. A path prefix is always cut off, whichever one supplied the id.
   */
  const resolveSession = (request: Request, url: URL): { session: Session; pathname: string } => {
    const prefixed = url.pathname.match(SESSION_PATH_PATTERN);
    const pathname = prefixed ? prefixed[2] || '/' : url.pathname;

    const id =
      request.headers.get(SESSION_HEADER) ||
      (prefixed ? safeDecode(prefixed[1]) : null) ||
      readCookie(request.headers.get('cookie'), SESSION_COOKIE) ||
      (defaultScenario !== undefined ? DEFAULT_SESSION_ID : null);

    if (!id) {
      throw new ControlError(
        400,
        'session_required',
        `Send the session id in the "${SESSION_HEADER}" header, a "/s/<id>" path prefix or the "${SESSION_COOKIE}" cookie.`,
      );
    }

    if (id === DEFAULT_SESSION_ID && defaultScenario !== undefined && !sessions.get(id)) {
      const session = sessions.create(
        { scenario: defaultScenario, label: 'default' },
        DEFAULT_SESSION_ID,
      );
      return { session, pathname };
    }
    return { session: sessions.require(id), pathname };
  };

  /** Decides and builds the answer for one mock request. */
  const answer = async (
    session: Session,
    request: Request,
    url: URL,
    pathname: string,
  ): Promise<Outcome> => {
    const { method } = request;
    const match = matcher.match(method, pathname);

    if (!match) {
      return {
        response: unmockedResponse(
          method,
          pathname,
          'no_handler',
          matcher.nearestByPath(method, pathname),
        ),
        entry: null,
        source: 'unhandled',
        variant: null,
        ruleId: null,
      };
    }

    const { entry } = match;
    const stored = session.configs[entry.key];
    const decision = decide(session, entry.key);
    armAfter(session, entry.key);
    const source: LogEntry['source'] = decision.answerRule ? 'rule' : 'scenario';
    const ruleId = decision.answerRule?.id ?? decision.delayRule?.id ?? null;

    let resolution: Resolution;
    try {
      const run = toRunRequest(match, request, url, pathname, await readBody(request));
      resolution = await resolveDecision(entry, stored, decision, run);
    } catch (error) {
      return {
        response: errorJson(
          500,
          'handler_error',
          error instanceof Error ? error.message : String(error),
        ),
        entry,
        source,
        variant: labelOf(entry, stored, decision),
        ruleId,
      };
    }

    if (resolution.kind === 'unmocked') {
      return {
        response: unmockedResponse(method, pathname, resolution.reason, [entry.handler.name]),
        entry,
        source: 'unhandled',
        variant: null,
        ruleId: null,
      };
    }

    return {
      response: setHeaders(resolution.response, {
        'x-mogu-handler': encodeURIComponent(entry.handler.description ?? entry.handler.name),
        'x-mogu-variant': encodeURIComponent(resolution.variant),
        'x-mogu-source': source,
      }),
      entry,
      source,
      variant: resolution.variant,
      ruleId,
    };
  };

  const handleMock = async (request: Request, url: URL): Promise<Response> => {
    const { session, pathname } = resolveSession(request, url);
    const startedAt = performance.now();
    const at = new Date().toISOString();
    const screen = session.lastScreen;

    session.requests += 1;
    session.pending += 1;
    let outcome: Outcome;
    try {
      outcome = await answer(session, request, url, pathname);
    } finally {
      session.pending -= 1;
    }

    const { response, entry } = outcome;
    appendLog(session, entry?.key ?? null, {
      at,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      method: request.method,
      path: pathname,
      query: url.search,
      handler: entry?.handler.name ?? null,
      operation: entry?.handler.description ?? null,
      source: outcome.source,
      variant: outcome.variant,
      ruleId: outcome.ruleId,
      status: response.type === 'error' ? 0 : response.status,
      origin: originOf(request),
      screen,
    });
    return response;
  };

  const handle = async (request: Request): Promise<Response> => {
    if (isPreflight(request)) return preflightResponse(request);

    const url = new URL(request.url);
    let response: Response;
    try {
      response = isControlPath(url.pathname)
        ? await control.handle(request, url)
        : await handleMock(request, url);
    } catch (error) {
      response =
        error instanceof ControlError
          ? errorJson(error.status, error.code, error.message, error.extra)
          : errorJson(
              500,
              'internal_error',
              error instanceof Error ? error.message : String(error),
            );
    }
    return withCors(response, request);
  };

  let nodeServer: NodeServerHandle | null = null;

  return {
    handle,

    async listen(port = 0, host = '127.0.0.1') {
      if (nodeServer) throw new Error('[MockingGUI] The mock server is already listening.');
      nodeServer = await listenNodeServer(handle, port, host);
      return nodeServer.address;
    },

    async close() {
      sessions.list().forEach(releaseWaiters);
      const current = nodeServer;
      nodeServer = null;
      await current?.close();
    },
  };
};
