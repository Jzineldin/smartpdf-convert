import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, X, Files, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFileSelect: (file: File, base64: string) => void;
  onMultipleFilesSelect?: (files: Array<{ file: File; base64: string }>) => void;
  disabled?: boolean;
  maxSize?: number; // in bytes
  allowMultiple?: boolean; // Pro feature
}

export default function DropZone({
  onFileSelect,
  onMultipleFilesSelect,
  disabled = false,
  maxSize = 20 * 1024 * 1024,
  allowMultiple = false
}: DropZoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Only PDF, PNG, and JPG files are supported.');
      } else {
        setError('Invalid file. Please upload a PDF.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      // Handle multiple files for Pro users
      if (allowMultiple && acceptedFiles.length > 1 && onMultipleFilesSelect) {
        setIsProcessing(true);
        setSelectedFiles(acceptedFiles);

        try {
          const filesWithBase64 = await Promise.all(
            acceptedFiles.map(file => new Promise<{ file: File; base64: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve({ file, base64 });
              };
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(file);
            }))
          );
          onMultipleFilesSelect(filesWithBase64);
        } catch (err) {
          setError('Failed to read files. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      } else {
        // Single file (original behavior)
        const file = acceptedFiles[0];
        setSelectedFiles([file]);

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          onFileSelect(file, base64);
        };
        reader.onerror = () => {
          setError('Failed to read file. Please try again.');
        };
        reader.readAsDataURL(file);
      }
    }
  }, [onFileSelect, onMultipleFilesSelect, maxSize, allowMultiple]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize,
    multiple: allowMultiple,
    disabled: disabled || isProcessing,
  });

  const selectedFile = selectedFiles[0] || null;

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles([]);
    setError(null);
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer',
          'hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
          isDragActive && !isDragReject && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
          isDragReject && 'border-red-500 bg-red-50 dark:bg-red-900/20',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-300',
          !isDragActive && !error && 'border-gray-300 dark:border-gray-700'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          {selectedFiles.length > 0 ? (
            <>
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="space-y-1">
                {selectedFiles.length === 1 ? (
                  <>
                    <p className="font-medium text-foreground">{selectedFiles[0].name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFiles[0].size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">{selectedFiles.length} files selected</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFiles.map(f => f.name).join(', ')}
                    </p>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </>
          ) : (
            <>
              {/* Pro badge for multi-file */}
              {allowMultiple && (
                <Badge variant="secondary" className="absolute top-3 right-3 gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Crown className="h-3 w-3" />
                  Pro: Multi-file
                </Badge>
              )}

              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
                isDragActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
              )}>
                {allowMultiple ? (
                  <Files className={cn(
                    'h-8 w-8 transition-colors',
                    isDragActive ? 'text-blue-600' : 'text-gray-400'
                  )} />
                ) : (
                  <Upload className={cn(
                    'h-8 w-8 transition-colors',
                    isDragActive ? 'text-blue-600' : 'text-gray-400'
                  )} />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {isDragActive
                    ? (allowMultiple ? 'Drop your files here' : 'Drop your file here')
                    : (allowMultiple ? 'Drag & drop multiple files here' : 'Drag & drop your file here')
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {allowMultiple
                    ? 'Select multiple invoices, receipts, or documents to combine into one Excel'
                    : 'or click to browse'
                  }
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  PDF, PNG, JPG
                </span>
                <span>•</span>
                <span>Max {Math.round(maxSize / 1024 / 1024)}MB {allowMultiple && 'per file'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
