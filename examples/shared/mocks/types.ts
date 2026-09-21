/**
 * Domain shapes the shared mock data is built from.
 *
 * Kept structurally compatible with the per-example `features` API types, so an example
 * can keep its own local types and still consume these handlers.
 */

export type UserRole = 'Admin' | 'User' | 'Guest';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  features: string[];
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  placedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  hasNext: boolean;
}

export interface ApiError {
  error: string;
  status: number;
}
