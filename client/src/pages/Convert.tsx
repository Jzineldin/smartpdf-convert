import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import DropZone from '@/components/upload/DropZone';
import ProcessingStatus, { ProcessingStep } from '@/components/upload/ProcessingStatus';
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, ArrowLeft, Zap, AlertTriangle, CheckCircle, RotateCcw, Edit3, Eye, Crown } from 'lucide-react';
import TemplateSelector from '@/components/templates/TemplateSelector';
import ConfidenceScore from '@/components/results/ConfidenceScore';
import { toast } from 'sonner';

const CACHE_KEY = 'smartpdf_last_conversion';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedConversion {
  tables: ExtractedTable[];
  warnings: AIWarning[];
  confidence: number;
  fileName: string;
  pageCount?: number;
  timestamp: number;
}

interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number;
}

interface AIWarning {
  type: string;
  message: string;
  pageNumber?: number;
  suggestion: string;
}

export default function Convert() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useSupabaseAuth();
  const [processingStep, setProcessingStep] = useState<ProcessingStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedTables, setExtractedTables] = useState<ExtractedTable[] | null>(null);
  const [warnings, setWarnings] = useState<AIWarning[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [conversionId, setConversionId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [fileName, setFileName] = useState<string>('converted-tables');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('generic');
  const [isTryingSample, setIsTryingSample] = useState<boolean>(false);

  const { data: usageData } = trpc.conversion.checkUsage.useQuery();
  const { data: templatesData } = trpc.conversion.getTemplates.useQuery();
  const processMutation = trpc.conversion.process.useMutation();

  // Load cached conversion on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedConversion = JSON.parse(cached);
        // Check if cache is still valid (not expired)
        if (Date.now() - data.timestamp < CACHE_EXPIRY_MS) {
          setExtractedTables(data.tables);
          setWarnings(data.warnings);
          setConfidence(data.confidence);
          setFileName(data.fileName);
          setPageCount(data.pageCount);
          setProcessingStep('ready');
          toast.info('Restored your previous conversion. Click "Convert Another" to start fresh.');
        } else {
          // Cache expired, remove it
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (e) {
      // Invalid cache, remove it
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Save to cache whenever extraction completes
  const saveToCache = useCallback((tables: ExtractedTable[], warns: AIWarning[], conf: number, name: string, pages?: number) => {
    try {
      const cacheData: CachedConversion = {
        tables,
        warnings: warns,
        confidence: conf,
        fileName: name,
        pageCount: pages,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      // localStorage might be full or disabled, ignore
      console.warn('Failed to cache conversion:', e);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File, base64: string) => {
    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setViewMode('preview');
    setFileName(file.name);
    
    // Check usage limit
    if (usageData && !usageData.allowed) {
      setError(usageData.message || 'Usage limit exceeded');
      return;
    }

    setProcessingStep('upload');

    try {
      // For PDFs, we need to convert to images first
      // For now, we'll send the PDF as base64 and let the server handle it
      setProcessingStep('analyze');

      const result = await processMutation.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
        fileSize: file.size,
        mimeType: 'application/pdf',
        templateId: selectedTemplate,
      });

      if (!result.success) {
        setProcessingStep('error');
        setError(result.error || 'Processing failed');
        return;
      }

      setProcessingStep('extract');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX

      setProcessingStep('verify');
      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingStep('ready');
      setExtractedTables(result.tables || []);
      setWarnings(result.warnings || []);
      setConfidence(result.confidence || 0);
      setConversionId(result.conversionId || null);
      setPageCount(result.pageCount || undefined);

      // Cache the results
      saveToCache(result.tables || [], result.warnings || [], result.confidence || 0, file.name, result.pageCount);

      const pageInfo = result.pageCount && result.pageCount > 1 ? ` from ${result.pageCount} pages` : '';
      toast.success(`Successfully extracted ${result.tables?.length || 0} table(s)${pageInfo}!`);
    } catch (err: any) {
      setProcessingStep('error');
      setError(err.message || 'An unexpected error occurred');
    }
  }, [usageData, processMutation, saveToCache]);

  const handleTrySample = useCallback(async (templateId: string, sampleUrl: string) => {
    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setViewMode('preview');
    setIsTryingSample(true);
    setSelectedTemplate(templateId);
    
    // Get the sample file name from URL
    const sampleFileName = sampleUrl.split('/').pop() || 'sample-document';
    setFileName(sampleFileName);

    setProcessingStep('upload');
    toast.info(`Loading ${templateId.replace('-', ' ')} sample...`);

    try {
      // Fetch the sample image and convert to base64
      const response = await fetch(sampleUrl);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix to get just the base64
          const base64Data = base64.split(',')[1] || base64;
          resolve(base64Data);
        };
      });
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;

      setProcessingStep('analyze');

      const result = await processMutation.mutateAsync({
        fileBase64: base64,
        fileName: sampleFileName,
        fileSize: blob.size,
        mimeType: blob.type || 'image/png',
        templateId: templateId,
        isSampleDemo: true, // Flag to bypass Pro check for samples
      });

      if (!result.success) {
        setProcessingStep('error');
        setError(result.error || 'Processing failed');
        return;
      }

      setProcessingStep('extract');
      await new Promise(resolve => setTimeout(resolve, 500));

      setProcessingStep('verify');
      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingStep('ready');
      setExtractedTables(result.tables || []);
      setWarnings(result.warnings || []);
      setConfidence(result.confidence || 0);
      setConversionId(result.conversionId || null);
      setPageCount(result.pageCount || undefined);

      // Cache the results
      saveToCache(result.tables || [], result.warnings || [], result.confidence || 0, sampleFileName, result.pageCount);

      toast.success(`Sample processed! See what ${templateId.replace('-', ' ')} template can do.`);
    } catch (err: any) {
      setProcessingStep('error');
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsTryingSample(false);
    }
  }, [processMutation, saveToCache]);

  const handleReset = () => {
    setProcessingStep(null);
    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setConfidence(0);
    setConversionId(null);
    setViewMode('preview');
    setPageCount(undefined);
    setFileName('converted-tables');
    // Clear the cache when user wants to start fresh
    localStorage.removeItem(CACHE_KEY);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg">SmartPDF Convert</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {usageData && usageData.remaining !== -1 && (
              <Badge variant="secondary" className="font-normal">
                {usageData.remaining} / 3 conversions today
              </Badge>
            )}
            {isAuthenticated ? (
              <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                Dashboard
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setLocation('/login')}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>

        {/* Upload Area */}
        {!processingStep && !extractedTables && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Template Selector */}
            {templatesData && (
              <TemplateSelector
                templates={templatesData.templates}
                selectedTemplate={selectedTemplate}
                onSelectTemplate={setSelectedTemplate}
                isPro={templatesData.userIsPro}
                onUpgradeClick={() => setLocation('/pricing')}
                onTrySample={handleTrySample}
              />
            )}
            
            {/* File Upload */}
            <DropZone onFileSelect={handleFileSelect} />
            
            {/* Selected template info */}
            {selectedTemplate !== 'generic' && templatesData && (
              <div className="text-center text-sm text-muted-foreground">
                Using <span className="font-medium text-foreground">
                  {templatesData.templates.find(t => t.id === selectedTemplate)?.name}
                </span> template for optimized extraction
              </div>
            )}
          </div>
        )}

        {/* Processing Status */}
        {processingStep && processingStep !== 'ready' && (
          <div className="max-w-md mx-auto">
            <ProcessingStatus 
              currentStep={processingStep} 
              error={error || undefined}
              pageCount={pageCount}
            />
            {error && (
              <div className="mt-4 text-center">
                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {extractedTables && extractedTables.length > 0 && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">Extraction Results</h2>
                <Badge 
                  variant={confidence >= 0.9 ? 'default' : confidence >= 0.7 ? 'secondary' : 'destructive'}
                  className="font-normal"
                >
                  {Math.round(confidence * 100)}% confidence
                </Badge>
                {pageCount && pageCount > 1 && (
                  <Badge variant="outline" className="font-normal">
                    {pageCount} pages processed
                  </Badge>
                )}
              </div>
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Convert Another
              </Button>
            </div>

            {/* Confidence Score */}
            <ConfidenceScore 
              confidence={confidence} 
              tableCount={extractedTables.length}
              pageCount={pageCount}
            />

            {/* Warnings */}
            {warnings.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    Quality Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {warnings.map((warning, index) => (
                      <li key={index} className="text-sm">
                        <span className="font-medium">{warning.message}</span>
                        {warning.suggestion && (
                          <span className="text-muted-foreground"> — {warning.suggestion}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'preview' | 'edit')}>
              <TabsList>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="edit" className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  Edit & Export
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                <div className="space-y-4">
                  {extractedTables.map((table, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{table.sheetName}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Page {table.pageNumber}</Badge>
                            <Badge 
                              variant={table.confidence >= 0.9 ? 'default' : 'secondary'}
                              className="font-normal"
                            >
                              {Math.round(table.confidence * 100)}%
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
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
                              {table.rows.slice(0, 10).map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-muted/50">
                                  {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="border px-3 py-2">
                                      {cell ?? ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {table.rows.length > 10 && (
                                <tr>
                                  <td colSpan={table.headers.length} className="border px-3 py-2 text-center text-muted-foreground">
                                    ... and {table.rows.length - 10} more rows (switch to Edit mode to see all)
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="edit" className="mt-4">
                <div className="h-[600px]">
                  <SpreadsheetEditor
                    tables={extractedTables}
                    filename={fileName}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Upgrade CTA for free users */}
            {usageData && usageData.remaining !== -1 && usageData.remaining <= 1 && (
              <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="h-8 w-8" />
                      <div>
                        <h3 className="font-semibold">Running low on conversions?</h3>
                        <p className="text-sm text-blue-100">
                          Upgrade to Pro for unlimited conversions
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => setLocation('/pricing')}>
                      Upgrade to Pro — $9/mo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* No tables extracted */}
        {extractedTables && extractedTables.length === 0 && (
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Tables Found</h3>
              <p className="text-muted-foreground mb-4">
                We couldn't detect any tables in your document. Try uploading a clearer image or a different file.
              </p>
              <Button onClick={handleReset}>
                Try Another File
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
