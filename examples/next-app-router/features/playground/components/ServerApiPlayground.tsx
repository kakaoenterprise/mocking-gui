import { API_PROBES, sendRequest } from '@shared/playground';

import { APITesterWithRefresh } from '@/components/ui/APITesterWithRefresh';
import { describeBody } from '@/features/playground/components/formatBody';

import type { ApiProbeConfig, ApiResponse } from '@shared/playground';

/**
 * Only safe reads run on the server — a render pass must never fire a POST or DELETE, and
 * Next may re-render this component more than once.
 */
const SERVER_PROBES = API_PROBES.filter(probe => probe.serverSafe);

interface ProbeResult {
  config: ApiProbeConfig;
  response: ApiResponse | null;
  error: string | null;
}

/**
 * Runs every server-safe probe during server rendering.
 *
 * The caller must await this inside the `server.listen()` / `server.close()` window in
 * `app/page.tsx`, otherwise the requests escape to the real network.
 */
export async function ServerApiPlayground() {
  const results: ProbeResult[] = await Promise.all(
    SERVER_PROBES.map(async config => {
      try {
        return {
          config,
          response: await sendRequest(config.method, config.url, {
            ...config.init,
            cache: 'no-store',
          }),
          error: null,
        };
      } catch (caught: unknown) {
        return {
          config,
          response: null,
          error: caught instanceof Error ? caught.message : String(caught),
        };
      }
    }),
  );

  return (
    <div className="space-y-12">
      {[...new Set(SERVER_PROBES.map(probe => probe.group))].map(group => (
        <section key={group}>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            {group}
          </h3>
          {results
            .filter(result => result.config.group === group)
            .map(({ config, response, error }) => (
              <APITesterWithRefresh
                key={config.id}
                title={config.title}
                description={config.description}
                method={config.method}
                url={config.url}
                status={response?.status ?? null}
                headers={response?.headers}
                data={response ? describeBody(response.body) : null}
                error={error}
              />
            ))}
        </section>
      ))}
    </div>
  );
}
