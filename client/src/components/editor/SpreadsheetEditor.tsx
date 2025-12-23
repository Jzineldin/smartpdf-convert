import { useState, useEffect, useCallback } from 'react';
import { Workbook } from "@fortune-sheet/react";

// FortuneSheet data type
type SheetData = any;
import "@fortune-sheet/react/dist/index.css";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Button } from '@/components/ui/button';
import { Download, Copy, Check, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportToPdf } from '@/lib/exportPdf';

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

export interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | ConfidenceBreakdown;
}

interface SpreadsheetEditorProps {
  tables: ExtractedTable[];
  filename: string;
  onExport?: () => void;
  showPdfExport?: boolean;
}

/**
 * Truncate sheet name to Excel's 31-character limit
 * Also removes invalid characters: \ / ? * [ ]
 */
function sanitizeSheetName(name: string, index: number): string {
  const MAX_SHEET_NAME_LENGTH = 31;

  // Remove invalid Excel sheet name characters
  let sanitized = name.replace(/[\\/?*[\]]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // If empty after sanitization, use default
  if (!sanitized) {
    return `Sheet${index + 1}`;
  }

  // Truncate if too long, leaving room for potential suffix
  if (sanitized.length > MAX_SHEET_NAME_LENGTH) {
    // Truncate and add ellipsis indicator
    sanitized = sanitized.substring(0, MAX_SHEET_NAME_LENGTH - 1) + '…';
  }

  return sanitized;
}

/**
 * Convert extracted AI tables to FortuneSheet format
 */
function convertToFortuneSheet(tables: ExtractedTable[]): SheetData[] {
  // Track used names to avoid duplicates
  const usedNames = new Set<string>();

  return tables.map((table, index) => {
    const celldata: any[] = [];

    // Headers (bold with background)
    table.headers.forEach((header, colIndex) => {
      celldata.push({
        r: 0,
        c: colIndex,
        v: { v: header || '', bl: 1, bg: "#f3f4f6" }
      });
    });

    // Data rows
    table.rows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        celldata.push({
          r: rowIndex + 1,
          c: colIndex,
          v: { v: cell ?? '' }
        });
      });
    });

    // Calculate dimensions for proper FortuneSheet initialization
    const rowCount = table.rows.length + 1; // +1 for header
    const colCount = table.headers.length;

    // Sanitize and deduplicate sheet name
    let sheetName = sanitizeSheetName(table.sheetName || `Sheet${index + 1}`, index);

    // Handle duplicate names by adding suffix
    let baseName = sheetName;
    let counter = 2;
    while (usedNames.has(sheetName)) {
      const suffix = ` (${counter})`;
      const maxBaseLength = 31 - suffix.length;
      baseName = sanitizeSheetName(table.sheetName || `Sheet${index + 1}`, index);
      if (baseName.length > maxBaseLength) {
        baseName = baseName.substring(0, maxBaseLength);
      }
      sheetName = baseName + suffix;
      counter++;
    }
    usedNames.add(sheetName);

    return {
      name: sheetName,
      celldata,
      row: Math.max(rowCount, 50), // Minimum 50 rows for scrolling
      column: Math.max(colCount, 26), // Minimum 26 columns (A-Z)
      config: {
        rowlen: { 0: 30 },
        columnlen: {},
      },
      // Set initial selection to avoid NaN issue
      luckysheet_select_save: [{
        row: [0, 0],
        column: [0, 0],
        row_focus: 0,
        column_focus: 0,
      }],
    } as SheetData;
  });
}

/**
 * Extract cell value from FortuneSheet cell object
 */
function extractCellValue(cell: any): { value: any; bold?: boolean; bg?: string } {
  if (cell === null || cell === undefined) {
    return { value: '' };
  }

  if (typeof cell === 'object' && cell !== null) {
    // FortuneSheet cell object can have: v (value), m (display text), bl (bold), bg (background)
    const value = cell.v ?? cell.m ?? '';
    return {
      value,
      bold: cell.bl === 1,
      bg: cell.bg,
    };
  }

  // Primitive value
  return { value: cell };
}

/**
 * Export FortuneSheet data to Excel file
 * FortuneSheet can store data in two formats:
 * 1. celldata array (initial format)
 * 2. data 2D array (after editing)
 */
async function exportToExcel(sheets: SheetData[], filename: string = "converted_data.xlsx") {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name || 'Sheet');

    // FortuneSheet stores data in 'data' array after editing, or 'celldata' initially
    if (sheet.data && Array.isArray(sheet.data)) {
      // Handle 2D array format (after editing)
      // IMPORTANT: Iterate through ALL indices, not just defined ones
      for (let rowIndex = 0; rowIndex < sheet.data.length; rowIndex++) {
        const row = sheet.data[rowIndex];
        if (!row || !Array.isArray(row)) continue;

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex];
          const { value, bold, bg } = extractCellValue(cell);

          // Only skip truly empty cells (empty string after extraction)
          if (value === '' || value === null || value === undefined) continue;

          const excelCell = worksheet.getCell(rowIndex + 1, colIndex + 1);
          excelCell.value = value;

          if (bold) {
            excelCell.font = { bold: true };
          }
          if (bg) {
            excelCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: String(bg).replace("#", "FF") }
            };
          }
        }
      }
    } else if (sheet.celldata && Array.isArray(sheet.celldata)) {
      // Handle celldata format (initial)
      for (const cell of sheet.celldata) {
        if (cell.r === undefined || cell.c === undefined) continue;

        const { value, bold, bg } = extractCellValue(cell.v);

        // Only skip truly empty cells
        if (value === '' || value === null || value === undefined) continue;

        const excelCell = worksheet.getCell(cell.r + 1, cell.c + 1);
        excelCell.value = value;

        if (bold) {
          excelCell.font = { bold: true };
        }
        if (bg) {
          excelCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: String(bg).replace("#", "FF") }
          };
        }
      }
    }

    // Auto-width columns
    worksheet.columns.forEach(col => {
      col.width = 15;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, filename);
}

/**
 * Copy all data to clipboard as tab-separated values
 * Handles both FortuneSheet data formats
 */
function copyToClipboard(sheets: SheetData[]) {
  const allText: string[] = [];
  
  for (const sheet of sheets) {
    // Handle 2D array format (after editing)
    if (sheet.data && Array.isArray(sheet.data)) {
      const rows: string[] = [];
      sheet.data.forEach((row: any[]) => {
        if (!row) return;
        const cells = row.map((cell: any) => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'object') return String(cell.v ?? cell.m ?? '');
          return String(cell);
        });
        rows.push(cells.join('\t'));
      });
      allText.push(`=== ${sheet.name || 'Sheet'} ===\n${rows.join('\n')}`);
      continue;
    }
    
    // Handle celldata format (initial)
    const celldata = sheet.celldata || [];
    
    // Find max rows and cols
    let maxRow = 0, maxCol = 0;
    for (const cell of celldata) {
      if (cell.r !== undefined && cell.r > maxRow) maxRow = cell.r;
      if (cell.c !== undefined && cell.c > maxCol) maxCol = cell.c;
    }
    
    // Create a 2D array
    const grid: string[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      grid[r] = [];
      for (let c = 0; c <= maxCol; c++) {
        grid[r][c] = '';
      }
    }
    
    // Fill in values
    for (const cell of celldata) {
      if (cell.r === undefined || cell.c === undefined) continue;
      const cellValue = cell.v;
      if (typeof cellValue === 'object' && cellValue !== null) {
        grid[cell.r][cell.c] = String(cellValue.v ?? '');
      } else {
        grid[cell.r][cell.c] = String(cellValue ?? '');
      }
    }
    
    // Convert to tab-separated string
    const sheetText = grid.map(row => row.join('\t')).join('\n');
    allText.push(`=== ${sheet.name || 'Sheet'} ===\n${sheetText}`);
  }
  
  return allText.join('\n\n');
}

export default function SpreadsheetEditor({ tables, filename, onExport, showPdfExport = true }: SpreadsheetEditorProps) {
  const [data, setData] = useState<SheetData[]>([]);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (tables && tables.length > 0) {
      const fortuneData = convertToFortuneSheet(tables);
      setData(fortuneData);
    }
  }, [tables]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // Ensure filename ends with .xlsx
      let exportFilename = filename.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '');
      if (!exportFilename.endsWith('.xlsx')) {
        exportFilename += '.xlsx';
      }
      await exportToExcel(data, exportFilename);
      toast.success('Excel file downloaded successfully!');
      if (onExport) {
        onExport();
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export Excel file');
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, onExport]);

  const handleCopy = useCallback(async () => {
    try {
      const text = copyToClipboard(data);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Data copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy to clipboard');
    }
  }, [data]);

  const handlePdfExport = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      await exportToPdf(tables, filename);
      toast.success('PDF file downloaded successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF file');
    } finally {
      setIsExportingPdf(false);
    }
  }, [tables, filename]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 dark:bg-gray-800">
        <span className="font-medium text-sm truncate max-w-[200px]" title={filename}>
          {filename}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All
              </>
            )}
          </Button>
          {showPdfExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePdfExport}
              disabled={isExportingPdf}
              className="gap-2"
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {isExportingPdf ? 'Exporting...' : 'Download PDF'}
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? 'Exporting...' : 'Export XLSX'}
          </Button>
        </div>
      </div>
      
      {/* FortuneSheet Editor */}
      <div className="flex-1 min-h-[400px]">
        <Workbook
          data={data}
          onChange={setData}
          showToolbar={true}
          showFormulaBar={true}
          showSheetTabs={true}
        />
      </div>
    </div>
  );
}
