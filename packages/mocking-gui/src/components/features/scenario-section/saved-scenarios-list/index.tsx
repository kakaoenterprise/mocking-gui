import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@components/ui/Card';
import { useHandlerStore } from '@store/useHandlerStore';
import {
  decodeScenarioAsync,
  encodeScenario,
  exportScenariosToFile,
  parseScenariosFromFile,
} from '@utils/scenario';
import HeaderSection from './HeaderSection';
import ImportSection from './ImportSection';
import ScenarioCard from './ScenarioCard';
import type { Scenario, StoredHandlerVariants } from '@mocking-gui-types/handler';

const SavedScenariosList = () => {
  const {
    scenarios,
    activeScenarioId,
    deleteScenario,
    activateScenario,
    updateScenario,
    deactivateScenario,
    importScenario,
    importScenarios,
  } = useHandlerStore();
  const handlers = useHandlerStore(state => state.handlers);

  const [importCode, setImportCode] = useState('');
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [isImportSectionVisible, setIsImportSectionVisible] = useState(false);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);

  const handleUpdateScenario = useCallback(
    (id: string, configs: Record<string, StoredHandlerVariants>) => {
      updateScenario(id, configs);
    },
    [updateScenario],
  );

  const handleApplyScenario = useCallback(
    (scenario: Scenario) => {
      const isActive = activeScenarioId === scenario.id;
      if (isActive) deactivateScenario();
      else activateScenario(scenario.id);
    },
    [activeScenarioId, deactivateScenario, activateScenario],
  );

  const handleCopyScenarioDataToClipboard = useCallback(
    (scenarioId: string) => {
      const scenario = scenarios.find(({ id }) => id === scenarioId);
      if (!scenario) return;
      try {
        const encodedScenarioData = encodeScenario(scenario);
        navigator.clipboard.writeText(encodedScenarioData);
        alert('Scenario code copied to clipboard.');
      } catch {
        alert('Failed to generate share data.');
      }
    },
    [scenarios],
  );

  const handleImportScenarioCode = () => {
    setIsImportSectionVisible(!isImportSectionVisible);
    setImportErrorMessage(null);
    setImportCode('');
  };

  const handleDecodeScenarioFromCode = useCallback(async () => {
    setImportErrorMessage(null);
    if (!importCode.trim()) return;
    const decodedScenario = await decodeScenarioAsync(importCode.trim());
    if (!decodedScenario) {
      setImportErrorMessage('Invalid scenario data. Please check the code.');
      return;
    }
    const ok = importScenario(decodedScenario);
    if (!ok) {
      setImportErrorMessage('Scenario already exists.');
      return;
    }
    setImportCode('');
    setIsImportSectionVisible(false);
  }, [importCode, importScenario]);

  const handleFileImport = useCallback(
    async (file: File) => {
      setImportErrorMessage(null);
      try {
        const importedScenarios = await parseScenariosFromFile(file);
        if (importedScenarios.length === 0) {
          setImportErrorMessage('No valid scenarios found in file.');
          return;
        }

        const successCount = importScenarios(importedScenarios);

        if (successCount === 0) {
          setImportErrorMessage('All scenarios in file already exist.');
        } else {
          setIsImportSectionVisible(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setImportErrorMessage(`Failed to parse JSON file: ${message}`);
      }
    },
    [importScenarios],
  );

  const handleExportScenarios = useCallback(() => {
    if (scenarios.length === 0) return;
    exportScenariosToFile(scenarios);
  }, [scenarios]);

  return (
    <section className="flex flex-col gap-3">
      <HeaderSection
        count={scenarios.length}
        onToggleImport={handleImportScenarioCode}
        onExport={handleExportScenarios}
      />

      <ImportSection
        isVisible={isImportSectionVisible}
        importCode={importCode}
        onChangeImportCode={v => {
          setImportCode(v);
          setImportErrorMessage(null);
        }}
        importErrorMessage={importErrorMessage}
        onConfirmImport={handleDecodeScenarioFromCode}
        onFileImport={handleFileImport}
      />

      <Card className="flex flex-col gap-4 border-none bg-panel">
        {scenarios?.map(scenario => {
          const isActive = activeScenarioId === scenario.id;

          return (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              isActive={isActive}
              onApply={() => handleApplyScenario(scenario)}
              onUpdate={configs => handleUpdateScenario(scenario.id, configs)}
              onShare={() => handleCopyScenarioDataToClipboard(scenario.id)}
              onDelete={() => deleteScenario(scenario.id)}
              expanded={expandedScenarioId === scenario.id}
              onToggleExpand={() =>
                setExpandedScenarioId(expandedScenarioId === scenario.id ? null : scenario.id)
              }
              handlers={handlers}
            />
          );
        })}
        {(!scenarios || scenarios.length === 0) && (
          <article className="col-span-full py-16 text-center rounded-lg bg-muted">
            <Plus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No saved scenarios.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add handlers from the API tab to create your own scenario.
            </p>
          </article>
        )}
      </Card>
    </section>
  );
};

export default SavedScenariosList;
