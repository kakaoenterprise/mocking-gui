import { AccountScreen } from '@/components/preview/AccountScreen';

/**
 * The opening.
 *
 * Earlier versions asked a visitor to press Send and read a JSON body, which
 * taught the wrong thing: nobody mocks an API to change a payload. They mock it
 * to reach a screen they otherwise cannot — the empty list, the expired session,
 * the plan with no seats left. So the opening is now a screen, and the list
 * beside it is a set of flips with the visible consequence written next to each
 * one. You learn what the panel does by watching this change, not by diffing
 * responses.
 */
const TRY = [
  {
    handler: 'Get user',
    pick: 'Admin',
    sees: 'The role badge and the permission chips change.',
  },
  {
    handler: 'Get user',
    pick: 'Seat limit reached',
    sees: 'The seat bar fills and turns red, and an upgrade line appears.',
  },
  {
    handler: 'Get user',
    pick: 'Session expired (401)',
    sees: 'The whole screen becomes a sign-in prompt.',
  },
  {
    handler: 'Notifications',
    pick: 'Empty',
    sees: 'The list becomes the empty state you can never get a real account into.',
  },
  {
    handler: 'Get user',
    pick: 'delay 2000',
    sees: 'The skeleton holds still long enough to look at.',
  },
];

export function FirstRun() {
  return (
    <section className="rounded-lg border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-5 py-4">
        <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">Start here</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Put your screen into a state you cannot otherwise reach
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">
          Below is a small piece of product, drawing on two mocked endpoints. Open the panel — the
          round button at the bottom-left — and change what those endpoints return. The screen
          follows, and your code never moves.
        </p>
      </header>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <AccountScreen />

        <div>
          <p className="font-mono text-[10px] tracking-widest text-stone-400 uppercase">
            Try these, in any order
          </p>
          <ol className="mt-2 space-y-2.5">
            {TRY.map(item => (
              <li key={`${item.handler}-${item.pick}`} className="text-xs leading-relaxed">
                <span className="font-mono text-[11px] text-stone-800">{item.handler}</span>
                <span className="text-stone-400"> → </span>
                <span className="font-mono text-[11px] text-stone-800">{item.pick}</span>
                <p className="mt-0.5 text-stone-600">{item.sees}</p>
              </li>
            ))}
          </ol>

          <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">
            Every one of these is a state a designer would ask you to build and a backend would make
            you beg for. None of them needed a server, a seeded database, or a code change.
          </p>
        </div>
      </div>
    </section>
  );
}
