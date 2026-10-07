import { useScenarioProgress } from '@/hooks/useScenarioProgress';
import { SCENARIO_PRESETS } from '@/mocks/scenarios';

/**
 * The four steps between "Copy scenario code" and seeing the app change.
 *
 * Copying put a string on the clipboard and then said nothing, which left the
 * most interesting feature of the library behind an undocumented sequence of
 * panel clicks. Each step below reports whether it has actually happened,
 * read from the panel's own state, so a reader can tell where they are instead
 * of guessing.
 */
type StepProps = {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
};

function Step({ n, title, done, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${
          done ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${done ? 'text-stone-400' : 'text-stone-800'}`}>
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{children}</p>
      </div>
    </li>
  );
}

export function ScenarioWalkthrough() {
  const { importedIds, activeId } = useScenarioProgress();

  const presetIds = SCENARIO_PRESETS.map(preset => preset.scenario.id);
  const importedCount = presetIds.filter(id => importedIds.has(id)).length;
  const activeIsPreset = activeId !== null && presetIds.includes(activeId);
  const activeName = SCENARIO_PRESETS.find(preset => preset.scenario.id === activeId)?.scenario
    .name;

  return (
    <div className="rounded-lg border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-900">What to do with the code you copy</h3>
        <p className="font-mono text-[10px] text-stone-500">
          {importedCount}/{presetIds.length} imported
          {activeIsPreset ? ` · active: ${activeName}` : ' · none active'}
        </p>
      </div>

      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        <Step n={1} title="Copy a scenario code" done={importedCount > 0}>
          Any card below. The button puts a base64 string on your clipboard — the whole scenario,
          nothing else.
        </Step>

        <Step n={2} title="Import it in the panel" done={importedCount > 0}>
          Open the panel (bottom-left), go to <strong>Scenario</strong> → <strong>Import</strong>,
          paste, and press <strong>Confirm</strong>. It appears in the saved list.
        </Step>

        <Step n={3} title="Apply it" done={activeIsPreset}>
          Press <strong>Apply</strong> on the saved scenario. Every handler it covers moves at once
          — that is the step a list of reproduction instructions replaces.
        </Step>
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-stone-600">
        Then press <strong className="font-semibold text-stone-700">Test this scenario</strong> on
        that card. Its badge reads <span className="font-mono">{'"all as described"'}</span> once
        the page is in the state the scenario describes — the three steps above are only worth doing
        because that is checkable.
      </p>

      {importedCount === 0 && (
        <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-[11px] leading-relaxed text-stone-600">
          Nothing imported yet. Steps 1 and 2 tick themselves once the panel has the scenario, so
          you can tell whether the paste worked without hunting for it.
        </p>
      )}
    </div>
  );
}
