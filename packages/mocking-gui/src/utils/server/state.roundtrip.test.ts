import { describe, it, expect } from 'vitest';

import { reconstructHandlerConfigsFromCookie } from './state';
import { HandlerType } from '../../types/handler';
import { encodeSyncState } from '../browser/cookie';
import { getHandlerKey } from '../common/keys';

import type { HandlerState, StoredHandlerVariants } from '../../types/handler';

/**
 * Browser → server round trip: what `encodeSyncState` writes must come back
 * from `reconstructHandlerConfigsFromCookie` unchanged, also after a cookie
 * API re-serializes the value with `encodeURIComponent` (Next.js
 * `cookies().toString()`), and after a `cookie.parse`-style `decodeURIComponent`.
 */

const ORIGIN = 'https://api.example.com';

const handlers: HandlerState[] = [
  {
    name: 'Get Users',
    method: 'get',
    url: `${ORIGIN}/users`,
    responseVariants: [
      { name: '200-default', status: 200, body: [] },
      { name: '400-error', status: 400, body: {} },
    ],
  },
  {
    name: 'List Images',
    method: 'get',
    url: `${ORIGIN}/v1/images`,
    swaggerResponseVariants: [
      { name: '200', status: 200, body: [] },
      { name: 'weird name (v2) / 한글', status: 404, body: {} },
    ],
  },
  {
    name: 'Create User',
    method: 'post',
    url: `${ORIGIN}/users`,
    responseVariantsFn: () => ({ name: '201', status: 201, body: {} }),
  },
  {
    name: 'Get Flavor',
    method: 'get',
    url: `${ORIGIN}/v1/flavors/:id`,
    responseVariants: [{ name: 'manual-200', status: 200, body: {} }],
    swaggerResponseVariants: [{ name: '200', status: 200, body: {} }],
  },
  {
    name: 'No variants at all',
    method: 'delete',
    url: `${ORIGIN}/v1/flavors/:id`,
  },
];
const [users, images, createUser, flavor, bare] = handlers;
const key = getHandlerKey;

const browserState: Record<string, StoredHandlerVariants> = {
  [key(users)]: { active: true, type: HandlerType.MANUAL, variant: '400-error', delay: 0 },
  [key(images)]: {
    active: true,
    type: HandlerType.SWAGGER,
    variant: 'weird name (v2) / 한글',
    delay: 0,
  },
  [key(createUser)]: { active: true, type: HandlerType.AUTO, delay: 0 },
  [key(flavor)]: { active: true, type: HandlerType.SWAGGER, variant: '200', delay: 0 },
  [key(bare)]: { active: true, type: null, delay: 0 },
};

const expected = {
  [key(users)]: { active: true, type: HandlerType.MANUAL, variant: '400-error' },
  [key(images)]: { active: true, type: HandlerType.SWAGGER, variant: 'weird name (v2) / 한글' },
  [key(createUser)]: { active: true, type: HandlerType.AUTO, variant: undefined },
  [key(flavor)]: { active: true, type: HandlerType.SWAGGER, variant: '200' },
  [key(bare)]: { active: true, type: null, variant: undefined },
};

describe('sync cookie round trip', () => {
  const encoded = encodeSyncState(browserState, handlers);

  it('restores the browser state from the raw cookie header', () => {
    const result = reconstructHandlerConfigsFromCookie(`mocking_gui_sync=${encoded}`, handlers);

    expect(result).toMatchObject(expected);
    expect(Object.keys(result)).toHaveLength(Object.keys(expected).length);
  });

  it('restores the browser state after encodeURIComponent re-serialization', () => {
    const reserialized = `mocking_gui_sync=${encodeURIComponent(encoded)}`;

    expect(reserialized).toBe(`mocking_gui_sync=${encoded}`);
    expect(reconstructHandlerConfigsFromCookie(reserialized, handlers)).toMatchObject(expected);
  });

  it('restores the browser state after decodeURIComponent', () => {
    const decoded = `mocking_gui_sync=${decodeURIComponent(encoded)}`;

    expect(reconstructHandlerConfigsFromCookie(decoded, handlers)).toMatchObject(expected);
  });
});
