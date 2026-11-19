import { delay as waitFor, HttpResponse } from 'msw';

import { HandlerType } from '../../types/handler';

import { getVariantKey } from '../../utils/common/keys';
import { createManualHandler } from '../../utils/handler/convertToMsw';

import type { HandlerEntry } from './matcher';
import type { Decision } from './session';
import type { InlineResponse, UnmockedReason } from './types';
import type { HandlerState, StoredHandlerVariants } from '../../types/handler';
import type { HttpHandler, JsonBodyType } from 'msw';

export type Resolution =
  | { kind: 'response'; response: Response; variant: string }
  | { kind: 'unmocked'; reason: UnmockedReason };

/** A request rebuilt on the matched handler's own base, ready for its MSW matcher. */
export interface RunRequest {
  request: Request;
  /** Path parameters of the matched route. */
  params: Record<string, string>;
  /** Base for a path-only handler url, which MSW cannot resolve on its own in Node. */
  baseUrl?: string;
}

/** Name the result of a response function is filed under while it is turned into a response. */
const AUTO_VARIANT = 'auto';

const unmocked = (reason: UnmockedReason): Resolution => ({ kind: 'unmocked', reason });

/**
 * Runs one MSW handler built by the existing converters, so the response rules
 * (rawBody first, delay, Auto) stay exactly the ones the worker and SSR use.
 */
const runMswHandler = async (handler: HttpHandler, run: RunRequest): Promise<Response | null> => {
  const result = await handler.run({
    request: run.request,
    requestId: globalThis.crypto.randomUUID(),
    resolutionContext: run.baseUrl ? { baseUrl: run.baseUrl } : undefined,
  });

  const response = result?.response;
  if (!response || response.headers.get('x-msw-intention') === 'passthrough') return null;
  return response;
};

/** The fields the Manual converter reads, without the (possibly async) response function. */
const manualStateOf = (entry: HandlerEntry): HandlerState => ({
  name: entry.handler.name,
  url: entry.handler.url,
  method: entry.handler.method,
  responseVariants: entry.handler.responseVariants,
});

const cookiesOf = (request: Request): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const pair of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    cookies[pair.slice(0, separator).trim()] = pair.slice(separator + 1).trim();
  }
  return cookies;
};

/**
 * Answers with the handler's response function. `respond` wins when both are
 * given. The result of `responseVariantsFn` is awaited, so the function may read
 * the request body. It is then turned into a response by the Manual converter,
 * so `rawBody` and `headers` follow the same rules as a named variant.
 */
const runAuto = async (
  entry: HandlerEntry,
  delayValue: StoredHandlerVariants['delay'],
  run: RunRequest,
): Promise<Response> => {
  const { handler } = entry;

  if (handler.respond) {
    if (delayValue) await waitFor(delayValue);
    const response = await handler.respond(run.request, { params: run.params });
    if (!(response instanceof Response)) {
      throw new TypeError(`[MockingGUI] respond of "${handler.name}" must return a Response.`);
    }
    return response;
  }

  // The function may consume the body, and MSW clones the request it runs.
  const manualRun: RunRequest = { ...run, request: run.request.clone() };
  const variant = await handler.responseVariantsFn?.({
    params: run.params,
    request: run.request,
    cookies: cookiesOf(run.request),
  });
  if (!variant || typeof variant.status !== 'number') {
    throw new TypeError(
      `[MockingGUI] responseVariantsFn of "${handler.name}" must return a variant with a status.`,
    );
  }

  const response = await runMswHandler(
    createManualHandler(
      { ...manualStateOf(entry), responseVariants: [{ ...variant, name: AUTO_VARIANT }] },
      { active: true, type: HandlerType.MANUAL, variant: AUTO_VARIANT, delay: delayValue },
    ),
    manualRun,
  );
  if (!response) {
    throw new Error(`[MockingGUI] The answer of "${handler.name}" could not be built.`);
  }
  return response;
};

/**
 * Builds the response a stored config asks for. A handler that is off, has no
 * usable variant or is a Swagger config is reported as unmocked — the standalone
 * server never passes a request through to a real backend.
 */
export const resolveStored = async (
  entry: HandlerEntry,
  stored: StoredHandlerVariants | undefined,
  run: RunRequest,
): Promise<Resolution> => {
  const { handler } = entry;
  if (!stored?.active) return unmocked('inactive');

  if (stored.type === HandlerType.SWAGGER) return unmocked('swagger_unsupported');

  if (stored.type === HandlerType.MANUAL) {
    const variant = handler.responseVariants?.find(
      candidate => getVariantKey(candidate) === stored.variant,
    );
    if (!variant) return unmocked('variant_missing');

    const response = await runMswHandler(createManualHandler(manualStateOf(entry), stored), run);
    return response
      ? { kind: 'response', response, variant: getVariantKey(variant) }
      : unmocked('no_handler');
  }

  if (stored.type === HandlerType.AUTO) {
    if (!handler.respond && !handler.responseVariantsFn) return unmocked('variant_missing');

    return {
      kind: 'response',
      response: await runAuto(entry, stored.delay, run),
      variant: AUTO_VARIANT,
    };
  }

  return unmocked('variant_missing');
};

const inlineResponse = ({ status, headers, body, text }: InlineResponse): Response =>
  text !== undefined
    ? HttpResponse.text(text, { status, headers })
    : HttpResponse.json((body ?? null) as JsonBodyType, { status, headers });

/** Label of the answer a decision will give, before it is built. Used when building it throws. */
export const labelOf = (
  entry: HandlerEntry,
  stored: StoredHandlerVariants | undefined,
  decision: Decision,
): string | null => {
  const answer = decision.answerRule?.answer;
  if (answer) {
    if (answer.kind === 'variant') return answer.variant;
    if (answer.kind === 'auto') return 'auto';
    return answer.kind === 'response' ? 'inline' : 'fail';
  }
  if (!stored?.active) return null;
  if (stored.type === HandlerType.AUTO) return 'auto';
  return stored.type === HandlerType.MANUAL ? (stored.variant ?? null) : null;
};

/**
 * Builds the response for one request: the answering rule if there is one,
 * otherwise the session's stored config, with the decided delay applied.
 */
export const resolveDecision = async (
  entry: HandlerEntry,
  stored: StoredHandlerVariants | undefined,
  decision: Decision,
  run: RunRequest,
): Promise<Resolution> => {
  const delayMs = decision.delayRule?.delay;
  const answer = decision.answerRule?.answer;

  if (!answer) {
    return resolveStored(
      entry,
      stored && delayMs !== undefined ? { ...stored, delay: delayMs } : stored,
      run,
    );
  }

  if (answer.kind === 'variant') {
    return resolveStored(
      entry,
      { active: true, type: HandlerType.MANUAL, variant: answer.variant, delay: delayMs ?? 0 },
      run,
    );
  }

  if (answer.kind === 'auto') {
    return resolveStored(entry, { active: true, type: HandlerType.AUTO, delay: delayMs ?? 0 }, run);
  }

  if (delayMs) await waitFor(delayMs);

  return answer.kind === 'response'
    ? { kind: 'response', response: inlineResponse(answer.response), variant: 'inline' }
    : { kind: 'response', response: Response.error(), variant: 'fail' };
};
