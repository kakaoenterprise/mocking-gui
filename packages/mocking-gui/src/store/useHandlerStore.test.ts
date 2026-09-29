import { describe, it, expect, beforeEach } from 'vitest';

import { useHandlerStore } from './useHandlerStore';
import { HandlerType } from '../types/handler';

import type { Scenario } from '../types/handler';

/**
 * Scenario import store tests
 * Validates: imported batches land in file order, duplicates are skipped
 */

const createScenario = (id: string, name: string): Scenario => ({
  id,
  name,
  configs: {
    'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Success' },
  },
  createdAt: '1970-01-01T00:00:00.000Z',
});

describe('importScenarios', () => {
  beforeEach(() => {
    useHandlerStore.setState({ scenarios: [] });
  });

  it('should prepend an imported batch in its source order', () => {
    useHandlerStore.setState({ scenarios: [createScenario('saved', 'Saved')] });

    const count = useHandlerStore
      .getState()
      .importScenarios([
        createScenario('s1', 'S1'),
        createScenario('s2', 'S2'),
        createScenario('s3', 'S3'),
      ]);

    expect(count).toBe(3);
    expect(useHandlerStore.getState().scenarios.map(({ name }) => name)).toEqual([
      'S1',
      'S2',
      'S3',
      'Saved',
    ]);
  });

  it('should skip entries colliding with saved scenarios and keep the rest in order', () => {
    useHandlerStore.setState({ scenarios: [createScenario('s2', 'S2')] });

    const count = useHandlerStore
      .getState()
      .importScenarios([
        createScenario('s1', 'S1'),
        createScenario('s2', 'S2'),
        createScenario('s3', 'S3'),
      ]);

    expect(count).toBe(2);
    expect(useHandlerStore.getState().scenarios.map(({ name }) => name)).toEqual([
      'S1',
      'S3',
      'S2',
    ]);
  });

  it('should leave the list untouched when every entry is a duplicate', () => {
    const saved = createScenario('s1', 'S1');
    useHandlerStore.setState({ scenarios: [saved] });

    expect(useHandlerStore.getState().importScenarios([createScenario('s1', 'S1')])).toBe(0);
    expect(useHandlerStore.getState().scenarios).toEqual([saved]);
  });
});

describe('importScenario', () => {
  beforeEach(() => {
    useHandlerStore.setState({ scenarios: [] });
  });

  it('should report whether the scenario was saved', () => {
    const { importScenario } = useHandlerStore.getState();

    expect(importScenario(createScenario('s1', 'S1'))).toBe(true);
    expect(importScenario(createScenario('s1', 'S1'))).toBe(false);
    expect(useHandlerStore.getState().scenarios).toHaveLength(1);
  });
});
