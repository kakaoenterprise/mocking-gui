import { useState } from 'react';

import { ScenarioTopology } from '@/components/ScenarioTopology';
import { useScenarioProgress } from '@/hooks/useScenarioProgress';
import { SCENARIO_PRESETS, encodeScenario } from '@/mocks/scenarios';

export function ScenarioPresets() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { importedIds, activeId } = useScenarioProgress();

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="grid gap-3">
      {SCENARIO_PRESETS.map(({ scenario, useWhen }) => {
        const code = encodeScenario(scenario);

        return (
          <article
            key={scenario.id}
            className="min-w-0 rounded-lg border border-stone-200 bg-white"
          >
            <header className="flex items-baseline justify-between gap-4 border-b border-stone-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-stone-900">{scenario.name}</h3>
                  <StatusChip
                    imported={importedIds.has(scenario.id)}
                    active={activeId === scenario.id}
                  />
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  Use when: <span className="text-stone-700">{useWhen}</span>
                </p>
              </div>
              <button
                onClick={() => handleCopy(scenario.id, code)}
                className="shrink-0 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
              >
                {copiedId === scenario.id
                  ? 'Copied — panel → Scenario → Import'
                  : 'Copy scenario code'}
              </button>
            </header>

            <div className="space-y-3 px-4 py-3">
              <p className="text-xs leading-relaxed text-stone-600">{scenario.description}</p>

              {/* The scenario's own calls, drawn from its configs and coloured by
                  what actually came back. A hand-written list of expected
                  responses used to sit here; it could only ever assert what this
                  shows. */}
              <ScenarioTopology scenario={scenario} />

              <p className="font-mono text-[10px] text-stone-400">
                {Object.keys(scenario.configs).length} handlers · {code.length} chars
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Where this particular scenario stands, so the cards are not all identical. */
function StatusChip({ imported, active }: { imported: boolean; active: boolean }) {
  if (active) {
    return (
      <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        active
      </span>
    );
  }

  if (imported) {
    return (
      <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
        imported · not applied
      </span>
    );
  }

  return (
    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] text-stone-500 ring-1 ring-stone-200">
      not imported
    </span>
  );
}
