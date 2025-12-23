import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileText,
  Sparkles,
  Table2,
  Clock,
  Globe,
  ChevronDown,
  Loader2,
  ArrowRight,
  Eye,
  X,
} from 'lucide-react';

// Types
interface DocumentAnalysisData {
  documentType: string;
  pageCount: number;
  tablesDetected: number;
  languages: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedExtractionTime: string;
}

// Table preview data from backend analysis
interface DetectedTableFromBackend {
  name: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  previewRows: (string | null)[][];
}

interface DocumentAnalysis {
  analysis: DocumentAnalysisData;
  detectedTables?: DetectedTableFromBackend[];
  questions: any[];
  suggestions: any[];
  warnings: string[];
  uncertainPatterns?: any[];
}

interface DetectedTable {
  name: string;
  pageNumber?: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  previewRows: (string | null)[][];
}

type OutputFormat = 'excel' | 'csv' | 'json';
type SheetsOption = 'one_per_table' | 'single_sheet';
type OutputLanguage = 'original' | 'english' | 'swedish' | 'german' | 'spanish' | 'french';

type ExtractionMode =
  | 'invoice_extract'
  | 'bank_extract'
  | 'expense_extract'
  | 'inventory_extract'
  | 'sales_extract'
  | 'table_extract'
  | 'clean_summarize';

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

interface ExtractionOptionsProps {
  analysis: DocumentAnalysis;
  fileName: string;
  isPro: boolean;
  onExtract: (guidance: UserGuidance) => void;
  onUpgradeClick: () => void;
  isExtracting?: boolean;
}

const LANGUAGE_OPTIONS: { value: OutputLanguage; label: string }[] = [
  { value: 'original', label: 'Keep Original' },
  { value: 'english', label: 'English' },
  { value: 'swedish', label: 'Swedish' },
  { value: 'german', label: 'German' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
];

const getComplexityIndicator = (complexity: string) => {
  switch (complexity) {
    case 'low':
      return { color: 'bg-green-500', text: 'Low complexity' };
    case 'medium':
      return { color: 'bg-yellow-500', text: 'Medium complexity' };
    case 'high':
      return { color: 'bg-red-500', text: 'High complexity' };
    default:
      return { color: 'bg-gray-500', text: complexity };
  }
};

// Generate detected tables from analysis
// Uses actual table preview data from backend when available
// Falls back to placeholder data based on document type if backend doesn't provide previews
function generateDetectedTables(analysis: DocumentAnalysis): DetectedTable[] {
  // If backend provided actual table data, use it directly
  if (analysis.detectedTables && analysis.detectedTables.length > 0) {
    return analysis.detectedTables.map(table => ({
      name: table.name,
      pageNumber: table.pageNumber,
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      headers: table.headers,
      previewRows: table.previewRows,
    }));
  }

  // Fallback: Generate placeholder tables based on analysis metadata
  const tables: DetectedTable[] = [];
  const tableCount = analysis.analysis.tablesDetected || 1;
  const docType = analysis.analysis.documentType.toLowerCase();
  const isInvoice = docType.includes('invoice') || docType.includes('receipt');
  const isBankStatement = docType.includes('bank') || docType.includes('statement');

  for (let i = 0; i < tableCount; i++) {
    let headers: string[];
    let previewRows: (string | null)[][];
    let name: string;

    if (isInvoice) {
      name = tableCount > 1 ? `Line Items (Table ${i + 1})` : 'Line Items';
      headers = ['Description', 'Qty', 'Unit Price', 'Amount'];
      previewRows = [
        ['Product/Service item', '1', '$50.00', '$50.00'],
        ['Additional item', '2', '$25.00', '$50.00'],
        ['...', '...', '...', '...'],
      ];
    } else if (isBankStatement) {
      name = tableCount > 1 ? `Transactions (Table ${i + 1})` : 'Transactions';
      headers = ['Date', 'Description', 'Amount', 'Balance'];
      previewRows = [
        ['01/15/2024', 'Direct Deposit', '+$2,500.00', '$5,432.10'],
        ['01/16/2024', 'Payment - Utility', '-$125.00', '$5,307.10'],
        ['...', '...', '...', '...'],
      ];
    } else {
      name = `Table ${i + 1}`;
      headers = ['Column A', 'Column B', 'Column C'];
      previewRows = [
        ['Data row 1', 'Value 1', 'Info 1'],
        ['Data row 2', 'Value 2', 'Info 2'],
        ['...', '...', '...'],
      ];
    }

    tables.push({
      name,
      rowCount: 10 + Math.floor(Math.random() * 15), // Estimated rows
      columnCount: headers.length,
      headers,
      previewRows,
    });
  }

  return tables;
}

// Table Preview Modal
function TablePreviewModal({
  table,
  open,
  onClose,
}: {
  table: DetectedTable | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{table.name}</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted">
                {table.headers.map((header, i) => (
                  <th key={i} className="border px-3 py-2 text-left font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/50">
                  {row.slice(0, table.headers.length).map((cell, cellIndex) => (
                    <td key={cellIndex} className="border px-3 py-2">
                      {cell ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
          <span>Showing {table.previewRows.length} of {table.rowCount} rows</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExtractionOptions({
  analysis,
  fileName,
  isPro,
  onExtract,
  onUpgradeClick,
  isExtracting = false,
}: ExtractionOptionsProps) {
  const { analysis: analysisData, warnings, detectedTables: backendTables } = analysis;

  // Calculate actual table count (prefer backend detectedTables if available)
  const actualTableCount = backendTables?.length || analysisData.tablesDetected || 1;

  // State
  const [selectedTables, setSelectedTables] = useState<Set<number>>(
    new Set(Array.from({ length: actualTableCount }, (_, i) => i))
  );
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('excel');
  const [sheetsOption, setSheetsOption] = useState<SheetsOption>('one_per_table');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('original');
  const [customInstructions, setCustomInstructions] = useState('');
  const [previewTable, setPreviewTable] = useState<DetectedTable | null>(null);

  // Generate detected tables - uses actual data from backend when available
  const detectedTables = useMemo(
    () => generateDetectedTables(analysis),
    [analysis]
  );

  // Complexity indicator
  const complexity = getComplexityIndicator(analysisData.complexity);

  // Toggle table selection
  const toggleTable = (index: number) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTables(newSelected);
  };

  // Handle extract
  const handleExtract = () => {
    const apiLanguage = outputLanguage === 'original' ? 'auto' : outputLanguage;

    const guidance: UserGuidance = {
      answers: {},
      acceptedSuggestions: analysis.suggestions.map((s) => s.id),
      freeformInstructions: customInstructions.trim() || undefined,
      extractionMode: 'table_extract',
      outputPreferences: {
        combineRelatedTables: sheetsOption === 'single_sheet',
        outputLanguage: apiLanguage,
        skipDiagrams: false,
        skipImages: false,
      },
    };

    onExtract(guidance);
  };

  // Dynamic button text
  const getButtonText = () => {
    if (isExtracting) return 'Extracting...';
    switch (outputFormat) {
      case 'csv':
        return 'Extract to CSV';
      case 'json':
        return 'Extract to JSON';
      default:
        return 'Extract to Excel';
    }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* 1. Document Summary Card */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardContent className="p-5">
          {/* File name with icon */}
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="font-medium truncate" title={fileName}>
              {fileName}
            </span>
          </div>

          {/* AI detection text (inline, no box) */}
          <div className="flex items-start gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0 animate-pulse" />
            <p className="text-sm text-foreground">
              <span className="font-semibold text-violet-600 dark:text-violet-400">{analysisData.documentType}</span>
              {' '}with{' '}
              <span className="font-semibold">
                {analysisData.tablesDetected} table{analysisData.tablesDetected !== 1 ? 's' : ''}
              </span>
              {' '}detected
            </p>
          </div>

          {/* Single metadata row - improved spacing */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              <span>{analysisData.tablesDetected} table{analysisData.tablesDetected !== 1 ? 's' : ''}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>{analysisData.languages.join(', ') || 'Unknown'}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>~{analysisData.estimatedExtractionTime}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${complexity.color}`} />
              <span>{complexity.text}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Tables Found Card */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Tables Found</h3>
            {detectedTables.length < analysisData.tablesDetected && (
              <span className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                Showing {detectedTables.length} preview tables • {analysisData.tablesDetected} total estimated
              </span>
            )}
          </div>

          {detectedTables.length < analysisData.tablesDetected && (
            <p className="text-xs text-muted-foreground mb-3 pb-3 border-b">
              These are sample tables from analyzed pages. All {analysisData.tablesDetected} tables will be extracted from the full document.
            </p>
          )}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {detectedTables.map((table, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`table-${index}`}
                    checked={selectedTables.has(index)}
                    onCheckedChange={() => toggleTable(index)}
                  />
                  <label
                    htmlFor={`table-${index}`}
                    className="cursor-pointer flex-1"
                  >
                    <div className="font-medium text-sm">
                      {table.name}
                      {table.pageNumber && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Page {table.pageNumber})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {table.rowCount} rows × {table.columnCount} columns
                    </div>
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={() => setPreviewTable(table)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
              </div>
            ))}
          </div>

          {selectedTables.size === 0 && (
            <p className="text-sm text-amber-600 mt-3">
              Select at least one table to extract
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Output Settings Card */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardContent className="p-5">
          <h3 className="font-medium mb-4">Output Settings</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Format dropdown */}
            <div className="space-y-2">
              <Label htmlFor="format" className="text-sm">
                Format
              </Label>
              <Select
                value={outputFormat}
                onValueChange={(v) => setOutputFormat(v as OutputFormat)}
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sheets dropdown */}
            <div className="space-y-2">
              <Label htmlFor="sheets" className="text-sm">
                Sheets
              </Label>
              <Select
                value={sheetsOption}
                onValueChange={(v) => setSheetsOption(v as SheetsOption)}
              >
                <SelectTrigger id="sheets">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_per_table">One per table</SelectItem>
                  <SelectItem value="single_sheet">All on one sheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* More options (collapsible) */}
          <Collapsible open={showMoreOptions} onOpenChange={setShowMoreOptions}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showMoreOptions ? 'rotate-180' : ''
                }`}
              />
              More options
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              {/* Language selection */}
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm">
                  Language
                </Label>
                <Select
                  value={outputLanguage}
                  onValueChange={(v) => setOutputLanguage(v as OutputLanguage)}
                >
                  <SelectTrigger id="language" className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions" className="text-sm">
                  Custom instructions
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="e.g., 'Skip footer rows', 'Convert checkmarks to Yes/No'"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="h-20"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          {warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}

      {/* 4. Single Primary CTA */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleExtract}
          disabled={isExtracting || selectedTables.size === 0}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              {getButtonText()}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Pro hint for free users */}
      {!isPro && (
        <div className="text-center text-sm text-muted-foreground">
          <span>Using free tier extraction. </span>
          <button
            onClick={onUpgradeClick}
            className="text-blue-600 hover:underline"
          >
            Upgrade to Pro
          </button>
          <span> for specialized templates and higher accuracy.</span>
        </div>
      )}

      {/* Table Preview Modal */}
      <TablePreviewModal
        table={previewTable}
        open={!!previewTable}
        onClose={() => setPreviewTable(null)}
      />
    </div>
  );
}
