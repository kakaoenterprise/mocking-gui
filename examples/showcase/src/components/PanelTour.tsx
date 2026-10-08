/**
 * What the panel contains, written down.
 *
 * The demo used to assume a visitor would open the panel and work it out. Most
 * will not — they will click the toggle, meet four tabs and thirty rows, and
 * leave. This is the map.
 */
/**
 * The same glyph the panel draws for this control (lucide `PlusCircle`), rather
 * than a plus character standing in for it — a legend is only useful if the
 * reader can match it to what is on screen.
 */
function CirclePlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

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

const ROW: { control: React.ReactNode; does: string; key: string }[] = [
  {
    key: 'switch',
    control: 'Switch',
    does: 'On means this handler answers. Off means the request goes to your real server.',
  },
  {
    key: 'variant',
    control: 'Variant',
    does: 'Which of the handler’s responses to return. Auto handlers compute it instead, so they show “Auto Mode”.',
  },
  {
    key: 'delay',
    control: 'ms',
    does: 'Delay before answering. The quickest way to hold a loading state still.',
  },
  {
    key: 'draft',
    control: <CirclePlusIcon />,
    does: 'Adds this handler to the scenario draft at the bottom of the panel. It turns into a tick once added; pressing it again takes the handler back out.',
  },
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
            <div key={item.key} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <dt className="flex items-start pt-px font-mono text-[11px] font-semibold text-stone-700">
                {item.control}
              </dt>
              <dd className="text-xs leading-relaxed text-stone-600">{item.does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
