import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Merge,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  Undo2,
  TableProperties,
  History,
  Eye,
  ArrowRight,
} from 'lucide-react';
import {
  analyzeTablesForOptimization,
  applyCombineSimilar,
  applyRemoveSmall,
  type ExtractedTable,
  type TableSuggestion,
} from '@/lib/tableOptimizer';

interface AppliedChange {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  tablesBeforeCount: number;
  tablesAfterCount: number;
  affectedTableNames: string[];
  previousTables: ExtractedTable[];
}

interface SmartSuggestionsProps {
  tables: ExtractedTable[];
  onTablesChange: (tables: ExtractedTable[]) => void;
}

export default function SmartSuggestions({ tables, onTablesChange }: SmartSuggestionsProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Analyze tables for optimization opportunities (recalculates after each change)
  const analysis = useMemo(() => {
    return analyzeTablesForOptimization(tables);
  }, [tables]);

  const { suggestions } = analysis;

  // Show panel if there are suggestions, applied changes, or many tables
  const showPanel = suggestions.length > 0 ||
                    appliedChanges.length > 0 ||
                    tables.length >= 10;

  if (!showPanel) {
    return null;
  }

  const getAffectedTableNames = (suggestion: TableSuggestion): string[] => {
    return suggestion.tableIndices
      .map(i => tables[i]?.sheetName || `Table ${i + 1}`)
      .slice(0, 8);
  };

  const handleApplySuggestion = (suggestion: TableSuggestion) => {
    const affectedNames = getAffectedTableNames(suggestion);
    const tablesBeforeCount = tables.length;

    let newTables: ExtractedTable[];
    let changeDescription: string;

    switch (suggestion.type) {
      case 'combine_similar':
      case 'merge_pricing':
      case 'consolidate_details':
        newTables = applyCombineSimilar(tables, suggestion.tableIndices);
        changeDescription = `Merged ${suggestion.tableIndices.length} tables into 1 "Combined Data" table`;
        break;
      case 'remove_small':
        newTables = applyRemoveSmall(tables, suggestion.tableIndices);
        changeDescription = `Removed ${suggestion.tableIndices.length} small tables`;
        break;
      default:
        return;
    }

    // Record the change for history
    const change: AppliedChange = {
      id: `change_${Date.now()}`,
      title: suggestion.title,
      description: changeDescription,
      timestamp: new Date(),
      tablesBeforeCount,
      tablesAfterCount: newTables.length,
      affectedTableNames: affectedNames,
      previousTables: [...tables], // Store snapshot for undo
    };

    setAppliedChanges(prev => [...prev, change]);
    onTablesChange(newTables);
    setExpandedSuggestion(null);
    setShowPreview(null);
  };

  const handleUndoChange = (changeId: string) => {
    const changeIndex = appliedChanges.findIndex(c => c.id === changeId);
    if (changeIndex === -1) return;

    const change = appliedChanges[changeIndex];

    // Restore tables to state before this change
    onTablesChange(change.previousTables);

    // Remove this change and all subsequent changes from history
    setAppliedChanges(prev => prev.slice(0, changeIndex));
  };

  const handleUndoAll = () => {
    if (appliedChanges.length === 0) return;

    // Restore to the original state (before first change)
    const originalTables = appliedChanges[0].previousTables;
    onTablesChange(originalTables);
    setAppliedChanges([]);
  };

  const getIconForType = (type: TableSuggestion['type']) => {
    switch (type) {
      case 'combine_similar':
      case 'merge_pricing':
      case 'consolidate_details':
        return <Merge className="h-4 w-4" />;
      case 'remove_small':
        return <Trash2 className="h-4 w-4" />;
      default:
        return <TableProperties className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: TableSuggestion['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getActionVerb = (type: TableSuggestion['type']) => {
    switch (type) {
      case 'combine_similar':
      case 'merge_pricing':
      case 'consolidate_details':
        return 'Merge';
      case 'remove_small':
        return 'Remove';
      default:
        return 'Apply';
    }
  };

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Sparkles className="h-5 w-5" />
            Smart Suggestions
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {suggestions.length} available
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {appliedChanges.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <History className="h-4 w-4 mr-1" />
                  History ({appliedChanges.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndoAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  Undo All
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Optimize your extracted data with AI-powered suggestions
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats summary */}
        {analysis.stats.potentialMerges > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground pb-2 border-b">
            <span>
              <strong>{analysis.stats.totalTables}</strong> tables total
            </span>
            {analysis.stats.potentialMerges > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                Could reduce by <strong>{analysis.stats.potentialMerges}</strong> tables
              </span>
            )}
          </div>
        )}

        {/* Change History */}
        {showHistory && appliedChanges.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-3 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Change History
            </h4>
            <div className="space-y-2">
              {appliedChanges.map((change, index) => (
                <div
                  key={change.id}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-600" />
                      <span className="font-medium">{change.description}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <span>{change.tablesBeforeCount} tables</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{change.tablesAfterCount} tables</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUndoChange(change.id)}
                    className="text-xs"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Undo
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success summary when changes were applied */}
        {appliedChanges.length > 0 && !showHistory && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
            <Check className="h-4 w-4" />
            <span>
              {appliedChanges.length} optimization{appliedChanges.length > 1 ? 's' : ''} applied
              {appliedChanges.length > 0 && (
                <span className="text-green-500 dark:text-green-500 ml-1">
                  (saved {appliedChanges.reduce((sum, c) => sum + c.tablesBeforeCount - c.tablesAfterCount, 0)} tables)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Available suggestions */}
        {suggestions.length === 0 && appliedChanges.length > 0 ? (
          <p className="text-sm text-muted-foreground italic">
            All suggestions have been applied. Your data is optimized!
          </p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No optimization suggestions available. Your tables have diverse structures.
          </p>
        ) : (
          <div className="space-y-2">
            {suggestions.map(suggestion => {
              const isExpanded = expandedSuggestion === suggestion.id;
              const isPreviewing = showPreview === suggestion.id;
              const affectedNames = getAffectedTableNames(suggestion);

              return (
                <div
                  key={suggestion.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm overflow-hidden"
                >
                  {/* Suggestion header */}
                  <button
                    onClick={() => {
                      setExpandedSuggestion(isExpanded ? null : suggestion.id);
                      setShowPreview(null);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className={`p-2 rounded-full ${getPriorityColor(suggestion.priority)}`}>
                      {getIconForType(suggestion.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{suggestion.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.impact}
                        </Badge>
                      </div>
                      {!isExpanded && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {suggestion.description}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t bg-gray-50/50 dark:bg-gray-800/50">
                      <p className="text-sm text-muted-foreground mb-3">
                        {suggestion.description}
                      </p>

                      {/* Preview toggle */}
                      <button
                        onClick={() => setShowPreview(isPreviewing ? null : suggestion.id)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mb-3"
                      >
                        <Eye className="h-3 w-3" />
                        {isPreviewing ? 'Hide' : 'Show'} affected tables ({suggestion.tableIndices.length})
                      </button>

                      {/* Affected tables preview */}
                      {isPreviewing && (
                        <div className="mb-3 p-2 bg-white dark:bg-gray-700 rounded border text-xs">
                          <div className="font-medium mb-2 text-muted-foreground">
                            Tables that will be {suggestion.type === 'remove_small' ? 'removed' : 'merged'}:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {affectedNames.map((name, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {name}
                              </Badge>
                            ))}
                            {suggestion.tableIndices.length > 8 && (
                              <Badge variant="outline" className="text-xs font-normal">
                                +{suggestion.tableIndices.length - 8} more
                              </Badge>
                            )}
                          </div>
                          {suggestion.type !== 'remove_small' && (
                            <div className="mt-2 text-muted-foreground">
                              <ArrowRight className="h-3 w-3 inline mr-1" />
                              Will create 1 new "Combined Data" table with a "Source" column
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplySuggestion(suggestion)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {getActionVerb(suggestion.type)} {suggestion.tableIndices.length} Tables
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setExpandedSuggestion(null);
                            setShowPreview(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
