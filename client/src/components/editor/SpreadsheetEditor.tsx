import { useState, useEffect, useCallback } from 'react';
import { Workbook } from "@fortune-sheet/react";

// FortuneSheet data type
type SheetData = any;
import "@fortune-sheet/react/dist/index.css";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Button } from '@/components/ui/button';
import { Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number;
}

interface SpreadsheetEditorProps {
  tables: ExtractedTable[];
  filename: string;
  onExport?: () => void;
}

/**
 * Convert extracted AI tables to FortuneSheet format
 */
function convertToFortuneSheet(tables: ExtractedTable[]): SheetData[] {
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
    
    return {
      name: table.sheetName || `Sheet${index + 1}`,
      celldata,
      config: {
        rowlen: { 0: 30 },
        columnlen: {},
      },
    } as SheetData;
  });
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
      sheet.data.forEach((row: any[], rowIndex: number) => {
        if (!row) return;
        row.forEach((cell: any, colIndex: number) => {
          if (cell === null || cell === undefined) return;
          const excelCell = worksheet.getCell(rowIndex + 1, colIndex + 1);
          
          if (typeof cell === 'object' && cell !== null) {
            excelCell.value = cell.v ?? cell.m ?? '';
            if (cell.bl === 1) {
              excelCell.font = { bold: true };
            }
            if (cell.bg) {
              excelCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: String(cell.bg).replace("#", "FF") }
              };
            }
          } else {
            excelCell.value = cell;
          }
        });
      });
    } else if (sheet.celldata && Array.isArray(sheet.celldata)) {
      // Handle celldata format (initial)
      for (const cell of sheet.celldata) {
        if (cell.r === undefined || cell.c === undefined) continue;
        const excelCell = worksheet.getCell(cell.r + 1, cell.c + 1);
        const cellValue = cell.v;
        
        if (typeof cellValue === 'object' && cellValue !== null) {
          excelCell.value = cellValue.v ?? '';
          if (cellValue.bl === 1) {
            excelCell.font = { bold: true };
          }
          if (cellValue.bg) {
            excelCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: String(cellValue.bg).replace("#", "FF") }
            };
          }
        } else {
          excelCell.value = cellValue ?? '';
        }
      }
    }
    
    // Auto-width columns
    worksheet.columns.forEach(col => {
      col.width = 15;
    });
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), filename);
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

export default function SpreadsheetEditor({ tables, filename, onExport }: SpreadsheetEditorProps) {
  const [data, setData] = useState<SheetData[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tables && tables.length > 0) {
      const fortuneData = convertToFortuneSheet(tables);
      setData(fortuneData);
    }
  }, [tables]);

  const handleExport = useCallback(async () => {
    try {
      const exportFilename = filename.replace(/\.(pdf|png|jpg|jpeg)$/i, '.xlsx');
      await exportToExcel(data, exportFilename);
      toast.success('Excel file downloaded successfully!');
      if (onExport) {
        onExport();
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export Excel file');
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
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export XLSX
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
