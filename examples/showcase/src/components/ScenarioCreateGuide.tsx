/**
 * How to build a scenario, rather than only how to receive one.
 *
 * Importing a preset shows what a scenario does; it does not show the part that
 * makes the feature worth having, which is capturing a state you found yourself
 * and handing it to someone else. Four steps, all inside the panel.
 */
const STEPS = [
  {
    n: 1,
    title: 'Pick the handlers',
    body: 'In the API tab, set two or three handlers to an interesting combination, then press ＋ on each row. They collect in the draft bar at the bottom of the panel.',
  },
  {
    n: 2,
    title: 'Name it',
    body: 'In the draft bar, give it a name that describes the situation rather than the endpoints — “checkout declined while metrics lag” beats “402 + 206”.',
  },
  {
    n: 3,
    title: 'Save',
    body: 'It appears in the Scenario tab. Applying it later sets every handler it covers in one move, and the panel tells you when the current state matches.',
  },
  {
    n: 4,
    title: 'Share',
    body: 'Export it as a code and paste it into a ticket or a chat message. Whoever opens the app next lands in exactly the state you were in.',
  },
];

export function ScenarioCreateGuide() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">Build one yourself</h3>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">
        The presets above are someone else’s. This is the loop you would actually use.
      </p>

      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {STEPS.map(step => (
          <li key={step.n} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-200 font-mono text-[10px] font-semibold text-stone-600">
              {step.n}
            </span>
            <div>
              <p className="text-xs font-semibold text-stone-800">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
