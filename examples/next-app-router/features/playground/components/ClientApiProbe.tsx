'use client';

import { useEffect } from 'react';

import { APITester } from '@/components/ui/APITester';
import { describeBody } from '@/features/playground/components/formatBody';
import { useApiRequest } from '@/features/playground/hooks/useApiRequest';

import type { ApiProbeConfig } from '@shared/playground';

/** Browser-side card: the Service Worker intercepts the request. */
export function ClientApiProbe({ config }: { config: ApiProbeConfig }) {
  const { response, error, loading, send } = useApiRequest(config.method, config.url, config.init);

  const shouldAutoFetch = config.autoFetch ?? false;

  useEffect(() => {
    if (shouldAutoFetch) void send();
  }, [shouldAutoFetch, send]);

  return (
    <APITester
      title={config.title}
      description={config.description}
      method={config.method}
      url={config.url}
      onRefetch={() => void send()}
      loading={loading}
      status={response?.status ?? null}
      headers={response?.headers}
      data={response ? describeBody(response.body) : null}
      error={error}
    />
  );
}
