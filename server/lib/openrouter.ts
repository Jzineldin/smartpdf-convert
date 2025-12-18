const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

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

CRITICAL RULES:
1. Extract EVERY table you see, even partial ones
2. PRESERVE EXACT VALUES - copy text EXACTLY as it appears, character for character
3. DO NOT normalize, modify, or "fix" any values:
   - Keep dates exactly as shown (e.g., "2018-03-01" stays "2018-03-01", not "2018-03")
   - Keep currency formats exactly (e.g., "46000:-" stays "46000:-", not "46000+" or "46000")
   - Keep number formats exactly (e.g., "1,234.56" or "1.234,56" - preserve the original)
   - Keep special characters exactly as they appear (:-  +  %  etc.)
4. If a cell is empty, use null
5. If you're unsure about a value, include your best guess but flag it in warnings
6. Detect the header row - it's usually the first row with column names
7. Handle merged cells by repeating the value or leaving subsequent cells null
8. Keep all currency symbols, suffixes, and formatting with their values

OUTPUT FORMAT:
{
  "tables": [
    {
      "sheetName": "Descriptive name based on content",
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

/**
 * Extract tables from multiple pages and combine results
 */
export async function extractTablesFromMultiplePages(
  pages: { pageNumber: number; base64: string; mimeType: string }[],
  fileName: string,
  onProgress?: (current: number, total: number) => void
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
      page.mimeType
    );

    if (result.success) {
      // Update page numbers in tables
      const tablesWithPageNum = result.tables.map(table => ({
        ...table,
        pageNumber: page.pageNumber,
        sheetName: pages.length > 1 
          ? `${table.sheetName} (Page ${page.pageNumber})`
          : table.sheetName,
      }));
      
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
  mimeType: string = 'application/pdf'
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
            content: SYSTEM_PROMPT,
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

    return {
      success: true,
      tables: parsed.tables || [],
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
