const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

/**
 * Post-process extracted tables to fix common AI alignment issues:
 * 1. Remove empty strings that shift data
 * 2. Fill in merged cell values from previous rows
 * 3. Ensure row length matches header length
 */
function postProcessTables(tables: ExtractedTable[]): ExtractedTable[] {
  return tables.map(table => {
    const headerCount = table.headers.length;
    const processedRows: (string | null)[][] = [];

    // Track the last non-empty value for each column (for merged cells)
    const lastValues: (string | null)[] = new Array(headerCount).fill(null);

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      let row = [...table.rows[rowIndex]];

      // Step 1: Remove leading empty strings that shift data right
      // Detect if row has empty strings at start followed by data
      let leadingEmpties = 0;
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '' || row[i] === null) {
          leadingEmpties++;
        } else {
          break;
        }
      }

      // If we have leading empties and the row is longer than headers,
      // the empties are likely causing misalignment - remove them
      if (leadingEmpties > 0 && row.length > headerCount) {
        // Remove the excess empty strings
        const excess = row.length - headerCount;
        const emptiesToRemove = Math.min(leadingEmpties, excess);
        row = row.slice(emptiesToRemove);
      }

      // Step 2: If row is shorter than headers, something's wrong
      // Pad with nulls at the end
      while (row.length < headerCount) {
        row.push(null);
      }

      // Step 3: If row is longer than headers, trim from the end
      if (row.length > headerCount) {
        row = row.slice(0, headerCount);
      }

      // Step 4: Fill in empty values at the start with values from previous row
      // (handles merged cells that span multiple rows)
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const value = row[colIndex];

        // If this cell is empty/null and we have a previous value, use it
        // But only for the first few columns (typically merged cells are on the left)
        if ((value === '' || value === null) && lastValues[colIndex] !== null) {
          // Only fill if this looks like a merged cell scenario:
          // - It's in the first 3 columns (Project, Phase, Department, etc.)
          // - The rest of the row has data
          const hasDataAfter = row.slice(colIndex + 1).some(v => v !== '' && v !== null);
          if (colIndex < 3 && hasDataAfter) {
            row[colIndex] = lastValues[colIndex];
          }
        }

        // Update last values for non-empty cells
        if (value !== '' && value !== null) {
          lastValues[colIndex] = value;
        }
      }

      // Step 5: Convert empty strings to null for consistency
      row = row.map(v => v === '' ? null : v);

      processedRows.push(row);
    }

    return {
      ...table,
      rows: processedRows,
    };
  });
}

export interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number;
}

export interface AIWarning {
  type: 'low_resolution' | 'merged_cells' | 'handwriting' | 'skewed' | 'partial_table' | 'mixed_languages' | 'inconsistent_format';
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
}

const SYSTEM_PROMPT = `You are a precise data extraction AI. Your job is to extract ALL tables from PDF images and return them as structured JSON.

SHEET NAMING (STRICT - MAX 15 CHARS):
- Use ONLY short generic names: "Inventory", "Employees", "Projects", "Sales", "Budget", "Timeline", "Expenses", "Tasks", "Orders", "Contacts"
- NEVER include descriptive words like "Product", "Department", "Performance", "Status", "Metrics"
- NEVER include "(Page X)" suffix - the system adds page numbers automatically
- BAD: "Product Inventory Status", "Employee Performance Metrics", "Department Expenses"
- GOOD: "Inventory", "Employees", "Expenses"

CRITICAL: MERGED/SPANNING CELLS - READ CAREFULLY

When a cell in the PDF visually spans multiple rows (the text appears once but covers 2+ rows):
- You MUST repeat that value in EVERY row it spans
- NEVER leave empty strings "" or skip values - this breaks column alignment

EXAMPLE 1 - Project Timeline with merged cells:
Headers: ["Project", "Phase", "Task", "Owner", "Start", "End"]
If "Alpha" spans rows 1-3 and "Planning" spans rows 1-2:

Visual PDF:
| Alpha | Planning | Research | Team A | 01/07 | 05/07 |
|       |          | Design   | Team B | 06/07 | 12/07 |
|       | Dev      | Coding   | Team C | 13/07 | 20/07 |

CORRECT output (repeat merged values):
["Alpha", "Planning", "Research", "Team A", "01/07", "05/07"]
["Alpha", "Planning", "Design", "Team B", "06/07", "12/07"]
["Alpha", "Dev", "Coding", "Team C", "13/07", "20/07"]

WRONG output (missing values):
["Alpha", "Planning", "Research", "Team A", "01/07", "05/07"]
["", "", "Design", "Team B", "06/07", "12/07"]  ← WRONG: empty strings shift data
["Alpha", "Design", "Team B", "06/07", "12/07", ""]  ← WRONG: missing Phase column

EXAMPLE 2 - Department Expenses with sub-rows:
Headers: ["Department", "Category", "Jul", "Aug", "Sep", "Total"]
If "IT" is a department with sub-items Hardware and Software:

Visual PDF:
| IT        | Hardware | $12,500 | $15,200 | $11,800 | $39,500 |
|           | Software | $8,000  | $7,500  | $9,200  | $24,700 |
| Marketing | Ads      | $5,000  | $6,000  | $5,500  | $16,500 |

CORRECT output:
["IT", "Hardware", "$12,500", "$15,200", "$11,800", "$39,500"]
["IT", "Software", "$8,000", "$7,500", "$9,200", "$24,700"]
["Marketing", "Ads", "$5,000", "$6,000", "$5,500", "$16,500"]

WRONG output:
["IT", "Hardware", "$12,500", "$15,200", "$11,800", "$39,500"]
["", "Software", "$8,000", "$7,500", "$9,200", "$24,700"]  ← WRONG: "" in Department
["IT", "", "Software", "$8,000", ...]  ← WRONG: extra "" shifts everything

KEY RULES:
1. Count headers FIRST - every row needs EXACTLY that many columns
2. When a cell spans rows visually, REPEAT the value in each row
3. NEVER use empty string "" - use null ONLY for truly empty cells
4. Check alignment: if row[3] should be "Owner" data, verify it's not "Start" data

VALUE PRESERVATION:
- Copy text EXACTLY: "46000:-" stays "46000:-", "2018-03-01" stays "2018-03-01"

VALIDATION - DO THIS BEFORE OUTPUTTING:
For each row: count values. If count != header count, you have an error. Fix it.

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Short Name",
      "pageNumber": 1,
      "headers": ["Column1", "Column2", ...],
      "rows": [
        ["value1", "value2", ...],
        ...
      ],
      "confidence": 0.95
    }
  ],
  "warnings": [
    {
      "type": "low_resolution|merged_cells|handwriting|skewed|partial_table|mixed_languages|inconsistent_format",
      "message": "Human-readable description",
      "pageNumber": 1,
      "suggestion": "What the user should check or do"
    }
  ],
  "overallConfidence": 0.92
}

WARNING TYPES:
- low_resolution: Image quality is poor, OCR may have errors
- merged_cells: Detected cells spanning multiple columns/rows
- handwriting: Detected handwritten text which is harder to read
- skewed: Document appears rotated or skewed
- partial_table: Table appears cut off or continues on another page
- mixed_languages: Multiple languages detected
- inconsistent_format: Dates, numbers, or currencies in inconsistent formats`;

const FALLBACK_PROMPT = `You are a precise data extraction AI. The document contains NO traditional tables, but may have structured data that should be extracted.

TASK: Analyze this document, determine what type it is, and extract ALL relevant structured information as a two-column table (Field | Value).

YOU DECIDE:
- What type of document this is
- What fields are relevant to extract
- How to label the fields appropriately
- How to structure the data logically

EXTRACTION GUIDELINES:
1. First, identify the document type (ID, contract, letter, certificate, form, receipt, invoice, report, etc.)
2. Extract ALL meaningful data points you can find
3. Use clear, descriptive field names in English
4. Preserve original values exactly (dates, numbers, names, codes, special characters)
5. For multi-line content (addresses, paragraphs), combine sensibly or split into logical parts
6. Group related fields together (e.g., all dates together, all personal info together)
7. Include metadata if visible (document date, reference numbers, page numbers)
8. For machine-readable codes (MRZ, barcodes, QR content), parse into human-readable fields

EXAMPLES OF WHAT TO EXTRACT:
- IDs/Passports: name, number, dates, nationality, issuing authority
- Contracts: parties, dates, terms, signatures, reference numbers
- Letters: sender, recipient, date, subject, key points
- Certificates: recipient, issuer, date, title, validity
- Forms: all filled fields and their values
- Receipts: vendor, date, items, totals, payment method
- Any document: dates, names, numbers, codes, addresses, key text

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Extracted Data",
      "pageNumber": 1,
      "headers": ["Field", "Value"],
      "rows": [
        ["Document Type", "<what you identified>"],
        ["<relevant field 1>", "<value>"],
        ["<relevant field 2>", "<value>"]
      ],
      "confidence": 0.90
    }
  ],
  "warnings": [],
  "overallConfidence": 0.90
}

IMPORTANT:
- Be thorough - extract everything that could be useful
- Be smart about field naming - use what makes sense for THIS document
- If multiple pages have different content, note which page data came from
- If you're unsure about a value, extract it anyway with your best interpretation
- The first row should always identify the Document Type you detected`;

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
      // Update page numbers in tables
      const tablesWithPageNum = result.tables.map(table => {
        let sheetName = table.sheetName;

        // Add page number suffix for multi-page documents
        if (pages.length > 1) {
          const suffix = ` (P${page.pageNumber})`;
          // Excel sheet names max 31 chars - truncate base name if needed
          const maxBaseLength = 31 - suffix.length;
          if (sheetName.length > maxBaseLength) {
            sheetName = sheetName.substring(0, maxBaseLength);
          }
          sheetName = sheetName + suffix;
        }

        // Final safety truncation to 31 chars
        if (sheetName.length > 31) {
          sheetName = sheetName.substring(0, 31);
        }

        return {
          ...table,
          pageNumber: page.pageNumber,
          sheetName,
        };
      });
      
      allTables.push(...tablesWithPageNum);
      
      // Update page numbers in warnings
      const warningsWithPageNum = result.warnings.map(warning => ({
        ...warning,
        pageNumber: page.pageNumber,
      }));
      
      allWarnings.push(...warningsWithPageNum);
      totalConfidence += result.confidence;
      successfulPages++;
    } else {
      // Add warning for failed page
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

export async function extractTablesFromPDF(
  fileBase64: string,
  fileName: string,
  mimeType: string = 'application/pdf',
  customSystemPrompt?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  if (!OPENROUTER_API_KEY) {
    return {
      success: false,
      tables: [],
      warnings: [],
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: 'OpenRouter API key not configured',
      errorCode: 'CONFIG_ERROR',
    };
  }

  try {
    // Ensure base64 is clean (no data URL prefix)
    let cleanBase64 = fileBase64;
    if (fileBase64.includes(',')) {
      cleanBase64 = fileBase64.split(',')[1];
    }
    
    // Remove any whitespace or newlines from base64
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    // For PDF files, we need to send as image/png or convert
    // OpenRouter/GPT-4V expects image formats, not PDF
    // We'll use image/png as the mime type for the data URL
    const imageMimeType = mimeType === 'application/pdf' ? 'image/png' : mimeType;
    
    // Create proper data URL format
    const dataUrl = `data:${imageMimeType};base64,${cleanBase64}`;

    console.log(`Processing file: ${fileName}, mime: ${mimeType}, base64 length: ${cleanBase64.length}`);

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://smartpdf-convert.com',
        'X-Title': 'SmartPDF Convert',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: customSystemPrompt || SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all tables from this document: "${fileName}". Return valid JSON only, no markdown code blocks.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      
      // Check for specific error types
      if (errorText.includes('Invalid image URL')) {
        return {
          success: false,
          tables: [],
          warnings: [],
          confidence: 0,
          processingTime: Date.now() - startTime,
          error: 'Unable to process this PDF. Please try converting it to an image (PNG/JPG) first, or use a different PDF.',
          errorCode: 'INVALID_IMAGE_FORMAT',
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

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        tables: [],
        warnings: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: 'No response from AI',
        errorCode: 'AI_NO_RESPONSE',
      };
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let parsed;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
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

    // Post-process tables to fix alignment issues
    const processedTables = postProcessTables(parsed.tables || []);

    // If no tables found, try fallback extraction for structured data
    if (processedTables.length === 0) {
      console.log('No tables found, attempting intelligent key-value extraction...');

      const fallbackResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smartpdf-convert.com',
          'X-Title': 'SmartPDF Convert',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: [
            { role: 'system', content: FALLBACK_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Analyze this document and extract all structured data: "${fileName}". Return valid JSON only.` },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        }),
      });

      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json();
        const fallbackContent = fallbackResult.choices?.[0]?.message?.content;

        if (fallbackContent) {
          try {
            const fallbackParsed = JSON.parse(fallbackContent.replace(/```json\n?|\n?```/g, '').trim());

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
                confidence: fallbackParsed.overallConfidence || 0.85,
                processingTime: Date.now() - startTime,
              };
            }
          } catch (e) {
            console.error('Fallback parsing failed:', e);
          }
        }
      }
    }

    return {
      success: true,
      tables: processedTables,
      warnings: parsed.warnings || [],
      confidence: parsed.overallConfidence || 0.9,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error('AI extraction error:', error);
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
