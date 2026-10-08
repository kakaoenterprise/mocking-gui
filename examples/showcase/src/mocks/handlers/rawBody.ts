import { ENDPOINTS } from '@/mocks/constants/endpoints';
import {
  CSV_REPORT,
  FEED_XML,
  INVOICE_HTML,
  createArchiveBuffer,
  createUploadReceipt,
} from '@/mocks/factories/report';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/**
 * Not every endpoint answers with JSON. `rawBody` sets the response body and its
 * content type directly — useful for file downloads, legacy XML APIs and
 * `multipart/form-data` receipts.
 */
export const rawBodyHandlers: HandlerConfigOption[] = [
  {
    name: 'Export CSV (text)',
    description: 'rawBody kind: text → served as text/plain.',
    url: ENDPOINTS.EXPORT_CSV,
    method: 'get',
    responseVariants: [
      {
        name: 'CSV',
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="report.csv"' },
        rawBody: { kind: 'text', value: CSV_REPORT },
      },
      {
        name: 'Empty export',
        status: 200,
        rawBody: { kind: 'text', value: 'date,requests,error_rate' },
      },
    ],
  },
  {
    name: 'Invoice (html)',
    description: 'rawBody kind: html → served as text/html.',
    url: ENDPOINTS.INVOICE_HTML,
    method: 'get',
    responseVariants: [
      { name: 'HTML', status: 200, rawBody: { kind: 'html', value: INVOICE_HTML } },
    ],
  },
  {
    name: 'Release feed (xml)',
    description: 'rawBody kind: xml → served as text/xml.',
    url: ENDPOINTS.FEED_XML,
    method: 'get',
    responseVariants: [{ name: 'XML', status: 200, rawBody: { kind: 'xml', value: FEED_XML } }],
  },
  {
    name: 'Upload receipt (formData)',
    description: 'rawBody kind: formData → multipart/form-data response.',
    url: ENDPOINTS.UPLOAD,
    method: 'post',
    responseVariants: [
      {
        name: 'Accepted',
        status: 201,
        rawBody: { kind: 'formData', value: createUploadReceipt() },
      },
    ],
  },
  {
    name: 'Archive (arrayBuffer)',
    description: 'rawBody kind: arrayBuffer → binary download. Bytes: 4D 4F 43 4B 00 01 02 03.',
    url: ENDPOINTS.ARCHIVE_BIN,
    method: 'get',
    responseVariants: [
      {
        name: 'Binary',
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        rawBody: { kind: 'arrayBuffer', value: createArchiveBuffer() },
      },
    ],
  },
];
