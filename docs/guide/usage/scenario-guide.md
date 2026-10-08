# Scenario Guide

The bug only happens when three endpoints are in a particular state at once, and
writing that down as reproduction steps asks the next person to rebuild it by
hand. A scenario is that combination, saved and shareable as one code.

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
