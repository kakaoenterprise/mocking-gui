import { describe, expect, it } from 'vitest';

import { mergeHandlersWithSwagger } from './merge';

import type { HandlerState } from '@mocking-gui-types/handler';

const manual = (url: string): HandlerState => ({
  name: url,
  method: 'post',
  url,
  responseVariants: [{ name: 'ok', status: 200, body: {} }],
});

const swagger = (url: string): HandlerState => ({
  name: url,
  method: 'post',
  url,
  swaggerResponseVariants: [{ name: 'ok', status: 200, body: {} }],
});

describe('mergeHandlersWithSwagger', () => {
  it('keeps colon-action handlers on the same resource as separate entries', () => {
    const base = 'https://api.example.com/v1/subscriptions/:subscription_id';
    const merged = mergeHandlersWithSwagger(
      [
        manual(`${base}:cancel`),
        manual(`${base}:accept-pending`),
        manual(`${base}:reject-pending`),
      ],
      [],
    );
    expect(merged.map(h => h.url)).toEqual([
      `${base}:cancel`,
      `${base}:accept-pending`,
      `${base}:reject-pending`,
    ]);
  });

  it('keeps colon-action handlers separate for wildcard-prefixed urls too', () => {
    const merged = mergeHandlersWithSwagger(
      [manual('*/v1/subscriptions/:id:cancel'), manual('*/v1/subscriptions/:id:accept-pending')],
      [],
    );
    expect(merged).toHaveLength(2);
  });

  it('keeps a literal action path and a parameter path separate', () => {
    const merged = mergeHandlersWithSwagger(
      [
        manual('https://api.example.com/v1/catalog/products:compare'),
        manual('https://api.example.com/v1/catalog/products/:slug'),
      ],
      [],
    );
    expect(merged).toHaveLength(2);
  });

  it('still merges a swagger handler into a manual one when only the param name differs', () => {
    const merged = mergeHandlersWithSwagger(
      [manual('https://api.example.com/v1/kubeflows/:kubeflowId')],
      [swagger('https://api.example.com/v1/kubeflows/:kubeflow_id')],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].url).toBe('https://api.example.com/v1/kubeflows/:kubeflowId');
    expect(merged[0].responseVariants).toHaveLength(1);
    expect(merged[0].swaggerResponseVariants).toHaveLength(1);
  });

  it('treats the legacy escaped colon and the plain colon as the same endpoint', () => {
    const merged = mergeHandlersWithSwagger(
      [manual('https://api.example.com/v1/subscriptions/:id\\:cancel')],
      [swagger('https://api.example.com/v1/subscriptions/:id:cancel')],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].swaggerResponseVariants).toHaveLength(1);
  });
});
