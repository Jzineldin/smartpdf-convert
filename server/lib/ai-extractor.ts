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
export interface DocumentAnalysis {
  analysis: {
    documentType: string;
    pageCount: number;
    tablesDetected: number;
    languages: string[];
    complexity: 'low' | 'medium' | 'high';
    estimatedExtractionTime: string;
  };
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

// User guidance types
export interface UserGuidance {
  answers: Record<string, string>;
  acceptedSuggestions: string[];
  freeformInstructions?: string;
  outputPreferences?: OutputPreferences;
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

=== PROACTIVE QUESTIONS - ALWAYS ASK IF PATTERNS DETECTED ===

CHECKBOX/SYMBOL PATTERNS:
If you see ANY of these symbols: □ ■ ☐ ☑ ○ ● ◯ ◉ - ✓ ✗ x X ▢ ▣
ALWAYS generate a question asking what they represent, even if you think you know.
Options should include: "Yes/supported → ✅" | "No/not supported → ❌" | "Keep original symbols"

COMPARISON/FEATURE TABLES:
If the document compares multiple products, services, or competitors:
ALWAYS ask about table structure preference.
Options: "One combined comparison table" | "Separate tables per item" | "Keep as found"

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
    "pageCount": 1,
    "tablesDetected": 3,
    "languages": ["English"],
    "complexity": "medium",
    "estimatedExtractionTime": "10-15 seconds"
  },
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

SHEET NAMING (MAX 20 CHARS):
- Use short descriptive names
- If user wants combined tables, use descriptive combined name
- Add page suffix only for multi-page documents with same-named tables

PRESERVE SPECIAL CHARACTERS (unless user specified conversion):
- Checkmarks: ✅ ✓ ☑ → keep as-is OR convert per user instruction
- X marks: ❌ ✗ ☒ → keep as-is OR convert per user instruction
- All currency symbols: $ € £ ¥ kr SEK → always preserve exactly
- All mathematical symbols: ± × ÷ ≈ ≠ ≤ ≥ % → always preserve exactly

MERGED/SPANNING CELLS:
- REPEAT the value in EVERY row it spans
- Count headers FIRST - every row needs EXACTLY that many columns
- NEVER use empty string "" - use null ONLY for truly empty cells

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

SHEET NAMING (MAX 20 CHARS):
- Use short descriptive names: "Market Data", "Pricing", "Features", "Contacts"
- Never exceed 20 characters before automatic page suffix

CRITICAL - PRESERVE ALL SPECIAL CHARACTERS EXACTLY:
- Checkmarks: ✅ ✓ ☑ → keep exactly as-is
- X marks: ❌ ✗ ☒ ✘ → keep exactly as-is
- Boxes: □ ■ ☐ → keep exactly as-is
- Bullets: • ◦ ▪ ▫ → keep exactly as-is
- Currency: $ € £ ¥ kr SEK NOK DKK → keep exactly as-is
- Math: ± × ÷ ≈ ≠ ≤ ≥ % ‰ → keep exactly as-is
If you cannot identify a character, use [?].

CRITICAL - MERGED/SPANNING CELLS:
When a cell visually spans multiple rows in the PDF:
1. REPEAT that value in EVERY row it spans
2. Count headers FIRST - every data row needs EXACTLY that many columns
3. NEVER use empty string "" - use null ONLY for genuinely empty cells

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
// HELPER FUNCTIONS
// ============================================

function buildGuidanceString(guidance: UserGuidance): string {
  const parts: string[] = [];

  if (Object.keys(guidance.answers).length > 0) {
    parts.push('USER ANSWERS TO QUESTIONS:');
    for (const [questionId, answer] of Object.entries(guidance.answers)) {
      parts.push(`- ${questionId}: ${answer}`);
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
      parts.push(`- Use ${prefs.outputLanguage} for column headers and field names`);
    }
    if (prefs.symbolMapping) {
      parts.push('- Symbol conversions:');
      for (const [from, to] of Object.entries(prefs.symbolMapping)) {
        parts.push(`  - Convert "${from}" to "${to}"`);
      }
    }
  }

  if (guidance.freeformInstructions) {
    parts.push('\nADDITIONAL USER INSTRUCTIONS:');
    parts.push(guidance.freeformInstructions);
  }

  return parts.join('\n');
}

function postProcessTables(tables: ExtractedTable[]): ExtractedTable[] {
  return tables.map(table => {
    const headerCount = table.headers.length;
    const processedRows: (string | null)[][] = [];
    const lastValues: (string | null)[] = new Array(headerCount).fill(null);

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      let row = [...table.rows[rowIndex]];

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

      while (row.length < headerCount) {
        row.push(null);
      }

      if (row.length > headerCount) {
        row = row.slice(0, headerCount);
      }

      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const value = row[colIndex];
        if ((value === '' || value === null) && lastValues[colIndex] !== null) {
          const hasDataAfter = row.slice(colIndex + 1).some(v => v !== '' && v !== null);
          if (colIndex < 3 && hasDataAfter) {
            row[colIndex] = lastValues[colIndex];
          }
        }
        if (value !== '' && value !== null) {
          lastValues[colIndex] = value;
        }
      }

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
      return JSON.parse(cleanContent);
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

  const userPrompt = `Analyze this document and generate clarifying questions: "${fileName}". Return valid JSON only, no markdown.`;
  const result = await callAI(cleanBase64, imageMimeType, dataUrl, ANALYSIS_PROMPT, userPrompt, 30000);

  if (!result.success) {
    throw new Error(result.error || 'Failed to analyze document');
  }

  try {
    const cleanContent = result.content!.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanContent);
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
    parts.push({
      text: `${ANALYSIS_PROMPT}\n\nAnalyze these sample pages from document "${fileName}" and generate clarifying questions.\n${pageInfo}\nLook for patterns across ALL pages shown. Return valid JSON only, no markdown.`
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
    const processedTables = postProcessTables(parsed.tables || []);

    return {
      success: true,
      tables: processedTables,
      warnings: parsed.warnings || [],
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

    const processedTables = postProcessTables(parsed.tables || []);

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

    return {
      success: true,
      tables: processedTables,
      warnings: parsed.warnings || [],
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
        let sheetName = table.sheetName;

        if (pages.length > 1) {
          const suffix = ` (P${page.pageNumber})`;
          const maxBaseLength = 31 - suffix.length;
          if (sheetName.length > maxBaseLength) {
            sheetName = sheetName.substring(0, maxBaseLength);
          }
          sheetName = sheetName + suffix;
        }

        if (sheetName.length > 31) {
          sheetName = sheetName.substring(0, 31);
        }

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

  return {
    success: true,
    tables: allTables,
    warnings: allWarnings,
    confidence: successfulPages > 0 ? totalConfidence / successfulPages : 0,
    processingTime: Date.now() - startTime,
  };
}
