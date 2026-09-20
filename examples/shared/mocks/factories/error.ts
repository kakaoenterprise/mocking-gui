import type { ApiError } from '../types';

/** Single error envelope, so every failure variant across the examples looks alike. */
export const createError = (status: number, error: string): ApiError => ({ error, status });

export const ERRORS = {
  badRequest: createError(400, 'Invalid username'),
  unauthorized: createError(401, 'Missing or expired session'),
  forbidden: createError(403, 'Your role cannot access this resource'),
  notFound: createError(404, 'User not found'),
  conflict: createError(409, 'Order already cancelled'),
  tooManyRequests: createError(429, 'Rate limit exceeded, retry later'),
  serverError: createError(500, 'Unexpected error, please retry'),
} as const;
