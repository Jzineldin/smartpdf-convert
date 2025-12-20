import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor';
import { PreviewContainer } from '@/components/preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileSpreadsheet,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Eye,
  Columns2,
  Download,
  Loader2,
  XCircle,
  Clock,
} from 'lucide-react';
import ConfidenceScore from '@/components/results/ConfidenceScore';
import { toast } from 'sonner';

interface ConfidenceBreakdown {
  overall: number;
  breakdown: {
    textClarity: number;
    structureClarity: number;
    specialChars: number;
    completeness: number;
  };
  uncertainCells: Array<{
    row: number;
    col: number;
    value: string;
    confidence: number;
    reason: string;
  }>;
}

interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | ConfidenceBreakdown;
}

interface AIWarning {
  type: string;
  message: string;
  pageNumber?: number;
  suggestion: string;
}

const getConfidenceValue = (confidence: number | ConfidenceBreakdown): number => {
  if (typeof confidence === 'number') {
    return confidence;
  }
  return confidence.overall;
};

export default function Results() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useSupabaseAuth();
  const [viewMode, setViewMode] = useState<'preview' | 'split' | 'edit'>('preview');

  const conversionId = params.id ? parseInt(params.id, 10) : null;

  const {
    data: conversion,
    isLoading,
    error,
    refetch,
  } = trpc.conversion.get.useQuery(
    { id: conversionId! },
    { enabled: !!conversionId }
  );

  // Parse extracted tables from conversion data
  const extractedTables: ExtractedTable[] = useMemo(() => {
    if (!conversion?.extractedTables) return [];
    try {
      if (typeof conversion.extractedTables === 'string') {
        return JSON.parse(conversion.extractedTables);
      }
      return conversion.extractedTables as ExtractedTable[];
    } catch {
      return [];
    }
  }, [conversion?.extractedTables]);

  // Parse warnings
  const warnings: AIWarning[] = useMemo(() => {
    if (!conversion?.aiWarnings) return [];
    try {
      if (typeof conversion.aiWarnings === 'string') {
        return JSON.parse(conversion.aiWarnings);
      }
      return (conversion.aiWarnings as AIWarning[]).filter(
        (w) => w && typeof w.message === 'string'
      );
    } catch {
      return [];
    }
  }, [conversion?.aiWarnings]);

  const confidence = conversion?.aiConfidenceScore
    ? parseFloat(String(conversion.aiConfidenceScore))
    : 0;

  // Determine if we have PDF data (would need to be stored separately or re-fetched)
  // For now, split view won't work for historical conversions without stored PDF
  const hasPdfData = false; // TODO: Implement PDF storage/retrieval for historical conversions

  if (!conversionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container py-8">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Conversion ID</h3>
              <p className="text-muted-foreground mb-4">
                The conversion ID in the URL is invalid.
              </p>
              <Button onClick={() => setLocation('/convert')}>
                Start New Conversion
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !conversion) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container py-8">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-8">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Conversion Not Found</h3>
              <p className="text-muted-foreground mb-4">
                {error?.message || 'This conversion could not be found or you do not have access to it.'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => refetch()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={() => setLocation('/convert')}>
                  New Conversion
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Handle different conversion statuses
  if (conversion.status === 'processing') {
    // Check if the processing is stale (more than 10 minutes old)
    const processingStartTime = new Date(conversion.createdAt).getTime();
    const now = Date.now();
    const minutesElapsed = (now - processingStartTime) / (1000 * 60);
    const isStale = minutesElapsed > 10;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container py-8">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-8">
              {isStale ? (
                <>
                  <Clock className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Processing Stalled</h3>
                  <p className="text-muted-foreground mb-2">
                    Your document "{conversion.originalFilename}" has been processing for {Math.round(minutesElapsed)} minutes.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This usually indicates a processing error. Try uploading the file again.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => refetch()}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Refresh Status
                    </Button>
                    <Button onClick={() => setLocation('/convert')}>
                      Try Again
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-blue-500 mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold mb-2">Processing...</h3>
                  <p className="text-muted-foreground mb-4">
                    Your document "{conversion.originalFilename}" is being processed.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This usually takes 10-30 seconds. Click refresh if it takes longer.
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (conversion.status === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container py-8">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-8">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Conversion Failed</h3>
              <p className="text-muted-foreground mb-2">
                "{conversion.originalFilename}" could not be processed.
              </p>
              {conversion.errorMessage && (
                <p className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">
                  {conversion.errorMessage}
                </p>
              )}
              {!conversion.errorMessage && (
                <p className="text-sm text-muted-foreground mb-4">
                  Possible reasons: The PDF may be corrupted, password-protected, contain no extractable tables, or use unsupported formatting.
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                  Back to Dashboard
                </Button>
                <Button onClick={() => setLocation('/convert')}>
                  Try Another File
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Completed conversion with tables
  if (extractedTables.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container py-8">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Tables Found</h3>
              <p className="text-muted-foreground mb-4">
                No tables were detected in "{conversion.originalFilename}".
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                  Back to Dashboard
                </Button>
                <Button onClick={() => setLocation('/convert')}>
                  Try Another File
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-2xl font-bold truncate max-w-md">
                {conversion.originalFilename}
              </h2>
              <Badge
                variant={confidence >= 0.9 ? 'default' : confidence >= 0.7 ? 'secondary' : 'destructive'}
                className="font-normal"
              >
                {Math.round(confidence * 100)}% confidence
              </Badge>
              {conversion.pageCount && conversion.pageCount > 1 && (
                <Badge variant="outline" className="font-normal">
                  {conversion.pageCount} pages
                </Badge>
              )}
              <Badge variant="outline" className="font-normal">
                {extractedTables.length} table{extractedTables.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {conversion.xlsxStoragePath && (
                <Button
                  variant="outline"
                  onClick={() => window.open(conversion.xlsxStoragePath!, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download XLSX
                </Button>
              )}
              <Button onClick={() => setLocation('/convert')} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Convert Another
              </Button>
            </div>
          </div>

          {/* Confidence Score */}
          <ConfidenceScore
            confidence={confidence}
            tableCount={extractedTables.length}
            pageCount={conversion.pageCount || undefined}
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
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              {hasPdfData && (
                <TabsTrigger value="split" className="gap-2">
                  <Columns2 className="h-4 w-4" />
                  Split View
                </TabsTrigger>
              )}
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
                            variant={getConfidenceValue(table.confidence) >= 0.9 ? 'default' : 'secondary'}
                            className="font-normal"
                          >
                            {Math.round(getConfidenceValue(table.confidence) * 100)}%
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
                                <td
                                  colSpan={table.headers.length}
                                  className="border px-3 py-2 text-center text-muted-foreground"
                                >
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

            {hasPdfData && (
              <TabsContent value="split" className="mt-4">
                <div className="h-[700px] rounded-lg border overflow-hidden">
                  <PreviewContainer
                    pdfFile={null} // Would need stored PDF
                    extractedSheets={extractedTables}
                    defaultViewMode="split"
                  />
                </div>
              </TabsContent>
            )}

            <TabsContent value="edit" className="mt-4">
              <div className="h-[600px]">
                <SpreadsheetEditor
                  tables={extractedTables}
                  filename={conversion.originalFilename?.replace(/\.[^/.]+$/, '') || 'export'}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function Header() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useSupabaseAuth();

  return (
    <header className="bg-white dark:bg-gray-800 border-b">
      <div className="container py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg">SmartPDF Convert</span>
        </Link>

        <div className="flex items-center gap-4">
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
  );
}
