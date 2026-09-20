import type { Order, OrderStatus, Page } from '../types';

const STATUS_CYCLE: OrderStatus[] = ['pending', 'paid', 'shipped', 'cancelled'];

export const createOrder = (overrides: Partial<Order> & { id: string }): Order => ({
  userId: 'user_ria',
  status: 'paid',
  total: 42_000,
  placedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const createOrderList = (count: number, startIndex = 0): Order[] =>
  Array.from({ length: count }, (_, index) => {
    const offset = startIndex + index;

    return createOrder({
      id: `order_${String(offset + 1).padStart(3, '0')}`,
      status: STATUS_CYCLE[offset % STATUS_CYCLE.length],
      total: 10_000 + offset * 1_500,
      placedAt: new Date(Date.UTC(2026, 0, (offset % 28) + 1)).toISOString(),
    });
  });

/** Wraps items in the pagination envelope the order endpoints return. */
export const createOrderPage = (page: number, perPage: number, total: number): Page<Order> => {
  const startIndex = (page - 1) * perPage;
  const size = Math.max(0, Math.min(perPage, total - startIndex));

  return {
    items: createOrderList(size, startIndex),
    page,
    perPage,
    total,
    hasNext: startIndex + size < total,
  };
};
