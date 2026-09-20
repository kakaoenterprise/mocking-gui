import { useEffect } from 'react';

import { APITester } from '@/components/ui/APITester';
import { useApiRequest } from '@/features/playground/hooks/useApiRequest';

import type { ApiProbeConfig, ResponseBody } from '@shared/playground';

/** Turns a parsed body into something the response pane can print. */
const describeBody = (body: ResponseBody): unknown => {
  switch (body.kind) {
    case 'json':
      return body.value;
    case 'text':
      return body.value;
    case 'binary':
      return `<${body.contentType}, ${body.size} bytes>`;
    case 'empty':
      return '<no content>';
  }
};

export function ApiProbe({ config }: { config: ApiProbeConfig }) {
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
