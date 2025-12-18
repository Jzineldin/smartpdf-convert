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
2. Preserve exact values - do not modify numbers, dates, or text
3. If a cell is empty, use null
4. If you're unsure about a value, include it with your best guess and flag it in warnings
5. Detect the header row - it's usually the first row with column names
6. Handle merged cells by repeating the value or leaving subsequent cells null
7. Normalize date formats to ISO (YYYY-MM-DD) when clearly identifiable
8. Keep currency symbols with their values

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

export async function extractTablesFromPDF(
  imageBase64: string,
  fileName: string,
  mimeType: string = 'image/png'
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
                text: `Extract all tables from this PDF document: "${fileName}". Return valid JSON only, no markdown code blocks.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
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
