import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, Table2, Columns2, Layers } from 'lucide-react';

export type ViewMode = 'pdf' | 'table' | 'split' | 'overlay';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  disabled?: boolean;
  availableModes?: ViewMode[];
}

const viewModeConfig: Record<ViewMode, { icon: React.ReactNode; label: string; description: string }> = {
  pdf: {
    icon: <FileText className="h-4 w-4" />,
    label: 'PDF',
    description: 'View original PDF only',
  },
  table: {
    icon: <Table2 className="h-4 w-4" />,
    label: 'Table',
    description: 'View extracted data only',
  },
  split: {
    icon: <Columns2 className="h-4 w-4" />,
    label: 'Split',
    description: 'Side-by-side PDF and table',
  },
  overlay: {
    icon: <Layers className="h-4 w-4" />,
    label: 'Overlay',
    description: 'PDF with data overlay',
  },
};

export default function ViewToggle({
  value,
  onChange,
  className,
  disabled = false,
  availableModes = ['pdf', 'table', 'split'],
}: ViewToggleProps) {
  return (
    <div className={cn('inline-flex rounded-lg border bg-muted p-1', className)}>
      {availableModes.map((mode) => {
        const config = viewModeConfig[mode];
        return (
          <Button
            key={mode}
            variant={value === mode ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(mode)}
            disabled={disabled}
            className={cn(
              'gap-1.5 px-3',
              value === mode && 'shadow-sm'
            )}
            title={config.description}
          >
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
