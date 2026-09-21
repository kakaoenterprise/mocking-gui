import { ENDPOINTS } from '../constants/endpoints';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

/** A 1x1 transparent GIF, small enough to inline as a binary fixture. */
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

/**
 * Non-JSON responses. `rawBody` takes precedence over `body`, and each `kind` maps to the
 * matching `HttpResponse` factory, which sets the Content-Type for you.
 */
export const userReportHandler: HandlerConfigOption = {
  name: 'Get User Report',
  description: 'Non-JSON payloads: plain text, HTML and XML',
  url: ENDPOINTS.userReport,
  method: 'get',
  responseVariants: [
    {
      name: 'Text (text/plain)',
      status: 200,
      rawBody: {
        kind: 'text',
        value: 'username=Ria&role=Admin&features=Dashboard,Settings',
      },
    },
    {
      name: 'HTML (text/html)',
      status: 200,
      rawBody: {
        kind: 'html',
        value: [
          '<section>',
          '  <h1>User Report</h1>',
          '  <dl><dt>Username</dt><dd>Ria</dd><dt>Role</dt><dd>Admin</dd></dl>',
          '</section>',
        ].join('\n'),
      },
    },
    {
      name: 'XML (text/xml)',
      status: 200,
      rawBody: {
        kind: 'xml',
        value: '<user><name>Ria</name><role>Admin</role></user>',
      },
    },
    {
      name: 'CSV as text',
      status: 200,
      rawBody: {
        kind: 'text',
        value: 'id,name,role\nuser_ria,Ria,Admin\nuser_guest,Guest,Guest',
      },
    },
  ],
};

export const userAvatarHandler: HandlerConfigOption = {
  name: 'Get User Avatar',
  description: 'Binary payload via the arrayBuffer kind (application/octet-stream)',
  url: ENDPOINTS.userAvatar,
  method: 'get',
  responseVariants: [
    {
      name: 'Transparent GIF',
      status: 200,
      rawBody: {
        kind: 'arrayBuffer',
        value: TRANSPARENT_GIF.buffer as ArrayBuffer,
      },
    },
    {
      name: 'Empty body',
      status: 204,
    },
  ],
};
