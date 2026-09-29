import { ENDPOINTS, PETSTORE_ENDPOINTS } from '@/mocks/constants/endpoints';

/**
 * Scenario shape, mirrored locally.
 *
 * NOTE: `Scenario` / `StoredHandlerVariants` are internal to the library today —
 * only `HandlerConfigOption`, `MockingConfig` and `SwaggerSourceConfigOption`
 * are exported. These local types are a stand-in until they are public.
 */
export type StoredHandlerVariants = {
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

/** Extra copy for the demo page; not part of the shared scenario payload. */
export type ScenarioPreset = {
  scenario: Scenario;
  /** The job this scenario exists to support. */
  useWhen: string;
  /** What visibly changes once it is applied. */
  expect: string[];
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

const CREATED_AT = '2026-09-22T00:00:00.000Z';

/**
 * Five situations a frontend engineer actually has to build for, each one
 * awkward or impossible to produce against a healthy backend.
 *
 * A visitor copies the code and pastes it into *Scenarios → Import* in the
 * panel. That is exactly the path a scenario takes between teammates: one
 * base64 string in a ticket or a chat message.
 */
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    useWhen: 'Designing the retry path and the error banner for a failed payment.',
    expect: [
      'POST /v1/checkout → 503 with Retry-After: 120',
      'Dashboard stats → 206, p95 latency flagged as degraded',
      'Notifications → three unread alerts',
    ],
    scenario: {
      id: 'demo-payment-outage',
      name: 'Payment provider is down',
      description:
        'The gateway is refusing charges while the rest of the product stays up. Retry-After is set, so the UI has something to count down from.',
      createdAt: CREATED_AT,
      configs: {
        [key('post', ENDPOINTS.CHECKOUT)]: manual('Payment gateway down'),
        [key('get', ENDPOINTS.DASHBOARD_STATS)]: manual('Partial outage'),
        [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Unread items'),
      },
    },
  },
  {
    useWhen:
      'Building first-run and empty states — the hardest thing to reproduce on a real backend.',
    expect: [
      'Notifications → empty list, unreadCount 0',
      'Export CSV → header row only',
      'Find pets → empty array',
      'User → Viewer, the lowest permission set',
    ],
    scenario: {
      id: 'demo-first-run',
      name: 'Brand new account',
      description:
        'Nothing has happened in this account yet. Every list is empty at the same time, which is the state that never survives on a shared staging environment.',
      createdAt: CREATED_AT,
      configs: {
        [key('get', ENDPOINTS.USER)]: manual('Viewer'),
        [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Empty'),
        [key('get', ENDPOINTS.EXPORT_CSV)]: manual('Empty export'),
        [key('get', PETSTORE_ENDPOINTS.FIND_BY_STATUS)]: manual('No pets'),
      },
    },
  },
  {
    useWhen: 'Working on the re-authentication flow — what happens when a token dies mid-session.',
    expect: [
      'GET /v1/users/:userId → 401 TOKEN_EXPIRED',
      'Notifications → 401 as well, so the whole shell has to react',
      'Dashboard stats → still 200, so partial failure is visible',
    ],
    scenario: {
      id: 'demo-session-expired',
      name: 'Session expired mid-session',
      description:
        'Two endpoints start returning 401 while a third keeps working. Useful for checking that you redirect once rather than three times.',
      createdAt: CREATED_AT,
      configs: {
        [key('get', ENDPOINTS.USER)]: manual('Session expired (401)'),
        [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Session expired (401)'),
        [key('get', ENDPOINTS.DASHBOARD_STATS)]: manual('Healthy'),
      },
    },
  },
  {
    useWhen: 'Reviewing skeletons and spinners — you need the loading state to hold still.',
    expect: [
      'Dashboard stats → 2.5s',
      'Search → 2.5s, so pagination spinners are visible',
      'Find pets → 4s, long enough to catch a layout shift',
    ],
    scenario: {
      id: 'demo-slow-network',
      name: 'Everything on a slow connection',
      description:
        'No errors at all — just latency. Responses are unchanged, which makes this the cleanest way to review loading states without also handling failures.',
      createdAt: CREATED_AT,
      configs: {
        [key('get', ENDPOINTS.DASHBOARD_STATS)]: manual('Healthy', 2500),
        [key('get', ENDPOINTS.SEARCH)]: auto(2500),
        [key('get', PETSTORE_ENDPOINTS.FIND_BY_STATUS)]: manual('Three pets', 4000),
      },
    },
  },
  {
    useWhen: 'Building the upgrade prompt that appears when an org runs out of seats.',
    expect: [
      'User → Admin with seatsUsed 10 of 10',
      'POST /v1/checkout → 402 CARD_DECLINED',
      'Notifications → unread, so the banner competes for attention',
    ],
    scenario: {
      id: 'demo-seat-limit',
      name: 'Seat limit reached, card declined',
      description:
        'The admin tries to add a teammate, hits the seat cap, and the upgrade charge fails. Two failure states stacked, which is where upgrade flows usually break.',
      createdAt: CREATED_AT,
      configs: {
        [key('get', ENDPOINTS.USER)]: manual('Seat limit reached'),
        [key('post', ENDPOINTS.CHECKOUT)]: manual('Card declined'),
        [key('get', ENDPOINTS.NOTIFICATIONS)]: manual('Unread items'),
      },
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
