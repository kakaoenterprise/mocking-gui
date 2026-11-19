import { ControlError, isRecord } from './http';
import { getVariantKey } from '../../utils/common/keys';

import type { HandlerEntry, HandlerMatcher } from './matcher';
import type { NewRule, RuleAnswer } from './session';
import type { InlineResponse } from './types';

const ANSWER_FIELDS = ['variant', 'auto', 'response', 'fail'] as const;
const PICK_FIELDS: readonly string[] = ['handler', ...ANSWER_FIELDS, 'delay', 'after', 'times'];
const RESPONSE_FIELDS: readonly string[] = ['status', 'headers', 'body', 'text'];

const invalid = (message: string, extra: Record<string, unknown> = {}) =>
  new ControlError(400, 'invalid_pick', message, extra);

/** Resolves a handler reference (key, name or description) or raises a 404 with the nearest names. */
export const requireHandler = (matcher: HandlerMatcher, ref: unknown): HandlerEntry => {
  if (typeof ref !== 'string' || !ref) {
    throw invalid('"handler" must be a handler key, name or description.');
  }

  const entry = matcher.byRef(ref);
  if (!entry) {
    throw new ControlError(404, 'unknown_handler', `No handler matches "${ref}".`, {
      handler: ref,
      nearest: matcher.nearestByText(ref),
    });
  }
  return entry;
};

const parseDelay = (value: unknown): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid('"delay" must be a non-negative number of milliseconds.');
  }
  return value;
};

const parseTimes = (value: unknown): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalid('"times" must be a positive integer.');
  }
  return value;
};

const parseInlineResponse = (value: unknown): InlineResponse => {
  if (!isRecord(value)) throw invalid('"response" must be an object.');

  const unknownFields = Object.keys(value).filter(field => !RESPONSE_FIELDS.includes(field));
  if (unknownFields.length > 0) {
    throw invalid(`Unknown field(s) in "response": ${unknownFields.join(', ')}.`);
  }

  const { status, headers, body, text } = value;
  if (typeof status !== 'number' || !Number.isInteger(status) || status < 200 || status > 599) {
    throw invalid('"response.status" must be an integer from 200 to 599.');
  }
  if (body !== undefined && text !== undefined) {
    throw invalid('Give either "response.body" or "response.text", not both.');
  }
  if (text !== undefined && typeof text !== 'string') {
    throw invalid('"response.text" must be a string.');
  }

  let parsedHeaders: Record<string, string> | undefined;
  if (headers !== undefined) {
    if (!isRecord(headers)) throw invalid('"response.headers" must be an object of strings.');
    parsedHeaders = {};
    for (const [name, headerValue] of Object.entries(headers)) {
      if (typeof headerValue !== 'string') {
        throw invalid('"response.headers" must be an object of strings.');
      }
      parsedHeaders[name] = headerValue;
    }
  }

  return {
    status,
    ...(parsedHeaders ? { headers: parsedHeaders } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(text !== undefined ? { text } : {}),
  };
};

const parseAnswer = (
  body: Record<string, unknown>,
  field: (typeof ANSWER_FIELDS)[number],
  entry: HandlerEntry,
): RuleAnswer => {
  const { handler } = entry;

  if (field === 'variant') {
    const variants = (handler.responseVariants ?? []).map(getVariantKey);
    if (typeof body.variant !== 'string' || !variants.includes(body.variant)) {
      throw new ControlError(
        400,
        'unknown_variant',
        `"${handler.name}" has no variant "${String(body.variant)}".`,
        { handler: handler.name, variants },
      );
    }
    return { kind: 'variant', variant: body.variant };
  }

  if (field === 'auto') {
    if (body.auto !== true) throw invalid('"auto" must be true.');
    if (!handler.respond && !handler.responseVariantsFn) {
      throw invalid(`"${handler.name}" has no response function, so "auto" cannot answer.`);
    }
    return { kind: 'auto' };
  }

  if (field === 'response') {
    return { kind: 'response', response: parseInlineResponse(body.response) };
  }

  if (body.fail !== 'network') throw invalid('"fail" must be "network".');
  return { kind: 'fail' };
};

/** Validates a pick body and turns it into a rule for the session. */
export const parsePick = (body: Record<string, unknown>, matcher: HandlerMatcher): NewRule => {
  const unknownFields = Object.keys(body).filter(field => !PICK_FIELDS.includes(field));
  if (unknownFields.length > 0) {
    throw invalid(`Unknown field(s): ${unknownFields.join(', ')}.`, { allowed: PICK_FIELDS });
  }

  const entry = requireHandler(matcher, body.handler);
  const delay = parseDelay(body.delay);
  const times = parseTimes(body.times);
  const after = body.after === undefined ? undefined : requireHandler(matcher, body.after);

  const given = ANSWER_FIELDS.filter(field => body[field] !== undefined);
  if (given.length > 1) {
    throw invalid(`Give only one of ${ANSWER_FIELDS.join(', ')} (got ${given.join(', ')}).`);
  }
  if (given.length === 0 && delay === undefined) {
    throw invalid(`Give one of ${ANSWER_FIELDS.join(', ')}, or "delay" alone.`);
  }

  return {
    key: entry.key,
    answer: given.length === 1 ? parseAnswer(body, given[0], entry) : null,
    ...(delay !== undefined ? { delay } : {}),
    ...(after ? { after: { key: after.key, armed: false } } : {}),
    ...(times !== undefined ? { times, remaining: times } : {}),
  };
};
