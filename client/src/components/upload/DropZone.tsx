import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFileSelect: (file: File, base64: string) => void;
  disabled?: boolean;
  maxSize?: number; // in bytes
}

export default function DropZone({ onFileSelect, disabled = false, maxSize = 20 * 1024 * 1024 }: DropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Only PDF files are supported.');
      } else {
        setError('Invalid file. Please upload a PDF.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);

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
  }, [onFileSelect, maxSize]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize,
    multiple: false,
    disabled,
  });

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
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
          {selectedFile ? (
            <>
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
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
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
                isDragActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
              )}>
                <Upload className={cn(
                  'h-8 w-8 transition-colors',
                  isDragActive ? 'text-blue-600' : 'text-gray-400'
                )} />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  PDF only
                </span>
                <span>•</span>
                <span>Max {Math.round(maxSize / 1024 / 1024)}MB</span>
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
