import { ENDPOINTS } from '../constants/endpoints';
import { ERRORS } from '../factories/error';
import { createOrderPage } from '../factories/order';
import { readNumericQuery } from '../utils/request';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

const TOTAL_ORDERS = 57;

/** Query-string driven pagination, plus fixed variants for the states worth pinning. */
export const orderListHandler: HandlerConfigOption = {
  name: 'List Orders',
  description: 'Auto mode paginates from ?page & ?perPage; Manual mode pins edge cases',
  url: ENDPOINTS.orders,
  method: 'get',
  responseVariants: [
    {
      name: 'First page',
      status: 200,
      body: createOrderPage(1, 10, TOTAL_ORDERS),
    },
    {
      name: 'Last page (partial)',
      status: 200,
      body: createOrderPage(6, 10, TOTAL_ORDERS),
    },
    {
      name: 'Empty result',
      status: 200,
      body: createOrderPage(1, 10, 0),
    },
    {
      name: 'Error - 500 Server Error',
      status: 500,
      body: ERRORS.serverError,
    },
  ],
  responseVariantsFn: ({ request }) => {
    const page = readNumericQuery(request, 'page', 1);
    const perPage = readNumericQuery(request, 'perPage', 10);

    return {
      name: `Auto - page ${page}`,
      status: 200,
      body: createOrderPage(page, perPage, TOTAL_ORDERS),
    };
  },
};

export const orderDetailHandler: HandlerConfigOption = {
  name: 'Get Order',
  description: 'Single order lookup driven by the :orderId path param',
  url: ENDPOINTS.order,
  method: 'get',
  responseVariants: [
    {
      name: 'Success',
      status: 200,
      body: createOrderPage(1, 1, TOTAL_ORDERS).items[0],
    },
    {
      name: 'Error - 404 Not Found',
      status: 404,
      body: ERRORS.notFound,
    },
  ],
};
