import { seedDefaultMockState } from './mocks/seedDefaults';

/**
 * Seed before the library loads.
 *
 * The library creates its zustand store — and rehydrates it from localStorage —
 * at module-evaluation time. A static `import './bootstrap'` would therefore be
 * evaluated before this call and the seed would be ignored, so the app is pulled
 * in dynamically instead. This makes the ordering a property of the code rather
 * than of the import list, which a formatter is free to reorder.
 */
seedDefaultMockState();

void import('./bootstrap');
