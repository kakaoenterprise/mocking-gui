import { ENDPOINTS } from '../constants/endpoints';
import { SPECIAL_USERNAMES } from '../constants/users';
import { ERRORS } from '../factories/error';
import { createUser } from '../factories/user';
import { readParam } from '../utils/request';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * One handler carrying BOTH modes, to show they are switchable from the panel:
 * - MANUAL: pick a fixed variant from `responseVariants`
 * - AUTO: let `responseVariantsFn` derive the response from the request
 */
export const userHandler: HandlerConfigOption = {
  name: 'Get User',
  description: 'Switch between fixed variants (Manual) and username-driven logic (Auto)',
  url: ENDPOINTS.user,
  method: 'get',
  responseVariants: [
    {
      name: 'Success - Admin',
      status: 200,
      headers: { 'x-mock-source': 'manual', 'cache-control': 'no-store' },
      body: createUser({ id: 'user_ria', name: 'Ria', role: 'Admin' }),
    },
    {
      name: 'Success - Guest (empty features)',
      status: 200,
      headers: { 'x-mock-source': 'manual' },
      body: createUser({ id: 'user_guest', name: 'Guest', role: 'Guest' }),
    },
    {
      name: 'Error - 404 Not Found',
      status: 404,
      body: ERRORS.notFound,
    },
    {
      name: 'Error - 429 Rate Limited',
      status: 429,
      headers: { 'retry-after': '30' },
      body: ERRORS.tooManyRequests,
    },
    {
      name: 'Error - 500 Server Error',
      status: 500,
      body: ERRORS.serverError,
    },
  ],
  /**
   * Note: the AUTO path applies `status` and the body only — `headers` declared here are
   * not sent, unlike the MANUAL variants above.
   */
  responseVariantsFn: ({ params }) => {
    const username = readParam(params, 'username');

    if (username === SPECIAL_USERNAMES.missing) {
      return { name: 'Auto - Not Found', status: 404, body: ERRORS.notFound };
    }

    if (username === SPECIAL_USERNAMES.guest) {
      return {
        name: 'Auto - Guest',
        status: 200,
        body: createUser({ name: username, role: 'Guest' }),
      };
    }

    return {
      name: 'Auto - Resolved',
      status: 200,
      body: createUser({
        name: username || 'Anonymous',
        role: username === SPECIAL_USERNAMES.admin ? 'Admin' : 'User',
      }),
    };
  },
};
