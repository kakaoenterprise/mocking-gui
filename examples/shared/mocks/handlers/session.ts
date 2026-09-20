import { ENDPOINTS } from '../constants/endpoints';
import { ERRORS } from '../factories/error';
import { createUser } from '../factories/user';
import { readBearerToken } from '../utils/request';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * Auth-driven responses: the same URL answers 200 / 401 / 403 depending on the request's
 * `Authorization` header or session cookie. Useful for exercising interceptor and
 * refresh-token paths without touching a real auth server.
 */
export const sessionHandler: HandlerConfigOption = {
  name: 'Get Session',
  description: 'Reads the Authorization header and cookies to decide the response',
  url: ENDPOINTS.session,
  method: 'get',
  responseVariantsFn: ({ request, cookies }) => {
    const token = readBearerToken(request);
    const sessionCookie = cookies?.session;

    if (!token && !sessionCookie) {
      return { name: 'Anonymous', status: 401, body: ERRORS.unauthorized };
    }

    if (token === 'expired') {
      return { name: 'Expired token', status: 401, body: ERRORS.unauthorized };
    }

    if (token === 'guest') {
      return { name: 'Insufficient role', status: 403, body: ERRORS.forbidden };
    }

    return {
      name: 'Authenticated',
      status: 200,
      body: {
        token: token ?? sessionCookie,
        user: createUser({ id: 'user_ria', name: 'Ria', role: 'Admin' }),
      },
    };
  },
};
