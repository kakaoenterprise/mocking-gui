import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { generateNormalizedUrl, normalizePathParams, toMswPath } from './pathParams';

describe('normalizePathParams', () => {
  it('converts a simple brace param to a colon param', () => {
    expect(normalizePathParams('/v1/kubeflows/{id}')).toBe('/v1/kubeflows/:id');
  });

  it('converts a kebab-case brace param to an underscore colon param', () => {
    expect(normalizePathParams('/v1/kubeflows/{kubeflow-id}')).toBe('/v1/kubeflows/:kubeflow_id');
  });

  it('converts multiple kebab-case params in one path', () => {
    expect(normalizePathParams('/v1/kubeflows/{kubeflow-id}/groups/{group-name}')).toBe(
      '/v1/kubeflows/:kubeflow_id/groups/:group_name',
    );
  });

  it('leaves an already-safe camelCase param unchanged', () => {
    expect(normalizePathParams('/v1/kubeflows/{kubeflowId}')).toBe('/v1/kubeflows/:kubeflowId');
  });

  it('leaves an already-safe snake_case param unchanged', () => {
    expect(normalizePathParams('/v1/kubeflows/{kubeflow_id}')).toBe('/v1/kubeflows/:kubeflow_id');
  });

  it('handles trailing/leading separators without leaving unsafe characters', () => {
    expect(normalizePathParams('/v1/{-id-}')).toBe('/v1/:_id_');
  });

  it('produces a route that MSW can actually match against a real request', async () => {
    const route =
      'https://example.com' +
      normalizePathParams('/v1/kubeflows/{kubeflow-id}/groups/{group-name}');
    const handler = http.delete(route, ({ params }) => HttpResponse.json(params));

    const result = await handler.run({
      request: new Request(
        'https://example.com/v1/kubeflows/a1f0c3d2-0001-4b2a-9c1e-1a2b3c4d0001/groups/ml-research-team',
        { method: 'DELETE' },
      ),
      requestId: 'test-request-id',
    });

    expect(result).not.toBeNull();
    expect(await result?.response?.json()).toEqual({
      kubeflow_id: 'a1f0c3d2-0001-4b2a-9c1e-1a2b3c4d0001',
      group_name: 'ml-research-team',
    });
  });
});

describe('generateNormalizedUrl', () => {
  it('masks already-normalized colon params by index', () => {
    expect(
      generateNormalizedUrl('https://example.com/v1/kubeflows/:kubeflowId/groups/:groupName'),
    ).toBe('https://example.com/v1/kubeflows/:param1/groups/:param2');
  });

  it('keeps a colon action suffix as a literal so different actions get different keys', () => {
    const cancel = generateNormalizedUrl(
      'https://api.example.com/v1/subscriptions/:subscription_id:cancel',
    );
    const accept = generateNormalizedUrl(
      'https://api.example.com/v1/subscriptions/:subscription_id:accept-pending',
    );
    expect(cancel).toBe('https://api.example.com/v1/subscriptions/:param1:cancel');
    expect(accept).toBe('https://api.example.com/v1/subscriptions/:param1:accept-pending');
    expect(cancel).not.toBe(accept);
  });

  it('treats the legacy escaped colon (\\:) as the same endpoint as a plain colon', () => {
    expect(
      generateNormalizedUrl('https://api.example.com/v1/subscriptions/:subscription_id\\:cancel'),
    ).toBe('https://api.example.com/v1/subscriptions/:param1:cancel');
  });

  it('applies the same rule to wildcard-prefixed urls without an origin', () => {
    expect(generateNormalizedUrl('*/v1/subscriptions/:subscription_id:cancel')).toBe(
      '*/v1/subscriptions/:param1:cancel',
    );
    expect(generateNormalizedUrl('*/v1/subscriptions/:subscription_id:accept-pending')).toBe(
      '*/v1/subscriptions/:param1:accept-pending',
    );
  });

  it('does not merge a literal action path with a parameter path', () => {
    expect(generateNormalizedUrl('https://api.example.com/v1/catalog/products:compare')).toBe(
      'https://api.example.com/v1/catalog/products:compare',
    );
    expect(generateNormalizedUrl('https://api.example.com/v1/catalog/products/:slug')).toBe(
      'https://api.example.com/v1/catalog/products/:param1',
    );
  });

  it('keeps the origin port and drops query/hash', () => {
    expect(generateNormalizedUrl('http://localhost:3000/v1/items/:id:cancel?x=1#h')).toBe(
      'http://localhost:3000/v1/items/:param1:cancel',
    );
  });

  it('still masks a param that carries a custom pattern or modifier', () => {
    expect(generateNormalizedUrl('https://example.com/v1/x/:id(\\d+)/y')).toBe(
      'https://example.com/v1/x/:param1/y',
    );
    expect(generateNormalizedUrl('https://example.com/v1/x/:id?')).toBe(
      'https://example.com/v1/x/:param1',
    );
  });

  it('normalizes brace params inside an absolute url before masking', () => {
    expect(generateNormalizedUrl('https://example.com/v1/subscriptions/{id}:cancel')).toBe(
      'https://example.com/v1/subscriptions/:param1:cancel',
    );
  });
});

describe('toMswPath', () => {
  it.each([
    [
      'https://api.example.com/v1/subscriptions/:subscription_id:cancel',
      'https://api.example.com/v1/subscriptions/:subscription_id\\:cancel',
    ],
    [
      'https://api.example.com/v1/subscriptions/:subscription_id',
      'https://api.example.com/v1/subscriptions/:subscription_id',
    ],
    ['*/v1/subscriptions/:subscription_id:cancel', '*/v1/subscriptions/:subscription_id\\:cancel'],
    [
      'https://api.example.com/v1/catalog/products:compare',
      'https://api.example.com/v1/catalog/products\\:compare',
    ],
    ['http://localhost:3000/v1/items/:id:cancel', 'http://localhost:3000/v1/items/:id\\:cancel'],
    ['https://example.com/v1/x/:id(\\d+)?/y', 'https://example.com/v1/x/:id(\\d+)?/y'],
    [
      'https://example.com/v1/subscriptions/:request_id\\:cancel/(cancel)?',
      'https://example.com/v1/subscriptions/:request_id\\:cancel/(cancel)?',
    ],
    ['/v1/subscriptions/:id:cancel', '/v1/subscriptions/:id\\:cancel'],
  ])('escapes literal colons only in the path: %s', (input, expected) => {
    expect(toMswPath(input)).toBe(expected);
  });

  it('is idempotent for an already-escaped url', () => {
    const once = toMswPath('https://api.example.com/v1/subscriptions/:subscription_id:cancel');
    expect(toMswPath(once)).toBe(once);
  });

  it('produces a route MSW matches for the action only, with the param extracted', async () => {
    const handler = http.post(
      toMswPath('https://api.example.com/v1/subscriptions/:subscription_id:cancel'),
      ({ params }) => HttpResponse.json(params),
    );
    const run = (url: string) =>
      handler.run({ request: new Request(url, { method: 'POST' }), requestId: 'test' });

    const matched = await run('https://api.example.com/v1/subscriptions/abc:cancel');
    expect(await matched?.response?.json()).toEqual({ subscription_id: 'abc' });

    expect(await run('https://api.example.com/v1/subscriptions/abc:reject')).toBeNull();
    expect(await run('https://api.example.com/v1/subscriptions/abc')).toBeNull();
  });
});
