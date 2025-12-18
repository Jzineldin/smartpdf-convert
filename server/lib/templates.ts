/**
 * Specialized extraction templates with optimized AI prompts
 * Pro-only feature for better accuracy on specific document types
 */

export interface ExtractionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPro: boolean;
  expectedFields: string[];
  systemPrompt: string;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  type: 'sum_check' | 'date_format' | 'required_field' | 'numeric_range';
  field?: string;
  params?: Record<string, any>;
}

export const EXTRACTION_TEMPLATES: ExtractionTemplate[] = [
  {
    id: 'generic',
    name: 'Generic Table',
    description: 'Extract any table structure from your document',
    icon: 'Table',
    isPro: false,
    expectedFields: [],
    systemPrompt: `You are a precise table extraction system. Extract ALL tables from this document image.

CRITICAL RULES:
1. Preserve EXACT original values - do not normalize, convert, or modify any data
2. Keep original date formats exactly as shown (e.g., "2018-03-01" stays "2018-03-01", not "2018-03")
3. Keep original number formats exactly as shown (e.g., "46000:-" stays "46000:-", not "46000")
4. Keep currency symbols, special characters, and formatting exactly as displayed
5. For merged cells, include the value only once in the appropriate position
6. Extract ALL rows and columns - do not skip any data

Return a JSON object with this structure:
{
  "tables": [
    {
      "sheetName": "Table 1",
      "headers": ["Column1", "Column2", ...],
      "rows": [["value1", "value2", ...], ...],
      "confidence": 0.95
    }
  ],
  "warnings": ["any issues encountered"]
}`
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Extract vendor info, line items, totals, and payment details',
    icon: 'Receipt',
    isPro: true,
    expectedFields: ['vendor_name', 'invoice_number', 'invoice_date', 'due_date', 'line_items', 'subtotal', 'tax', 'total'],
    systemPrompt: `You are a specialized invoice extraction system. Extract structured data from this invoice image.

EXTRACT THE FOLLOWING:
1. **Header Information:**
   - Vendor/Company name
   - Vendor address
   - Invoice number
   - Invoice date
   - Due date
   - PO number (if present)

2. **Customer Information:**
   - Bill to name/company
   - Bill to address
   - Ship to address (if different)

3. **Line Items Table:**
   - Item description
   - Quantity
   - Unit price
   - Amount/Total for each line
   - Any item codes or SKUs

4. **Totals:**
   - Subtotal
   - Tax amount and rate
   - Shipping/handling (if present)
   - Discounts (if present)
   - Grand total

5. **Payment Information:**
   - Payment terms
   - Bank details (if shown)
   - Payment instructions

CRITICAL RULES:
- Preserve EXACT original values - do not normalize currencies or dates
- Keep original number formats (e.g., "1,234.56" or "1.234,56")
- Include ALL line items, even if table spans multiple pages
- Calculate confidence based on clarity and completeness

Return JSON:
{
  "tables": [
    {
      "sheetName": "Invoice Details",
      "headers": ["Field", "Value"],
      "rows": [
        ["Vendor", "..."],
        ["Invoice #", "..."],
        ["Date", "..."],
        ["Due Date", "..."],
        ["Total", "..."]
      ],
      "confidence": 0.95
    },
    {
      "sheetName": "Line Items",
      "headers": ["Description", "Qty", "Unit Price", "Amount"],
      "rows": [...],
      "confidence": 0.95
    }
  ],
  "metadata": {
    "vendor_name": "...",
    "invoice_number": "...",
    "invoice_date": "...",
    "due_date": "...",
    "subtotal": "...",
    "tax": "...",
    "total": "..."
  },
  "warnings": []
}`,
    validationRules: [
      { type: 'required_field', field: 'invoice_number' },
      { type: 'required_field', field: 'total' },
      { type: 'sum_check', params: { lineItemsField: 'amount', totalField: 'subtotal' } }
    ]
  },
  {
    id: 'bank_statement',
    name: 'Bank Statement',
    description: 'Extract transactions, running balance, and account details',
    icon: 'Landmark',
    isPro: true,
    expectedFields: ['account_number', 'statement_period', 'opening_balance', 'closing_balance', 'transactions'],
    systemPrompt: `You are a specialized bank statement extraction system. Extract structured data from this bank statement image.

EXTRACT THE FOLLOWING:
1. **Account Information:**
   - Bank name
   - Account holder name
   - Account number (may be partially masked)
   - Statement period (start and end dates)
   - Account type (checking, savings, etc.)

2. **Balance Summary:**
   - Opening/Beginning balance
   - Total deposits/credits
   - Total withdrawals/debits
   - Closing/Ending balance

3. **Transaction Table:**
   - Date
   - Description/Memo
   - Reference number (if present)
   - Debit amount (withdrawals)
   - Credit amount (deposits)
   - Running balance (if shown)
   - Transaction type/category (if shown)

CRITICAL RULES:
- Preserve EXACT original values - do not normalize dates or amounts
- Keep original date formats (MM/DD/YYYY, DD/MM/YYYY, etc.)
- Keep original number formats including currency symbols
- Negative amounts should be preserved as shown (parentheses, minus sign, etc.)
- Extract ALL transactions in chronological order
- If statement spans multiple pages, combine all transactions
- Running balance helps verify extraction accuracy

VALIDATION:
- Opening balance + deposits - withdrawals should equal closing balance
- Flag any discrepancies in warnings

Return JSON:
{
  "tables": [
    {
      "sheetName": "Account Summary",
      "headers": ["Field", "Value"],
      "rows": [
        ["Bank", "..."],
        ["Account Number", "..."],
        ["Statement Period", "..."],
        ["Opening Balance", "..."],
        ["Closing Balance", "..."]
      ],
      "confidence": 0.95
    },
    {
      "sheetName": "Transactions",
      "headers": ["Date", "Description", "Debit", "Credit", "Balance"],
      "rows": [...],
      "confidence": 0.95
    }
  ],
  "metadata": {
    "bank_name": "...",
    "account_number": "...",
    "statement_period": "...",
    "opening_balance": "...",
    "closing_balance": "...",
    "total_deposits": "...",
    "total_withdrawals": "..."
  },
  "warnings": []
}`,
    validationRules: [
      { type: 'required_field', field: 'account_number' },
      { type: 'required_field', field: 'closing_balance' },
      { type: 'sum_check', params: { 
        openingField: 'opening_balance',
        depositsField: 'total_deposits',
        withdrawalsField: 'total_withdrawals',
        closingField: 'closing_balance'
      }}
    ]
  },
  {
    id: 'expense_report',
    name: 'Expense Report',
    description: 'Extract expense items, categories, and reimbursement totals',
    icon: 'CreditCard',
    isPro: true,
    expectedFields: ['employee_name', 'report_date', 'expense_items', 'total_amount'],
    systemPrompt: `You are a specialized expense report extraction system. Extract structured data from this expense report image.

EXTRACT THE FOLLOWING:
1. **Report Information:**
   - Employee name
   - Department
   - Report date/period
   - Report number/ID
   - Approval status (if shown)

2. **Expense Items Table:**
   - Date of expense
   - Category (meals, travel, lodging, etc.)
   - Description/Purpose
   - Vendor/Merchant
   - Amount
   - Currency
   - Receipt attached (Y/N)
   - Project/Cost center (if shown)

3. **Totals:**
   - Total by category
   - Grand total
   - Amount approved (if different)
   - Advance received (if any)
   - Net reimbursement due

CRITICAL RULES:
- Preserve EXACT original values
- Keep original currency formats
- Include ALL expense line items
- Note any items marked as non-reimbursable

Return JSON:
{
  "tables": [
    {
      "sheetName": "Report Summary",
      "headers": ["Field", "Value"],
      "rows": [...],
      "confidence": 0.95
    },
    {
      "sheetName": "Expenses",
      "headers": ["Date", "Category", "Description", "Vendor", "Amount"],
      "rows": [...],
      "confidence": 0.95
    }
  ],
  "metadata": {
    "employee_name": "...",
    "report_date": "...",
    "total_amount": "..."
  },
  "warnings": []
}`
  },
  {
    id: 'inventory',
    name: 'Inventory List',
    description: 'Extract product codes, quantities, locations, and values',
    icon: 'Package',
    isPro: true,
    expectedFields: ['product_code', 'description', 'quantity', 'unit_cost', 'total_value'],
    systemPrompt: `You are a specialized inventory extraction system. Extract structured data from this inventory list/report.

EXTRACT THE FOLLOWING:
1. **Inventory Items Table:**
   - SKU/Product code
   - Product name/description
   - Category
   - Location/Warehouse/Bin
   - Quantity on hand
   - Unit of measure
   - Unit cost
   - Extended value (qty × cost)
   - Reorder point (if shown)
   - Last count date (if shown)

2. **Summary:**
   - Total items/SKUs
   - Total quantity
   - Total inventory value
   - Report date

CRITICAL RULES:
- Preserve EXACT original values
- Keep original product codes exactly as shown
- Include ALL items even if list is long
- Maintain original number formats

Return JSON:
{
  "tables": [
    {
      "sheetName": "Inventory",
      "headers": ["SKU", "Description", "Location", "Qty", "Unit Cost", "Total Value"],
      "rows": [...],
      "confidence": 0.95
    }
  ],
  "metadata": {
    "report_date": "...",
    "total_items": "...",
    "total_value": "..."
  },
  "warnings": []
}`
  },
  {
    id: 'sales_report',
    name: 'Sales Report',
    description: 'Extract sales data, revenue figures, and performance metrics',
    icon: 'TrendingUp',
    isPro: true,
    expectedFields: ['period', 'total_sales', 'transactions', 'top_products'],
    systemPrompt: `You are a specialized sales report extraction system. Extract structured data from this sales report.

EXTRACT THE FOLLOWING:
1. **Report Period & Summary:**
   - Report period (date range)
   - Total revenue/sales
   - Number of transactions
   - Average transaction value
   - Comparison to previous period (if shown)

2. **Sales by Category/Product:**
   - Product/Category name
   - Units sold
   - Revenue
   - Percentage of total

3. **Sales by Time Period (if shown):**
   - Daily/Weekly/Monthly breakdown
   - Trends and patterns

4. **Top Performers:**
   - Top products
   - Top customers
   - Top sales reps (if shown)

CRITICAL RULES:
- Preserve EXACT original values
- Keep original currency and percentage formats
- Include ALL data rows
- Note any YoY or MoM comparisons

Return JSON:
{
  "tables": [
    {
      "sheetName": "Summary",
      "headers": ["Metric", "Value"],
      "rows": [...],
      "confidence": 0.95
    },
    {
      "sheetName": "Sales by Product",
      "headers": ["Product", "Units", "Revenue", "% of Total"],
      "rows": [...],
      "confidence": 0.95
    }
  ],
  "metadata": {
    "period": "...",
    "total_sales": "...",
    "transaction_count": "..."
  },
  "warnings": []
}`
  }
];

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): ExtractionTemplate | undefined {
  return EXTRACTION_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get all available templates
 */
export function getAllTemplates(): ExtractionTemplate[] {
  return EXTRACTION_TEMPLATES;
}

/**
 * Get free templates only
 */
export function getFreeTemplates(): ExtractionTemplate[] {
  return EXTRACTION_TEMPLATES.filter(t => !t.isPro);
}

/**
 * Get Pro templates only
 */
export function getProTemplates(): ExtractionTemplate[] {
  return EXTRACTION_TEMPLATES.filter(t => t.isPro);
}
