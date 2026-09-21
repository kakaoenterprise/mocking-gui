import { dynamicHandlers } from './dynamic';
import { manualHandlers } from './manual';
import { networkHandlers } from './network';
import { rawBodyHandlers } from './rawBody';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export const handlers: HandlerConfigOption[] = [
  ...manualHandlers,
  ...dynamicHandlers,
  ...networkHandlers,
  ...rawBodyHandlers,
];
