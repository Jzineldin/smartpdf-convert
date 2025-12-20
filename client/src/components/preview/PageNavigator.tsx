import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FileText, Table2 } from 'lucide-react';

interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | { overall: number };
}

interface PageNavigatorProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  sheets: ExtractedTable[];
  currentSheet: string | null;
  onSheetChange: (sheetName: string) => void;
  className?: string;
}

export default function PageNavigator({
  totalPages,
  currentPage,
  onPageChange,
  sheets,
  currentSheet,
  onSheetChange,
  className,
}: PageNavigatorProps) {
  // Build page-to-sheet mapping
  const pageToSheetMap = useMemo(() => {
    const map: Record<number, ExtractedTable[]> = {};
    sheets.forEach((sheet) => {
      const page = sheet.pageNumber;
      if (!map[page]) map[page] = [];
      map[page].push(sheet);
    });
    return map;
  }, [sheets]);

  // Get sheets from current page
  const sheetsFromCurrentPage = pageToSheetMap[currentPage] || [];

  return (
    <div className={cn('border-t bg-background', className)}>
      {/* Page thumbnails / numbers */}
      <div className="p-2 border-b overflow-visible">
        <ScrollArea className="w-full whitespace-nowrap overflow-visible">
          <div className="flex gap-1 py-1">
            {Array.from({ length: totalPages }, (_, i) => {
              const pageNum = i + 1;
              const sheetsOnPage = pageToSheetMap[pageNum] || [];
              const hasSheets = sheetsOnPage.length > 0;
              const isCurrentPage = pageNum === currentPage;

              return (
                <Button
                  key={pageNum}
                  variant={isCurrentPage ? 'default' : hasSheets ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    'relative min-w-[40px] h-10 px-2',
                    !hasSheets && !isCurrentPage && 'text-muted-foreground opacity-50'
                  )}
                >
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {pageNum}
                  </span>
                  {hasSheets && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]',
                        isCurrentPage ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'
                      )}
                    >
                      {sheetsOnPage.length}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Sheets from current page */}
      {sheetsFromCurrentPage.length > 0 && (
        <div className="p-2 overflow-x-auto">
          <div className="flex items-center gap-2 mb-2">
            <Table2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {sheetsFromCurrentPage.length} table{sheetsFromCurrentPage.length > 1 ? 's' : ''} from this page
            </span>
          </div>
          <TooltipProvider>
            <div className="flex gap-2 flex-nowrap">
              {sheetsFromCurrentPage.map((sheet) => {
                const isSelected = sheet.sheetName === currentSheet;
                const confidence = typeof sheet.confidence === 'number'
                  ? sheet.confidence
                  : sheet.confidence.overall;
                const displayName = sheet.sheetName.length > 20
                  ? sheet.sheetName.slice(0, 20) + '...'
                  : sheet.sheetName;

                return (
                  <Tooltip key={sheet.sheetName}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSheetChange(sheet.sheetName)}
                        className="gap-2 flex-shrink-0"
                      >
                        <span className="whitespace-nowrap">{displayName}</span>
                        <Badge
                          variant={confidence >= 0.9 ? 'default' : 'secondary'}
                          className="text-[10px] px-1"
                        >
                          {Math.round(confidence * 100)}%
                        </Badge>
                      </Button>
                    </TooltipTrigger>
                    {sheet.sheetName.length > 20 && (
                      <TooltipContent>
                        <p>{sheet.sheetName}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* No sheets indicator */}
      {sheetsFromCurrentPage.length === 0 && totalPages > 0 && (
        <div className="p-2 text-center">
          <span className="text-sm text-muted-foreground">
            No tables extracted from this page
          </span>
        </div>
      )}
    </div>
  );
}
