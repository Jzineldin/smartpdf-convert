# SmartPDF Convert - Extraction Quality Fix Plan

## Executive Summary

Based on analysis of the test document (KONKURRENTANALYS-TALEFORGE-SCIENCEPARK.pdf), we identified 5 critical issues with the extraction pipeline. This plan outlines targeted fixes for each issue.

---

## Issues Identified

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | Checkbox symbols corrupted (✓/□ → "%¡") | Critical | Encoding issues in PDF export, not AI extraction |
| 2 | Only 3 tables detected vs 18+ actual | Critical | AI combining unrelated tables |
| 3 | Column duplication in output | High | Different table structures forced into same format |
| 4 | Missing tables (NovelAI, Epic, etc.) | High | Incomplete extraction from multi-page doc |
| 5 | Wrong page numbers on badges | Medium | Page tracking not preserved per-table |

---

## Phase 1: Symbol Preservation (Priority: CRITICAL)

### Problem
Checkmarks (✓) and empty boxes (□) become "%¡" in the exported PDF. This suggests the issue is in `exportPdf.ts`, not the AI extraction.

### Investigation Steps
1. Check if symbols are correct in `extractedTables` data (before export)
2. Check if symbols are correct in Excel export
3. Isolate whether corruption happens in jsPDF/autoTable

### Fix: Update PDF Export Font Handling
**File:** `client/src/lib/exportPdf.ts`

```typescript
// Add before creating jsPDF instance
import { jsPDF } from 'jspdf';

// Use a font that supports Unicode symbols
// Option A: Embed a custom font with symbol support
// Option B: Convert symbols to text equivalents for PDF

function sanitizeForPdf(text: string): string {
  // Convert Unicode symbols to PDF-safe equivalents
  return text
    .replace(/✅|✓|☑/g, '[YES]')
    .replace(/❌|✗|☒/g, '[NO]')
    .replace(/□|☐/g, '[ ]')
    .replace(/■|☑/g, '[X]');
}

// Apply to all cell values before rendering
```

**Alternative (Better):** Embed a Unicode-capable font
```typescript
// Use a base64-encoded font that supports these characters
// DejaVu Sans or Noto Sans work well
doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
doc.setFont('DejaVuSans');
```

### Estimated Complexity: Low
- Single file change
- Clear problem/solution

---

## Phase 2: Table Detection Improvement (Priority: CRITICAL)

### Problem
The AI is merging unrelated tables into combined "Feature Comparison" tables. Original document has 18+ distinct competitor tables, but only 3 are detected.

### Root Cause Analysis
1. The prompt says "combine related tables" by default
2. Sample pages (max 5) may miss tables on other pages
3. AI interprets "competitor tables" as related and combines them

### Fix 2.1: Update ANALYSIS_PROMPT to Detect Table Boundaries
**File:** `server/lib/ai-extractor.ts`

Add explicit instruction to count tables accurately:

```typescript
// Add to ANALYSIS_PROMPT around line 134
CRITICAL TABLE COUNTING RULES:
1. Count EACH visually separate table as ONE table
2. Tables with different column structures are DIFFERENT tables
3. Tables separated by whitespace/text are DIFFERENT tables
4. Do NOT pre-combine tables - count them individually
5. If a page has 5 separate tables, report 5 tables

When reporting tablesDetected: count individual tables, not groups.
```

### Fix 2.2: Add "Separate Tables" as Default Option
**File:** `server/lib/ai-extractor.ts`

Update the default suggestion for combining tables:

```typescript
// In ANALYSIS_PROMPT suggestions section (around line 152)
COMPARISON/FEATURE TABLES:
If the document compares multiple products, services, or competitors:
ALWAYS ask about table structure preference.
Options: "Keep as separate tables (recommended)" | "One combined comparison table" | "Separate tables per item"
Default: "Keep as separate tables (recommended)"
```

### Fix 2.3: Update GUIDED_EXTRACTION_PROMPT
**File:** `server/lib/ai-extractor.ts`

Add explicit instruction to respect table boundaries:

```typescript
// Add to GUIDED_EXTRACTION_PROMPT
TABLE BOUNDARY RULES:
- Extract each visually distinct table as a SEPARATE table in output
- Tables with different column counts MUST be separate
- Tables about different competitors/products should be separate unless user explicitly requested combination
- If user says "Keep as separate tables", do NOT combine any tables
```

### Fix 2.4: Update SYSTEM_PROMPT (Non-Guided Extraction)
**File:** `server/lib/ai-extractor.ts`

```typescript
// Add to SYSTEM_PROMPT around line 300
CRITICAL - SEPARATE TABLE DETECTION:
- Each visually distinct table = one entry in "tables" array
- Different column structures = different tables
- Different topics/subjects = different tables
- NEVER combine tables unless they share exact same structure AND are clearly continuation
- When in doubt, keep tables separate
```

### Estimated Complexity: Medium
- Prompt engineering
- Need testing with actual document

---

## Phase 3: Column Structure Preservation (Priority: HIGH)

### Problem
When tables have different column counts, the postprocessing forces them to match, causing data duplication.

Example: A 2-column table gets stretched to 4 columns by repeating data.

### Root Cause
`postProcessTables()` in `ai-extractor.ts` lines 440-503:
- Pads short rows with nulls
- Trims long rows to match headers
- Fills empty cells from previous row (for merged cells)

The issue is the AI is already returning wrong data. The postprocess is just trying to fix broken AI output.

### Fix 3.1: Remove Aggressive Column Filling
**File:** `server/lib/ai-extractor.ts`

```typescript
function postProcessTables(tables: ExtractedTable[]): ExtractedTable[] {
  return tables.map(table => {
    const headerCount = table.headers.length;
    const processedRows: (string | null)[][] = [];

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      let row = [...table.rows[rowIndex]];

      // Only pad/trim if slightly off (±1 column)
      // If wildly different, it's likely a different table mixed in
      if (Math.abs(row.length - headerCount) > 2) {
        console.warn(`Row ${rowIndex} has ${row.length} cols but header has ${headerCount} - possible table mixing`);
      }

      // Still normalize, but don't fill from previous row
      while (row.length < headerCount) {
        row.push(null);
      }
      if (row.length > headerCount) {
        row = row.slice(0, headerCount);
      }

      // Remove the aggressive "fill from previous row" logic
      // This was causing duplication

      row = row.map(v => v === '' ? null : v);
      processedRows.push(row);
    }

    return { ...table, rows: processedRows, confidence: normalizedConfidence };
  });
}
```

### Fix 3.2: Add Warning for Mismatched Column Counts
**File:** `server/lib/ai-extractor.ts`

```typescript
// In postProcessTables, add warning detection
if (table.rows.some(row => Math.abs(row.length - headerCount) > 1)) {
  // Add a warning to the extraction result
  console.warn(`Table "${table.sheetName}" has inconsistent row lengths - may indicate table mixing`);
}
```

### Estimated Complexity: Medium
- Requires careful testing to not break merged cell handling

---

## Phase 4: Complete Table Extraction (Priority: HIGH)

### Problem
Several competitor tables are completely missing from extraction (NovelAI, Epic, ABCmouse, etc.).

### Root Cause Analysis
1. Multi-page sampling only looks at 5 pages (1, middle, last, 25%, 75%)
2. Full extraction processes all pages but AI may skip tables
3. AI may be grouping/combining and losing data

### Fix 4.1: Improve Multi-Page Extraction
**File:** `server/routers.ts`

Current sampling strategy is fine for analysis, but full extraction must ensure ALL pages are processed.

Check the `extractWithGuidance` route to ensure it processes ALL pages:

```typescript
// In conversion.extractWithGuidance route
// Verify this processes all pages, not just sample pages
for (const page of pages) {
  // Each page should be fully extracted
}
```

### Fix 4.2: Add Explicit "Extract ALL Tables" Instruction
**File:** `server/lib/ai-extractor.ts`

```typescript
// Add to GUIDED_EXTRACTION_PROMPT and SYSTEM_PROMPT
COMPLETENESS REQUIREMENT:
- You MUST extract EVERY table visible on the page
- Do not skip any tables, even small ones
- If a table has only 2 rows, still extract it
- If unsure if something is a table, extract it anyway
- Missing data is WORSE than extracting too much
```

### Fix 4.3: Add Table Count Validation
**File:** `server/lib/ai-extractor.ts`

```typescript
// After extraction, compare expected vs actual table count
function validateExtractionCompleteness(
  analysis: DocumentAnalysis,
  result: ExtractionResult
): AIWarning[] {
  const warnings: AIWarning[] = [];

  const expectedTables = analysis.analysis.tablesDetected;
  const actualTables = result.tables.length;

  if (actualTables < expectedTables * 0.7) {
    warnings.push({
      type: 'skipped_content',
      message: `Expected ~${expectedTables} tables but only extracted ${actualTables}`,
      suggestion: 'Some tables may have been missed. Consider re-extracting.',
    });
  }

  return warnings;
}
```

### Estimated Complexity: Medium
- May require UI changes to show completeness warnings

---

## Phase 5: Page Number Accuracy (Priority: MEDIUM)

### Problem
Page badges show incorrect source pages for tables.

### Root Cause Analysis
Looking at the code, page numbers are set in two places:
1. When extracting: `pageNumber: page.pageNumber`
2. When naming sheets: adds ` (P${page.pageNumber})` suffix

The issue may be that the AI returns wrong page numbers in its JSON output.

### Fix 5.1: Override AI Page Numbers with Actual Page
**File:** `server/lib/ai-extractor.ts`

```typescript
// In extractWithGuidance and extractTablesFromPDF
// Don't trust the AI's pageNumber, use the actual page we're processing

const tablesWithPageNum = result.tables.map(table => ({
  ...table,
  pageNumber: actualPageNumber, // Override whatever AI returned
}));
```

### Fix 5.2: Validate Page Numbers in Range
**File:** `server/lib/ai-extractor.ts`

```typescript
// Add validation
function validatePageNumbers(tables: ExtractedTable[], maxPage: number): ExtractedTable[] {
  return tables.map(table => ({
    ...table,
    pageNumber: Math.min(Math.max(table.pageNumber, 1), maxPage),
  }));
}
```

### Estimated Complexity: Low
- Simple validation fix

---

## Implementation Order

| Phase | Issue | Priority | Effort | Dependencies |
|-------|-------|----------|--------|--------------|
| 1 | Symbol preservation in PDF | Critical | Low | None |
| 2 | Table detection | Critical | Medium | None |
| 3 | Column structure | High | Medium | Phase 2 |
| 4 | Complete extraction | High | Medium | Phase 2 |
| 5 | Page numbers | Medium | Low | None |

### Recommended Order:
1. **Phase 1** (Symbol preservation) - Quick win, visible improvement
2. **Phase 5** (Page numbers) - Quick win, easy fix
3. **Phase 2** (Table detection) - Core fix, enables other fixes
4. **Phase 4** (Complete extraction) - Depends on better detection
5. **Phase 3** (Column structure) - Polish, may resolve itself with better detection

---

## Testing Plan

### Test Document Set
1. KONKURRENTANALYS-TALEFORGE-SCIENCEPARK.pdf (existing test)
2. A simple 1-page document with 2 tables
3. A document with checkboxes and symbols
4. A document with merged cells
5. A multi-language document

### Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Symbols preserved | "%¡" | ✓ □ ✅ ❌ |
| Tables detected | 3 | 18+ |
| Column accuracy | Duplicated | Exact match |
| Tables extracted | ~60% | >95% |
| Page accuracy | Wrong | Correct |

### Regression Tests
- Ensure existing working extractions don't break
- Test edge cases (empty tables, 1-row tables, nested tables)

---

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/lib/exportPdf.ts` | Font/encoding fix for symbols |
| `server/lib/ai-extractor.ts` | Prompt updates, postprocessing fixes |
| `server/routers.ts` | Completeness validation |

---

## Estimated Timeline

- Phase 1: 1-2 hours
- Phase 2: 2-3 hours (prompt iteration + testing)
- Phase 3: 1-2 hours
- Phase 4: 2-3 hours
- Phase 5: 30 minutes

**Total: 7-10 hours of focused work**

---

## Notes

1. The symbol corruption issue may be entirely in PDF export, not AI extraction. Need to verify symbols are correct in the raw extraction data first.

2. Most issues stem from the AI combining/interpreting rather than faithfully extracting. The fix is better prompting + validation.

3. Consider adding a "debug mode" that shows raw AI response before postprocessing for easier debugging.
