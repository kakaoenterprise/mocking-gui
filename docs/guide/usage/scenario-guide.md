# Scenario Guide

Scenarios allow you to group multiple handler configurations into a single set for easy storage and management. You can reproduce complex test environments with just a single click.

## Key Features

- **Save Scenarios**: Save current handler variants, delays, and other settings as a scenario.
- **One-Click Apply**: Instantly apply all handler configurations included in a saved scenario.
- **Status Syncing**: View the `Active` status in the list when a scenario is enabled.
- **Share & Export**: Copy scenario JSON data to share with teammates, or export/import them as files.

## Scenario Status

- **Active Status**: When a scenario is applied, an `Active` badge appears next to its name. This status is maintained as long as at least one handler in the scenario is active.
- **Inactive Status**: A scenario becomes inactive if all its handlers are deactivated or if a different scenario is applied.

## How to Use

1. Open the Mocking GUI Panel.
2. Configure the state (Response Variant, Delay, etc.) of the handlers you want to batch process, then click the **+ (Add)** icon on the handler to register it to the scenario draft list.
3. Go to the **Scenarios** tab.
4. Enter a scenario name and click the **+ (Add)** button to save.

5. **Draft Bar**:
   - Selecting a variant from the handler list brings up the Draft Bar at the bottom.
   - **Expanded View**: Click the arrow on the left of the Draft Bar to preview the list of APIs included in the current draft.
   - **Clear Draft**: Click the `Clear All` button to remove all currently selected handlers from the draft.
6. **Save Scenario**: Enter a name for the scenario and click Save to add it to the Scenario tab.
7. **Apply & Deactivate**: Click 'Apply' on a scenario card to enable it, or 'Deactivate' to disable it.

## Exporting & Importing Scenarios

- **Export JSON File**: Click the 'Export' button at the top of the Scenario tab to download all saved scenarios as a `.json` file.
- **Import File**: Upload a JSON file in the 'Import' section to register multiple scenarios at once.
- **Direct JSON Input (Share)**: Click the share button on an individual scenario card to copy its JSON data. Paste this data into the Textarea in the 'Import' section to register it instantly.

## Programmatic Scenarios & Test Injection (experimental)

> Exported from `@kakaocloud/mocking-gui/experimental`. See [Entry Points](./api-guide#entry-points) for the stability policy.

Scenarios can be declared in code with full type inference and injected into a browser before the app boots, so E2E runs, screenshot jobs or Storybook stories start from a known mock state.

### 1. Declare a registry

```ts
// src/mocks/registry.ts
import { defineRegistry } from '@kakaocloud/mocking-gui/experimental';

export const registry = defineRegistry([
  {
    name: 'Users',
    url: '/api/users',
    method: 'get',
    responseVariants: [
      { name: 'Success', status: 200, body: { items: [{ id: 1, name: 'kim' }] } },
      { name: 'Empty', status: 200, body: { items: [] } },
      { name: 'Error', status: 500, body: { message: 'internal error' } },
    ],
  },
]);

// The same declaration drives the GUI at runtime:
export const mockConfig = { mocks: registry.handlers };
```

Handler and variant names are literal types, so `registry.pick('Usres', …)` or `registry.pick('Users', 'Nope')` fail to compile.

### 2. Compose scenarios

```ts
import { defineScenario, extendScenario } from '@kakaocloud/mocking-gui/experimental';
import { registry } from '../src/mocks/registry';

export const happy = defineScenario('happy path', [registry.pick('Users', 'Success')]);
export const slow = defineScenario('slow list', [
  registry.pick('Users', 'Success', { delay: 3000 }),
]);
export const failing = extendScenario(happy, 'list fails', [registry.pick('Users', 'Error')]);
```

Picking the same handler twice inside one `defineScenario` is a compile error; use `extendScenario` to override deliberately.

### 3. Inject before boot

**Playwright / WebdriverIO v9** (any driver with `addInitScript` and `addCookies` or `setCookies`):

```ts
import { applyScenario } from '@kakaocloud/mocking-gui/experimental';

test('renders users', async ({ context, page }) => {
  await applyScenario(context, happy, { origin: 'http://localhost:5173', ssr: true });
  await page.goto('http://localhost:5173');
});
```

`ssr: true` also writes the sync cookie so a server-rendered first paint sees the same scenario.

**Cypress, Storybook, or anything running inside the page**: use `serializeScenario` and write the pair to `localStorage` yourself.

```ts
import { serializeScenario } from '@kakaocloud/mocking-gui/experimental';

const { key, value } = serializeScenario(happy);
cy.visit('/', { onBeforeLoad: win => win.localStorage.setItem(key, value) });
```
