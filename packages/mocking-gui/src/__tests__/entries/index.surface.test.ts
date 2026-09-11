// @vitest-environment node
import { describe, expect, it } from 'vitest';

import * as root from '../../index';

import type {
  HandlerConfigOption,
  MockingConfig,
  ReadonlyHandlerConfig,
  Scenario,
  SwaggerSourceConfigOption,
} from '../../index';

/**
 * The root entry is a type-only contract (ADR-0006). It must never export a
 * runtime value. The pinned type set is asserted by the type imports above:
 * `tsconfig.test.json` typechecks this file, so a removed type fails lint.
 */
export type RootTypes = {
  HandlerConfigOption: HandlerConfigOption;
  MockingConfig: MockingConfig;
  ReadonlyHandlerConfig: ReadonlyHandlerConfig;
  Scenario: Scenario;
  SwaggerSourceConfigOption: SwaggerSourceConfigOption;
};

describe('root entry surface', () => {
  it('exports no runtime values', () => {
    expect(Object.keys(root)).toEqual([]);
  });

  it('accepts an as-const handler collection as MockingConfig.mocks', () => {
    const handlers = [
      { name: 'Users', url: '/api/users', method: 'get', responseVariants: [{ name: 'Success', status: 200 }] },
    ] as const satisfies readonly ReadonlyHandlerConfig[];
    const config: MockingConfig = { mocks: handlers };
    expect(config.mocks).toHaveLength(1);
  });
});
