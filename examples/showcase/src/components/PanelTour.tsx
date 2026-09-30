/**
 * What the panel contains, written down.
 *
 * The demo used to assume a visitor would open the panel and work it out. Most
 * will not — they will click the toggle, meet four tabs and thirty rows, and
 * leave. This is the map.
 */
const TABS = [
  {
    name: 'API',
    line: 'Every handler, grouped by origin. Search, filter by method, or show only what is active.',
  },
  {
    name: 'Swagger',
    line: 'The OpenAPI documents that were imported, with load status and how many handlers each produced.',
  },
  {
    name: 'Scenario',
    line: 'Saved combinations of handlers. Build, apply, import and share them here.',
  },
  { name: 'Setting', line: 'Panel position and a reset for everything you have changed.' },
];

const ROW = [
  {
    control: 'Switch',
    does: 'On means this handler answers. Off means the request goes to your real server.',
  },
  {
    control: 'Variant',
    does: 'Which of the handler’s responses to return. Auto handlers compute it instead, so they show “Auto Mode”.',
  },
  {
    control: 'ms',
    does: 'Delay before answering. The quickest way to hold a loading state still.',
  },
  { control: '＋', does: 'Adds this handler to the scenario draft at the bottom of the panel.' },
];

export function PanelTour() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-900">Four tabs</h3>
        <dl className="mt-3 space-y-2.5">
          {TABS.map(tab => (
            <div key={tab.name} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="font-mono text-[11px] font-semibold text-stone-700">{tab.name}</dt>
              <dd className="text-xs leading-relaxed text-stone-600">{tab.line}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-900">One handler row</h3>
        <dl className="mt-3 space-y-2.5">
          {ROW.map(item => (
            <div key={item.control} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="font-mono text-[11px] font-semibold text-stone-700">{item.control}</dt>
              <dd className="text-xs leading-relaxed text-stone-600">{item.does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
