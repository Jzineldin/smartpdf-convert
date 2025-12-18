import { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import DropZone from '@/components/upload/DropZone';
import ProcessingStatus, { ProcessingStep } from '@/components/upload/ProcessingStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, ArrowLeft, Zap, AlertTriangle, CheckCircle, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

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

  const { data: usageData } = trpc.conversion.checkUsage.useQuery();
  const processMutation = trpc.conversion.process.useMutation();
  const exportMutation = trpc.conversion.export.useMutation();

  const handleFileSelect = useCallback(async (file: File, base64: string) => {
    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    
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

      toast.success(`Successfully extracted ${result.tables?.length || 0} table(s)!`);
    } catch (err: any) {
      setProcessingStep('error');
      setError(err.message || 'An unexpected error occurred');
    }
  }, [usageData, processMutation]);

  const handleExport = async () => {
    if (!extractedTables || extractedTables.length === 0) return;

    try {
      const sheets = extractedTables.map(table => ({
        name: table.sheetName,
        data: [table.headers, ...table.rows] as (string | number | null)[][],
      }));

      const result = await exportMutation.mutateAsync({
        conversionId: conversionId || undefined,
        sheets,
        fileName: 'converted-tables',
      });

      if (result.success && result.url) {
        // Open download URL
        window.open(result.url, '_blank');
        toast.success('Excel file ready for download!');
      } else {
        toast.error('Failed to export Excel file');
      }
    } catch (err) {
      toast.error('Export failed. Please try again.');
    }
  };

  const handleReset = () => {
    setProcessingStep(null);
    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setConfidence(0);
    setConversionId(null);
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
              <Button variant="outline" size="sm" onClick={() => setLocation('/dashboard')}>
                Dashboard
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLocation('/login')}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => setLocation('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {/* Main content */}
          {!processingStep && !extractedTables && (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Upload Your PDF</CardTitle>
                <p className="text-muted-foreground">
                  Drop your PDF file below and our AI will extract all tables
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <DropZone onFileSelect={handleFileSelect} />
                
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    3 free conversions/day
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    No signup required
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {processingStep && processingStep !== 'ready' && (
            <Card>
              <CardContent className="py-12">
                <ProcessingStatus currentStep={processingStep} error={error || undefined} />
                {processingStep === 'error' && (
                  <div className="mt-6 text-center">
                    <Button onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {extractedTables && (
            <div className="space-y-6">
              {/* Success header */}
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-900 dark:text-green-100">
                          Extraction Complete
                        </h3>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Found {extractedTables.length} table(s) • {Math.round(confidence * 100)}% confidence
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        New File
                      </Button>
                      <Button size="sm" onClick={handleExport} disabled={exportMutation.isPending}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {warnings.length > 0 && (
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
                      <AlertTriangle className="h-4 w-4" />
                      Heads Up
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {warnings.map((warning, index) => (
                        <li key={index} className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>{warning.message}</strong>
                          {warning.suggestion && (
                            <span className="text-yellow-600 dark:text-yellow-400"> — {warning.suggestion}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Tables preview */}
              <div className="space-y-4">
                {extractedTables.map((table, tableIndex) => (
                  <Card key={tableIndex}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{table.sheetName}</CardTitle>
                        <Badge variant="secondary">
                          {table.rows.length} rows • Page {table.pageNumber}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              {table.headers.map((header, i) => (
                                <th key={i} className="px-3 py-2 text-left font-medium">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.slice(0, 5).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b">
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-3 py-2">
                                    {cell ?? '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {table.rows.length > 5 && (
                              <tr>
                                <td colSpan={table.headers.length} className="px-3 py-2 text-center text-muted-foreground">
                                  ... and {table.rows.length - 5} more rows
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
        </div>
      </main>
    </div>
  );
}
