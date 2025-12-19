import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  FileSearch,
  MessageSquareMore,
  Lightbulb,
  AlertTriangle,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Table2,
  Languages
} from 'lucide-react';

// Types matching server definitions
interface DocumentAnalysis {
  analysis: {
    documentType: string;
    pageCount: number;
    tablesDetected: number;
    languages: string[];
    complexity: 'low' | 'medium' | 'high';
    estimatedExtractionTime: string;
  };
  questions: AnalysisQuestion[];
  suggestions: Suggestion[];
  warnings: string[];
  uncertainPatterns?: UncertainPattern[];
}

interface UncertainPattern {
  pattern: string;
  pagesDetected: number[];
  count: number;
  likelyMeaning: string;
}

interface AnalysisQuestion {
  id: string;
  category: 'symbols' | 'structure' | 'content' | 'output';
  question: string;
  options?: string[];
  context: string;
  default?: string;
}

interface Suggestion {
  id: string;
  text: string;
  action: string;
  accepted?: boolean;
}

interface UserGuidance {
  answers: Record<string, string>;
  acceptedSuggestions: string[];
  freeformInstructions?: string;
  outputPreferences?: {
    combineRelatedTables: boolean;
    outputLanguage: 'auto' | 'english' | 'swedish' | 'german' | 'spanish' | 'french';
    skipDiagrams: boolean;
    skipImages: boolean;
    symbolMapping?: Record<string, string>;
  };
}

interface AnalysisDialogProps {
  analysis: DocumentAnalysis;
  fileName: string;
  onExtract: (guidance: UserGuidance) => void;
  onQuickExtract: () => void;
  isExtracting?: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'symbols': return '🔣';
    case 'structure': return '📊';
    case 'content': return '📝';
    case 'output': return '📤';
    default: return '❓';
  }
};

const getComplexityColor = (complexity: string) => {
  switch (complexity) {
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function AnalysisDialog({
  analysis,
  fileName,
  onExtract,
  onQuickExtract,
  isExtracting = false,
}: AnalysisDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    // Pre-fill with defaults
    const defaults: Record<string, string> = {};
    analysis.questions.forEach(q => {
      if (q.default) {
        defaults[q.id] = q.default;
      }
    });
    return defaults;
  });

  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>(
    analysis.suggestions.map(s => s.id) // Accept all by default
  );

  const [freeformInstructions, setFreeformInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const toggleSuggestion = (suggestionId: string) => {
    setAcceptedSuggestions(prev =>
      prev.includes(suggestionId)
        ? prev.filter(id => id !== suggestionId)
        : [...prev, suggestionId]
    );
  };

  const toggleQuestionExpanded = (questionId: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleExtract = () => {
    const guidance: UserGuidance = {
      answers,
      acceptedSuggestions,
      freeformInstructions: freeformInstructions.trim() || undefined,
    };
    onExtract(guidance);
  };

  const hasQuestions = analysis.questions.length > 0;
  const hasSuggestions = analysis.suggestions.length > 0;
  const hasWarnings = analysis.warnings.length > 0;
  const hasUncertainPatterns = (analysis.uncertainPatterns?.length || 0) > 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Document Summary Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <FileSearch className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Document Analysis</CardTitle>
                <CardDescription className="text-sm truncate max-w-[200px]" title={fileName}>
                  {fileName}
                </CardDescription>
              </div>
            </div>
            <Badge className={getComplexityColor(analysis.analysis.complexity)}>
              {analysis.analysis.complexity} complexity
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{analysis.analysis.documentType}</span>
            </div>
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tables:</span>
              <span className="font-medium">{analysis.analysis.tablesDetected}</span>
            </div>
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Language:</span>
              <span className="font-medium">{analysis.analysis.languages.join(', ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Est. time:</span>
              <span className="font-medium">{analysis.analysis.estimatedExtractionTime}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {hasWarnings && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Potential Issues Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {analysis.warnings.map((warning, i) => (
                <li key={i} className="text-yellow-700 dark:text-yellow-300">• {warning}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Uncertain Patterns */}
      {hasUncertainPatterns && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              Patterns Detected That May Need Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.uncertainPatterns!.map((pattern, i) => (
                <div key={i} className="text-sm flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-orange-100 dark:border-orange-800">
                  <span className="text-orange-500">⚠️</span>
                  <div>
                    <span className="font-medium">{pattern.count}x "{pattern.pattern}"</span>
                    <span className="text-muted-foreground"> on page{pattern.pagesDetected.length > 1 ? 's' : ''} {pattern.pagesDetected.join(', ')}</span>
                    <p className="text-xs text-muted-foreground mt-1">Likely: {pattern.likelyMeaning}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              If these patterns are important, add instructions in the "Additional Instructions" section below.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Questions Section */}
      {hasQuestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareMore className="h-5 w-5 text-blue-600" />
              Quick Questions
            </CardTitle>
            <CardDescription>
              Help me understand your preferences for better extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.questions.map((question) => (
              <div key={question.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getCategoryIcon(question.category)}</span>
                    <div>
                      <p className="font-medium">{question.question}</p>
                      {question.context && (
                        <button
                          onClick={() => toggleQuestionExpanded(question.id)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                        >
                          {expandedQuestions.has(question.id) ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              Hide context
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              Show context
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {question.category}
                  </Badge>
                </div>

                {expandedQuestions.has(question.id) && question.context && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">
                    {question.context}
                  </p>
                )}

                {question.options ? (
                  <RadioGroup
                    value={answers[question.id] || question.default || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                    className="space-y-2"
                  >
                    {question.options.map((option, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                        <Label
                          htmlFor={`${question.id}-${i}`}
                          className="text-sm cursor-pointer"
                        >
                          {option}
                          {option === question.default && (
                            <span className="text-xs text-muted-foreground ml-2">(recommended)</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    placeholder="Type your answer..."
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="h-20"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions Section */}
      {hasSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Suggestions
            </CardTitle>
            <CardDescription>
              I noticed some things that might help improve the output
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  acceptedSuggestions.includes(suggestion.id)
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-muted/30'
                }`}
              >
                <Switch
                  checked={acceptedSuggestions.includes(suggestion.id)}
                  onCheckedChange={() => toggleSuggestion(suggestion.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{suggestion.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Action: {suggestion.action}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Additional Instructions (Collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              Additional Instructions (Optional)
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CardTitle>
        </CardHeader>
        {showAdvanced && (
          <CardContent>
            <Textarea
              placeholder="Add any specific instructions for extraction... e.g., 'Skip the footer rows', 'Combine columns A and B', 'Use Swedish for headers'"
              value={freeformInstructions}
              onChange={(e) => setFreeformInstructions(e.target.value)}
              className="h-24"
            />
          </CardContent>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleExtract}
          disabled={isExtracting}
          className="flex-1 gap-2"
          size="lg"
        >
          {isExtracting ? (
            <>
              <span className="animate-spin">⏳</span>
              Extracting...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Extract with My Preferences
            </>
          )}
        </Button>

        {!hasQuestions && !hasSuggestions && (
          <Button
            onClick={onQuickExtract}
            disabled={isExtracting}
            variant="outline"
            className="flex-1 gap-2"
            size="lg"
          >
            <Zap className="h-5 w-5" />
            Quick Extract (Use Defaults)
          </Button>
        )}
      </div>

      {/* No questions message */}
      {!hasQuestions && !hasSuggestions && (
        <p className="text-center text-sm text-muted-foreground">
          This document looks straightforward! Click "Quick Extract" to proceed, or add custom instructions above.
        </p>
      )}
    </div>
  );
}
