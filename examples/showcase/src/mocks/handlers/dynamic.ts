import { ENDPOINTS } from '@/mocks/constants/endpoints';
import { createErrorBody, createUser, type Role } from '@/mocks/factories/user';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

const ALL_RESULTS = [
  'mocking-gui',
  'mock-service-worker',
  'msw-dev-tool',
  'openapi-typescript',
  'vitest',
] as const;

const ROLES: Role[] = ['viewer', 'editor', 'admin'];

const isRole = (value: string | null): value is Role =>
  value !== null && ROLES.includes(value as Role);

/**
 * AUTO handlers — instead of a fixed list, a function computes the response from
 * the incoming request. Use this when the response has to reflect the query,
 * path params, headers or cookies. The panel shows these as `Auto`; there is no
 * variant to pick because the request itself decides.
 */
export const dynamicHandlers: HandlerConfigOption[] = [
  {
    name: 'Search (reads query params)',
    description: 'Paginates over a fixed corpus. `?q=` and `?page=` shape the response.',
    url: ENDPOINTS.SEARCH,
    method: 'get',
    responseVariantsFn: ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      const pageSize = Number(url.searchParams.get('pageSize') ?? 2);
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));

      const matched = ALL_RESULTS.filter(item => item.includes(query));
      const start = (page - 1) * pageSize;
      const items = matched.slice(start, start + pageSize);

      if (query && matched.length === 0) {
        return {
          name: 'No matches',
          status: 404,
          body: createErrorBody('NO_RESULTS', `Nothing matches "${query}".`),
        };
      }

      return {
        name: 'Page',
        status: 200,
        body: {
          query,
          page,
          pageSize,
          total: matched.length,
          hasNext: start + pageSize < matched.length,
          items,
        },
      };
    },
  },
  {
    name: 'Session (reads headers + path)',
    description: 'Send `x-demo-role: admin` and the same endpoint answers as an admin.',
    url: `${ENDPOINTS.SESSION}/:tenantId`,
    method: 'get',
    responseVariantsFn: ({ request, params }) => {
      const roleHeader = request.headers.get('x-demo-role');
      const authorization = request.headers.get('authorization');

      if (!authorization) {
        return {
          name: 'Missing token',
          status: 401,
          body: createErrorBody('NO_TOKEN', 'Authorization header is required.'),
        };
      }

      const role: Role = isRole(roleHeader) ? roleHeader : 'viewer';

      return {
        name: 'Session',
        status: 200,
        body: {
          tenantId: params.tenantId,
          resolvedFrom: { 'x-demo-role': roleHeader ?? '(absent → viewer)' },
          user: createUser({ role }),
        },
      };
    },
  },
];
