import { useMemo } from 'react';

import { FileJson } from 'lucide-react';

import APIResponseDetail from './APIResponseDetail';

import type { APIItemProps } from '.';
import type {
  HandlerResponseVariant,
  RawBody,
  StoredHandlerVariants,
} from '@mocking-gui-types/handler';

type APIItemDetailProps = {
  handlerKey: string;
  handlerConfig: StoredHandlerVariants;
} & APIItemProps;

const APIItemDetail = (props: APIItemDetailProps) => {
  const { apiGroup, handlerConfig } = props;

  const currentVariant = apiGroup.responseVariants?.find(
    variant => variant.name === handlerConfig.variant,
  ) as HandlerResponseVariant;

  const { headers = {}, body = '', rawBody = {} as RawBody } = currentVariant || {};

  const headersJson = useMemo(() => {
    return JSON.stringify(headers, null, 2);
  }, [headers]);

  const responseBodyJson = useMemo(() => {
    try {
      if (rawBody?.value) {
        return String(rawBody.value);
      }
      if (body && typeof body === 'object' && Object.keys(body).length) {
        return JSON.stringify(body, null, 2);
      }
      if (typeof body === 'string') return body;
      return '';
    } catch {
      return '';
    }
  }, [body, rawBody]);

  return (
    <section className="w-full px-8 py-2" aria-labelledby="response-details-heading">
      <div className="flex items-center justify-between py-1">
        <h5 id="response-details-heading" className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-700">Response Details</span>
        </h5>
      </div>
      <APIResponseDetail
        responseJson={responseBodyJson}
        headersJson={headersJson}
        headers={headers}
      />
    </section>
  );
};

export default APIItemDetail;
