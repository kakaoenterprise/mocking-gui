import { describe, it, expect } from 'vitest';

import { hashHandlerKey } from './keys';

describe('hashHandlerKey', () => {
  it('is deterministic and short', () => {
    const key = 'get.https://api.example.com/v1/projects/:param0/instances/:param1';

    expect(hashHandlerKey(key)).toBe(hashHandlerKey(key));
    expect(hashHandlerKey(key)).toMatch(/^[0-9a-z]{1,7}$/);
  });

  it('differs for keys that differ only in method or path', () => {
    const base = 'https://api.example.com/users';

    expect(hashHandlerKey(`get.${base}`)).not.toBe(hashHandlerKey(`post.${base}`));
    expect(hashHandlerKey(`get.${base}`)).not.toBe(hashHandlerKey(`get.${base}/:id`));
  });

  it('has no collisions across a realistic OpenAPI-sized key set', () => {
    const methods = ['get', 'post', 'put', 'patch', 'delete'];
    const keys = Array.from(
      { length: 500 },
      (_, i) =>
        `${methods[i % 5]}.https://api.example.com/v1/projects/:param0/resources-${i}/:param1`,
    );

    expect(new Set(keys.map(hashHandlerKey)).size).toBe(keys.length);
  });
});
