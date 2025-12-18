import { useRef, useEffect, useState, useCallback } from 'react';
import { HotTable, HotTableClass } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Plus, Trash2, Save } from 'lucide-react';

// Register all Handsontable modules
registerAllModules();

export interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

interface SpreadsheetEditorProps {
  initialData: SheetData[];
  onExport: (sheets: { name: string; data: (string | number | null)[][] }[]) => void;
  onSave?: (sheets: SheetData[]) => void;
  isExporting?: boolean;
}

export default function SpreadsheetEditor({
  initialData,
  onExport,
  onSave,
  isExporting = false,
}: SpreadsheetEditorProps) {
  const [sheets, setSheets] = useState<SheetData[]>(initialData);
  const [activeSheet, setActiveSheet] = useState(0);
  const hotRef = useRef<HotTableClass>(null);

  // Update sheets when initialData changes
  useEffect(() => {
    setSheets(initialData);
    setActiveSheet(0);
  }, [initialData]);

  const getCurrentSheetData = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return null;

    const data = hot.getData() as (string | number | null)[][];
    return data;
  }, []);

  const handleSheetChange = (index: number) => {
    // Save current sheet data before switching
    const currentData = getCurrentSheetData();
    if (currentData) {
      setSheets(prev => {
        const updated = [...prev];
        updated[activeSheet] = {
          ...updated[activeSheet],
          rows: currentData.slice(1), // Exclude header row
          headers: currentData[0] as string[],
        };
        return updated;
      });
    }
    setActiveSheet(index);
  };

  const handleExport = () => {
    // Get latest data from current sheet
    const currentData = getCurrentSheetData();
    const updatedSheets = [...sheets];
    
    if (currentData) {
      updatedSheets[activeSheet] = {
        ...updatedSheets[activeSheet],
        rows: currentData.slice(1),
        headers: currentData[0] as string[],
      };
    }

    // Format for export
    const exportData = updatedSheets.map(sheet => ({
      name: sheet.name,
      data: [sheet.headers, ...sheet.rows],
    }));

    onExport(exportData);
  };

  const handleAddRow = () => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      hot.alter('insert_row_below', hot.countRows() - 1);
    }
  };

  const handleAddColumn = () => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      hot.alter('insert_col_end');
    }
  };

  const handleDeleteRow = () => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      const selected = hot.getSelected();
      if (selected && selected.length > 0) {
        const [startRow] = selected[0];
        if (startRow > 0) { // Don't delete header row
          hot.alter('remove_row', startRow);
        }
      }
    }
  };

  const currentSheet = sheets[activeSheet];
  const tableData = currentSheet
    ? [currentSheet.headers, ...currentSheet.rows]
    : [['']];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Edit Extracted Data</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAddRow}>
              <Plus className="h-4 w-4 mr-1" />
              Row
            </Button>
            <Button variant="outline" size="sm" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-1" />
              Column
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteRow}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Row
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sheets.length > 1 && (
          <Tabs
            value={activeSheet.toString()}
            onValueChange={(v) => handleSheetChange(parseInt(v))}
            className="mb-4"
          >
            <TabsList>
              {sheets.map((sheet, index) => (
                <TabsTrigger key={index} value={index.toString()}>
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="border rounded-lg overflow-hidden">
          <HotTable
            ref={hotRef}
            data={tableData}
            rowHeaders={true}
            colHeaders={true}
            height={400}
            width="100%"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            contextMenu={true}
            manualColumnResize={true}
            manualRowResize={true}
            autoWrapRow={true}
            autoWrapCol={true}
            fixedRowsTop={1}
            cells={(row) => {
              const cellProperties: any = {};
              if (row === 0) {
                cellProperties.className = 'htCenter htMiddle font-bold bg-muted';
              }
              return cellProperties;
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Tip: Double-click a cell to edit. Right-click for more options. The first row is treated as headers.
        </p>
      </CardContent>
    </Card>
  );
}
