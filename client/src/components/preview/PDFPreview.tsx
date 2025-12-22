import { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  file: string | null; // Base64 string or URL
  currentPage: number;
  onPageChange: (page: number) => void;
  onLoadSuccess?: (numPages: number) => void;
  highlightArea?: { x: number; y: number; width: number; height: number } | null;
  className?: string;
}

type ZoomLevel = 'fit-width' | 'fit-page' | number;

export default function PDFPreview({
  file,
  currentPage,
  onPageChange,
  onLoadSuccess,
  highlightArea,
  className,
}: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [zoom, setZoom] = useState<ZoomLevel>('fit-width');
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageInputValue, setPageInputValue] = useState(String(currentPage));

  // Update page input when currentPage changes
  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  // Handle container resize for fit modes
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 32; // Account for padding
        setPageWidth(containerWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
    onLoadSuccess?.(numPages);
  }, [onLoadSuccess]);

  const handleDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setIsLoading(false);
    setError('Failed to load PDF. The file may be corrupted or unsupported.');
  }, []);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, numPages, onPageChange]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInputValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      onPageChange(pageNum);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  };

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const currentZoom = typeof prev === 'number' ? prev : 1;
      return Math.min(currentZoom + 0.25, 3);
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const currentZoom = typeof prev === 'number' ? prev : 1;
      return Math.max(currentZoom - 0.25, 0.25);
    });
  }, []);

  const handleFitWidth = useCallback(() => {
    setZoom('fit-width');
  }, []);

  const handleFitPage = useCallback(() => {
    setZoom('fit-page');
  }, []);

  const getPageWidth = useCallback(() => {
    if (zoom === 'fit-width') {
      return pageWidth;
    }
    if (zoom === 'fit-page') {
      // Approximate fit-page width (assumes standard page ratio)
      const containerHeight = containerRef.current?.clientHeight ?? 600;
      return Math.min(pageWidth, (containerHeight - 100) * 0.7); // Approximate A4 ratio
    }
    return pageWidth * zoom;
  }, [zoom, pageWidth]);

  // Convert base64 to data URL if needed
  const pdfSource = file
    ? file.startsWith('data:') || file.startsWith('http')
      ? file
      : `data:application/pdf;base64,${file}`
    : null;

  if (!file) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-muted/30 rounded-lg', className)}>
        <p className="text-muted-foreground">No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              className="w-12 h-8 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">/ {numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-8 w-8"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-12 text-center">
            {typeof zoom === 'number' ? `${Math.round(zoom * 100)}%` : zoom === 'fit-width' ? 'Fit W' : 'Fit P'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-8 w-8"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant={zoom === 'fit-width' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={handleFitWidth}
            className="h-8 w-8"
            title="Fit width"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant={zoom === 'fit-page' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={handleFitPage}
            className="h-8 w-8"
            title="Fit page"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 p-4"
      >
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setError(null)}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <Document
            file={pdfSource}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading PDF...</p>
                </div>
              </div>
            }
            className="flex justify-center"
          >
            <div className="relative">
              <Page
                key={`page-${currentPage}`}
                pageNumber={currentPage}
                width={getPageWidth()}
                loading={
                  <Skeleton
                    className="rounded-lg"
                    style={{ width: getPageWidth(), height: getPageWidth() * 1.4 }}
                  />
                }
                className="shadow-lg rounded-lg overflow-hidden"
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              {/* Highlight overlay for uncertain cells */}
              {highlightArea && (
                <div
                  className="absolute border-2 border-yellow-500 bg-yellow-500/20 rounded pointer-events-none transition-all"
                  style={{
                    left: `${highlightArea.x}%`,
                    top: `${highlightArea.y}%`,
                    width: `${highlightArea.width}%`,
                    height: `${highlightArea.height}%`,
                  }}
                />
              )}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
