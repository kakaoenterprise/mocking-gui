import { http, RequestHandler } from 'msw';

import type { HandlerResponseVariant, HttpResolverInfo } from './handler';
import type { StartOptions as WorkerStartOptions } from 'msw/browser';

/**
 * Recursively marks every array and property as `readonly`, leaving functions
 * callable.
 *
 * The function branch comes first on purpose: without it a function type would
 * fall into the object branch and be mapped into a plain property bag, losing
 * its call signature (`responseVariantsFn` would stop being invokable).
 */
type ReadonlyDeep<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends (infer U)[]
    ? readonly ReadonlyDeep<U>[]
    : T extends object
      ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> }
      : T;

/**
 * Handler config as accepted from user code: {@link HandlerConfigOption} with
 * every array and property relaxed to `readonly`.
 *
 * The relaxation is what lets consumers pin declarations with `as const` — which
 * is in turn what lets the testing API infer handler and variant names as
 * literals. `as const` produces readonly arrays and readonly tuples, and neither
 * is assignable to a mutable array.
 *
 * Note the relaxation is only needed when a *variable* is passed. An inline
 * `[...] as const satisfies readonly HandlerConfigOption[]` checks fine against
 * the engine's own type, because `satisfies` on a fresh literal is a different
 * check from assigning an already-readonly value.
 *
 * Expressed by applying {@link ReadonlyDeep} rather than by restating fields, so
 * the two shapes cannot drift: a field added to the engine's type appears here
 * automatically, with no second definition to keep in sync. Named rather than
 * inlined so compiler errors and IDE hovers print a short name instead of the
 * fully expanded mapped type.
 *
 * Handler configs are only ever read by the engine, never mutated, so accepting
 * readonly input costs nothing. The two reads that need the engine's shape cast
 * at their boundary (`useSetupMockingGUIWorker`, `createMockingServer`).
 */
export type ReadonlyHandlerConfig = ReadonlyDeep<HandlerConfigOption>;

// Client configuration type for Mocking GUI
export type MockingConfig = {
  mocks?: readonly ReadonlyHandlerConfig[];
  swagger?: SwaggerSourceConfigOption[];
  worker?: WorkerStartOptions;
  /**
   * Additional MSW RequestHandlers that are not managed by Mocking GUI.
   * Useful for GraphQL or WebSocket handlers.
   */
  onDemandHandlers?: RequestHandler[];
};

export type MockingServerConfig = {
  /**
   * Cookie string passed from the browser (e.g., request.headers.get('cookie'))
   * Applies the browser GUI settings to the server when provided.
   */

  cookie?: string | null;
} & Omit<MockingConfig, 'method' | 'url' | 'name'>;

/** Handler Config Options */
export interface HandlerConfigOption {
  name: string;
  description?: string;
  url: string;
  method: keyof typeof http;
  /**
   * Function to statically change the response
   */
  responseVariants?: HandlerResponseVariant[];
  /**
   * Function to dynamically generate the response
   * - Can generate response using request parameters, headers, etc.
   */
  responseVariantsFn?: (info: HttpResolverInfo) => HandlerResponseVariant;
  delay?: number;
}

/** Swagger Config Options */
export interface SwaggerSourceConfigOption {
  /**
   * Defines the name for identifying the swagger source
   */
  name: string;
  /**
   * Endpoint URL for accessing Swagger/OpenAPI documentation (JSON)
   */
  configUrl: string;
  /**
   * Swagger UI web documentation URL provided by the service or other Docs
   * Supports link navigation in the API tab when provided
   */
  docsUrl?: string;
  /**
   * Specifies the server domain (URL) to be used for actual MSW API calls.
   * Instead of the server URL defined in Swagger config, specifies the target domain for MSW to intercept requests.
   */
  serverUrl?: string;
}
