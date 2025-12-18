import * as XLSX from 'xlsx';
import type { ExtractedTable } from './openrouter';

export interface SpreadsheetData {
  sheets: {
    name: string;
    data: (string | number | null)[][];
  }[];
}

// Convert extracted tables to Excel workbook buffer
export function tablesToExcel(tables: ExtractedTable[]): Buffer {
  const workbook = XLSX.utils.book_new();

  tables.forEach((table, index) => {
    // Combine headers and rows
    const sheetData = [table.headers, ...table.rows];
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Auto-size columns
    const colWidths = table.headers.map((header, colIndex) => {
      let maxWidth = header.length;
      table.rows.forEach(row => {
        const cellValue = row[colIndex];
        if (cellValue && String(cellValue).length > maxWidth) {
          maxWidth = String(cellValue).length;
        }
      });
      return { wch: Math.min(maxWidth + 2, 50) };
    });
    worksheet['!cols'] = colWidths;

    // Use sheet name or generate one
    const sheetName = table.sheetName || `Sheet${index + 1}`;
    // Ensure sheet name is valid (max 31 chars, no special chars)
    const validSheetName = sheetName.substring(0, 31).replace(/[\\/*?[\]]/g, '_');
    
    XLSX.utils.book_append_sheet(workbook, worksheet, validSheetName);
  });

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

// Convert spreadsheet data (from editor) to Excel buffer
export function spreadsheetDataToExcel(data: SpreadsheetData): Buffer {
  const workbook = XLSX.utils.book_new();

  data.sheets.forEach(sheet => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
    
    // Auto-size columns based on content
    if (sheet.data.length > 0) {
      const colWidths = sheet.data[0].map((_, colIndex) => {
        let maxWidth = 10;
        sheet.data.forEach(row => {
          const cellValue = row[colIndex];
          if (cellValue && String(cellValue).length > maxWidth) {
            maxWidth = String(cellValue).length;
          }
        });
        return { wch: Math.min(maxWidth + 2, 50) };
      });
      worksheet['!cols'] = colWidths;
    }

    const validSheetName = sheet.name.substring(0, 31).replace(/[\\/*?[\]]/g, '_');
    XLSX.utils.book_append_sheet(workbook, worksheet, validSheetName);
  });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Parse Excel file to get data
export function parseExcelFile(buffer: Buffer): SpreadsheetData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  const sheets = workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][];
    return { name, data };
  });

  return { sheets };
}
