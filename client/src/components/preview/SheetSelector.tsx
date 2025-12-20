import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Table2 } from 'lucide-react';

interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | { overall: number };
}

interface SheetSelectorProps {
  sheets: ExtractedTable[];
  currentSheet: string | null;
  onSheetChange: (sheetName: string) => void;
  className?: string;
}

export default function SheetSelector({
  sheets,
  currentSheet,
  onSheetChange,
  className,
}: SheetSelectorProps) {
  if (sheets.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Table2 className="h-4 w-4" />
        No tables extracted
      </div>
    );
  }

  const selectedSheet = sheets.find(s => s.sheetName === currentSheet);
  const confidence = selectedSheet
    ? typeof selectedSheet.confidence === 'number'
      ? selectedSheet.confidence
      : selectedSheet.confidence.overall
    : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Table2 className="h-4 w-4 text-muted-foreground" />
      <Select value={currentSheet || undefined} onValueChange={onSheetChange}>
        <SelectTrigger className="w-[200px] h-8">
          <SelectValue placeholder="Select a sheet" />
        </SelectTrigger>
        <SelectContent>
          {sheets.map((sheet) => {
            const sheetConfidence = typeof sheet.confidence === 'number'
              ? sheet.confidence
              : sheet.confidence.overall;

            return (
              <SelectItem key={sheet.sheetName} value={sheet.sheetName}>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[120px]">{sheet.sheetName}</span>
                  <span className="text-muted-foreground text-xs">
                    (Page {sheet.pageNumber})
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {currentSheet && (
        <Badge
          variant={confidence >= 0.9 ? 'default' : 'secondary'}
          className="text-xs"
        >
          {Math.round(confidence * 100)}%
        </Badge>
      )}
    </div>
  );
}
