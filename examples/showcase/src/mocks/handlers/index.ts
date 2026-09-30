import { dynamicHandlers } from './dynamic';
import { firstRunHandlers } from './firstRun';
import { liveApiHandlers } from './liveApi';
import { manualHandlers } from './manual';
import { networkHandlers } from './network';
import { rawBodyHandlers } from './rawBody';

import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export const handlers: HandlerConfigOption[] = [
  ...firstRunHandlers,
  ...manualHandlers,
  ...dynamicHandlers,
  ...networkHandlers,
  ...rawBodyHandlers,
  ...liveApiHandlers,
];
