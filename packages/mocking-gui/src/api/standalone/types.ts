import type { HandlerConfigOption, ReadonlyHandlerConfig } from '../../types/config';
import type { Scenario } from '../../types/handler';

/** Request header that carries the session id. Takes priority over the cookie. */
export const SESSION_HEADER = 'x-mogu-session';

/** Cookie that carries the session id when the header is absent. */
export const SESSION_COOKIE = 'mogu_session';

/** Id of the implicit session used when `defaultScenario` is set. */
export const DEFAULT_SESSION_ID = 'default';

/** Path prefix of the control API. Never matched against handlers. */
export const CONTROL_PREFIX = '/__mogu';

/**
 * `/s/<session id>/...`: the session id carried in the url. An app that cannot
 * add a header (a built bundle) gets `<server>/s/<id>` as its API url. The
 * prefix is cut off before the path is matched, so `/s/` is reserved.
 */
export const SESSION_PATH_PATTERN = /^\/s\/([^/]+)(\/.*)?$/;

/** What `respond` gets besides the request. */
export interface RespondInfo {
  /** Path parameters of the matched handler url. */
  params: Record<string, string>;
}

/** What a handler may carry on top of a `MockingConfig.mocks` entry. */
interface RespondOption {
  /**
   * Answers with a web `Response` built from the web `Request`. Used for an Auto
   * answer in place of `responseVariantsFn`. A stream body is sent as it is
   * produced, so this is how a streaming or file response is mocked.
   */
  respond?: (request: Request, info: RespondInfo) => Response | Promise<Response>;
}

/**
 * Handler accepted by the mock server: what `MockingConfig.mocks` accepts, plus
 * an optional `respond`.
 */
export type StandaloneHandler = ReadonlyHandlerConfig & RespondOption;

/** `StandaloneHandler` in the engine's mutable shape. The matcher casts to it once. */
export type EngineHandler = HandlerConfigOption & RespondOption;

export interface MockServerOptions {
  mocks: readonly StandaloneHandler[];
  scenarios?: readonly Scenario[];
  /**
   * Base the handler urls were created with (e.g. `https://api.example.com/api`).
   * It is stripped from each handler url to get the route path. When omitted only
   * the origin (or a leading `*`) of each handler url is stripped.
   */
  baseUrl?: string;
  /**
   * Scenario id for requests that carry no session value. They are served by the
   * implicit `default` session. Without it such requests get a 400.
   */
  defaultScenario?: string;
  /**
   * Folder this server was started for, usually the repository root. It is returned
   * by `GET /__mogu/health` so a test runner can refuse a server that was left
   * running from another checkout.
   */
  root?: string;
}

export interface MockServerAddress {
  url: string;
  port: number;
}

export interface MockServer {
  /** Handles one request without a socket. Use it in unit tests or to mount the server on another runtime. */
  handle(request: Request): Promise<Response>;
  listen(port?: number, host?: string): Promise<MockServerAddress>;
  close(): Promise<void>;
}

/** Why a request could not be answered with a mock. */
export type UnmockedReason = 'no_handler' | 'inactive' | 'variant_missing' | 'swagger_unsupported';

/** Response written out in a pick instead of naming a variant. */
export interface InlineResponse {
  status: number;
  headers?: Record<string, string>;
  /** JSON body. Give either `body` or `text`. */
  body?: unknown;
  text?: string;
}

/**
 * Body of `POST /__mogu/sessions/:id/picks`: one override laid over the
 * session's scenario. Give exactly one of `variant`, `auto`, `response` and
 * `fail` — or `delay` alone, which then delays whatever answers below it.
 */
export interface PickBody {
  /** Handler key, name or description (first exact match in that order). */
  handler: string;
  variant?: string;
  auto?: true;
  response?: InlineResponse;
  /** Drops the connection without a response. */
  fail?: 'network';
  /** Milliseconds to wait before answering. */
  delay?: number;
  /**
   * Handler reference (same lookup as `handler`). The pick starts applying
   * once that handler has been requested after the pick was made.
   */
  after?: string;
  /** The pick stops applying after it has been applied to this many requests. */
  times?: number;
}

/** One answered mock request, as returned by `GET /__mogu/sessions/:id/log`. */
export interface LogEntry {
  /** Starts at 1 within a session. */
  seq: number;
  at: string;
  /** From receiving the request to having its response ready. */
  durationMs: number;
  method: string;
  path: string;
  /** `?a=1` form, or `''`. */
  query: string;
  handler: string | null;
  operation: string | null;
  source: 'scenario' | 'rule' | 'unhandled';
  /** Variant name, `auto`, `inline` or `fail`. `null` when unhandled. */
  variant: string | null;
  ruleId: string | null;
  /** `0` for a dropped connection. */
  status: number;
  /** `browser` when the request carries `Origin` or `Sec-Fetch-Mode`. */
  origin: 'browser' | 'server';
  /** Last mark of the session when the request arrived. */
  screen: string | null;
}
