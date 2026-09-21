import type { ResponseBody } from '@shared/playground';

/** Turns a parsed body into something the response pane can print. */
export const describeBody = (body: ResponseBody): unknown => {
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
