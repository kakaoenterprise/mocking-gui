import { describe, it, expect, vi } from 'vitest';

import { reconstructHandlerConfigsFromCookie } from './state';

import type { HandlerState } from '../../types/handler';

vi.mock('../common/keys', async importOriginal => {
  const original = await importOriginal<typeof import('../common/keys')>();
  return { ...original, hashHandlerKey: () => 'same' };
});

/**
 * Hash collision handling: two registered handlers sharing one hash cannot be
 * told apart, so the entry is ignored rather than applied to the wrong handler.
 */
describe('reconstructHandlerConfigsFromCookie — hash collision', () => {
  const a: HandlerState = {
    name: 'A',
    method: 'get',
    url: 'https://api.example.com/a',
    responseVariants: [{ name: '200', status: 200, body: {} }],
  };
  const b: HandlerState = {
    name: 'B',
    method: 'get',
    url: 'https://api.example.com/b',
    responseVariants: [{ name: '200', status: 200, body: {} }],
  };

  it('ignores an ambiguous hash with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = reconstructHandlerConfigsFromCookie('mocking_gui_sync=v2~same', [a, b]);

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('collision');
  });
});
