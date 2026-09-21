import { useState } from 'react';

import { SCENARIO_PRESETS, encodeScenario } from '@/mocks/scenarios';

export function ScenarioPresets() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SCENARIO_PRESETS.map(scenario => {
        const code = encodeScenario(scenario);
        const handlerCount = Object.keys(scenario.configs).length;

        return (
          <div
            key={scenario.id}
            className="flex flex-col rounded-lg border border-stone-200 bg-white p-4"
          >
            <h3 className="text-sm font-semibold text-stone-900">{scenario.name}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-stone-600">
              {scenario.description}
            </p>
            <p className="mt-3 font-mono text-[10px] text-stone-400">
              {handlerCount} handlers · {code.length} chars
            </p>
            <button
              onClick={() => handleCopy(scenario.id, code)}
              className="mt-2 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
            >
              {copiedId === scenario.id ? 'Copied — now paste it' : 'Copy scenario code'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
