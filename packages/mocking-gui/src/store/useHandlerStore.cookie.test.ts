import { describe, it, expect, vi, beforeEach } from 'vitest';

import { HandlerType } from '../types/handler';

/**
 * Cookie subscription tests
 * Validates: the sync cookie is rewritten only when handler state changes
 */

const syncStateToCookie = vi.hoisted(() => vi.fn());
vi.mock('../utils/browser/cookie', () => ({ syncStateToCookie }));

// The subscription is registered at module load only in a browser-like
// environment, so `window` must exist before the store module is imported.
(globalThis as { window?: unknown }).window ??= {};
const { useHandlerStore } = await import('./useHandlerStore');

describe('cookie subscription', () => {
  beforeEach(() => {
    syncStateToCookie.mockClear();
  });

  it('does not rewrite the cookie when only unrelated state changes', () => {
    useHandlerStore.setState({ scenarios: [] });
    useHandlerStore.getState().addToDraft('get./api/users', {
      active: true,
      type: HandlerType.MANUAL,
      variant: 'Success',
    });

    expect(syncStateToCookie).not.toHaveBeenCalled();
  });

  it('rewrites the cookie when handler configs change', () => {
    useHandlerStore.setState({
      handlerConfigs: {
        'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Success' },
      },
    });

    expect(syncStateToCookie).toHaveBeenCalledTimes(1);
  });

  it('rewrites the cookie when the handler list changes', () => {
    useHandlerStore.setState({ handlers: [] });

    expect(syncStateToCookie).toHaveBeenCalledTimes(1);
  });
});
