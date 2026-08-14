import { describe, it, expect } from 'vitest';

import { LOCAL_STORAGE_KEY, PERSIST_VERSION } from '../../../constants/key';
import { HandlerType } from '../../../types/handler';
import { COOKIE_KEY, encodeHandlerConfigsToCookieValue } from '../../../utils/browser/cookie';
import { computeActiveScenarioId } from '../../../utils/scenario';
import { serializeScenario, serializeScenarioCookie } from '../../serialize';

import type { HandlerState } from '../../../types/handler';
import type { Scenario } from '../../../types/handler';

const makeScenario = (): Scenario => ({
  id: 'scn-1',
  name: 'My Scenario',
  configs: {
    'get./users': {
      active: true,
      type: HandlerType.MANUAL,
      variant: '200-success',
    },
  },
  createdAt: '1970-01-01T00:00:00.000Z',
});

describe('serializeScenario', () => {
  it('registers the scenario as active by default', () => {
    const scn = makeScenario();
    const entry = serializeScenario(scn);

    expect(entry.key).toBe(LOCAL_STORAGE_KEY.MOCKING_GUI_HANDLERS);

    const parsed = JSON.parse(entry.value) as {
      state: {
        handlerConfigs: Scenario['configs'];
        scenarios: Scenario[];
        activeScenarioId: string | null;
      };
      version: number;
    };

    // Documents the coupling rather than verifying it: the serializer and the
    // store now read the *same* constant, so there is nothing left to drift.
    // Whether the store actually accepts this envelope is proven in the browser
    // (examples/react-csr/e2e), not here.
    expect(parsed.version).toBe(PERSIST_VERSION);
    expect(parsed.state.handlerConfigs).toEqual(scn.configs);
    expect(parsed.state.scenarios).toEqual([scn]);
    expect(parsed.state.activeScenarioId).toBe(scn.id);
  });
});

describe('serializeScenarioCookie', () => {
  it('produces the same value as the pure cookie encoder (parity)', () => {
    const scn = makeScenario();
    const cookie = serializeScenarioCookie(scn);

    expect(cookie.name).toBe(COOKIE_KEY);
    expect(cookie.value).toBe(encodeHandlerConfigsToCookieValue(scn.configs));
  });
});

describe('Risk 2: reconciliation of an injected active scenario', () => {
  it('returns the scenario id when the handler key matches (positive case)', () => {
    const scn = makeScenario();
    const handler: HandlerState = { name: 'Users', method: 'get', url: '/users' };

    const result = computeActiveScenarioId(scn.id, [scn], scn.configs, [handler]);

    expect(result).toBe(scn.id);
  });

  it('returns null when the handler key does not match (negative case)', () => {
    const scn = makeScenario();
    const handler: HandlerState = { name: 'Other', method: 'get', url: '/other-resource' };

    const result = computeActiveScenarioId(scn.id, [scn], scn.configs, [handler]);

    expect(result).toBeNull();
  });
});
