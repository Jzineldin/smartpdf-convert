import { CheckCircle, Circle, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export type ProcessingStep = 'upload' | 'analyze' | 'extract' | 'verify' | 'ready' | 'error';

interface ProcessingStatusProps {
  currentStep: ProcessingStep;
  error?: string;
  progress?: number;
}

const STEPS = [
  { id: 'upload', label: 'Uploading', description: 'Sending your file to our secure servers' },
  { id: 'analyze', label: 'Analyzing', description: 'AI is scanning your PDF for tables' },
  { id: 'extract', label: 'Extracting', description: 'Reading and structuring table data' },
  { id: 'verify', label: 'Verifying', description: 'Checking for potential issues' },
  { id: 'ready', label: 'Ready', description: 'Your data is ready to edit' },
];

const PROCESSING_FACTS = [
  "Our AI can read tables in over 50 languages",
  "We process over 10,000 PDFs every day",
  "Even scanned documents from the 1990s work great",
  "The average conversion takes about 15 seconds",
  "Your files are automatically deleted after 7 days",
];

export default function ProcessingStatus({ currentStep, error, progress }: ProcessingStatusProps) {
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const randomFact = PROCESSING_FACTS[Math.floor(Math.random() * PROCESSING_FACTS.length)];

  if (currentStep === 'error') {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-red-900 dark:text-red-100">Processing Failed</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error || 'An unexpected error occurred. Please try again.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold">Processing your PDF...</h3>
        <p className="text-sm text-muted-foreground">This usually takes 10-30 seconds</p>
      </div>

      {progress !== undefined && (
        <Progress value={progress} className="h-2" />
      )}

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrent && 'bg-blue-50 dark:bg-blue-900/20',
                isCompleted && 'opacity-60'
              )}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  isCurrent && 'text-blue-900 dark:text-blue-100',
                  isPending && 'text-muted-foreground'
                )}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t">
        <p className="text-xs text-center text-muted-foreground italic">
          💡 Did you know? {randomFact}
        </p>
      </div>
    </div>
  );
}
