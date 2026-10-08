import { useCallback, useEffect, useState } from 'react';

import { ENDPOINTS } from '@/mocks/constants/endpoints';

type Organization = { name: string; seatsUsed: number; seatLimit: number };

export type Account = {
  name: string;
  role: string;
  permissions: string[];
  organization: Organization;
};

export type Notification = { id: string; title: string; unread: boolean };

export type PreviewState = {
  phase: 'loading' | 'ready' | 'problem';
  account: Account | null;
  notifications: Notification[] | null;
  /** Set when an endpoint answered with something other than 2xx. */
  problem: { status: number; retryAfter: string | null } | null;
};

const INITIAL: PreviewState = {
  phase: 'loading',
  account: null,
  notifications: null,
  problem: null,
};

/**
 * The data behind the little account screen.
 *
 * It reads two of the demo's handlers and reports enough for the screen to
 * render every state a real one has to: loading, loaded, empty, and a failure
 * with its status. Nothing here inspects the panel — the screen only ever sees
 * what the network gave it, which is the point.
 */
export const useAccountPreview = () => {
  const [state, setState] = useState<PreviewState>(INITIAL);

  const load = useCallback(async () => {
    setState(current => ({ ...current, phase: 'loading' }));

    try {
      const [userResponse, notificationsResponse] = await Promise.all([
        fetch(`${ENDPOINTS.USER.replace(':userId', 'u_1024')}`),
        fetch(ENDPOINTS.NOTIFICATIONS),
      ]);

      const failed = [userResponse, notificationsResponse].find(response => !response.ok);
      if (failed) {
        setState({
          phase: 'problem',
          account: null,
          notifications: null,
          problem: { status: failed.status, retryAfter: failed.headers.get('retry-after') },
        });
        return;
      }

      const account = (await userResponse.json()) as Account;
      const { items } = (await notificationsResponse.json()) as { items: Notification[] };

      setState({ phase: 'ready', account, notifications: items, problem: null });
    } catch {
      // The handler is off and the demo origin does not resolve.
      setState({
        phase: 'problem',
        account: null,
        notifications: null,
        problem: { status: 0, retryAfter: null },
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
};
