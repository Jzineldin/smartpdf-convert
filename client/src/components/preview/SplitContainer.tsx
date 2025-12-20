import { ReactNode } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { ViewMode } from './ViewToggle';

interface SplitContainerProps {
  mode: ViewMode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  className?: string;
  defaultLeftSize?: number;
  minLeftSize?: number;
  minRightSize?: number;
}

export default function SplitContainer({
  mode,
  leftPanel,
  rightPanel,
  className,
  defaultLeftSize = 50,
  minLeftSize = 20,
  minRightSize = 20,
}: SplitContainerProps) {
  // PDF only mode
  if (mode === 'pdf') {
    return (
      <div className={cn('h-full', className)}>
        {leftPanel}
      </div>
    );
  }

  // Table only mode
  if (mode === 'table') {
    return (
      <div className={cn('h-full', className)}>
        {rightPanel}
      </div>
    );
  }

  // Overlay mode - PDF as background with table overlay
  if (mode === 'overlay') {
    return (
      <div className={cn('relative h-full', className)}>
        <div className="absolute inset-0">
          {leftPanel}
        </div>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm overflow-auto">
          {rightPanel}
        </div>
      </div>
    );
  }

  // Split mode - side by side with resizable panels
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className={cn('h-full rounded-lg border', className)}
    >
      <ResizablePanel
        defaultSize={defaultLeftSize}
        minSize={minLeftSize}
        className="bg-background overflow-hidden"
      >
        <div className="h-full overflow-auto">
          {leftPanel}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={100 - defaultLeftSize}
        minSize={minRightSize}
        className="bg-background overflow-hidden"
      >
        <div className="h-full overflow-auto">
          {rightPanel}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
