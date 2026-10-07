import { ENDPOINTS } from '@/mocks/constants/endpoints';
import { createErrorBody, createUser } from '@/mocks/factories/user';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * MANUAL handlers — a fixed list of response variants you switch between in the
 * panel. This is the bread-and-butter case: one endpoint, every state it can
 * return, including the ones a real backend makes hard to reproduce.
 */
export const manualHandlers: HandlerConfigOption[] = [
  {
    name: 'Get user',
    description: 'Switch role to watch permission-gated UI change. 404/500 need no backend help.',
    url: ENDPOINTS.USER,
    method: 'get',
    responseVariants: [
      { name: 'Viewer', status: 200, body: createUser({ role: 'viewer' }) },
      { name: 'Editor', status: 200, body: createUser({ role: 'editor' }) },
      { name: 'Admin', status: 200, body: createUser({ role: 'admin', seatsUsed: 9 }) },
      {
        name: 'Seat limit reached',
        status: 200,
        body: createUser({ role: 'admin', seatsUsed: 10 }),
      },
      {
        name: 'Not found (404)',
        status: 404,
        body: createErrorBody('USER_NOT_FOUND', 'No user matches that id.'),
      },
      {
        name: 'Server error (500)',
        status: 500,
        body: createErrorBody('INTERNAL', 'Unexpected error.', 'Retry in a moment.'),
      },
      {
        name: 'Session expired (401)',
        status: 401,
        body: createErrorBody('TOKEN_EXPIRED', 'Your session has expired.', 'Sign in again.'),
      },
      {
        name: 'Rate limited (429)',
        status: 429,
        headers: {
          'Retry-After': '30',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
        },
        body: createErrorBody('RATE_LIMITED', 'Too many requests.'),
      },
    ],
  },
  {
    name: 'Checkout',
    description:
      'Three failure modes worth designing for, none of which you can trigger on demand.',
    url: ENDPOINTS.CHECKOUT,
    method: 'post',
    responseVariants: [
      {
        name: 'Paid',
        status: 201,
        headers: { Location: '/orders/ord_5512' },
        body: { orderId: 'ord_5512', status: 'paid', amount: 42_000, currency: 'KRW' },
      },
      {
        name: 'Card declined',
        status: 402,
        body: createErrorBody('CARD_DECLINED', 'Issuer declined the charge.', 'Try another card.'),
      },
      {
        name: 'Idempotency conflict',
        status: 409,
        body: createErrorBody('DUPLICATE_REQUEST', 'This order was already submitted.'),
      },
      {
        name: 'Payment gateway down',
        status: 503,
        headers: { 'Retry-After': '120' },
        body: createErrorBody('GATEWAY_UNAVAILABLE', 'Upstream payment provider is unreachable.'),
      },
    ],
  },
];
