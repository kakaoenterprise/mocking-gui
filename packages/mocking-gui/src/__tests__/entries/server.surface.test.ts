// @vitest-environment node
import { describe, expect, it } from 'vitest';

import * as server from '../../server';

describe('server entry surface', () => {
  it('exports exactly setupMockingServer', () => {
    expect(Object.keys(server).sort()).toEqual(['setupMockingServer']);
    expect(typeof server.setupMockingServer).toBe('function');
  });
});
