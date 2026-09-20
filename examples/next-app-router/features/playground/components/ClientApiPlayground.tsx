'use client';

import { API_PROBES } from '@shared/playground';

import { ClientApiProbe } from '@/features/playground/components/ClientApiProbe';

/** Preserves the order groups first appear in `API_PROBES`. */
const groupNames = [...new Set(API_PROBES.map(probe => probe.group))];

export function ClientApiPlayground() {
  return (
    <div className="space-y-12">
      {groupNames.map(group => (
        <section key={group}>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            {group}
          </h3>
          {API_PROBES.filter(probe => probe.group === group).map(probe => (
            <ClientApiProbe key={probe.id} config={probe} />
          ))}
        </section>
      ))}
    </div>
  );
}
