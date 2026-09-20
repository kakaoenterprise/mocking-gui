import {
  createOrderHandler,
  deleteOrderHandler,
  patchOrderHandler,
  replaceOrderHandler,
} from './mutation';
import { orderDetailHandler, orderListHandler } from './order';
import { userAvatarHandler, userReportHandler } from './report';
import { sessionHandler } from './session';
import { userHandler } from './user';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export * from './mutation';
export * from './order';
export * from './report';
export * from './session';
export * from './user';

/** Every shared handler, in the order the panel should list them. */
export const sharedHandlers: HandlerConfigOption[] = [
  userHandler,
  userReportHandler,
  userAvatarHandler,
  sessionHandler,
  orderListHandler,
  orderDetailHandler,
  createOrderHandler,
  replaceOrderHandler,
  patchOrderHandler,
  deleteOrderHandler,
];
