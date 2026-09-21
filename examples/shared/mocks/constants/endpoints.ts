/** Petstore3 API endpoint, shared by every example so mocked URLs stay identical. */
export const BASE_ENDPOINT = 'https://petstore3.swagger.io/api/v3';

/**
 * Handlers are keyed internally by `method` + `url`, so every entry here must stay
 * unique per method.
 */
export const ENDPOINTS = {
  user: `${BASE_ENDPOINT}/user/:username`,
  userReport: `${BASE_ENDPOINT}/user/:username/report`,
  userAvatar: `${BASE_ENDPOINT}/user/:username/avatar`,
  session: `${BASE_ENDPOINT}/session`,
  orders: `${BASE_ENDPOINT}/orders`,
  order: `${BASE_ENDPOINT}/orders/:orderId`,
} as const;
