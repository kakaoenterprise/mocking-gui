import { useState, useEffect } from 'react';
import { Save, Trash2, ChevronUp, Layers } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@components/ui/Collapsible';
import { Input } from '@components/ui/Input';
import { PanelTab } from '@constants/tab';
import { cn } from '@lib/utils';
import { useHandlerStore } from '@store/useHandlerStore';
import IncludedHandlersList from './saved-scenarios-list/IncludedHandlersList';

interface ScenarioDraftBarProps {
  onTabChange: (tab: string) => void;
  className?: string;
}

/**
 * Fixed bottom bar component for entering and saving a scenario name.
 * Supports expanding the draft list upward when needed.
 */
const ScenarioDraftBar = ({ onTabChange, className }: ScenarioDraftBarProps) => {
  const { draftScenario, addScenario, clearDraft, handlers, removeFromDraft } = useHandlerStore();

  const [scenarioName, setScenarioName] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const draftKeys = Object.keys(draftScenario || {});
  const hasDraftItems = draftKeys.length > 0;

  useEffect(() => {
    if (!hasDraftItems) {
      setScenarioName('');
      setErrorText(null);
      setIsExpanded(false);
    }
  }, [hasDraftItems]);

  if (!hasDraftItems) return null;

  const handleSave = () => {
    if (!scenarioName.trim()) {
      setErrorText('Please enter scenario name.');
      return;
    }
    const result = addScenario(scenarioName.trim());
    if (result.success) {
      setScenarioName('');
      setErrorText(null);
      setIsExpanded(false);
      onTabChange(PanelTab.SCENARIO);
    } else if (result.reason === 'duplicate_name') {
      setErrorText('A scenario with this name already exists.');
    } else if (result.reason === 'duplicate_config') {
      setErrorText('An identical handler combination is already saved as a scenario.');
    }
  };

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        'flex flex-col bg-background border-t border-border shadow-[0_-12px_30px_rgba(0,0,0,0.1)] z-10 transition-all duration-300 ease-in-out',
        className,
      )}
    >
      <CollapsibleContent className="CollapsibleContent overflow-hidden">
        <div className="bg-muted/5 flex flex-col border-b border-border/40">
          <div className="px-6 py-2 flex items-center justify-between bg-muted/20 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Selected APIs ({draftKeys.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-slate-400 hover:text-destructive px-2"
              onClick={clearDraft}
            >
              <Trash2 className="w-3 h-3 mr-1.5" />
              Clear All
            </Button>
          </div>
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <IncludedHandlersList
              configs={draftScenario}
              handlers={handlers}
              onRemove={removeFromDraft}
              className="px-6 py-4 bg-transparent"
            />
          </div>
        </div>
      </CollapsibleContent>
      <div className="px-6 py-2 flex items-center justify-between gap-4 h-14 relative z-20">
        {/* Clickable Trigger Area (Left Side) */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-3 text-left shrink-0 transition-all duration-200 cursor-pointer group px-3 py-1.5 -ml-3 rounded-md',
              isExpanded && 'bg-muted/30',
            )}
          >
            <ChevronUp
              className={cn(
                'w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform duration-300',
                isExpanded && 'rotate-180',
              )}
            />
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-bold text-foreground leading-none">
                Scenario Draft
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="flex w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-primary font-medium tracking-tight">
                  {draftKeys.length} items ready
                </span>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Action Area (Center & Right) */}
        <div className="flex-1 flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Input
              placeholder="Give your scenario a name..."
              value={scenarioName}
              onChange={e => {
                setScenarioName(e.target.value);
                setErrorText(null);
              }}
              className={cn(
                'h-8 text-[11px] bg-muted/50 border-input transition-all focus-visible:bg-background',
                errorText && 'border-destructive focus-visible:ring-destructive',
              )}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            {errorText && (
              <span className="absolute right-0 -bottom-3 text-[9px] text-destructive">
                {errorText}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 px-4 font-bold text-[11px] shadow-sm"
          >
            <Save className="w-3.5 h-3.5 mr-2" />
            Save
          </Button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={clearDraft}
            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            title="Discard Draft"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Collapsible>
  );
};

export default ScenarioDraftBar;
