import { ENDPOINTS } from '@/mocks/constants/endpoints';

/**
 * Scenario shape, mirrored locally.
 *
 * NOTE: `Scenario` / `StoredHandlerVariants` are internal to the library today —
 * only `HandlerConfigOption`, `MockingConfig` and `SwaggerSourceConfigOption`
 * are exported. These local types are a stand-in until they are public.
 */
type StoredHandlerVariants = {
  active: boolean;
  type: 'Manual' | 'Auto' | 'Swagger' | null;
  variant?: string;
  delay?: number;
};

export type Scenario = {
  id: string;
  name: string;
  description?: string;
  configs: Record<string, StoredHandlerVariants>;
  createdAt: string;
};

/** Handler keys are `${method}.${url}` — the same rule the library uses. */
const key = (method: string, url: string) => `${method}.${url}`;

const manual = (variant: string, delay?: number): StoredHandlerVariants => ({
  active: true,
  type: 'Manual',
  variant,
  ...(delay === undefined ? {} : { delay }),
});

const auto = (delay?: number): StoredHandlerVariants => ({
  active: true,
  type: 'Auto',
  ...(delay === undefined ? {} : { delay }),
});

/**
 * Presets a visitor can paste into the panel's *Scenarios → Import* box. This is
 * exactly how a scenario travels between teammates: one base64 string in a
 * ticket or a chat message.
 */
export const SCENARIO_PRESETS: Scenario[] = [
  {
    id: 'demo-payment-outage',
    name: 'Payment provider outage',
    description: 'Checkout 503 with Retry-After, degraded metrics, a pile of unread alerts.',
    createdAt: '2026-09-21T00:00:00.000Z',
    configs: {
      [key('post', ENDPOINTS.CHECKOUT)]: manual('Payment gateway down'),
      [key('get', ENDPOINTS.DASHBOARD_STATS)]: manual('Partial outage'),
      [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Unread items'),
    },
  },
  {
    id: 'demo-first-run',
    name: 'Brand new account',
    description: 'Every empty state at once — the hardest thing to reproduce on a real backend.',
    createdAt: '2026-09-21T00:00:00.000Z',
    configs: {
      [key('get', ENDPOINTS.USER)]: manual('Viewer'),
      [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Empty'),
      [key('get', ENDPOINTS.EXPORT_CSV)]: manual('Empty export'),
    },
  },
  {
    id: 'demo-slow-and-expired',
    name: 'Slow network, expired session',
    description: '1.5s delay on stats and search, then a 401 on notifications.',
    createdAt: '2026-09-21T00:00:00.000Z',
    configs: {
      [key('get', ENDPOINTS.DASHBOARD_STATS)]: manual('Healthy', 1500),
      [key('get', ENDPOINTS.SEARCH)]: auto(1500),
      [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Session expired (401)'),
    },
  },
];

/**
 * Base64 of the scenario JSON — the same encoding the panel's share button
 * produces, so these codes are indistinguishable from a teammate's.
 */
export const encodeScenario = (scenario: Scenario): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(scenario));
  let binary = '';
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
};
