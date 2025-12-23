import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileSearch,
  Table2,
  Receipt,
  Landmark,
  CreditCard,
  Package,
  TrendingUp,
  FileText,
  Sparkles,
  Zap,
  Crown,
  ChevronDown,
  ChevronUp,
  Clock,
  Languages,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Globe
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Document type to icon mapping
const DOCUMENT_TYPE_ICONS: Record<string, typeof FileText> = {
  'invoice': Receipt,
  'bank statement': Landmark,
  'expense report': CreditCard,
  'inventory': Package,
  'sales report': TrendingUp,
  'financial': Landmark,
  'receipt': Receipt,
  'spreadsheet': Table2,
  'table': Table2,
  'form': FileText,
  'report': FileText,
  'default': FileText,
};

// Document type to extraction mode mapping
const DOCUMENT_TYPE_MODES: Record<string, ExtractionMode[]> = {
  'invoice': ['invoice_extract', 'table_extract', 'clean_summarize'],
  'bank statement': ['bank_extract', 'table_extract', 'clean_summarize'],
  'expense report': ['expense_extract', 'table_extract', 'clean_summarize'],
  'inventory': ['inventory_extract', 'table_extract', 'clean_summarize'],
  'sales report': ['sales_extract', 'table_extract', 'clean_summarize'],
  'financial': ['table_extract', 'clean_summarize'],
  'receipt': ['invoice_extract', 'table_extract', 'clean_summarize'],
  'spreadsheet': ['table_extract', 'clean_summarize'],
  'table': ['table_extract', 'clean_summarize'],
  'form': ['table_extract', 'clean_summarize'],
  'report': ['table_extract', 'clean_summarize'],
  'default': ['table_extract', 'clean_summarize'],
};

type ExtractionMode =
  | 'invoice_extract'
  | 'bank_extract'
  | 'expense_extract'
  | 'inventory_extract'
  | 'sales_extract'
  | 'table_extract'
  | 'clean_summarize';

interface ExtractionModeInfo {
  id: ExtractionMode;
  name: string;
  description: string;
  icon: typeof FileText;
  isPro: boolean;
  outputType: 'excel' | 'summary';
  aiExplanation: (analysis: DocumentAnalysisData) => string;
}

const EXTRACTION_MODES: Record<ExtractionMode, ExtractionModeInfo> = {
  invoice_extract: {
    id: 'invoice_extract',
    name: 'Extract Invoice Data',
    description: 'Vendor info, line items, totals, and payment details',
    icon: Receipt,
    isPro: true,
    outputType: 'excel',
    aiExplanation: (a) => `I'll extract vendor information, ${a.tablesDetected > 1 ? `${a.tablesDetected} tables with` : 'the'} line items, amounts, tax, and totals into a structured Excel format.`,
  },
  bank_extract: {
    id: 'bank_extract',
    name: 'Extract Bank Statement',
    description: 'Transactions, running balance, and account details',
    icon: Landmark,
    isPro: true,
    outputType: 'excel',
    aiExplanation: (a) => `I'll extract ${a.tablesDetected} transaction table${a.tablesDetected > 1 ? 's' : ''}, account details, and running balances into Excel with proper date/amount formatting.`,
  },
  expense_extract: {
    id: 'expense_extract',
    name: 'Extract Expense Report',
    description: 'Expense items, categories, and reimbursement totals',
    icon: CreditCard,
    isPro: true,
    outputType: 'excel',
    aiExplanation: (a) => `I'll organize all expense items by category with dates, vendors, and amounts. ${a.tablesDetected > 1 ? `Found ${a.tablesDetected} sections to process.` : ''}`,
  },
  inventory_extract: {
    id: 'inventory_extract',
    name: 'Extract Inventory List',
    description: 'Product codes, quantities, locations, and values',
    icon: Package,
    isPro: true,
    outputType: 'excel',
    aiExplanation: (a) => `I'll extract product information including SKUs, quantities, and values. ${a.tablesDetected > 1 ? `Detected ${a.tablesDetected} inventory tables.` : ''}`,
  },
  sales_extract: {
    id: 'sales_extract',
    name: 'Extract Sales Report',
    description: 'Sales data, revenue figures, and performance metrics',
    icon: TrendingUp,
    isPro: true,
    outputType: 'excel',
    aiExplanation: (a) => `I'll extract sales figures, metrics, and ${a.tablesDetected > 1 ? `all ${a.tablesDetected} tables` : 'the data'} with proper number formatting preserved.`,
  },
  table_extract: {
    id: 'table_extract',
    name: 'Extract All Tables',
    description: 'Extract every table as-is into Excel sheets',
    icon: Table2,
    isPro: false,
    outputType: 'excel',
    aiExplanation: (a) => `I detected ${a.tablesDetected} table${a.tablesDetected !== 1 ? 's' : ''} in this ${a.documentType.toLowerCase()}. I'll extract each one to a separate Excel sheet with the exact formatting preserved.`,
  },
  clean_summarize: {
    id: 'clean_summarize',
    name: 'Clean & Summarize',
    description: 'Organize messy content into a clean, readable format',
    icon: Sparkles,
    isPro: false,
    outputType: 'summary',
    aiExplanation: (a) => `This document looks like it has ${a.complexity === 'high' ? 'complex' : a.complexity} content. I'll clean up the information and organize it into a readable summary instead of forcing it into Excel columns.`,
  },
};

interface DocumentAnalysisData {
  documentType: string;
  pageCount: number;
  tablesDetected: number;
  languages: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedExtractionTime: string;
}

interface DocumentAnalysis {
  analysis: DocumentAnalysisData;
  questions: any[];
  suggestions: any[];
  warnings: string[];
  uncertainPatterns?: any[];
}

type OutputLanguage = 'original' | 'english' | 'swedish' | 'german' | 'spanish' | 'french';

const LANGUAGE_OPTIONS: { value: OutputLanguage; label: string; description: string }[] = [
  { value: 'original', label: 'Keep Original', description: 'Extract in the document\'s original language' },
  { value: 'english', label: 'English', description: 'Translate all content to English' },
  { value: 'swedish', label: 'Swedish', description: 'Translate all content to Swedish' },
  { value: 'german', label: 'German', description: 'Translate all content to German' },
  { value: 'spanish', label: 'Spanish', description: 'Translate all content to Spanish' },
  { value: 'french', label: 'French', description: 'Translate all content to French' },
];

interface UserGuidance {
  answers: Record<string, string>;
  acceptedSuggestions: string[];
  freeformInstructions?: string;
  extractionMode?: ExtractionMode;
  outputPreferences?: {
    combineRelatedTables: boolean;
    outputLanguage: 'auto' | 'english' | 'swedish' | 'german' | 'spanish' | 'french';
    skipDiagrams: boolean;
    skipImages: boolean;
    symbolMapping?: Record<string, string>;
  };
}

interface SmartExtractionOptionsProps {
  analysis: DocumentAnalysis;
  fileName: string;
  isPro: boolean;
  onExtract: (guidance: UserGuidance) => void;
  onUpgradeClick: () => void;
  isExtracting?: boolean;
}

function getDocumentIcon(documentType: string): typeof FileText {
  const lowerType = documentType.toLowerCase();
  for (const [key, icon] of Object.entries(DOCUMENT_TYPE_ICONS)) {
    if (lowerType.includes(key)) {
      return icon;
    }
  }
  return DOCUMENT_TYPE_ICONS.default;
}

function getExtractionModes(documentType: string): ExtractionMode[] {
  const lowerType = documentType.toLowerCase();
  for (const [key, modes] of Object.entries(DOCUMENT_TYPE_MODES)) {
    if (lowerType.includes(key)) {
      return modes;
    }
  }
  return DOCUMENT_TYPE_MODES.default;
}

const getComplexityColor = (complexity: string) => {
  switch (complexity) {
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function SmartExtractionOptions({
  analysis,
  fileName,
  isPro,
  onExtract,
  onUpgradeClick,
  isExtracting = false,
}: SmartExtractionOptionsProps) {
  const [selectedMode, setSelectedMode] = useState<ExtractionMode | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('original');

  const { analysis: analysisData, warnings } = analysis;
  const DocumentIcon = getDocumentIcon(analysisData.documentType);

  // Detect if document has non-English content
  const hasNonEnglishContent = useMemo(() => {
    const langs = analysisData.languages.map(l => l.toLowerCase());
    return langs.length > 0 && !langs.every(l => l === 'english');
  }, [analysisData.languages]);

  // Get available extraction modes based on detected document type
  const availableModes = useMemo(() => {
    return getExtractionModes(analysisData.documentType);
  }, [analysisData.documentType]);

  // Get the primary (recommended) mode
  const primaryMode = availableModes[0];
  const primaryModeInfo = EXTRACTION_MODES[primaryMode];

  const handleExtract = (mode: ExtractionMode) => {
    const modeInfo = EXTRACTION_MODES[mode];

    // Check Pro requirement
    if (modeInfo.isPro && !isPro) {
      onUpgradeClick();
      return;
    }

    // Map 'original' to 'auto' for the API
    const apiLanguage = outputLanguage === 'original' ? 'auto' : outputLanguage;

    const guidance: UserGuidance = {
      answers: {},
      acceptedSuggestions: analysis.suggestions.map(s => s.id),
      freeformInstructions: customInstructions.trim() || undefined,
      extractionMode: mode,
      outputPreferences: {
        combineRelatedTables: false,
        outputLanguage: apiLanguage,
        skipDiagrams: false,
        skipImages: false,
      },
    };

    onExtract(guidance);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* AI Analysis Summary */}
      <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <DocumentIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-blue-500" />
                  Document Analyzed
                </CardTitle>
                <CardDescription className="text-sm truncate max-w-[200px]" title={fileName}>
                  {fileName}
                </CardDescription>
              </div>
            </div>
            <Badge className={getComplexityColor(analysisData.complexity)}>
              {analysisData.complexity} complexity
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* AI Detection Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border mb-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-purple-700 dark:text-purple-300 mb-1">
                  AI Detection
                </p>
                <p className="text-sm text-foreground">
                  I detected a <span className="font-semibold">{analysisData.documentType}</span> with{' '}
                  <span className="font-semibold">{analysisData.tablesDetected} table{analysisData.tablesDetected !== 1 ? 's' : ''}</span>
                  {analysisData.pageCount > 1 && <> across <span className="font-semibold">{analysisData.pageCount} pages</span></>}.
                  {analysisData.languages.length > 0 && (
                    <> Content is in <span className="font-semibold">{analysisData.languages.join(', ')}</span>.</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Table2 className="h-4 w-4" />
              <span>{analysisData.tablesDetected} table{analysisData.tablesDetected !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Languages className="h-4 w-4" />
              <span>{analysisData.languages.join(', ') || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>~{analysisData.estimatedExtractionTime}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                {warnings.map((warning, i) => (
                  <p key={i} className="text-yellow-700 dark:text-yellow-300">{warning}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Options */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          Choose Extraction Method
        </h3>

        {availableModes.map((modeId, index) => {
          const mode = EXTRACTION_MODES[modeId];
          const isPrimary = index === 0;
          const isProLocked = mode.isPro && !isPro;

          return (
            <Card
              key={modeId}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedMode === modeId
                  ? 'ring-2 ring-blue-500 border-blue-500'
                  : isPrimary
                  ? 'border-blue-200 dark:border-blue-800'
                  : ''
              } ${isProLocked ? 'opacity-75' : ''}`}
              onClick={() => !isExtracting && setSelectedMode(modeId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isPrimary ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <mode.icon className={`h-5 w-5 ${isPrimary ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{mode.name}</h4>
                        {isPrimary && (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            Recommended
                          </Badge>
                        )}
                        {mode.isPro && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Crown className="h-3 w-3" />
                            Pro
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {mode.outputType === 'excel' ? 'Excel' : 'Summary'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {mode.description}
                      </p>
                      {/* AI Explanation for selected mode */}
                      {(selectedMode === modeId || (selectedMode === null && isPrimary)) && (
                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              {mode.aiExplanation(analysisData)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isPrimary ? 'default' : 'outline'}
                    disabled={isExtracting}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtract(modeId);
                    }}
                    className="flex-shrink-0"
                  >
                    {isExtracting && selectedMode === modeId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Extracting...
                      </>
                    ) : isProLocked ? (
                      <>
                        <Crown className="h-4 w-4 mr-1" />
                        Upgrade
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Extract
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Language Selection - Show prominently if non-English content detected */}
      {hasNonEnglishContent && (
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-gray-900">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                <Globe className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Output Language</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Document is in {analysisData.languages.join(', ')}. Choose output language:
                  </p>
                </div>
                <Select value={outputLanguage} onValueChange={(v) => setOutputLanguage(v as OutputLanguage)}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <div className="flex flex-col">
                          <span>{lang.label}</span>
                          <span className="text-xs text-muted-foreground">{lang.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Options (Collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer py-3"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span>Additional Options</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CardTitle>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="pt-0 space-y-4">
            {/* Language selector in advanced options if not shown above */}
            {!hasNonEnglishContent && (
              <div className="space-y-2">
                <Label htmlFor="language-select" className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Output Language
                </Label>
                <Select value={outputLanguage} onValueChange={(v) => setOutputLanguage(v as OutputLanguage)}>
                  <SelectTrigger id="language-select" className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <div className="flex flex-col">
                          <span>{lang.label}</span>
                          <span className="text-xs text-muted-foreground">{lang.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Translate extracted content to a different language
                </p>
              </div>
            )}

            {/* Custom instructions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Instructions</Label>
              <Textarea
                placeholder="Add specific instructions for extraction... e.g., 'Skip the footer rows', 'Convert checkmarks to Yes/No', 'Keep amounts in original format'"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="h-24"
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be passed to the AI for more customized extraction.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Free vs Pro hint */}
      {!isPro && (
        <div className="text-center text-sm text-muted-foreground">
          <span>Free tier uses generic extraction. </span>
          <button onClick={onUpgradeClick} className="text-blue-600 hover:underline">
            Upgrade to Pro
          </button>
          <span> for specialized document-type extraction with higher accuracy.</span>
        </div>
      )}
    </div>
  );
}
