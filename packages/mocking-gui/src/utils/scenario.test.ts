import { describe, it, expect } from 'vitest';

import { selectImportableScenarios } from './scenario';
import { HandlerType } from '../types/handler';

import type { Scenario } from '../types/handler';

/**
 * Scenario import selection tests
 * Validates: source order preservation, duplicate rejection by id and by name
 */

const createScenario = (id: string, name: string): Scenario => ({
  id,
  name,
  configs: {
    'get./api/users': { active: true, type: HandlerType.MANUAL, variant: 'Success' },
  },
  createdAt: '1970-01-01T00:00:00.000Z',
});

describe('selectImportableScenarios', () => {
  it('should keep the source order of the imported batch', () => {
    const incoming = [
      createScenario('s1', 'S1'),
      createScenario('s2', 'S2'),
      createScenario('s3', 'S3'),
    ];

    const result = selectImportableScenarios(incoming, []);

    expect(result.map(({ id }) => id)).toEqual(['s1', 's2', 's3']);
  });

  it('should drop scenarios already saved by id or by name', () => {
    const existing = [createScenario('s1', 'S1'), createScenario('other-id', 'S2')];
    const incoming = [
      createScenario('s1', 'Renamed'),
      createScenario('s2', '  S2  '),
      createScenario('s3', 'S3'),
    ];

    const result = selectImportableScenarios(incoming, existing);

    expect(result.map(({ id }) => id)).toEqual(['s3']);
  });

  it('should drop duplicates inside the batch itself', () => {
    const incoming = [
      createScenario('s1', 'S1'),
      createScenario('s1', 'Same id'),
      createScenario('s2', 'S1'),
    ];

    const result = selectImportableScenarios(incoming, []);

    expect(result.map(({ id }) => id)).toEqual(['s1']);
  });

  it('should return an empty list when nothing can be imported', () => {
    const existing = [createScenario('s1', 'S1')];

    expect(selectImportableScenarios([createScenario('s1', 'S1')], existing)).toEqual([]);
  });
});
