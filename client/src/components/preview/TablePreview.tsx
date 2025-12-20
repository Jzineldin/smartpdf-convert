import { useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import SheetSelector from './SheetSelector';

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

interface TablePreviewProps {
  sheets: ExtractedTable[];
  currentSheet: string | null;
  onSheetChange: (sheetName: string) => void;
  onCellHover?: (cell: { row: number; col: number } | null) => void;
  onCellClick?: (cell: { row: number; col: number; pageNumber: number }) => void;
  className?: string;
  maxRows?: number;
}

export default function TablePreview({
  sheets,
  currentSheet,
  onSheetChange,
  onCellHover,
  onCellClick,
  className,
  maxRows,
}: TablePreviewProps) {
  const selectedSheet = useMemo(() => {
    if (!currentSheet) return sheets[0] || null;
    return sheets.find(s => s.sheetName === currentSheet) || sheets[0] || null;
  }, [sheets, currentSheet]);

  const uncertainCells = useMemo(() => {
    if (!selectedSheet) return [];
    if (typeof selectedSheet.confidence === 'object' && selectedSheet.confidence.uncertainCells) {
      return selectedSheet.confidence.uncertainCells;
    }
    return [];
  }, [selectedSheet]);

  const uncertainCellMap = useMemo(() => {
    const map = new Map<string, UncertainCell>();
    uncertainCells.forEach(cell => {
      map.set(`${cell.row}-${cell.col}`, cell);
    });
    return map;
  }, [uncertainCells]);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    onCellHover?.({ row, col });
  }, [onCellHover]);

  const handleCellMouseLeave = useCallback(() => {
    onCellHover?.(null);
  }, [onCellHover]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (selectedSheet) {
      onCellClick?.({ row, col, pageNumber: selectedSheet.pageNumber });
    }
  }, [selectedSheet, onCellClick]);

  if (!selectedSheet) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-muted-foreground">No tables extracted</p>
      </div>
    );
  }

  const confidence = typeof selectedSheet.confidence === 'number'
    ? selectedSheet.confidence
    : selectedSheet.confidence.overall;

  const displayRows = maxRows ? selectedSheet.rows.slice(0, maxRows) : selectedSheet.rows;
  const hasMoreRows = maxRows && selectedSheet.rows.length > maxRows;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with sheet selector */}
      <div className="flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <SheetSelector
          sheets={sheets}
          currentSheet={currentSheet}
          onSheetChange={onSheetChange}
        />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-normal">
            Page {selectedSheet.pageNumber}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {selectedSheet.rows.length} rows
          </Badge>
        </div>
      </div>

      {/* Table content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 min-w-0">
          <div className="overflow-x-auto rounded-lg border">
            <TooltipProvider>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted">
                    {selectedSheet.headers.map((header, i) => (
                      <th
                        key={i}
                        className="border-b px-3 py-2 text-left font-medium whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {row.map((cell, cellIndex) => {
                        const uncertainCell = uncertainCellMap.get(`${rowIndex}-${cellIndex}`);
                        const isUncertain = !!uncertainCell;

                        return (
                          <td
                            key={cellIndex}
                            className={cn(
                              'border-b px-3 py-2 cursor-pointer',
                              isUncertain && 'bg-yellow-50 dark:bg-yellow-900/20'
                            )}
                            onMouseEnter={() => handleCellMouseEnter(rowIndex, cellIndex)}
                            onMouseLeave={handleCellMouseLeave}
                            onClick={() => handleCellClick(rowIndex, cellIndex)}
                          >
                            {isUncertain ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <span>{cell ?? ''}</span>
                                    <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-medium">
                                      {Math.round(uncertainCell.confidence * 100)}% confident
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {uncertainCell.reason}
                                    </p>
                                    <p className="text-xs text-blue-500">
                                      Click to view in PDF
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span>{cell ?? ''}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {hasMoreRows && (
                    <tr>
                      <td
                        colSpan={selectedSheet.headers.length}
                        className="border-b px-3 py-2 text-center text-muted-foreground bg-muted/30"
                      >
                        ... and {selectedSheet.rows.length - maxRows!} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TooltipProvider>
          </div>

          {/* Uncertain cells summary */}
          {uncertainCells.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">
                  {uncertainCells.length} cell{uncertainCells.length > 1 ? 's' : ''} need review
                </span>
                <span className="text-muted-foreground">
                  - Click highlighted cells to compare with original PDF
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
