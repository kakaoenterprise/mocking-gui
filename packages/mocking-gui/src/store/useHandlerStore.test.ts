import { describe, it, expect, beforeEach } from 'vitest';

import { useHandlerStore } from './useHandlerStore';
import { HandlerType } from '../types/handler';

import type { HandlerState, Scenario } from '../types/handler';

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

/**
 * `config.scenarios` seeding store tests
 * Validates: declared scenarios are added once, persisted copies win, seeding
 * never activates, and seeding before setupInitialState preserves the active id
 */

const USERS_HANDLER: HandlerState = {
  name: 'Users',
  url: '/api/users',
  method: 'get',
  responseVariants: [{ name: 'Success', status: 200 }],
};

describe('initScenarios', () => {
  beforeEach(() => {
    useHandlerStore.setState({
      scenarios: [],
      activeScenarioId: null,
      handlerConfigs: {},
      handlers: [],
    });
  });

  it('should add a declared scenario that is not persisted yet', () => {
    useHandlerStore.getState().initScenarios([createScenario('declared', 'Declared')]);

    expect(useHandlerStore.getState().scenarios.map(({ id }) => id)).toEqual(['declared']);
  });

  it('should keep the persisted copy when the id is already saved', () => {
    const edited = createScenario('shared', 'Renamed by the visitor');
    useHandlerStore.setState({ scenarios: [edited] });

    useHandlerStore.getState().initScenarios([createScenario('shared', 'Shipped name')]);

    const { scenarios } = useHandlerStore.getState();
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe('Renamed by the visitor');
  });

  it('should not activate anything it seeds', () => {
    useHandlerStore.getState().initScenarios([createScenario('declared', 'Declared')]);

    expect(useHandlerStore.getState().activeScenarioId).toBeNull();
  });

  it('should preserve a persisted active scenario when seeded before setupInitialState', () => {
    // The persisted shape a returning visitor arrives with: the active id refers
    // to a scenario that lives in config, not in storage.
    useHandlerStore.setState({
      scenarios: [],
      activeScenarioId: 'declared',
      handlerConfigs: {
        'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Success' },
      },
    });

    useHandlerStore.getState().initScenarios([createScenario('declared', 'Declared')]);
    useHandlerStore.getState().setupInitialState([USERS_HANDLER]);

    expect(useHandlerStore.getState().activeScenarioId).toBe('declared');
  });

  it('should drop the active scenario if setupInitialState runs before seeding', () => {
    // Guards the ordering in useSetupMockingGUIWorker: computeActiveScenarioId
    // cannot find a scenario that has not been seeded yet, so it clears the id.
    useHandlerStore.setState({
      scenarios: [],
      activeScenarioId: 'declared',
      handlerConfigs: {
        'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Success' },
      },
    });

    useHandlerStore.getState().setupInitialState([USERS_HANDLER]);

    expect(useHandlerStore.getState().activeScenarioId).toBeNull();
  });
});
