import type { JsonBodyType } from 'msw';

export const createStats = (multiplier = 1): JsonBodyType => ({
  requests: 12_480 * multiplier,
  errorRate: 0.021,
  p95LatencyMs: 184,
  updatedAt: '2026-09-21T00:00:00.000Z',
});

export const createNotification = (id: number, unread: boolean) => ({
  id: `n_${id}`,
  title: `Deployment #${1200 + id} finished`,
  unread,
  createdAt: `2026-09-${String(10 + id).padStart(2, '0')}T09:00:00.000Z`,
});

export const CSV_REPORT = [
  'date,requests,error_rate',
  '2026-09-18,11840,0.019',
  '2026-09-19,12194,0.024',
  '2026-09-20,12480,0.021',
].join('\n');

export const INVOICE_HTML = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui; padding: 24px">
    <h1>Invoice #INV-2026-0912</h1>
    <p>Served as <strong>text/html</strong> by a rawBody handler.</p>
  </body>
</html>`;

export const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed>
  <entry><title>Mocking GUI v1.0.4</title><updated>2026-09-21T00:00:00Z</updated></entry>
</feed>`;

/** A tiny fixed byte pattern, so the arrayBuffer response is verifiable. */
export const createArchiveBuffer = (): ArrayBuffer =>
  new Uint8Array([0x4d, 0x4f, 0x43, 0x4b, 0x00, 0x01, 0x02, 0x03]).buffer;

export const createUploadReceipt = (): FormData => {
  const formData = new FormData();
  formData.append('uploadId', 'up_88f21');
  formData.append('status', 'accepted');
  formData.append('bytes', '2048');
  return formData;
};

/** Shaped like the real Petstore `Pet` schema, so mock and live data compare cleanly. */
export const createPet = (id: number, name: string, status: 'available' | 'pending' | 'sold') => ({
  id,
  name,
  status,
  photoUrls: [`https://example.test/pets/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`],
  tags: [{ id: 1, name: status }],
  category: { id: 1, name: 'Dogs' },
});
