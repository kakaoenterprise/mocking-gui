import { useAccountPreview, type Account, type Notification } from '@/hooks/useAccountPreview';

/**
 * A small piece of product, rendered from the mocks.
 *
 * The demo used to answer "what does this library do?" with a JSON body and let
 * the reader diff it. But nobody mocks an API to change a payload — they mock it
 * to see a screen they otherwise cannot reach: the empty list, the expired
 * session, the plan that has run out of seats. So the payload moved out of the
 * way and the screen took its place. Flip a handler in the panel and what
 * changes here is a heading, a badge, an empty state — the things you would
 * actually be building.
 */
export function AccountScreen() {
  const { phase, account, notifications, problem, reload } = useAccountPreview();

  return (
    <div className="overflow-hidden rounded-lg border border-stone-300 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-widest text-stone-400 uppercase">
          Your product
        </span>
        <button
          onClick={() => void reload()}
          disabled={phase === 'loading'}
          className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 disabled:text-stone-400"
        >
          {phase === 'loading' ? 'Loading…' : 'Reload'}
        </button>
      </header>

      <div className="p-4">
        {phase === 'loading' && <Skeleton />}
        {phase === 'problem' && problem && <Problem {...problem} />}
        {phase === 'ready' && account && (
          <Ready account={account} notifications={notifications ?? []} />
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-5 w-40 animate-pulse rounded bg-stone-200" />
      <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
      <div className="h-16 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

/** Every non-2xx answer, told as the thing a user would actually be shown. */
function Problem({ status, retryAfter }: { status: number; retryAfter: string | null }) {
  const copy = (() => {
    if (status === 401) return ['Your session expired', 'Sign in again to continue.'];
    if (status === 404) return ['We could not find that account', 'It may have been removed.'];
    if (status === 429)
      return [
        'Too many requests',
        retryAfter ? `Try again in ${retryAfter} seconds.` : 'Slow down and try again.',
      ];
    if (status >= 500) return ['Something went wrong on our end', 'We are looking into it.'];
    return [
      'No response',
      'The handler is off, so this request went to a server that is not there.',
    ];
  })();

  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-rose-900">{copy[0]}</p>
      <p className="mt-1 text-xs text-rose-700">{copy[1]}</p>
      {status > 0 && <p className="mt-2 font-mono text-[10px] text-rose-400">HTTP {status}</p>}
    </div>
  );
}

function Ready({ account, notifications }: { account: Account; notifications: Notification[] }) {
  const { organization } = account;
  const full = organization.seatsUsed >= organization.seatLimit;
  const unread = notifications.filter(notification => notification.unread).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-stone-900">{account.name}</h3>
        <span className="rounded bg-stone-900 px-1.5 py-0.5 font-mono text-[10px] text-white uppercase">
          {account.role}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {account.permissions.map(permission => (
          <span
            key={permission}
            className="rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-600"
          >
            {permission}
          </span>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-stone-600">{organization.name}</p>
          <p className={`font-mono text-[11px] ${full ? 'text-rose-600' : 'text-stone-500'}`}>
            {organization.seatsUsed}/{organization.seatLimit} seats
          </p>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full ${full ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{
              width: `${Math.min(100, (organization.seatsUsed / organization.seatLimit) * 100)}%`,
            }}
          />
        </div>
        {full && (
          <p className="mt-1.5 text-[11px] text-rose-700">
            Every seat is taken — inviting a teammate needs an upgrade.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 font-mono text-[10px] tracking-widest text-stone-400 uppercase">
          Notifications {unread > 0 && `· ${unread} unread`}
        </p>
        {notifications.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-300 px-4 py-6 text-center">
            <p className="text-xs font-medium text-stone-600">Nothing here yet</p>
            <p className="mt-0.5 text-[11px] text-stone-500">
              This is the empty state — the one a real account grows out of in a day.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
            {notifications.map(notification => (
              <li key={notification.id} className="flex items-center gap-2 px-3 py-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${notification.unread ? 'bg-emerald-500' : 'bg-stone-200'}`}
                />
                <span
                  className={`truncate text-xs ${notification.unread ? 'font-medium text-stone-800' : 'text-stone-500'}`}
                >
                  {notification.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
