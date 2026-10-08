import { describe, expect, it } from 'vitest';

import { convertToMswHandler } from './convertToMsw';
import { HandlerType } from '../../types/handler';
import { getHandlerKey } from '../common/keys';
import { convertSwaggerToHandlers } from '../swagger/convert';

import type { HandlerState, StoredHandlerVariants } from '../../types/handler';

const active = (type: HandlerType, variant = 'ok'): StoredHandlerVariants => ({
  active: true,
  type,
  variant,
  delay: 0,
});

const run = async (handlers: ReturnType<typeof convertToMswHandler>, url: string) => {
  for (const handler of handlers) {
    const result = await handler.run({
      request: new Request(url, { method: 'POST' }),
      requestId: 'test',
    });
    if (result?.response) return result.response;
  }
  return null;
};

describe('convertToMswHandler — colon action paths', () => {
  const cancel: HandlerState = {
    name: 'cancel',
    method: 'post',
    url: 'https://api.example.com/v1/subscriptions/:subscription_id:cancel',
    responseVariants: [{ name: 'ok', status: 200, body: { action: 'cancel' } }],
  };
  const reject: HandlerState = {
    name: 'reject',
    method: 'post',
    url: 'https://api.example.com/v1/subscriptions/:subscription_id:reject-pending',
    responseVariantsFn: ({ params }) => ({
      name: 'ok',
      status: 200,
      body: { action: 'reject', id: params.subscription_id },
    }),
  };

  const handlers = convertToMswHandler([cancel, reject], {
    [getHandlerKey(cancel)]: active(HandlerType.MANUAL),
    [getHandlerKey(reject)]: active(HandlerType.AUTO),
  });

  it('routes each action to its own handler without the user writing \\:', async () => {
    const cancelRes = await run(handlers, 'https://api.example.com/v1/subscriptions/s1:cancel');
    expect(await cancelRes?.json()).toEqual({ action: 'cancel' });

    const rejectRes = await run(
      handlers,
      'https://api.example.com/v1/subscriptions/s1:reject-pending',
    );
    expect(await rejectRes?.json()).toEqual({ action: 'reject', id: 's1' });
  });

  it('does not intercept an action that was not registered', async () => {
    expect(
      await run(handlers, 'https://api.example.com/v1/subscriptions/s1:accept-pending'),
    ).toBeNull();
  });

  it('serves a swagger-imported colon action path instead of throwing at match time', async () => {
    const [swaggerHandler] = convertSwaggerToHandlers('https://api.example.com', {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/v1/subscriptions/{subscription-id}:cancel': {
          post: { responses: { '200': { description: 'ok' } } },
        },
      },
    });
    expect(swaggerHandler.url).toBe(
      'https://api.example.com/v1/subscriptions/:subscription_id:cancel',
    );

    const [msw] = convertToMswHandler([swaggerHandler], {
      [getHandlerKey(swaggerHandler)]: active(HandlerType.SWAGGER, 'ok'),
    });
    const res = await run([msw], 'https://api.example.com/v1/subscriptions/s1:cancel');
    expect(res?.status).toBe(200);
  });
});
