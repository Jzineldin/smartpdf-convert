// Intelligent Document Extraction with Analysis-First Flow
// Supports both Google AI Studio (free) and OpenRouter as fallback

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const USE_GOOGLE_AI = !!GOOGLE_AI_API_KEY;
const GOOGLE_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

// ============================================
// TYPE DEFINITIONS
// ============================================

// Analysis phase types
export interface DetectedTablePreview {
  name: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  previewRows: (string | null)[][];
}

export interface DocumentAnalysis {
  analysis: {
    documentType: string;
    pageCount: number;
    tablesDetected: number;
    tablesPerPage?: { page: number; tables: number; description?: string }[];
    languages: string[];
    complexity: 'low' | 'medium' | 'high';
    estimatedExtractionTime: string;
  };
  detectedTables?: DetectedTablePreview[];
  questions: AnalysisQuestion[];
  suggestions: Suggestion[];
  warnings: string[];
}

export interface AnalysisQuestion {
  id: string;
  category: 'symbols' | 'structure' | 'content' | 'output';
  question: string;
  options?: string[];
  context: string;
  default?: string;
}

export interface Suggestion {
  id: string;
  text: string;
  action: string;
  accepted?: boolean;
}

// Extraction mode types - determines how AI extracts data
export type ExtractionMode =
  | 'invoice_extract'
  | 'bank_extract'
  | 'expense_extract'
  | 'inventory_extract'
  | 'sales_extract'
  | 'table_extract'
  | 'clean_summarize';

// User guidance types
export interface UserGuidance {
  answers: Record<string, string>;
  acceptedSuggestions: string[];
  freeformInstructions?: string;
  outputPreferences?: OutputPreferences;
  extractionMode?: ExtractionMode;
}

export interface OutputPreferences {
  combineRelatedTables: boolean;
  outputLanguage: 'auto' | 'english' | 'swedish' | 'german' | 'spanish' | 'french';
  skipDiagrams: boolean;
  skipImages: boolean;
  symbolMapping?: Record<string, string>;
}

// Confidence types
export interface ConfidenceBreakdown {
  overall: number;
  breakdown: {
    textClarity: number;
    structureClarity: number;
    specialChars: number;
    completeness: number;
  };
  uncertainCells: UncertainCell[];
}

export interface UncertainCell {
  row: number;
  col: number;
  value: string;
  confidence: number;
  reason: string;
}

// Table and extraction types
export interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | ConfidenceBreakdown;
}

export interface AIWarning {
  type: 'low_resolution' | 'merged_cells' | 'handwriting' | 'skewed' | 'partial_table' | 'mixed_languages' | 'inconsistent_format' | 'skipped_content' | 'special_chars_uncertain' | 'structure_ambiguous';
  message: string;
  pageNumber?: number;
  suggestion: string;
}

export interface ExtractionResult {
  success: boolean;
  tables: ExtractedTable[];
  warnings: AIWarning[];
  confidence: number;
  processingTime: number;
  error?: string;
  errorCode?: string;
  appliedGuidance?: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize confidence value to 0-1 range
 * AI sometimes returns 0-100 or 0-1, this normalizes to 0-1
 */
function normalizeConfidence(confidence: number | undefined): number {
  if (confidence === undefined || confidence === null) return 0.9;
  // If confidence is > 1, assume it's 0-100 scale and convert
  if (confidence > 1) {
    return Math.min(confidence / 100, 1);
  }
  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Smart sheet name truncation that preserves meaningful content
 * Excel sheet names are limited to 31 characters
 */
function smartTruncateSheetName(name: string, suffix: string = ''): string {
  const maxLength = 31;
  const availableLength = maxLength - suffix.length;

  if (name.length <= availableLength) {
    return name + suffix;
  }

  // Try to truncate at word boundary
  let truncated = name.substring(0, availableLength);

  // Find the last space to avoid cutting mid-word
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > availableLength * 0.6) {
    // Only use word boundary if we keep at least 60% of the length
    truncated = truncated.substring(0, lastSpace);
  }

  // Remove trailing special characters
  truncated = truncated.replace(/[\s\-_.,]+$/, '');

  return truncated + suffix;
}

// ============================================
// PROMPTS
// ============================================

const ANALYSIS_PROMPT = `You are a document analysis AI. Your job is to analyze a document and ask clarifying questions BEFORE extraction.

IMPORTANT: DO NOT extract data yet. Only analyze and generate questions.
NOTE: You may be shown SAMPLE PAGES from a multi-page document (not all pages). Look for patterns that might appear throughout.

ANALYZE THE DOCUMENT FOR:
1. Document type (invoice, report, spreadsheet, form, ID, contract, receipt, etc.)
2. Number of tables and structured data sections
3. Languages present in the document
4. Special symbols that may need interpretation (□ ■ ✓ ✗ ● ○ etc.)
5. Complex layouts that need user guidance
6. Content that might be skipped (ASCII diagrams, charts, decorative elements)
7. Image quality issues that may affect extraction

=== CRITICAL TABLE COUNTING RULES ===
When counting "tablesDetected", follow these rules STRICTLY:
1. Count EACH visually separate table as ONE table
2. Tables with DIFFERENT column structures = DIFFERENT tables (count separately)
3. Tables separated by whitespace, headings, or text = DIFFERENT tables
4. A table about "Product A" and another about "Product B" = 2 SEPARATE tables
5. Do NOT pre-group or combine tables in your count - count them individually
6. If a page has 5 separate bordered/structured data sections, report 5 tables
7. COUNT TABLES ACROSS ALL PAGES SHOWN - add up tables from each page
8. For multi-page documents: Page 1 has 3 tables + Page 2 has 2 tables = 5 total tables

COLUMN COUNTING:
- Count the ACTUAL number of columns in each table
- Include ALL columns, even narrow ones (checkboxes, numbers, dates)
- A table header with "Feature | Product A | Product B | Product C | Notes" = 5 columns
- Don't skip columns just because they contain short values or symbols

Example: A competitive analysis with sections for 6 different competitors = 6+ tables, NOT 1

DETECTED TABLES PREVIEW:
For EACH table you detect, provide:
- name: A descriptive name for the table (e.g., "Invoice Items", "Transaction History")
- pageNumber: Which page the table is on
- rowCount: Estimated number of data rows (excluding header)
- columnCount: EXACT number of columns (count ALL columns!)
- headers: The ACTUAL column headers from the document (extract the real text)
- previewRows: First 2-3 rows of ACTUAL data from the table (extract the real values)

CRITICAL: Extract REAL data from the document for headers and previewRows, not placeholders!
=== END TABLE COUNTING RULES ===

=== PROACTIVE QUESTIONS - ALWAYS ASK IF PATTERNS DETECTED ===

CHECKBOX/SYMBOL PATTERNS:
If you see ANY of these symbols: □ ■ ☐ ☑ ○ ● ◯ ◉ - ✓ ✗ x X ▢ ▣
ALWAYS generate a question asking what they represent, even if you think you know.
Options should include: "Yes/supported → ✅" | "No/not supported → ❌" | "Keep original symbols"

COMPARISON/FEATURE TABLES:
If the document compares multiple products, services, or competitors:
ALWAYS ask about table structure preference.
Options: "Keep as separate tables (recommended)" | "Combine into one comparison table" | "Keep original structure as-is"
Default: "Keep as separate tables (recommended)"

IMPORTANT: Each competitor/product section with its own data = separate table. Do NOT combine unless user explicitly requests it.

EMPTY/BLANK CELLS:
If tables have many empty or blank cells:
ALWAYS ask what empty cells mean.
Options: "No data available" | "Same as cell above (merged)" | "Not applicable" | "Keep empty"

ASCII ART/DIAGRAMS:
If you detect ASCII diagrams, positioning charts, or text-based graphics:
ALWAYS ask whether to skip them.
Options: "Skip diagrams (recommended)" | "Try to extract as table" | "Keep as text"

MULTIPLE DATE/NUMBER FORMATS:
If you see inconsistent date formats (MM/DD vs DD/MM) or number formats (1,000 vs 1.000):
Ask about standardization preference.

=== END PROACTIVE QUESTIONS ===

GENERATE ADDITIONAL QUESTIONS WHEN YOU SEE:
- Multiple possible ways to structure the output
- Tables that could logically be combined or should stay separate
- Content where it's unclear if it should be included
- Headers that are ambiguous or span multiple rows

QUESTION LIMITS:
- Ask 2-5 questions maximum
- Proactive questions (checkbox symbols, etc.) take priority
- Always provide a sensible default option
- Group related questions if possible

QUESTION CATEGORIES:
- symbols: Questions about what symbols/characters mean
- structure: Questions about how to organize tables
- content: Questions about what to include/exclude
- output: Questions about format preferences

OUTPUT FORMAT (JSON only, no markdown):
{
  "analysis": {
    "documentType": "Competitive Analysis Report",
    "pageCount": 2,
    "tablesDetected": 5,
    "tablesPerPage": [
      { "page": 1, "tables": 3, "description": "Header info and 2 data tables" },
      { "page": 2, "tables": 2, "description": "Continuation tables" }
    ],
    "languages": ["English"],
    "complexity": "medium",
    "estimatedExtractionTime": "10-15 seconds"
  },
  "detectedTables": [
    {
      "name": "Invoice Header",
      "pageNumber": 1,
      "rowCount": 5,
      "columnCount": 4,
      "headers": ["Description", "Quantity", "Unit Price", "Amount"],
      "previewRows": [
        ["Website Design", "1", "$2,500", "$2,500"],
        ["Development", "40 hrs", "$100", "$4,000"]
      ]
    },
    {
      "name": "Payment Summary",
      "pageNumber": 1,
      "rowCount": 3,
      "columnCount": 2,
      "headers": ["Item", "Value"],
      "previewRows": [
        ["Subtotal", "$6,500"],
        ["Tax (8%)", "$520"]
      ]
    }
  ],
  "questions": [
    {
      "id": "symbols_checkbox",
      "category": "symbols",
      "question": "I see □ symbols in the feature comparison. What do they represent?",
      "options": [
        "Checkmarks meaning 'yes' or 'supported' → convert to ✅",
        "Empty boxes meaning 'no' or 'not supported' → convert to ❌",
        "Keep as □ symbols (no conversion)"
      ],
      "context": "The document has a comparison matrix with □ appearing in feature cells.",
      "default": "Checkmarks meaning 'yes' or 'supported' → convert to ✅"
    }
  ],
  "suggestions": [
    {
      "id": "combine_tables",
      "text": "Found 3 related pricing tables. I can combine these into one comparison table.",
      "action": "Combine into one table with a 'Source' column"
    }
  ],
  "warnings": [
    "Some text appears slightly blurry - extraction may have minor errors"
  ],
  "uncertainPatterns": [
    {
      "pattern": "□ checkbox symbols",
      "pagesDetected": [7, 8],
      "count": 45,
      "likelyMeaning": "yes/no indicators in feature matrix"
    }
  ]
}

IMPORTANT: The "uncertainPatterns" array should list ANY symbols, formats, or structures you noticed that MIGHT need clarification, even if you didn't generate a question for them. This helps the UI warn users about potential issues.

If the document is simple with no ambiguities:
{
  "analysis": { ... },
  "questions": [],
  "suggestions": [],
  "warnings": [],
  "uncertainPatterns": []
}`;

const GUIDED_EXTRACTION_PROMPT = `You are a precise data extraction AI. Extract data according to the user's specific instructions provided below.

=== USER GUIDANCE ===
{USER_GUIDANCE_PLACEHOLDER}
=== END USER GUIDANCE ===

Apply ALL user instructions above during extraction. This includes:
- Symbol interpretations (convert symbols as specified)
- Table structure preferences (combine or separate as specified)
- Content inclusion/exclusion (skip what user said to skip)
- Output format preferences

=== CRITICAL TABLE EXTRACTION RULES ===
1. Extract EVERY visually distinct table as a SEPARATE entry in the "tables" array
2. Tables with different column counts MUST be separate tables
3. Tables about different subjects/items (competitors, products) = SEPARATE tables
4. If user says "keep separate" or "separate tables", do NOT combine ANY tables
5. Only combine tables if user EXPLICITLY requested combination AND tables have identical structure
6. COMPLETENESS IS CRITICAL: Missing tables is WORSE than extracting extra tables
7. When in doubt, keep tables separate
=== END TABLE RULES ===

SHEET NAMING (MAX 25 CHARS):
- Use short but DESCRIPTIVE names that uniquely identify each table
- For competitor analysis: use competitor/product name (e.g., "Canva", "Jasper AI", "NovelAI")
- EACH table MUST have a UNIQUE name - never use generic names like "Table 1", "Data", "Sheet1"
- If multiple tables about similar topics, differentiate by content (e.g., "Canva Features", "Canva Pricing")
- Add page suffix only for multi-page documents with same-named tables

PRESERVE SPECIAL CHARACTERS (unless user specified conversion):
- Checkmarks: ✅ ✓ ☑ → keep as-is OR convert per user instruction
- X marks: ❌ ✗ ☒ → keep as-is OR convert per user instruction
- All currency symbols: $ € £ ¥ kr SEK → always preserve exactly
- All mathematical symbols: ± × ÷ ≈ ≠ ≤ ≥ % → always preserve exactly
- Subscripts: O₂ CO₂ H₂O → keep subscript digits (₀₁₂₃₄₅₆₇₈₉)
- Superscripts: m³ km² → keep superscript digits (⁰¹²³⁴⁵⁶⁷⁸⁹)
- Em-dash: — → keep as — (not - or ?)

NUMBER FORMAT PRESERVATION:
- Keep number formats EXACTLY as shown (do NOT convert 2,340 to 2.340 or vice versa)
- European format 1.000,50 and US format 1,000.50 must be preserved as-is

MERGED/SPANNING CELLS:
- REPEAT the value in EVERY row it spans
- Count headers FIRST - every row needs EXACTLY that many columns
- NEVER use empty string "" - use null ONLY for truly empty cells

HEADERS MUST HAVE DATA:
- A table is NOT just headers - every table MUST include the data rows below it
- If you see a header row followed by data rows, they are ONE table together
- NEVER extract just headers without the data rows beneath them
- Section headings are NOT table headers - look for the actual column headers AND data

TOTALS/SUMMARY SECTIONS - KEEP SEPARATE:
- If a table has line items AND a totals/summary section below it, create TWO separate tables:
  1. "Items" or main table with the line items
  2. "Totals" or "Summary" table with subtotal, tax, total rows
- Common totals indicators: "Subtotal", "Tax", "Total", "Sum", "Grand Total", "Amount Due"
- Do NOT append totals rows to item tables - they have different column structures
- If totals appear in a separate visual area (footer, box, different alignment), make it a separate table

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Feature Comparison",
      "pageNumber": 1,
      "headers": ["Feature", "Product A", "Product B"],
      "rows": [
        ["AI Generation", "✅", "❌"],
        ["Video", "✅", "✅"]
      ],
      "confidence": 94
    }
  ],
  "warnings": [],
  "overallConfidence": 94,
  "appliedGuidance": [
    "Converted □ symbols to ✅ as requested",
    "Combined tables as requested"
  ]
}

VALIDATION BEFORE OUTPUT:
1. Verify all user instructions were applied
2. Count headers, verify each row has same column count
3. Check no empty strings "" exist (use null)
4. Ensure symbols converted correctly per user instruction`;

const SYSTEM_PROMPT = `You are a precise data extraction AI. Extract ALL tables from PDF images and return them as structured JSON.

=== CRITICAL - SEPARATE TABLE DETECTION ===
1. Each visually distinct table = ONE entry in "tables" array
2. Tables with different column structures = DIFFERENT tables (never combine)
3. Tables about different topics/subjects = DIFFERENT tables
4. Tables separated by text, headings, or whitespace = DIFFERENT tables
5. NEVER combine tables unless they are clearly a continuation with identical columns
6. When in doubt, keep tables SEPARATE
7. COMPLETENESS: Extract EVERY table you see - missing data is worse than extra tables

Example: A document with info about 6 different competitors = 6+ separate tables in output
=== END SEPARATE TABLE RULES ===

SHEET NAMING (MAX 25 CHARS):
- Use short but DESCRIPTIVE names that uniquely identify each table
- For competitor/product analysis: use the item name (e.g., "Canva", "Jasper AI", "NovelAI")
- EACH table MUST have a UNIQUE name - never use generic names like "Table 1", "Data"
- If extracting multiple tables from same category, differentiate them (e.g., "Features", "Pricing", "Overview")
- Never exceed 25 characters before automatic page suffix

CRITICAL - PRESERVE ALL SPECIAL CHARACTERS EXACTLY:
- Checkmarks: ✅ ✓ ☑ → keep exactly as-is
- X marks: ❌ ✗ ☒ ✘ → keep exactly as-is
- Boxes: □ ■ ☐ → keep exactly as-is
- Bullets: • ◦ ▪ ▫ → keep exactly as-is
- Currency: $ € £ ¥ kr SEK NOK DKK → keep exactly as-is
- Math: ± × ÷ ≈ ≠ ≤ ≥ % ‰ → keep exactly as-is
- Subscripts: O₂ CO₂ H₂O → keep subscript characters (₀₁₂₃₄₅₆₇₈₉)
- Superscripts: m³ km² ft³ → keep superscript characters (⁰¹²³⁴⁵⁶⁷⁸⁹)
- Em-dash: — (long dash) → keep as — not as - or ?
If you cannot identify a character, use [?].

NUMBER FORMAT PRESERVATION:
- CRITICAL: Preserve number formats EXACTLY as they appear in the document
- If document shows "2,340" keep as "2,340" (comma separator)
- If document shows "2.340" keep as "2.340" (period separator)
- Do NOT convert between European (1.000,50) and US (1,000.50) formats
- The user will handle localization in post-processing

CRITICAL - MERGED/SPANNING CELLS:
When a cell visually spans multiple rows in the PDF:
1. REPEAT that value in EVERY row it spans
2. Count headers FIRST - every data row needs EXACTLY that many columns
3. NEVER use empty string "" - use null ONLY for genuinely empty cells

CRITICAL - HEADERS MUST HAVE DATA:
- A table is NOT just headers - every table MUST include the data rows below it
- If you see a header row followed by data rows, they are ONE table together
- NEVER extract just headers without the data rows beneath them
- Section headings (like "10.1 Tale Forges svenska fördel") are NOT table headers
- Look for the actual column header row (e.g., "Fördel | Beskrivning") AND its data rows

TOTALS/SUMMARY SECTIONS - KEEP SEPARATE:
- If a document has line items AND totals below, create SEPARATE tables for each
- Line items table: the main data rows (products, services, etc.)
- Totals table: subtotal, tax, discount, total rows with their values
- Do NOT mix totals into item rows (they have different column structures)
- Common totals: "Subtotal", "Tax", "Total", "Sum", "Grand Total", "Amount Due", "Balance"

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Descriptive Name",
      "pageNumber": 1,
      "headers": ["Column1", "Column2", "Column3"],
      "rows": [
        ["value1", "value2", "value3"],
        ["value4", null, "value6"]
      ],
      "confidence": 91
    }
  ],
  "warnings": [
    {
      "type": "merged_cells",
      "message": "Complex merged cell structure detected",
      "pageNumber": 1,
      "suggestion": "Review data alignment in Excel"
    }
  ],
  "overallConfidence": 91
}

WARNING TYPES:
- low_resolution: Image quality below optimal
- merged_cells: Complex merged cell structure detected
- skipped_content: Non-table content not extracted
- partial_table: Table may continue on another page
- handwriting: Handwritten content detected
- mixed_languages: Multiple languages detected
- special_chars_uncertain: Some symbols may not be correctly identified
- structure_ambiguous: Table structure required interpretation
- inconsistent_format: Inconsistent data formats detected

VALIDATION CHECKLIST:
□ Each row has exactly as many values as there are headers
□ No empty strings "" anywhere (use null instead)
□ Special characters preserved exactly as seen
□ Merged cells have values repeated in all spanned rows`;

const FALLBACK_PROMPT = `You are a precise data extraction AI. This document contains NO traditional tables, but has structured data that should be extracted.

TASK: Extract ALL relevant structured information as a two-column table (Field | Value).

EXTRACTION GUIDELINES:
1. Identify document type first (ID, contract, letter, certificate, form, receipt, etc.)
2. Extract ALL meaningful data points
3. Use clear, descriptive field names
4. Preserve original values exactly (dates, numbers, codes, special characters)
5. For machine-readable codes (MRZ, barcodes), parse into human-readable fields

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Extracted Data",
      "pageNumber": 1,
      "headers": ["Field", "Value"],
      "rows": [
        ["Document Type", "Invoice"],
        ["Invoice Number", "INV-2024-001"],
        ["Date", "2024-01-15"],
        ["Total", "$1,234.56"]
      ],
      "confidence": 93
    }
  ],
  "warnings": [],
  "overallConfidence": 93
}

First row should ALWAYS be Document Type.`;

// ============================================
// EXTRACTION MODE PROMPTS
// ============================================

const EXTRACTION_MODE_PROMPTS: Record<ExtractionMode, string> = {
  invoice_extract: `INVOICE EXTRACTION MODE - Specialized extraction for invoices.

EXTRACT THE FOLLOWING:
1. **Header Information:**
   - Vendor/Company name and address
   - Invoice number, date, due date
   - PO number (if present)

2. **Customer Information:**
   - Bill to name/company and address
   - Ship to address (if different)

3. **Line Items Table:**
   - Item description, quantity, unit price, amount
   - Any item codes or SKUs

4. **Totals (SEPARATE TABLE):**
   - Subtotal, tax (amount and rate), shipping/handling
   - Discounts, grand total

5. **Payment Information:**
   - Payment terms, bank details, instructions

CRITICAL: Create separate tables for "Invoice Details", "Line Items", and "Totals".`,

  bank_extract: `BANK STATEMENT EXTRACTION MODE - Specialized extraction for bank statements.

EXTRACT THE FOLLOWING:
1. **Account Information:**
   - Bank name, account holder name
   - Account number (even if partially masked)
   - Statement period, account type

2. **Balance Summary:**
   - Opening/beginning balance
   - Total deposits/credits
   - Total withdrawals/debits
   - Closing/ending balance

3. **Transaction Table:**
   - Date, description/memo
   - Reference number (if present)
   - Debit/credit amount
   - Running balance (if shown)

VALIDATION: Opening + deposits - withdrawals should equal closing balance.
CRITICAL: Create separate tables for "Account Summary" and "Transactions".`,

  expense_extract: `EXPENSE REPORT EXTRACTION MODE - Specialized extraction for expense reports.

EXTRACT THE FOLLOWING:
1. **Report Information:**
   - Employee name, department
   - Report date/period, report number

2. **Expense Items Table:**
   - Date of expense, category
   - Description/purpose, vendor/merchant
   - Amount, currency
   - Receipt attached (Y/N)

3. **Totals (SEPARATE TABLE):**
   - Total by category
   - Grand total, amount approved
   - Advance received, net reimbursement

CRITICAL: Create separate tables for "Report Summary", "Expenses", and "Totals".`,

  inventory_extract: `INVENTORY LIST EXTRACTION MODE - Specialized extraction for inventory.

EXTRACT THE FOLLOWING:
1. **Inventory Items Table:**
   - SKU/product code
   - Product name/description
   - Category, location/warehouse/bin
   - Quantity on hand, unit of measure
   - Unit cost, extended value

2. **Summary (if present):**
   - Total items/SKUs
   - Total quantity
   - Total inventory value

CRITICAL: Preserve exact product codes and keep original number formats.`,

  sales_extract: `SALES REPORT EXTRACTION MODE - Specialized extraction for sales reports.

EXTRACT THE FOLLOWING:
1. **Report Period & Summary:**
   - Report period, total revenue/sales
   - Number of transactions
   - Average transaction value
   - Comparison to previous period

2. **Sales by Category/Product:**
   - Product/category name
   - Units sold, revenue
   - Percentage of total

3. **Top Performers (if shown):**
   - Top products, customers, sales reps

CRITICAL: Keep original currency and percentage formats.`,

  table_extract: `GENERIC TABLE EXTRACTION MODE - Extract all tables as-is.

CRITICAL RULES:
1. Preserve EXACT original values - do not normalize, convert, or modify any data
2. Keep original date formats exactly as shown
3. Keep original number formats exactly as shown
4. Keep currency symbols and special characters exactly as displayed
5. Extract ALL rows and columns - do not skip any data
6. Each visually distinct table = separate entry in tables array`,

  clean_summarize: `CLEAN & SUMMARIZE MODE - Organize messy content into readable format.

This document may not have clean table structures. Your job is to:
1. Identify the main topics and sections
2. Extract key information in a structured way
3. Create a clean, organized summary

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Document Summary",
      "pageNumber": 1,
      "headers": ["Section", "Content"],
      "rows": [
        ["Document Type", "..."],
        ["Key Information", "..."],
        ["Main Points", "..."]
      ],
      "confidence": 90
    },
    {
      "sheetName": "Extracted Data",
      "pageNumber": 1,
      "headers": ["Field", "Value"],
      "rows": [
        ["...", "..."]
      ],
      "confidence": 90
    }
  ],
  "summary": "A brief 2-3 sentence summary of the document content",
  "warnings": [],
  "overallConfidence": 90
}

Focus on CLARITY and USEFULNESS rather than preserving exact table structure.
If the document has any tables, also extract them normally.`,
};

/**
 * Get the extraction mode prompt based on the guidance
 */
function getExtractionModePrompt(extractionMode?: ExtractionMode): string {
  if (!extractionMode) {
    return '';
  }
  return EXTRACTION_MODE_PROMPTS[extractionMode] || '';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildGuidanceString(guidance: UserGuidance): string {
  const parts: string[] = [];

  // Add extraction mode-specific instructions first (highest priority)
  if (guidance.extractionMode) {
    const modePrompt = getExtractionModePrompt(guidance.extractionMode);
    if (modePrompt) {
      parts.push('=== EXTRACTION MODE INSTRUCTIONS ===');
      parts.push(modePrompt);
      parts.push('=== END EXTRACTION MODE ===\n');
    }
  }

  if (Object.keys(guidance.answers).length > 0) {
    parts.push('USER ANSWERS TO QUESTIONS:');
    for (const [questionId, answer] of Object.entries(guidance.answers)) {
      parts.push(`- ${questionId}: ${answer}`);

      // Add explicit symbol conversion instructions based on common answer patterns
      if (questionId.includes('symbol') || questionId.includes('checkbox')) {
        if (answer.includes('Yes') || answer.includes('supported') || answer.includes('✅')) {
          parts.push('  → CRITICAL: Convert ALL □ ☐ symbols to ✅ in the output');
          parts.push('  → CRITICAL: Convert ALL ■ ☑ ✓ symbols to ✅ in the output');
        } else if (answer.includes('No') || answer.includes('not supported') || answer.includes('❌')) {
          parts.push('  → CRITICAL: Convert ALL □ ☐ symbols to ❌ in the output');
        }
      }
    }
  }

  if (guidance.acceptedSuggestions?.length > 0) {
    parts.push('\nACCEPTED SUGGESTIONS:');
    guidance.acceptedSuggestions.forEach(s => parts.push(`- ${s}`));
  }

  if (guidance.outputPreferences) {
    parts.push('\nOUTPUT PREFERENCES:');
    const prefs = guidance.outputPreferences;
    if (prefs.combineRelatedTables) parts.push('- Combine related tables into single comparison tables');
    if (prefs.skipDiagrams) parts.push('- Skip ASCII diagrams and charts');
    if (prefs.skipImages) parts.push('- Skip decorative images');
    if (prefs.outputLanguage && prefs.outputLanguage !== 'auto') {
      parts.push(`\n=== LANGUAGE INSTRUCTIONS ===`);
      parts.push(`OUTPUT LANGUAGE: ${prefs.outputLanguage.toUpperCase()}`);
      parts.push(`- Translate ALL extracted content (headers, data values, text) to ${prefs.outputLanguage}`);
      parts.push(`- Keep numbers, dates, and currency values in their original format but translate any text labels`);
      parts.push(`- Translate column headers and field names to ${prefs.outputLanguage}`);
      parts.push(`- For proper nouns (company names, product names, person names), keep the original`);
      parts.push(`- For technical terms without a good translation, keep the original with optional translation in parentheses`);
      parts.push(`=== END LANGUAGE INSTRUCTIONS ===`);
    }
    if (prefs.symbolMapping) {
      parts.push('- CRITICAL SYMBOL CONVERSIONS (apply to ALL matching symbols):');
      for (const [from, to] of Object.entries(prefs.symbolMapping)) {
        parts.push(`  - Convert EVERY "${from}" to "${to}"`);
      }
    }
  }

  if (guidance.freeformInstructions) {
    parts.push('\nADDITIONAL USER INSTRUCTIONS:');
    parts.push(guidance.freeformInstructions);
  }

  return parts.join('\n');
}

/**
 * Apply symbol conversions to extracted tables based on user guidance
 * This ensures symbols are converted even if the AI didn't do it
 */
function applySymbolConversions(tables: ExtractedTable[], guidance: UserGuidance): ExtractedTable[] {
  // Determine what conversion to apply based on user answers
  let convertCheckboxesToYes = false;
  let convertCheckboxesToNo = false;

  // Check answers for symbol-related questions
  for (const [questionId, answer] of Object.entries(guidance.answers)) {
    const answerStr = String(answer).toLowerCase();
    if (questionId.includes('symbol') || questionId.includes('checkbox') || answerStr.includes('□')) {
      if (answerStr.includes('yes') || answerStr.includes('supported') || answerStr.includes('✅')) {
        convertCheckboxesToYes = true;
      } else if (answerStr.includes('no') || answerStr.includes('not supported') || answerStr.includes('❌')) {
        convertCheckboxesToNo = true;
      }
    }
  }

  // Also check symbolMapping in output preferences
  const symbolMapping = guidance.outputPreferences?.symbolMapping || {};

  // If no conversion needed, return tables as-is
  if (!convertCheckboxesToYes && !convertCheckboxesToNo && Object.keys(symbolMapping).length === 0) {
    return tables;
  }

  // Apply conversions to all tables
  return tables.map(table => {
    const convertCell = (cell: string | null): string | null => {
      if (cell === null) return null;
      let result = cell;

      // Apply explicit symbol mapping first
      for (const [from, to] of Object.entries(symbolMapping)) {
        result = result.split(from).join(to);
      }

      // Apply checkbox conversions based on user answer
      if (convertCheckboxesToYes) {
        // Empty checkbox symbols → ✅
        result = result.replace(/□|☐|▢/g, '✅');
        // Filled checkbox/checkmark symbols → ✅
        result = result.replace(/■|☑|✓|✔/g, '✅');
      } else if (convertCheckboxesToNo) {
        // Empty checkbox symbols → ❌
        result = result.replace(/□|☐|▢/g, '❌');
      }

      return result;
    };

    return {
      ...table,
      headers: table.headers.map(h => convertCell(h) || h),
      rows: table.rows.map(row => row.map(cell => convertCell(cell))),
    };
  });
}

/**
 * Detect if a row is a summary/total row that should NOT receive merged cell values
 * Summary rows typically contain keywords like TOTAL, SUM, SUBTOTAL, etc.
 */
function isSummaryRow(row: (string | null)[]): boolean {
  const summaryKeywords = [
    'total', 'totalt', 'summa', 'sum', 'subtotal', 'grand total',
    'amount due', 'balance', 'net', 'gross', 'average', 'avg',
    'count', 'min', 'max', 'mean', 'median',
    // Swedish/Nordic
    'totalt', 'summa', 'delsumma', 'slutsumma', 'moms', 'att betala',
    // German
    'gesamt', 'summe', 'zwischensumme', 'mwst', 'netto', 'brutto',
    // Common abbreviations
    'tot', 'sub', 'ttl'
  ];

  // Check first few cells for summary keywords
  for (let i = 0; i < Math.min(3, row.length); i++) {
    const cellValue = row[i];
    if (cellValue && typeof cellValue === 'string') {
      const lowerValue = cellValue.toLowerCase().trim();
      // Check if the cell contains any summary keyword
      for (const keyword of summaryKeywords) {
        if (lowerValue === keyword ||
            lowerValue.startsWith(keyword + ' ') ||
            lowerValue.startsWith(keyword + ':') ||
            lowerValue.endsWith(' ' + keyword) ||
            lowerValue.includes(' ' + keyword + ' ')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Detect if a table has a merged cell pattern (first columns empty in some rows)
 * This helps distinguish intentional merged cells from tables that just have empty values
 */
function detectMergedCellPattern(rows: (string | null)[][], headerCount: number): boolean {
  if (rows.length < 3) return false; // Need at least a few rows to detect pattern

  let rowsWithEmptyFirstCol = 0;
  let rowsWithDataFirstCol = 0;
  let consecutiveEmptyGroups = 0;
  let lastHadData = true;

  for (const row of rows) {
    const firstColEmpty = !row[0] || row[0] === '';
    const hasDataAfterFirst = row.slice(1).some(v => v !== '' && v !== null);

    if (firstColEmpty && hasDataAfterFirst) {
      rowsWithEmptyFirstCol++;
      if (lastHadData) {
        consecutiveEmptyGroups++;
      }
      lastHadData = false;
    } else if (!firstColEmpty) {
      rowsWithDataFirstCol++;
      lastHadData = true;
    }
  }

  // Pattern detected if:
  // 1. Some rows have empty first col but data in other cols
  // 2. There's a mix (not all rows are the same)
  // 3. The pattern appears in groups (merged cells typically span multiple rows)
  const hasPattern = rowsWithEmptyFirstCol > 0 &&
                     rowsWithDataFirstCol > 0 &&
                     consecutiveEmptyGroups >= 1 &&
                     rowsWithEmptyFirstCol >= 2;

  return hasPattern;
}

function postProcessTables(tables: ExtractedTable[]): ExtractedTable[] {
  return tables.map(table => {
    const headerCount = table.headers.length;
    const processedRows: (string | null)[][] = [];

    // First pass: analyze table structure to detect if merged cell filling is appropriate
    // Only fill merged cells if we see a clear pattern of group headers
    const hasMergedCellPattern = detectMergedCellPattern(table.rows, headerCount);

    const lastValues: (string | null)[] = new Array(headerCount).fill(null);

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      let row = [...table.rows[rowIndex]];

      // Remove leading empty cells only if row is longer than expected
      // This fixes AI sometimes adding extra empty cells at the start
      let leadingEmpties = 0;
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '' || row[i] === null) {
          leadingEmpties++;
        } else {
          break;
        }
      }

      if (leadingEmpties > 0 && row.length > headerCount) {
        const excess = row.length - headerCount;
        const emptiesToRemove = Math.min(leadingEmpties, excess);
        row = row.slice(emptiesToRemove);
      }

      // Pad short rows with null
      while (row.length < headerCount) {
        row.push(null);
      }

      // Trim rows that are too long
      if (row.length > headerCount) {
        row = row.slice(0, headerCount);
      }

      // CRITICAL: Check if this is a summary/total row - do NOT fill from previous rows
      const isThisSummaryRow = isSummaryRow(row);

      // Only fill from previous row if we detected a merged cell pattern AND this is not a summary row
      // This prevents incorrect filling when tables just have empty cells or summary rows
      if (hasMergedCellPattern && !isThisSummaryRow) {
        for (let colIndex = 0; colIndex < Math.min(2, row.length); colIndex++) {
          const value = row[colIndex];
          if ((value === '' || value === null) && lastValues[colIndex] !== null) {
            // Only fill if there's actual data after this cell
            const hasDataAfter = row.slice(colIndex + 1).some(v => v !== '' && v !== null);
            if (hasDataAfter) {
              row[colIndex] = lastValues[colIndex];
            }
          }
        }
      }

      // Track non-empty values for potential merged cell filling
      // For summary rows: Reset lastValues to prevent leaking into rows AFTER the summary
      if (isThisSummaryRow) {
        lastValues.fill(null);
      } else {
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          if (row[colIndex] !== '' && row[colIndex] !== null) {
            lastValues[colIndex] = row[colIndex];
          }
        }
      }

      // Convert empty strings to null
      row = row.map(v => v === '' ? null : v);
      processedRows.push(row);
    }

    // Normalize table confidence to 0-1 range
    let normalizedConfidence: number | ConfidenceBreakdown = table.confidence;
    if (typeof table.confidence === 'number') {
      normalizedConfidence = normalizeConfidence(table.confidence);
    } else if (table.confidence && typeof table.confidence === 'object') {
      // Handle ConfidenceBreakdown object
      normalizedConfidence = {
        ...table.confidence,
        overall: normalizeConfidence(table.confidence.overall),
      };
    }

    return { ...table, rows: processedRows, confidence: normalizedConfidence };
  });
}

/**
 * Filter out empty or low-quality tables
 * - Removes tables with 0 data rows
 * - Removes tables where all cells are null/empty
 * - Flags tables with low confidence (but keeps them with warning)
 */
function filterEmptyTables(tables: ExtractedTable[]): { tables: ExtractedTable[]; warnings: AIWarning[] } {
  const warnings: AIWarning[] = [];
  const MIN_CONFIDENCE_THRESHOLD = 0.5; // 50%

  const filteredTables = tables.filter(table => {
    // Get confidence as number
    const confidence = typeof table.confidence === 'number'
      ? table.confidence
      : table.confidence?.overall ?? 0.9;

    // Filter out tables with 0 data rows
    if (table.rows.length === 0) {
      warnings.push({
        type: 'skipped_content',
        message: `Removed empty table "${table.sheetName}" (no data rows)`,
        pageNumber: table.pageNumber,
        suggestion: 'This table had headers but no data and was removed.',
      });
      return false;
    }

    // Check if all cells are null/empty
    const hasAnyData = table.rows.some(row =>
      row.some(cell => cell !== null && cell !== '' && cell !== undefined)
    );

    if (!hasAnyData) {
      warnings.push({
        type: 'skipped_content',
        message: `Removed table "${table.sheetName}" (all cells empty)`,
        pageNumber: table.pageNumber,
        suggestion: 'This table had no actual data content and was removed.',
      });
      return false;
    }

    // Flag low confidence tables but keep them
    if (confidence < MIN_CONFIDENCE_THRESHOLD) {
      warnings.push({
        type: 'low_resolution',
        message: `Table "${table.sheetName}" has low confidence (${Math.round(confidence * 100)}%)`,
        pageNumber: table.pageNumber,
        suggestion: 'Review this table carefully as extraction quality may be poor.',
      });
    }

    return true;
  });

  return { tables: filteredTables, warnings };
}

/**
 * Ensure all sheet names are unique
 * If duplicates exist, append distinguishing suffix
 */
function ensureUniqueSheetNames(tables: ExtractedTable[]): ExtractedTable[] {
  const nameCount: Map<string, number> = new Map();
  const usedNames: Set<string> = new Set();

  return tables.map(table => {
    let baseName = table.sheetName;

    // If this name has been used, make it unique
    if (usedNames.has(baseName)) {
      const count = (nameCount.get(baseName) || 1) + 1;
      nameCount.set(baseName, count);

      // Try to make name more descriptive
      // First, try adding page number if different
      let newName = `${baseName} ${count}`;

      // If we have headers that differ, use first header as differentiator
      if (table.headers.length > 0) {
        const firstHeader = table.headers[0];
        // Check if firstHeader provides useful differentiation (not too generic)
        if (firstHeader &&
            firstHeader.length > 2 &&
            firstHeader.length < 15 &&
            !['id', 'name', 'feature', 'item', '#', 'no', 'nr'].includes(firstHeader.toLowerCase())) {
          // Truncate if needed to fit in 31 chars
          const maxBaseLength = 25 - firstHeader.length - 3; // " - " separator
          if (maxBaseLength > 10) {
            newName = `${baseName.substring(0, maxBaseLength)} - ${firstHeader}`;
          }
        }
      }

      // Ensure the new name is also unique
      let counter = 2;
      let finalName = newName;
      while (usedNames.has(finalName)) {
        finalName = `${baseName} ${counter}`;
        counter++;
      }

      usedNames.add(finalName);
      return { ...table, sheetName: smartTruncateSheetName(finalName) };
    }

    usedNames.add(baseName);
    nameCount.set(baseName, 1);
    return table;
  });
}

/**
 * Validate extraction completeness against analysis expectations
 * Returns warnings if extraction might be missing tables
 */
function validateExtractionCompleteness(
  expectedTableCount: number | undefined,
  extractedTables: ExtractedTable[]
): AIWarning[] {
  const warnings: AIWarning[] = [];
  const actualCount = extractedTables.length;

  // Skip validation if we don't have an expected count
  if (!expectedTableCount || expectedTableCount <= 0) {
    return warnings;
  }

  // Warn if we extracted significantly fewer tables than expected
  if (actualCount < expectedTableCount * 0.7) {
    warnings.push({
      type: 'skipped_content',
      message: `Expected approximately ${expectedTableCount} tables but only extracted ${actualCount}. Some tables may have been missed or incorrectly combined.`,
      suggestion: 'Review the extracted data and consider re-processing if tables are missing.',
    });
  }

  // Warn if we extracted way more than expected (might indicate over-splitting)
  if (actualCount > expectedTableCount * 2 && expectedTableCount >= 3) {
    warnings.push({
      type: 'structure_ambiguous',
      message: `Extracted ${actualCount} tables, which is more than the ${expectedTableCount} initially detected. Some content may have been split into multiple tables.`,
      suggestion: 'Review the table structure in the output.',
    });
  }

  return warnings;
}

/**
 * Log table column structure for debugging
 * Helps identify when tables have inconsistent structures
 */
function logTableStructures(tables: ExtractedTable[], context: string): void {
  if (tables.length === 0) return;

  console.log(`[${context}] Table structures:`);
  tables.forEach((table, i) => {
    const rowLengths = table.rows.map(r => r.length);
    const uniqueLengths = Array.from(new Set(rowLengths));
    const hasInconsistentRows = uniqueLengths.length > 1;

    console.log(`  Table ${i + 1} "${table.sheetName}": ${table.headers.length} headers, ${table.rows.length} rows${hasInconsistentRows ? ` (INCONSISTENT: ${uniqueLengths.join(', ')} cols)` : ''}`);
  });
}

// ============================================
// API CALL FUNCTIONS
// ============================================

async function callGoogleAI(
  base64Image: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 60000
): Promise<{ success: boolean; content?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${GOOGLE_AI_BASE_URL}/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\n${userPrompt}` },
                { inline_data: { mime_type: mimeType, data: base64Image } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google AI API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return content ? { success: true, content } : { success: false, error: 'No response from Google AI' };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') return { success: false, error: 'Request timed out' };
    return { success: false, error: error.message };
  }
}

async function callOpenRouter(
  dataUrl: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 60000
): Promise<{ success: boolean; content?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://smartpdf-convert.com',
        'X-Title': 'SmartPDF Convert',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    return content ? { success: true, content } : { success: false, error: 'No response from OpenRouter' };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') return { success: false, error: 'Request timed out' };
    return { success: false, error: error.message };
  }
}

async function callAI(
  cleanBase64: string,
  imageMimeType: string,
  dataUrl: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 60000
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (USE_GOOGLE_AI) {
    console.log('Using Google AI Studio (free)...');
    const result = await callGoogleAI(cleanBase64, imageMimeType, systemPrompt, userPrompt, timeoutMs);
    if (!result.success && OPENROUTER_API_KEY) {
      console.log('Google AI failed, falling back to OpenRouter...');
      return callOpenRouter(dataUrl, systemPrompt, userPrompt, timeoutMs);
    }
    return result;
  }
  return callOpenRouter(dataUrl, systemPrompt, userPrompt, timeoutMs);
}

// ============================================
// MAIN API FUNCTIONS
// ============================================

/**
 * Phase 1: Analyze document and generate questions (NEW)
 * Supports multiple sample pages for better pattern detection
 */
export async function analyzeDocument(
  fileBase64: string | string[],
  fileName: string,
  mimeType: string,
  pageNumbers?: number[]
): Promise<DocumentAnalysis> {
  if (!GOOGLE_AI_API_KEY && !OPENROUTER_API_KEY) {
    throw new Error('No AI API key configured');
  }

  // Handle single image or array of images
  const images = Array.isArray(fileBase64) ? fileBase64 : [fileBase64];
  const pages = pageNumbers || [1];

  console.log(`Analyzing document: ${fileName} (${images.length} sample page(s): ${pages.join(', ')})`);

  // For multi-page analysis, we need to use Google AI's multi-image capability
  if (USE_GOOGLE_AI && images.length > 1) {
    const result = await callGoogleAIMultiImage(images, mimeType, fileName, pages);
    if (!result.success) {
      throw new Error(result.error || 'Failed to analyze document');
    }
    try {
      const cleanContent = result.content!.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanContent);

      // Debug: Log if detectedTables was returned
      console.log(`[Analysis] Multi-image analysis returned: tablesDetected=${parsed.analysis?.tablesDetected}, detectedTables count=${parsed.detectedTables?.length || 0}`);
      if (parsed.detectedTables && parsed.detectedTables.length > 0) {
        console.log(`[Analysis] First detected table: ${parsed.detectedTables[0].name}, ${parsed.detectedTables[0].columnCount} columns, headers: ${parsed.detectedTables[0].headers?.join(', ')}`);
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse analysis response:', result.content);
      throw new Error('Failed to parse analysis response');
    }
  }

  // Single image analysis (fallback)
  let cleanBase64 = images[0].includes(',') ? images[0].split(',')[1] : images[0];
  cleanBase64 = cleanBase64.replace(/\s/g, '');
  const imageMimeType = mimeType === 'application/pdf' ? 'image/png' : mimeType;
  const dataUrl = `data:${imageMimeType};base64,${cleanBase64}`;

  const userPrompt = `Analyze this document and generate clarifying questions: "${fileName}". IMPORTANT: You MUST include the "detectedTables" array with actual table data from the document. Return valid JSON only, no markdown.`;
  const result = await callAI(cleanBase64, imageMimeType, dataUrl, ANALYSIS_PROMPT, userPrompt, 30000);

  if (!result.success) {
    throw new Error(result.error || 'Failed to analyze document');
  }

  try {
    const cleanContent = result.content!.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);

    // Debug: Log if detectedTables was returned
    console.log(`[Analysis] Single-image analysis returned: tablesDetected=${parsed.analysis?.tablesDetected}, detectedTables count=${parsed.detectedTables?.length || 0}`);
    if (parsed.detectedTables && parsed.detectedTables.length > 0) {
      console.log(`[Analysis] First detected table: ${parsed.detectedTables[0].name}, ${parsed.detectedTables[0].columnCount} columns, headers: ${parsed.detectedTables[0].headers?.join(', ')}`);
    }

    return parsed;
  } catch (e) {
    console.error('Failed to parse analysis response:', result.content);
    throw new Error('Failed to parse analysis response');
  }
}

/**
 * Call Google AI with multiple images for comprehensive analysis
 */
async function callGoogleAIMultiImage(
  images: string[],
  mimeType: string,
  fileName: string,
  pageNumbers: number[]
): Promise<{ success: boolean; content?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for multi-image

  try {
    const imageMimeType = mimeType === 'application/pdf' ? 'image/png' : mimeType;

    // Build parts array with all images
    const parts: any[] = [];

    // Add text prompt first
    const pageInfo = pageNumbers.map((p, i) => `Image ${i + 1} = Page ${p}`).join(', ');
    const totalPagesShown = images.length;
    parts.push({
      text: `${ANALYSIS_PROMPT}\n\nAnalyze these ${totalPagesShown} pages from document "${fileName}" and generate clarifying questions.\n${pageInfo}\n\nCRITICAL REQUIREMENTS:
1. Count tables on EACH page and SUM them for "tablesDetected". If Page 1 has 3 tables and Page 2 has 2 tables, report tablesDetected: 5.
2. You MUST include the "detectedTables" array with ACTUAL table data extracted from the document.
3. For each table, provide the REAL column headers and 2-3 REAL preview rows of data.
4. Count ALL columns accurately - if a table has 8 columns, report columnCount: 8.

Return valid JSON only, no markdown.`
    });

    // Add each image
    for (let i = 0; i < images.length; i++) {
      let cleanBase64 = images[i].includes(',') ? images[i].split(',')[1] : images[i];
      cleanBase64 = cleanBase64.replace(/\s/g, '');

      parts.push({
        inline_data: {
          mime_type: imageMimeType,
          data: cleanBase64,
        },
      });
    }

    const response = await fetch(
      `${GOOGLE_AI_BASE_URL}/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google AI multi-image error:', errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return { success: false, error: 'No content in response' };
    }

    return { success: true, content };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Analysis timed out' };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Phase 2: Extract with user guidance (NEW)
 */
export async function extractWithGuidance(
  fileBase64: string,
  fileName: string,
  mimeType: string,
  guidance: UserGuidance
): Promise<ExtractionResult> {
  const startTime = Date.now();

  if (!GOOGLE_AI_API_KEY && !OPENROUTER_API_KEY) {
    return {
      success: false,
      tables: [],
      warnings: [],
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: 'No AI API key configured',
      errorCode: 'CONFIG_ERROR',
    };
  }

  let cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  cleanBase64 = cleanBase64.replace(/\s/g, '');
  const imageMimeType = mimeType === 'application/pdf' ? 'image/png' : mimeType;
  const dataUrl = `data:${imageMimeType};base64,${cleanBase64}`;

  const guidanceString = buildGuidanceString(guidance);
  const customPrompt = GUIDED_EXTRACTION_PROMPT.replace('{USER_GUIDANCE_PLACEHOLDER}', guidanceString);

  console.log(`Extracting with guidance: ${fileName}`);

  const userPrompt = `Extract data from this document following the guidance provided: "${fileName}". Return valid JSON only.`;
  const result = await callAI(cleanBase64, imageMimeType, dataUrl, customPrompt, userPrompt);

  if (!result.success) {
    return {
      success: false,
      tables: [],
      warnings: [],
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: result.error || 'Failed to extract with guidance',
      errorCode: 'AI_API_ERROR',
    };
  }

  try {
    const cleanContent = result.content!.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    let processedTables = postProcessTables(parsed.tables || []);

    // Debug: Log tables with 0 rows before filtering
    const emptyTables = processedTables.filter(t => t.rows.length === 0);
    if (emptyTables.length > 0) {
      console.log(`[AI Extraction] Found ${emptyTables.length} tables with 0 data rows:`,
        emptyTables.map(t => ({ name: t.sheetName, headers: t.headers, page: t.pageNumber }))
      );
    }

    // Apply symbol conversions based on user guidance (ensures conversion even if AI didn't do it)
    processedTables = applySymbolConversions(processedTables, guidance);

    // Filter out empty tables and collect warnings
    const { tables: filteredTables, warnings: filterWarnings } = filterEmptyTables(processedTables);

    // Ensure unique sheet names
    const uniqueTables = ensureUniqueSheetNames(filteredTables);

    // Combine all warnings
    const allWarnings = [...(parsed.warnings || []), ...filterWarnings];

    return {
      success: true,
      tables: uniqueTables,
      warnings: allWarnings,
      confidence: normalizeConfidence(parsed.overallConfidence),
      processingTime: Date.now() - startTime,
      appliedGuidance: parsed.appliedGuidance || [],
    };
  } catch (e) {
    return {
      success: false,
      tables: [],
      warnings: [],
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: 'Failed to parse AI response',
      errorCode: 'AI_PARSE_ERROR',
    };
  }
}

/**
 * Quick extraction without analysis (existing flow)
 */
export async function extractTablesFromPDF(
  fileBase64: string,
  fileName: string,
  mimeType: string = 'application/pdf',
  customSystemPrompt?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  if (!GOOGLE_AI_API_KEY && !OPENROUTER_API_KEY) {
    return {
      success: false,
      tables: [],
      warnings: [],
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: 'No AI API key configured. Please set GOOGLE_AI_API_KEY or OPENROUTER_API_KEY.',
      errorCode: 'CONFIG_ERROR',
    };
  }

  try {
    let cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    cleanBase64 = cleanBase64.replace(/\s/g, '');
    const imageMimeType = mimeType === 'application/pdf' ? 'image/png' : mimeType;
    const dataUrl = `data:${imageMimeType};base64,${cleanBase64}`;

    console.log(`Processing file: ${fileName}, using: ${USE_GOOGLE_AI ? 'Google AI Studio' : 'OpenRouter'}`);

    const systemPrompt = customSystemPrompt || SYSTEM_PROMPT;
    const userPrompt = `Extract all tables from this document: "${fileName}". Return valid JSON only, no markdown code blocks.`;

    const result = await callAI(cleanBase64, imageMimeType, dataUrl, systemPrompt, userPrompt);

    if (!result.success) {
      if (result.error?.includes('Invalid image') || result.error?.includes('image')) {
        return {
          success: false,
          tables: [],
          warnings: [],
          confidence: 0,
          processingTime: Date.now() - startTime,
          error: 'Unable to process this PDF. Please try converting it to an image (PNG/JPG) first.',
          errorCode: 'INVALID_IMAGE_FORMAT',
        };
      }
      if (result.error?.includes('timed out')) {
        return {
          success: false,
          tables: [],
          warnings: [],
          confidence: 0,
          processingTime: Date.now() - startTime,
          error: 'Processing timed out. The document may be too complex.',
          errorCode: 'AI_TIMEOUT',
        };
      }
      return {
        success: false,
        tables: [],
        warnings: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: 'Failed to process PDF with AI',
        errorCode: 'AI_API_ERROR',
      };
    }

    let parsed;
    try {
      const cleanContent = result.content!.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', result.content);
      return {
        success: false,
        tables: [],
        warnings: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: 'Failed to parse AI response',
        errorCode: 'AI_PARSE_ERROR',
      };
    }

    let processedTables = postProcessTables(parsed.tables || []);

    // Debug: Log tables with 0 rows before filtering
    const emptyTables = processedTables.filter(t => t.rows.length === 0);
    if (emptyTables.length > 0) {
      console.log(`[Quick Extraction] Found ${emptyTables.length} tables with 0 data rows:`,
        emptyTables.map(t => ({ name: t.sheetName, headers: t.headers, page: t.pageNumber }))
      );
    }

    // If no tables found, try fallback extraction
    if (processedTables.length === 0) {
      console.log('No tables found, attempting intelligent key-value extraction...');

      const fallbackUserPrompt = `Extract all text and data from this document as structured key-value pairs. File: "${fileName}". Return only JSON.`;
      const fallbackResult = await callAI(cleanBase64, imageMimeType, dataUrl, FALLBACK_PROMPT, fallbackUserPrompt, 30000);

      if (fallbackResult.success && fallbackResult.content) {
        try {
          const fallbackParsed = JSON.parse(fallbackResult.content.replace(/```json\n?|\n?```/g, '').trim());
          if (fallbackParsed.tables && fallbackParsed.tables.length > 0) {
            const fallbackWarning: AIWarning = {
              type: 'inconsistent_format',
              message: 'No tables detected - extracted as structured key-value data',
              suggestion: 'The AI analyzed this document and extracted all relevant data as Field/Value pairs.',
            };
            return {
              success: true,
              tables: fallbackParsed.tables,
              warnings: [...(fallbackParsed.warnings || []), fallbackWarning],
              confidence: normalizeConfidence(fallbackParsed.overallConfidence),
              processingTime: Date.now() - startTime,
            };
          }
        } catch (e) {
          console.error('Fallback parsing failed:', e);
        }
      }
    }

    // Filter out empty tables and collect warnings
    const { tables: filteredTables, warnings: filterWarnings } = filterEmptyTables(processedTables);

    // Ensure unique sheet names
    const uniqueTables = ensureUniqueSheetNames(filteredTables);

    // Combine all warnings
    const allWarnings = [...(parsed.warnings || []), ...filterWarnings];

    return {
      success: true,
      tables: uniqueTables,
      warnings: allWarnings,
      confidence: normalizeConfidence(parsed.overallConfidence),
      processingTime: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('AI extraction error:', error);
    if (error.name === 'AbortError') {
      return {
        success: false,
        tables: [],
        warnings: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: 'Processing timed out. The document may be too complex.',
        errorCode: 'AI_TIMEOUT',
      };
    }
    return {
      success: false,
      tables: [],
      warnings: [],
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: 'Failed to extract tables from PDF. Please try again.',
      errorCode: 'AI_EXTRACTION_FAILED',
    };
  }
}

/**
 * Extract tables from multiple pages and combine results
 */
export async function extractTablesFromMultiplePages(
  pages: { pageNumber: number; base64: string; mimeType: string }[],
  fileName: string,
  onProgress?: (current: number, total: number) => void,
  customSystemPrompt?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const allTables: ExtractedTable[] = [];
  const allWarnings: AIWarning[] = [];
  let totalConfidence = 0;
  let successfulPages = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`Processing page ${page.pageNumber} of ${pages.length}...`);

    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    const result = await extractTablesFromPDF(
      page.base64,
      `${fileName} (Page ${page.pageNumber})`,
      page.mimeType,
      customSystemPrompt
    );

    if (result.success) {
      const tablesWithPageNum = result.tables.map(table => {
        const suffix = pages.length > 1 ? ` (P${page.pageNumber})` : '';
        const sheetName = smartTruncateSheetName(table.sheetName, suffix);

        return { ...table, pageNumber: page.pageNumber, sheetName };
      });

      allTables.push(...tablesWithPageNum);

      const warningsWithPageNum = result.warnings.map(warning => ({
        ...warning,
        pageNumber: page.pageNumber,
      }));

      allWarnings.push(...warningsWithPageNum);
      totalConfidence += result.confidence;
      successfulPages++;
    } else {
      allWarnings.push({
        type: 'partial_table',
        message: `Failed to extract tables from page ${page.pageNumber}: ${result.error}`,
        pageNumber: page.pageNumber,
        suggestion: 'Try uploading this page separately as an image',
      });
    }
  }

  if (allTables.length === 0) {
    return {
      success: false,
      tables: [],
      warnings: allWarnings,
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: 'No tables could be extracted from any page',
      errorCode: 'NO_TABLES_FOUND',
    };
  }

  // Apply filtering and unique naming across all pages
  const { tables: filteredTables, warnings: filterWarnings } = filterEmptyTables(allTables);
  const uniqueTables = ensureUniqueSheetNames(filteredTables);
  const combinedWarnings = [...allWarnings, ...filterWarnings];

  return {
    success: true,
    tables: uniqueTables,
    warnings: combinedWarnings,
    confidence: successfulPages > 0 ? totalConfidence / successfulPages : 0,
    processingTime: Date.now() - startTime,
  };
}
