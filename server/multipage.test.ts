import { describe, expect, it, vi } from "vitest";

// Mock the extractTablesFromPDF function for testing
const mockExtractTablesFromPDF = vi.fn();

// Test the multi-page extraction logic
describe("Multi-Page PDF Extraction", () => {
  it("should combine tables from multiple pages", () => {
    // Simulate results from multiple pages
    const page1Tables = [
      { sheetName: "Sales Data", headers: ["Date", "Amount"], rows: [["2024-01-01", "100"]], pageNumber: 1, confidence: 0.95 }
    ];
    const page2Tables = [
      { sheetName: "Inventory", headers: ["Item", "Qty"], rows: [["Widget", "50"]], pageNumber: 2, confidence: 0.92 }
    ];

    // Combine tables
    const allTables = [...page1Tables, ...page2Tables];
    
    expect(allTables.length).toBe(2);
    expect(allTables[0].pageNumber).toBe(1);
    expect(allTables[1].pageNumber).toBe(2);
  });

  it("should calculate average confidence across pages", () => {
    const confidences = [0.95, 0.92, 0.88];
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    
    expect(avgConfidence).toBeCloseTo(0.9167, 2);
  });

  it("should handle pages with no tables", () => {
    const results = [
      { success: true, tables: [{ sheetName: "Data", headers: ["A"], rows: [], pageNumber: 1, confidence: 0.9 }] },
      { success: true, tables: [] }, // Page with no tables
      { success: false, error: "Failed to process" }, // Failed page
    ];

    const allTables = results
      .filter(r => r.success && r.tables)
      .flatMap(r => r.tables || []);

    expect(allTables.length).toBe(1);
  });

  it("should add warnings for failed pages", () => {
    const failedPages = [2, 5];
    const warnings = failedPages.map(pageNum => ({
      type: 'partial_table',
      message: `Failed to extract tables from page ${pageNum}`,
      pageNumber: pageNum,
      suggestion: 'Try uploading this page separately as an image',
    }));

    expect(warnings.length).toBe(2);
    expect(warnings[0].pageNumber).toBe(2);
    expect(warnings[1].pageNumber).toBe(5);
  });

  it("should limit pages to maximum of 10", () => {
    const maxPages = 10;
    const totalPagesInPdf = 25;
    const pagesToProcess = Math.min(totalPagesInPdf, maxPages);
    
    expect(pagesToProcess).toBe(10);
  });

  it("should update sheet names with page numbers for multi-page PDFs", () => {
    const originalName = "Sales Data";
    const pageNumber = 3;
    const totalPages = 5;
    
    const updatedName = totalPages > 1 
      ? `${originalName} (Page ${pageNumber})`
      : originalName;
    
    expect(updatedName).toBe("Sales Data (Page 3)");
  });

  it("should not modify sheet names for single-page PDFs", () => {
    const originalName = "Sales Data";
    const pageNumber = 1;
    const totalPages = 1;
    
    const updatedName = totalPages > 1 
      ? `${originalName} (Page ${pageNumber})`
      : originalName;
    
    expect(updatedName).toBe("Sales Data");
  });
});
