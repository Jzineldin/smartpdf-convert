import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert Unicode symbols to PDF-safe text equivalents.
 * jsPDF's default Helvetica font doesn't support Unicode symbols,
 * so we convert them to readable text that renders correctly.
 */
function sanitizeForPdf(text: string | null): string {
  if (text === null || text === undefined) return '';

  return String(text)
    // Checkmarks / Yes indicators -> [YES]
    .replace(/✅|✓|☑|☑️|✔|✔️/g, '[YES]')
    // X marks / No indicators -> [NO]
    .replace(/❌|✗|✘|☒|❎|✖|✖️/g, '[NO]')
    // Empty checkboxes -> [ ]
    .replace(/□|☐|▢/g, '[ ]')
    // Filled boxes -> [X]
    .replace(/■|▣|◼|◾/g, '[X]')
    // Bullets
    .replace(/•/g, '-')
    .replace(/◦|◯|○/g, 'o')
    .replace(/●|◉/g, '*')
    // Common arrows
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    // Math symbols that might cause issues
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    // Keep currency symbols (these usually work)
    // €, $, £, ¥ typically render fine
    // Clean up any other problematic characters
    .replace(/[^\x00-\x7F€£¥°]/g, (char) => {
      // If we encounter other non-ASCII chars, try to keep common ones
      // or replace with placeholder
      const commonChars = 'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ';
      if (commonChars.includes(char)) return char;
      return '?';
    });
}

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
  sourceFile?: string;
}

// Helper to get confidence as a number
const getConfidenceValue = (confidence: number | ConfidenceBreakdown): number => {
  if (typeof confidence === 'number') {
    return confidence;
  }
  return confidence.overall;
};

export function exportToPdf(tables: ExtractedTable[], filename: string): void {
  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  // Colors
  const primaryBlue = [59, 130, 246]; // Tailwind blue-500
  const headerBg = [241, 245, 249]; // Tailwind slate-100
  const textDark = [30, 41, 59]; // Tailwind slate-800
  const textMuted = [100, 116, 139]; // Tailwind slate-500

  // Document title
  doc.setFontSize(20);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Extracted Data', margin, currentY);
  currentY += 8;

  // Subtitle with filename and date
  doc.setFontSize(10);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'normal');
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Source: ${filename} | Exported: ${exportDate}`, margin, currentY);
  currentY += 10;

  // Divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // Iterate through tables
  tables.forEach((table, index) => {
    // Check if we need a new page (leave room for at least header + a few rows)
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = margin;
    }

    // Table title
    doc.setFontSize(14);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(table.sheetName, margin, currentY);

    // Page and confidence badges (inline with title)
    const confidence = getConfidenceValue(table.confidence);
    const confidencePercent = Math.round(confidence * 100);
    const badgeText = `Page ${table.pageNumber}  |  ${confidencePercent}% confidence`;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Calculate badge position (right side of title)
    const titleWidth = doc.getTextWidth(table.sheetName);
    const badgeX = margin + titleWidth + 10;

    // Badge background
    const badgeWidth = doc.getTextWidth(badgeText) + 6;
    doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    doc.roundedRect(badgeX - 3, currentY - 4, badgeWidth, 6, 1, 1, 'F');

    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(badgeText, badgeX, currentY);

    currentY += 8;

    // Source file if present (for batch uploads)
    if (table.sourceFile) {
      doc.setFontSize(8);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(`Source: ${table.sourceFile}`, margin, currentY);
      currentY += 5;
    }

    // Create table using autoTable
    // Sanitize headers and cells for PDF rendering (convert Unicode symbols to text)
    const sanitizedHeaders = table.headers.map(h => sanitizeForPdf(h));
    const sanitizedBody = table.rows.map(row => row.map(cell => sanitizeForPdf(cell)));

    autoTable(doc, {
      startY: currentY,
      head: [sanitizedHeaders],
      body: sanitizedBody,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // slate-50
      },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.1,
      didDrawPage: (data) => {
        // Add page number footer
        const pageNumber = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(
          `Page ${pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      },
    });

    // Get the final Y position after the table
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });

  // Add branding footer on last page
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    'Generated by SmartPDF Convert | smartpdf-convert.com',
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  );

  // Save the PDF
  const sanitizedFilename = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  doc.save(`${sanitizedFilename}-extracted.pdf`);
}
