import { API_PROBES } from '@shared/playground';
import { ApiProbe } from '@/features/playground/components/ApiProbe';

/** Preserves the order groups first appear in `API_PROBES`. */
const groupNames = [...new Set(API_PROBES.map(probe => probe.group))];

export function ApiPlayground() {
  return (
    <div className="space-y-12">
      {groupNames.map(group => (
        <section key={group}>
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            {group}
          </h2>
          {API_PROBES.filter(probe => probe.group === group).map(probe => (
            <ApiProbe key={probe.id} config={probe} />
          ))}
        </section>
      ))}
    </div>
  );
}
