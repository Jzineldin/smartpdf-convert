import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import DropZone from '@/components/upload/DropZone';
import ProcessingStatus, { ProcessingStep } from '@/components/upload/ProcessingStatus';
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor';
import AnalysisDialog from '@/components/analysis/AnalysisDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, ArrowLeft, Zap, AlertTriangle, CheckCircle, RotateCcw, Edit3, Eye, Crown, Plus, Files, Info, Loader2, Columns2, Maximize2, Minimize2 } from 'lucide-react';
import { PreviewContainer } from '@/components/preview';
import TemplateSelector from '@/components/templates/TemplateSelector';
import { cn } from '@/lib/utils';
import ConfidenceScore from '@/components/results/ConfidenceScore';
import { toast } from 'sonner';

// Removed localStorage caching - each session starts fresh
// History is available in dashboard for logged-in users

// ConfidenceBreakdown type for detailed confidence info
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

interface TableWithSource extends ExtractedTable {
  sourceFile: string;
}

// Helper to get confidence as a number (handles both formats)
const getConfidenceValue = (confidence: number | ConfidenceBreakdown): number => {
  if (typeof confidence === 'number') {
    return confidence;
  }
  return confidence.overall;
};

interface AIWarning {
  type: string;
  message: string;
  pageNumber?: number;
  suggestion: string;
}

// Analysis types matching server definitions
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

export default function Convert() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useSupabaseAuth();
  const [processingStep, setProcessingStep] = useState<ProcessingStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedTables, setExtractedTables] = useState<ExtractedTable[] | null>(null);
  const [warnings, setWarnings] = useState<AIWarning[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [conversionId, setConversionId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'split' | 'edit'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Store the original PDF file for split view
  const [originalPdfBase64, setOriginalPdfBase64] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const [fileName, setFileName] = useState<string>('converted-tables');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('generic');
  const [isTryingSample, setIsTryingSample] = useState<boolean>(false);

  // Batch upload state (Pro feature)
  const [accumulatedTables, setAccumulatedTables] = useState<TableWithSource[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // Pending file(s) from landing page
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; size: number; type: string; base64: string }> | null>(null);

  // Intelligent analysis flow state
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysis | null>(null);
  const [currentFileData, setCurrentFileData] = useState<{ base64: string; mimeType: string; name: string; size: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const { data: usageData } = trpc.conversion.checkUsage.useQuery();
  const { data: templatesData } = trpc.conversion.getTemplates.useQuery();
  const processMutation = trpc.conversion.process.useMutation();
  const analyzeMutation = trpc.conversion.analyze.useMutation();
  const extractWithGuidanceMutation = trpc.conversion.extractWithGuidance.useMutation();

  // Check if user has Pro access (or TESTING_MODE is enabled)
  const isPro = templatesData?.userIsPro ?? false;

  // Each visit to /convert starts fresh - no localStorage caching
  // History is available in the Dashboard for logged-in users
  useEffect(() => {
    // Clean up any old localStorage cache from previous versions
    localStorage.removeItem('smartpdf_last_conversion');
  }, []);

  // Check for pending file(s) from landing page
  useEffect(() => {
    try {
      // Check for multiple files first (Pro feature)
      const pendingMultiple = sessionStorage.getItem('pendingFiles');
      if (pendingMultiple) {
        const filesData = JSON.parse(pendingMultiple);
        if (Array.isArray(filesData) && filesData.length > 0) {
          setPendingFiles(filesData);
          setFileName(`${filesData.length} files ready`);
          sessionStorage.removeItem('pendingFiles');
          toast.info(`${filesData.length} files ready - select a template and click Convert`);
          return;
        }
      }

      // Check for single file
      const pending = sessionStorage.getItem('pendingFile');
      if (pending) {
        const fileData = JSON.parse(pending);
        setPendingFile(fileData);
        setFileName(fileData.name);
        sessionStorage.removeItem('pendingFile');
        toast.info(`"${fileData.name}" ready - select a template and click Convert`);
      }
    } catch (e) {
      sessionStorage.removeItem('pendingFile');
      sessionStorage.removeItem('pendingFiles');
    }
  }, []);


  // Process the pending file from landing page
  const processPendingFile = useCallback(async () => {
    if (!pendingFile) return;

    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setViewMode('preview');

    // Check usage limit
    if (usageData && !usageData.allowed) {
      setError(usageData.message || 'Usage limit exceeded');
      return;
    }

    // Store PDF for split view preview (pending files are usually PDFs)
    const isPdf = pendingFile.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setOriginalPdfBase64(pendingFile.base64);
    } else {
      setOriginalPdfBase64(null);
    }

    setProcessingStep('upload');

    try {
      setProcessingStep('analyze');

      const result = await processMutation.mutateAsync({
        fileBase64: pendingFile.base64,
        fileName: pendingFile.name,
        fileSize: pendingFile.size,
        mimeType: 'application/pdf',
        templateId: selectedTemplate,
      });

      if (result.success && result.tables) {
        // Redirect to Results page for persistent viewing
        if (result.conversionId) {
          setLocation(`/results/${result.conversionId}`);
          return;
        }

        // Fallback: show results inline if no conversion ID
        setProcessingStep('ready');
        setExtractedTables(result.tables);
        const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
        setWarnings(validWarnings);
        setConfidence(result.confidence || 0);
        setConversionId(result.conversionId || null);
        setPageCount(result.pageCount);

        // Clear pending file
        setPendingFile(null);
      } else {
        setError(result.error || 'No tables could be extracted');
        setProcessingStep('ready');
      }
    } catch (err) {
      console.error('Conversion error:', err);
      setError('Failed to process document. Please try again.');
      setProcessingStep('ready');
    }
  }, [pendingFile, usageData, selectedTemplate, processMutation]);

  // Process pending multiple files from landing page (Pro feature)
  const processPendingFiles = useCallback(async () => {
    if (!pendingFiles || pendingFiles.length === 0) return;

    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setViewMode('preview');

    // Check usage limit
    if (usageData && !usageData.allowed) {
      setError(usageData.message || 'Usage limit exceeded');
      return;
    }

    // Clear previous batch
    setAccumulatedTables([]);
    setProcessedFiles([]);

    // Generate a batch ID for grouping these uploads
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setCurrentBatchId(batchId);

    // Store the first PDF for split view preview
    const firstPdf = pendingFiles.find(f =>
      f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (firstPdf) {
      setOriginalPdfBase64(firstPdf.base64);
    } else {
      setOriginalPdfBase64(null);
    }

    const allTables: TableWithSource[] = [];
    const allWarnings: AIWarning[] = [];
    let totalConfidence = 0;
    let failedFiles: string[] = [];

    setProcessingStep('upload');
    toast.info(`Processing ${pendingFiles.length} files...`);

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileData = pendingFiles[i];

      try {
        setFileName(`Processing ${i + 1}/${pendingFiles.length}: ${fileData.name}`);
        setProcessingStep('analyze');

        const result = await processMutation.mutateAsync({
          fileBase64: fileData.base64,
          fileName: fileData.name,
          fileSize: fileData.size,
          mimeType: fileData.type || 'application/pdf',
          templateId: selectedTemplate,
          batchId: batchId,
        });

        if (result.success && result.tables) {
          const tablesWithSource: TableWithSource[] = result.tables.map((t) => {
            const shortFileName = fileData.name.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '').slice(0, 12);
            let sheetName = pendingFiles.length > 1
              ? `${t.sheetName.slice(0, 17)}-${shortFileName}`
              : t.sheetName;
            if (sheetName.length > 31) {
              sheetName = sheetName.slice(0, 31);
            }
            return { ...t, sheetName, sourceFile: fileData.name };
          });

          allTables.push(...tablesWithSource);
          totalConfidence += result.confidence || 0;

          const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
          allWarnings.push(...validWarnings);

          setProcessedFiles(prev => [...prev, fileData.name]);
        } else {
          failedFiles.push(fileData.name);
        }
      } catch (err: any) {
        console.error(`Failed to process ${fileData.name}:`, err);
        failedFiles.push(fileData.name);
      }
    }

    // Set final results
    setProcessingStep('ready');
    setAccumulatedTables(allTables);
    setExtractedTables(allTables);
    setWarnings(allWarnings);
    setConfidence(allTables.length > 0 ? totalConfidence / (pendingFiles.length - failedFiles.length) : 0);
    setFileName(pendingFiles.length > 1 ? 'combined-export' : pendingFiles[0].name);

    // Clear pending files
    setPendingFiles(null);

    if (failedFiles.length > 0) {
      toast.warning(`${failedFiles.length} file(s) failed to process: ${failedFiles.join(', ')}`);
    }

    if (allTables.length > 0) {
      toast.success(`Extracted ${allTables.length} table(s) from ${pendingFiles.length - failedFiles.length} file(s)!`);
    } else {
      setError('No tables could be extracted from any of the files');
    }
  }, [pendingFiles, usageData, selectedTemplate, processMutation]);

  // Handle multiple files at once (Pro feature)
  const handleMultipleFilesSelect = useCallback(async (files: Array<{ file: File; base64: string }>) => {
    if (!isPro || files.length === 0) return;

    setError(null);
    setExtractedTables(null);
    setWarnings([]);
    setViewMode('preview');
    setPendingFile(null);

    // Check usage limit
    if (usageData && !usageData.allowed) {
      setError(usageData.message || 'Usage limit exceeded');
      return;
    }

    // Clear previous batch
    setAccumulatedTables([]);
    setProcessedFiles([]);

    // Generate a batch ID for grouping these uploads
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setCurrentBatchId(batchId);

    // Store the first PDF for split view preview
    const firstPdf = files.find(f =>
      f.file.type === 'application/pdf' || f.file.name.toLowerCase().endsWith('.pdf')
    );
    if (firstPdf) {
      setOriginalPdfBase64(firstPdf.base64);
    } else {
      setOriginalPdfBase64(null);
    }

    const allTables: TableWithSource[] = [];
    const allWarnings: AIWarning[] = [];
    let totalConfidence = 0;
    let failedFiles: string[] = [];

    setProcessingStep('upload');
    toast.info(`Processing ${files.length} files...`);

    for (let i = 0; i < files.length; i++) {
      const { file, base64 } = files[i];

      try {
        setFileName(`Processing ${i + 1}/${files.length}: ${file.name}`);
        setProcessingStep('analyze');

        const result = await processMutation.mutateAsync({
          fileBase64: base64,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/pdf',
          templateId: selectedTemplate,
          batchId: batchId,
        });

        if (result.success && result.tables) {
          // Add source file to each table
          const tablesWithSource: TableWithSource[] = result.tables.map((t, idx) => {
            const shortFileName = file.name.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '').slice(0, 12);
            let sheetName = files.length > 1
              ? `${t.sheetName.slice(0, 17)}-${shortFileName}`
              : t.sheetName;
            // Ensure sheet name is within Excel's 31 char limit
            if (sheetName.length > 31) {
              sheetName = sheetName.slice(0, 31);
            }
            return { ...t, sheetName, sourceFile: file.name };
          });

          allTables.push(...tablesWithSource);
          totalConfidence += result.confidence || 0;

          // Collect warnings
          const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
          allWarnings.push(...validWarnings);

          setProcessedFiles(prev => [...prev, file.name]);
        } else {
          failedFiles.push(file.name);
        }
      } catch (err: any) {
        console.error(`Failed to process ${file.name}:`, err);
        failedFiles.push(file.name);
      }
    }

    // Set final results
    setProcessingStep('ready');
    setAccumulatedTables(allTables);
    setExtractedTables(allTables);
    setWarnings(allWarnings);
    setConfidence(allTables.length > 0 ? totalConfidence / (files.length - failedFiles.length) : 0);
    setFileName(files.length > 1 ? 'combined-export' : files[0].file.name);

    if (failedFiles.length > 0) {
      toast.warning(`${failedFiles.length} file(s) failed to process: ${failedFiles.join(', ')}`);
    }

    if (allTables.length > 0) {
      toast.success(`Extracted ${allTables.length} table(s) from ${files.length - failedFiles.length} file(s)!`);
    } else {
      setError('No tables could be extracted from any of the files');
    }
  }, [isPro, usageData, processMutation, selectedTemplate]);

  const handleFileSelect = useCallback(async (file: File, base64: string) => {
    setError(null);
    // Don't clear accumulated tables for Pro users adding more files
    if (!isPro || processedFiles.length === 0) {
      setExtractedTables(null);
    }
    setWarnings([]);
    setViewMode('preview');
    setFileName(file.name);

    // Check usage limit
    if (usageData && !usageData.allowed) {
      setError(usageData.message || 'Usage limit exceeded');
      return;
    }

    const mimeType = file.type || 'application/pdf';
    const isPdfFile = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    // Store file data for later extraction
    setCurrentFileData({
      base64,
      mimeType,
      name: file.name,
      size: file.size,
    });

    // Store PDF for split view preview (only for PDF files)
    if (isPdfFile) {
      setOriginalPdfBase64(base64);
    } else {
      setOriginalPdfBase64(null);
    }

    setProcessingStep('upload');
    setIsAnalyzing(true);

    try {
      // NEW: Analyze document first to get questions and suggestions
      setProcessingStep('analyze');
      toast.info('Analyzing your document...');

      const analysisRes = await analyzeMutation.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
        mimeType,
      });

      console.log('Analysis response:', analysisRes);
      setIsAnalyzing(false);

      if (analysisRes.success && analysisRes.analysis) {
        console.log('Analysis successful, showing dialog:', analysisRes.analysis);
        // Show analysis dialog
        setAnalysisResult(analysisRes.analysis);
        setProcessingStep(null); // Clear processing step to show dialog
        toast.success('Document analyzed! Review the details and extract.');
      } else {
        console.log('Analysis failed or no analysis returned:', analysisRes);
        // Analysis failed - fall back to quick extraction
        console.log('Analysis unavailable, falling back to quick extraction');
        toast.info('Proceeding with quick extraction...');

        setProcessingStep('extract');

        const result = await processMutation.mutateAsync({
          fileBase64: base64,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          templateId: selectedTemplate,
        });

        if (!result.success) {
          setProcessingStep('error');
          setError(result.error || 'Processing failed');
          return;
        }

        // Redirect to Results page for persistent viewing
        if (result.conversionId) {
          toast.success(`Extracted ${result.tables?.length || 0} table(s)!`);
          setLocation(`/results/${result.conversionId}`);
          return;
        }

        // Fallback: show results inline
        setProcessingStep('ready');
        setExtractedTables(result.tables || []);
        const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
        setWarnings(validWarnings);
        setConfidence(result.confidence || 0);
        setConversionId(result.conversionId || null);
        setPageCount(result.pageCount || undefined);
        setCurrentFileData(null);

        toast.success(`Extracted ${result.tables?.length || 0} table(s)!`);
      }
    } catch (err: any) {
      setIsAnalyzing(false);
      setProcessingStep('error');
      setError(err.message || 'An unexpected error occurred');
    }
  }, [usageData, analyzeMutation, processMutation, isPro, processedFiles, selectedTemplate]);

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

      // Store PDF for split view if sample is a PDF
      const isPdf = sampleFileName.toLowerCase().endsWith('.pdf') || blob.type === 'application/pdf';
      if (isPdf) {
        setOriginalPdfBase64(base64);
      } else {
        setOriginalPdfBase64(null);
      }

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
      // Ensure warnings array has valid objects with message property
      const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
      setWarnings(validWarnings);
      setConfidence(result.confidence || 0);
      setConversionId(result.conversionId || null);
      setPageCount(result.pageCount || undefined);

      toast.success(`Sample processed! See what ${templateId.replace('-', ' ')} template can do.`);
    } catch (err: any) {
      setProcessingStep('error');
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsTryingSample(false);
    }
  }, [processMutation]);

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
    // Clear batch state
    setAccumulatedTables([]);
    setProcessedFiles([]);
    setCurrentBatchId(null);
    // Clear any pending files
    setPendingFile(null);
    setPendingFiles(null);
    // Clear analysis state
    setAnalysisResult(null);
    setCurrentFileData(null);
    setIsAnalyzing(false);
    setIsExtracting(false);
    // Clear PDF for split view
    setOriginalPdfBase64(null);
  };

  // Handler for guided extraction after analysis dialog
  const handleGuidedExtract = useCallback(async (guidance: UserGuidance) => {
    if (!currentFileData) return;

    setIsExtracting(true);
    setError(null);

    try {
      const result = await extractWithGuidanceMutation.mutateAsync({
        fileBase64: currentFileData.base64,
        fileName: currentFileData.name,
        fileSize: currentFileData.size,
        mimeType: currentFileData.mimeType,
        guidance,
      });

      if (result.success && result.tables) {
        // Redirect to Results page for persistent viewing
        if (result.conversionId) {
          toast.success(`Extracted ${result.tables.length} table(s) with your preferences!`);
          setLocation(`/results/${result.conversionId}`);
          return;
        }

        // Fallback: show results inline
        setProcessingStep('ready');
        setExtractedTables(result.tables);
        const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
        setWarnings(validWarnings);
        setConfidence(result.confidence || 0);
        setConversionId(result.conversionId || null);
        setPageCount(result.pageCount);

        // Clear analysis state
        setAnalysisResult(null);
        setCurrentFileData(null);

        toast.success(`Extracted ${result.tables.length} table(s) with your preferences!`);
      } else {
        setError(result.error || 'No tables could be extracted');
        setProcessingStep('ready');
      }
    } catch (err: any) {
      console.error('Guided extraction error:', err);
      setError(err.message || 'Failed to extract data. Please try again.');
      setProcessingStep('ready');
    } finally {
      setIsExtracting(false);
    }
  }, [currentFileData, selectedTemplate, extractWithGuidanceMutation]);

  // Handler for quick extraction (skip analysis dialog)
  const handleQuickExtract = useCallback(async () => {
    if (!currentFileData) return;

    setIsExtracting(true);
    setAnalysisResult(null);
    setError(null);

    try {
      setProcessingStep('extract');

      const result = await processMutation.mutateAsync({
        fileBase64: currentFileData.base64,
        fileName: currentFileData.name,
        fileSize: currentFileData.size,
        mimeType: currentFileData.mimeType,
        templateId: selectedTemplate,
      });

      if (result.success && result.tables) {
        // Redirect to Results page for persistent viewing
        if (result.conversionId) {
          toast.success(`Extracted ${result.tables.length} table(s)!`);
          setLocation(`/results/${result.conversionId}`);
          return;
        }

        // Fallback: show results inline
        setProcessingStep('ready');
        setExtractedTables(result.tables);
        const validWarnings = (result.warnings || []).filter((w: AIWarning) => w && typeof w.message === 'string');
        setWarnings(validWarnings);
        setConfidence(result.confidence || 0);
        setConversionId(result.conversionId || null);
        setPageCount(result.pageCount);

        // Clear file data
        setCurrentFileData(null);

        toast.success(`Extracted ${result.tables.length} table(s)!`);
      } else {
        setError(result.error || 'No tables could be extracted');
        setProcessingStep('ready');
      }
    } catch (err: any) {
      console.error('Quick extraction error:', err);
      setError(err.message || 'Failed to extract data. Please try again.');
      setProcessingStep('ready');
    } finally {
      setIsExtracting(false);
    }
  }, [currentFileData, selectedTemplate, processMutation]);

  // Pro feature: Add another file to the batch
  const handleAddAnotherFile = () => {
    // Keep accumulated tables but clear current view to show DropZone
    setExtractedTables(null);
    setProcessingStep(null);
    setError(null);
    setWarnings([]);
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
        {!processingStep && !extractedTables && !analysisResult && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Batch mode indicator for Pro users adding more files */}
            {isPro && processedFiles.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Files className="h-5 w-5 text-blue-600" />
                      <div>
                        <span className="font-medium">Adding to batch:</span>
                        <span className="text-muted-foreground ml-2">
                          {processedFiles.length} file{processedFiles.length > 1 ? 's' : ''} already processed ({accumulatedTables.length} tables)
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleReset}>
                      Start Fresh Instead
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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

            {/* File Upload or Pending File(s) */}
            {pendingFiles && pendingFiles.length > 0 ? (
              <Card className="border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <Files className="h-10 w-10 text-green-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{pendingFiles.length} files ready</p>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {pendingFiles.map(f => f.name).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setPendingFiles(null)}
                      >
                        Remove All
                      </Button>
                      <Button
                        onClick={processPendingFiles}
                        className="gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Convert All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : pendingFile ? (
              <Card className="border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-10 w-10 text-green-600" />
                      <div>
                        <p className="font-medium">{pendingFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(pendingFile.size / 1024 / 1024).toFixed(2)} MB - Ready to convert
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setPendingFile(null)}
                      >
                        Remove
                      </Button>
                      <Button
                        onClick={processPendingFile}
                        className="gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Convert Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <DropZone
                onFileSelect={handleFileSelect}
                allowMultiple={isPro}
                onMultipleFilesSelect={handleMultipleFilesSelect}
              />
            )}

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

        {/* Analysis Dialog - Show after document analysis */}
        {analysisResult && !extractedTables && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Document Analysis Complete</h2>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            </div>
            {analysisResult.analysis ? (
              <AnalysisDialog
                analysis={analysisResult}
                fileName={fileName}
                onExtract={handleGuidedExtract}
                onQuickExtract={handleQuickExtract}
                isExtracting={isExtracting}
              />
            ) : (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground mb-4">
                  Analysis completed but data structure was unexpected. Proceeding with quick extraction...
                </p>
                <Button onClick={handleQuickExtract} disabled={isExtracting}>
                  {isExtracting ? 'Extracting...' : 'Quick Extract'}
                </Button>
              </Card>
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
              <div className="flex items-center gap-4 flex-wrap">
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
                {/* Pro batch mode indicator */}
                {isPro && processedFiles.length > 1 && (
                  <Badge variant="secondary" className="font-normal gap-1">
                    <Files className="h-3 w-3" />
                    {processedFiles.length} files • {accumulatedTables.length} tables
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Pro: Add Another File button */}
                {isPro && (
                  <Button onClick={handleAddAnotherFile} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Another File
                  </Button>
                )}
                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {isPro && processedFiles.length > 0 ? 'Start Fresh' : 'Convert Another'}
                </Button>
              </div>
            </div>

            {/* Confidence Score */}
            <ConfidenceScore 
              confidence={confidence} 
              tableCount={extractedTables.length}
              pageCount={pageCount}
            />

            {/* Info Messages (fallback extraction) */}
            {warnings && warnings.length > 0 && warnings.some(w => w.message?.includes('No tables detected')) && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Info className="h-5 w-5" />
                    Smart Extraction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    No traditional tables were detected in this document. The AI analyzed the content and extracted all structured data as Field/Value pairs.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Warnings (excluding info messages) */}
            {warnings && warnings.filter(w => !w.message?.includes('No tables detected')).length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    Quality Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {warnings.filter(w => !w.message?.includes('No tables detected')).map((warning, index) => (
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
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'preview' | 'split' | 'edit')}>
              <TabsList>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </TabsTrigger>
                {originalPdfBase64 && (
                  <TabsTrigger value="split" className="gap-2">
                    <Columns2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Split View</span>
                    <span className="sm:hidden">Split</span>
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

              {/* Split View - PDF side by side with extracted data */}
              <TabsContent value="split" className="mt-4">
                <div className={cn(
                  'relative rounded-lg border overflow-hidden transition-all',
                  isFullscreen
                    ? 'fixed inset-0 z-50 rounded-none'
                    : 'h-[calc(100vh-280px)] min-h-[500px]'
                )}>
                  {/* Fullscreen toggle button */}
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="gap-1 shadow-md"
                    >
                      {isFullscreen ? (
                        <>
                          <Minimize2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Exit Fullscreen</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Fullscreen</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <PreviewContainer
                    pdfFile={originalPdfBase64}
                    extractedSheets={extractedTables}
                    defaultViewMode="split"
                  />
                </div>
              </TabsContent>

              <TabsContent value="edit" className="mt-4">
                <div className="h-[600px]">
                  <SpreadsheetEditor
                    tables={isPro && accumulatedTables.length > 0 ? accumulatedTables : extractedTables}
                    filename={isPro && processedFiles.length > 1 ? 'combined-export' : fileName}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Pro batch feature CTA for free users */}
            {!isPro && (
              <Card className="border-dashed border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className="h-6 w-6 text-amber-500" />
                      <div>
                        <span className="font-medium">Pro Feature:</span>
                        <span className="text-muted-foreground ml-2">
                          Combine multiple files into one Excel workbook
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setLocation('/pricing')}>
                      Upgrade to Pro
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upgrade CTA for free users running low */}
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
                      Upgrade to Pro — $29/mo
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

        {/* Debug: Unexpected state fallback */}
        {!processingStep && !extractedTables && !analysisResult && !pendingFile && !pendingFiles && processedFiles.length === 0 && (
          <div className="max-w-md mx-auto text-center p-8">
            <p className="text-muted-foreground mb-4">
              Ready to convert your documents. Select a template and upload a file above.
            </p>
            {isAnalyzing && (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Analyzing document...</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
