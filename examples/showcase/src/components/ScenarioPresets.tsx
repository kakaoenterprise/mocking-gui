import { useState } from 'react';

import { SCENARIO_PRESETS, encodeScenario } from '@/mocks/scenarios';

export function ScenarioPresets() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      {SCENARIO_PRESETS.map(({ scenario, useWhen, expect }) => {
        const code = encodeScenario(scenario);

        return (
          <article key={scenario.id} className="rounded-lg border border-stone-200 bg-white">
            <header className="flex items-baseline justify-between gap-4 border-b border-stone-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-stone-900">{scenario.name}</h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Use when: <span className="text-stone-700">{useWhen}</span>
                </p>
              </div>
              <button
                onClick={() => handleCopy(scenario.id, code)}
                className="shrink-0 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
              >
                {copiedId === scenario.id ? 'Copied — now paste it' : 'Copy scenario code'}
              </button>
            </header>

            <div className="space-y-3 px-4 py-3">
              <p className="text-xs leading-relaxed text-stone-600">{scenario.description}</p>

              <div>
                <p className="mb-1.5 font-mono text-[10px] tracking-widest text-stone-400 uppercase">
                  after applying
                </p>
                <ul className="space-y-1">
                  {expect.map(line => (
                    <li key={line} className="flex gap-2 font-mono text-[11px] text-stone-600">
                      <span className="text-stone-300">→</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

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
