import { graphql, http, HttpResponse } from 'msw';

import { GRAPHQL_ENDPOINT } from '@/mocks/constants/endpoints';
import { createUser } from '@/mocks/factories/user';

import type { RequestHandler } from 'msw';

/**
 * `onDemandHandlers` are handed straight to MSW and are **not** managed by the
 * panel — they have no toggle and no variants. That is the point: GraphQL,
 * WebSocket or always-on infrastructure routes keep working while you flip the
 * REST handlers around them.
 */
export const onDemandHandlers: RequestHandler[] = [
  graphql.query('Me', () =>
    HttpResponse.json({
      data: { me: createUser({ role: 'editor' }) },
    }),
  ),
  http.get(`${GRAPHQL_ENDPOINT}/health`, () =>
    HttpResponse.json({ status: 'ok', managedBy: 'onDemandHandlers' }),
  ),
];
