import { useState, useCallback, useMemo, useEffect } from 'react';
import PDFPreview from './PDFPreview';
import TablePreview from './TablePreview';
import ViewToggle, { ViewMode } from './ViewToggle';
import SplitContainer from './SplitContainer';
import PageNavigator from './PageNavigator';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface UncertainCell {
  row: number;
  col: number;
  value: string;
  confidence: number;
  reason: string;
}

interface ConfidenceBreakdown {
  overall: number;
  breakdown: {
    textClarity: number;
    structureClarity: number;
    specialChars: number;
    completeness: number;
  };
  uncertainCells: UncertainCell[];
}

interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | ConfidenceBreakdown;
}

interface PreviewContainerProps {
  pdfFile: string | null; // Base64 string
  extractedSheets: ExtractedTable[];
  className?: string;
  defaultViewMode?: ViewMode;
  initialPage?: number;
  initialSheet?: string;
  onPageChange?: (page: number) => void;
  onSheetChange?: (sheetName: string) => void;
}

export default function PreviewContainer({
  pdfFile,
  extractedSheets,
  className,
  defaultViewMode = 'split',
  initialPage = 1,
  initialSheet,
  onPageChange,
  onSheetChange,
}: PreviewContainerProps) {
  // Check if sheets are from multiple source files (batch upload)
  const sourceFiles = useMemo(() => {
    const sources = new Set<string>();
    extractedSheets.forEach((sheet) => {
      // Check if sheet has sourceFile property (from batch processing)
      if ('sourceFile' in sheet && typeof (sheet as any).sourceFile === 'string') {
        sources.add((sheet as any).sourceFile);
      }
    });
    return sources;
  }, [extractedSheets]);
  const isFromMultipleSources = sourceFiles.size > 1;
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentSheet, setCurrentSheet] = useState<string | null>(
    initialSheet || extractedSheets[0]?.sheetName || null
  );
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [highlightArea, setHighlightArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // If mobile, force to table or pdf mode only (no split)
  useEffect(() => {
    if (isMobile && viewMode === 'split') {
      setViewMode('table');
    }
  }, [isMobile, viewMode]);

  // Build page-to-sheet mapping
  const pageToSheetMap = useMemo(() => {
    const map: Record<number, ExtractedTable[]> = {};
    extractedSheets.forEach((sheet) => {
      const page = sheet.pageNumber;
      if (!map[page]) map[page] = [];
      map[page].push(sheet);
    });
    return map;
  }, [extractedSheets]);

  // When user selects a sheet, sync PDF to that page
  const handleSheetChange = useCallback((sheetName: string) => {
    setCurrentSheet(sheetName);
    onSheetChange?.(sheetName);

    const sheet = extractedSheets.find(s => s.sheetName === sheetName);
    if (sheet) {
      setCurrentPage(sheet.pageNumber);
      onPageChange?.(sheet.pageNumber);
    }
  }, [extractedSheets, onSheetChange, onPageChange]);

  // When user changes PDF page, update current sheet
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);

    // Find sheets from this page and select the first one
    const sheetsFromPage = pageToSheetMap[page] || [];
    if (sheetsFromPage.length > 0) {
      setCurrentSheet(sheetsFromPage[0].sheetName);
      onSheetChange?.(sheetsFromPage[0].sheetName);
    }
  }, [pageToSheetMap, onPageChange, onSheetChange]);

  // Handle PDF load success
  const handlePdfLoadSuccess = useCallback((numPages: number) => {
    setPdfPageCount(numPages);
  }, []);

  // Handle cell hover - could be used for PDF highlight
  const handleCellHover = useCallback((cell: { row: number; col: number } | null) => {
    // For now, just clear highlight when not hovering
    // Future: Could add position data from extraction metadata
    if (!cell) {
      setHighlightArea(null);
    }
  }, []);

  // Handle cell click - navigate to PDF page
  const handleCellClick = useCallback((cell: { row: number; col: number; pageNumber: number }) => {
    setCurrentPage(cell.pageNumber);
    onPageChange?.(cell.pageNumber);
  }, [onPageChange]);

  // Available modes based on what's loaded
  const availableModes = useMemo(() => {
    const modes: ViewMode[] = [];
    if (pdfFile) modes.push('pdf');
    if (extractedSheets.length > 0) modes.push('table');
    if (pdfFile && extractedSheets.length > 0 && !isMobile) {
      modes.push('split');
      // Overlay mode is advanced - uncomment to enable
      // modes.push('overlay');
    }
    return modes;
  }, [pdfFile, extractedSheets, isMobile]);

  // Ensure view mode is valid
  useEffect(() => {
    if (!availableModes.includes(viewMode)) {
      setViewMode(availableModes[0] || 'table');
    }
  }, [availableModes, viewMode]);

  // Update current sheet when sheets change (e.g., initial load)
  useEffect(() => {
    if (!currentSheet && extractedSheets.length > 0) {
      setCurrentSheet(extractedSheets[0].sheetName);
    }
  }, [extractedSheets, currentSheet]);

  const totalPages = pdfPageCount || Math.max(...extractedSheets.map(s => s.pageNumber), 0);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* View mode toggle */}
      <div className="flex items-center justify-between p-2 border-b bg-background">
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          availableModes={availableModes}
        />
        {viewMode === 'split' && !isFromMultipleSources && (
          <span className="text-xs text-muted-foreground hidden md:inline">
            Drag the divider to resize panels
          </span>
        )}
      </div>

      {/* Batch upload notice */}
      {isFromMultipleSources && viewMode === 'split' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-amber-700 dark:text-amber-300">
            Viewing first PDF from batch. Tables are from {sourceFiles.size} different files.
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <SplitContainer
          mode={viewMode}
          leftPanel={
            <PDFPreview
              file={pdfFile}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onLoadSuccess={handlePdfLoadSuccess}
              highlightArea={highlightArea}
              className="h-full"
            />
          }
          rightPanel={
            <TablePreview
              sheets={extractedSheets}
              currentSheet={currentSheet}
              onSheetChange={handleSheetChange}
              onCellHover={handleCellHover}
              onCellClick={handleCellClick}
              className="h-full"
            />
          }
          className="h-full"
        />
      </div>

      {/* Bottom navigation bar */}
      {totalPages > 0 && (
        <PageNavigator
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          sheets={extractedSheets}
          currentSheet={currentSheet}
          onSheetChange={handleSheetChange}
        />
      )}
    </div>
  );
}
