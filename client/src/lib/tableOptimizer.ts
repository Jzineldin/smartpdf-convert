/**
 * Post-extraction table optimization utilities
 * Analyzes extracted tables and suggests ways to reduce clutter or improve structure
 */

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

export interface ExtractedTable {
  sheetName: string;
  headers: string[];
  rows: (string | null)[][];
  pageNumber: number;
  confidence: number | ConfidenceBreakdown;
  sourceFile?: string;
}

export interface TableSuggestion {
  id: string;
  type: 'combine_similar' | 'merge_pricing' | 'remove_small' | 'consolidate_details';
  title: string;
  description: string;
  impact: string;
  tableIndices: number[]; // Which tables this affects
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  suggestions: TableSuggestion[];
  stats: {
    totalTables: number;
    uniqueStructures: number;
    smallTables: number;
    potentialMerges: number;
  };
}

/**
 * Generate a structure signature for a table based on its headers
 */
function getStructureSignature(table: ExtractedTable): string {
  // Normalize headers for comparison
  const normalizedHeaders = table.headers
    .map(h => h.toLowerCase().trim())
    .sort()
    .join('|');
  return `${table.headers.length}:${normalizedHeaders}`;
}

/**
 * Check if two tables have compatible structures for merging
 */
function areStructuresCompatible(table1: ExtractedTable, table2: ExtractedTable): boolean {
  if (table1.headers.length !== table2.headers.length) return false;

  // Check if headers match (case-insensitive)
  const headers1 = table1.headers.map(h => h.toLowerCase().trim());
  const headers2 = table2.headers.map(h => h.toLowerCase().trim());

  return headers1.every((h, i) => h === headers2[i]);
}

/**
 * Detect if tables appear to be pricing/tier tables
 */
function isPricingTable(table: ExtractedTable): boolean {
  const pricingKeywords = ['pris', 'price', 'tier', 'plan', 'cost', '$', '€', 'kr', '/mån', '/month', 'monthly', 'annual'];

  // Check headers
  const headersLower = table.headers.map(h => h.toLowerCase()).join(' ');
  if (pricingKeywords.some(kw => headersLower.includes(kw))) return true;

  // Check first few rows
  const sampleData = table.rows.slice(0, 3).flat().filter(Boolean).join(' ').toLowerCase();
  if (pricingKeywords.some(kw => sampleData.includes(kw))) return true;

  // Check for currency patterns in data
  const hasCurrency = table.rows.some(row =>
    row.some(cell => cell && /\$[\d,]+|\d+\s*(kr|SEK|€|£)|\d+\/m[åo]n/i.test(cell))
  );

  return hasCurrency;
}

/**
 * Detect if tables appear to be detail/aspect tables (key-value format)
 */
function isDetailTable(table: ExtractedTable): boolean {
  // Common patterns for detail tables
  const detailPatterns = [
    /aspekt/i, /detail/i, /property/i, /attribute/i,
    /styrk/i, /svagh/i, /fördel/i, // Swedish: strengths, weaknesses, advantage
  ];

  // Check if it's a 2-column table with key-value structure
  if (table.headers.length !== 2) return false;

  const headersLower = table.headers.map(h => h.toLowerCase()).join(' ');
  return detailPatterns.some(p => p.test(headersLower)) ||
    (headersLower.includes('aspekt') && headersLower.includes('detalj'));
}

/**
 * Generate a fuzzy structure signature for broader matching
 * Allows tables with similar column counts to be grouped
 */
function getFuzzyStructureSignature(table: ExtractedTable): string {
  const colCount = table.headers.length;
  // Group by column count ranges: 2, 3-4, 5+
  const colGroup = colCount <= 2 ? '2' : colCount <= 4 ? '3-4' : '5+';

  // Check for common patterns
  const headersLower = table.headers.map(h => h.toLowerCase().trim());

  // Aspekt/Detalj pattern (very common in Swedish docs)
  if (headersLower.some(h => h.includes('aspekt')) ||
      headersLower.some(h => h.includes('detalj'))) {
    return 'aspekt-detalj';
  }

  // Key-value style tables (2 columns with descriptive headers)
  if (colCount === 2) {
    return '2col-keyvalue';
  }

  return `${colGroup}col`;
}

/**
 * Analyze tables and generate optimization suggestions
 */
export function analyzeTablesForOptimization(tables: ExtractedTable[]): AnalysisResult {
  const suggestions: TableSuggestion[] = [];

  // Group tables by structure
  const structureGroups: Map<string, number[]> = new Map();
  tables.forEach((table, index) => {
    const sig = getStructureSignature(table);
    if (!structureGroups.has(sig)) {
      structureGroups.set(sig, []);
    }
    structureGroups.get(sig)!.push(index);
  });

  // Also group by fuzzy structure for broader suggestions
  const fuzzyGroups: Map<string, number[]> = new Map();
  tables.forEach((table, index) => {
    const sig = getFuzzyStructureSignature(table);
    if (!fuzzyGroups.has(sig)) {
      fuzzyGroups.set(sig, []);
    }
    fuzzyGroups.get(sig)!.push(index);
  });

  // Find groups with multiple tables that could be combined
  let suggestionId = 0;
  structureGroups.forEach((indices, signature) => {
    if (indices.length >= 3) {
      // Check if these are detail tables (Aspekt | Detalj format)
      const sampleTable = tables[indices[0]];

      if (isDetailTable(sampleTable)) {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: 'combine_similar',
          title: `Combine ${indices.length} similar detail tables`,
          description: `Found ${indices.length} tables with "${sampleTable.headers.join(' | ')}" structure. These can be merged into one table with a "Source" column to identify where each row came from.`,
          impact: `Reduces ${indices.length} tables to 1`,
          tableIndices: indices,
          priority: indices.length >= 5 ? 'high' : 'medium',
        });
      } else if (isPricingTable(sampleTable)) {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: 'merge_pricing',
          title: `Merge ${indices.length} pricing tables`,
          description: `Found ${indices.length} pricing/tier tables with similar structure. These can be combined into a unified pricing comparison table.`,
          impact: `Reduces ${indices.length} tables to 1`,
          tableIndices: indices,
          priority: 'high',
        });
      } else {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: 'consolidate_details',
          title: `Consolidate ${indices.length} tables with same structure`,
          description: `These tables have identical column structure and could be merged with a source identifier column.`,
          impact: `Reduces ${indices.length} tables to 1`,
          tableIndices: indices,
          priority: 'medium',
        });
      }
    }
  });

  // Check fuzzy groups for additional suggestions (only if no exact matches)
  // This catches tables with similar but not identical structures
  const indicesInExactGroups = new Set<number>();
  structureGroups.forEach((indices) => {
    if (indices.length >= 3) {
      indices.forEach(i => indicesInExactGroups.add(i));
    }
  });

  fuzzyGroups.forEach((indices, fuzzySignature) => {
    // Filter out tables already included in exact-match suggestions
    const remainingIndices = indices.filter(i => !indicesInExactGroups.has(i));

    if (remainingIndices.length >= 3) {
      // Check what type of fuzzy group this is
      if (fuzzySignature === 'aspekt-detalj') {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: 'combine_similar',
          title: `Combine ${remainingIndices.length} Aspekt/Detalj tables`,
          description: `Found ${remainingIndices.length} tables with Aspekt/Detalj structure. These appear to be details about different items and could be merged with a source identifier.`,
          impact: `Reduces ${remainingIndices.length} tables to 1`,
          tableIndices: remainingIndices,
          priority: 'high',
        });
      } else if (fuzzySignature === '2col-keyvalue') {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: 'combine_similar',
          title: `Combine ${remainingIndices.length} two-column tables`,
          description: `Found ${remainingIndices.length} tables with key-value structure. These could be consolidated into a single reference table.`,
          impact: `Reduces ${remainingIndices.length} tables to 1`,
          tableIndices: remainingIndices,
          priority: 'medium',
        });
      }
    }
  });

  // Find small tables (1-2 rows) that might be removable
  const smallTableIndices = tables
    .map((t, i) => ({ table: t, index: i }))
    .filter(({ table }) => table.rows.length <= 2)
    .map(({ index }) => index);

  if (smallTableIndices.length >= 3) {
    suggestions.push({
      id: `suggestion_${suggestionId++}`,
      type: 'remove_small',
      title: `${smallTableIndices.length} tables have very few rows`,
      description: `These tables have only 1-2 rows of data. You can remove them if they're not important, or they might be better as part of a larger table.`,
      impact: `Could remove up to ${smallTableIndices.length} small tables`,
      tableIndices: smallTableIndices,
      priority: 'low',
    });
  }

  // If still no suggestions but many tables, suggest general consolidation
  if (suggestions.length === 0 && tables.length >= 10) {
    // Group tables by their names (removing page numbers)
    const nameGroups: Map<string, number[]> = new Map();
    tables.forEach((table, index) => {
      // Extract base name without page suffix
      const baseName = table.sheetName
        .replace(/\s*\(P\d+\)\s*$/i, '')
        .replace(/\s*Page\s*\d+\s*$/i, '')
        .trim()
        .toLowerCase();

      if (!nameGroups.has(baseName)) {
        nameGroups.set(baseName, []);
      }
      nameGroups.get(baseName)!.push(index);
    });

    // Check for tables with similar names
    nameGroups.forEach((indices, baseName) => {
      if (indices.length >= 2 && baseName.length > 3) {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: 'consolidate_details',
          title: `Combine ${indices.length} "${baseName}" tables`,
          description: `Found ${indices.length} tables with similar names. These might be related data that can be merged.`,
          impact: `Reduces ${indices.length} tables to 1`,
          tableIndices: indices,
          priority: 'low',
        });
      }
    });
  }

  // Always provide a "combine all similar structure" option if we have many 2-column tables
  const twoColumnTables = tables
    .map((t, i) => ({ table: t, index: i }))
    .filter(({ table }) => table.headers.length === 2);

  if (twoColumnTables.length >= 5 && !suggestions.some(s => s.tableIndices.length >= 5)) {
    suggestions.push({
      id: `suggestion_${suggestionId++}`,
      type: 'combine_similar',
      title: `Combine ${twoColumnTables.length} two-column tables`,
      description: `Found ${twoColumnTables.length} tables with 2-column structure (likely key-value or comparison tables). These can be merged into a single consolidated table with a source identifier column.`,
      impact: `Reduces ${twoColumnTables.length} tables to 1`,
      tableIndices: twoColumnTables.map(t => t.index),
      priority: 'medium',
    });
  }

  // Calculate stats
  const stats = {
    totalTables: tables.length,
    uniqueStructures: structureGroups.size,
    smallTables: smallTableIndices.length,
    potentialMerges: suggestions.filter(s => s.type !== 'remove_small').reduce((sum, s) => sum + s.tableIndices.length - 1, 0),
  };

  return { suggestions, stats };
}

/**
 * Apply a "combine similar" suggestion - merge tables with same structure
 */
export function applyCombineSimilar(
  tables: ExtractedTable[],
  tableIndices: number[]
): ExtractedTable[] {
  if (tableIndices.length < 2) return tables;

  const tablesToMerge = tableIndices.map(i => tables[i]);
  const firstTable = tablesToMerge[0];

  // Create new headers with "Source" column first
  const newHeaders = ['Source', ...firstTable.headers];

  // Combine all rows with source identifier
  const newRows: (string | null)[][] = [];
  for (const table of tablesToMerge) {
    // Extract a short source name from sheetName
    const sourceName = table.sheetName
      .replace(/\s*\(P\d+\)\s*$/, '') // Remove page suffix
      .substring(0, 20);

    for (const row of table.rows) {
      newRows.push([sourceName, ...row]);
    }
  }

  // Create the merged table
  const mergedTable: ExtractedTable = {
    sheetName: 'Combined Data',
    headers: newHeaders,
    rows: newRows,
    pageNumber: firstTable.pageNumber,
    confidence: tablesToMerge.reduce((sum, t) => {
      const conf = typeof t.confidence === 'number' ? t.confidence : t.confidence.overall;
      return sum + conf;
    }, 0) / tablesToMerge.length,
  };

  // Return new table list with merged table replacing the originals
  const indicesToRemove = new Set(tableIndices);
  const remainingTables = tables.filter((_, i) => !indicesToRemove.has(i));

  // Insert merged table at position of first original
  const insertPosition = tableIndices[0];
  const adjustedPosition = remainingTables.length > 0
    ? Math.min(insertPosition, remainingTables.length)
    : 0;

  remainingTables.splice(adjustedPosition, 0, mergedTable);

  return remainingTables;
}

/**
 * Apply a "remove small" suggestion - filter out tables with few rows
 */
export function applyRemoveSmall(
  tables: ExtractedTable[],
  tableIndices: number[]
): ExtractedTable[] {
  const indicesToRemove = new Set(tableIndices);
  return tables.filter((_, i) => !indicesToRemove.has(i));
}

/**
 * Get a human-readable summary of what will change
 */
export function getSuggestionSummary(suggestion: TableSuggestion, tables: ExtractedTable[]): string {
  const affectedNames = suggestion.tableIndices
    .map(i => tables[i]?.sheetName || `Table ${i + 1}`)
    .slice(0, 5);

  if (affectedNames.length < suggestion.tableIndices.length) {
    affectedNames.push(`... and ${suggestion.tableIndices.length - 5} more`);
  }

  return `Affects: ${affectedNames.join(', ')}`;
}
