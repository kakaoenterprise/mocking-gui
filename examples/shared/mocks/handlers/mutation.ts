import { ENDPOINTS } from '../constants/endpoints';
import { ERRORS } from '../factories/error';
import { createOrder } from '../factories/order';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * Non-GET methods. The same URL can carry one handler per method, so POST / PUT / PATCH /
 * DELETE on `/orders` each get their own entry.
 *
 * Note: `responseVariantsFn` runs synchronously, so a handler cannot read the *request
 * body* to shape its answer — use fixed variants for mutations instead.
 */
export const createOrderHandler: HandlerConfigOption = {
  name: 'Create Order',
  description: '201 Created, plus validation and conflict failures',
  url: ENDPOINTS.orders,
  method: 'post',
  responseVariants: [
    {
      name: 'Created',
      status: 201,
      headers: { location: `${ENDPOINTS.orders}/order_058` },
      body: createOrder({ id: 'order_058', status: 'pending', total: 99_000 }),
    },
    {
      name: 'Error - 400 Validation',
      status: 400,
      body: ERRORS.badRequest,
    },
    {
      name: 'Error - 409 Conflict',
      status: 409,
      body: ERRORS.conflict,
    },
  ],
};

export const replaceOrderHandler: HandlerConfigOption = {
  name: 'Replace Order',
  description: 'Full update returning the replaced resource',
  url: ENDPOINTS.order,
  method: 'put',
  responseVariants: [
    {
      name: 'Replaced',
      status: 200,
      body: createOrder({ id: 'order_001', status: 'paid', total: 120_000 }),
    },
    {
      name: 'Error - 403 Forbidden',
      status: 403,
      body: ERRORS.forbidden,
    },
  ],
};

export const patchOrderHandler: HandlerConfigOption = {
  name: 'Update Order Status',
  description: 'Partial update',
  url: ENDPOINTS.order,
  method: 'patch',
  responseVariants: [
    {
      name: 'Shipped',
      status: 200,
      body: createOrder({ id: 'order_001', status: 'shipped' }),
    },
    {
      name: 'Error - 409 Conflict',
      status: 409,
      body: ERRORS.conflict,
    },
  ],
};

export const deleteOrderHandler: HandlerConfigOption = {
  name: 'Cancel Order',
  description: '204 No Content — a successful response carrying no body at all',
  url: ENDPOINTS.order,
  method: 'delete',
  responseVariants: [
    {
      name: 'No Content',
      status: 204,
    },
    {
      name: 'Error - 409 Already Cancelled',
      status: 409,
      body: ERRORS.conflict,
    },
  ],
};
