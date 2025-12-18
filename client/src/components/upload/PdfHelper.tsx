import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileImage,
  Monitor,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Camera,
} from 'lucide-react';

interface PdfHelperProps {
  className?: string;
}

export default function PdfHelper({ className }: PdfHelperProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Tips for best results
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4 space-y-4">
        <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileImage className="h-4 w-4 text-blue-600" />
              Supported File Types
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">PDF</Badge>
              <Badge variant="secondary">PNG</Badge>
              <Badge variant="secondary">JPG</Badge>
              <Badge variant="secondary">WebP</Badge>
            </div>
            <p className="text-muted-foreground">
              PDFs are automatically converted to images for processing. For best results with complex PDFs, consider taking a screenshot.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera className="h-4 w-4" />
              How to Take a Screenshot
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex items-start gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Windows</p>
                <p className="text-muted-foreground">Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Win</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">S</kbd> and select the table area</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Mac</p>
                <p className="text-muted-foreground">Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">4</kbd> and select the table area</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Mobile</p>
                <p className="text-muted-foreground">Use your device's screenshot feature, then crop to the table</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Online PDF Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              For multi-page PDFs or better quality, use these free tools:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.ilovepdf.com/pdf_to_jpg" target="_blank" rel="noopener noreferrer">
                  iLovePDF
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://smallpdf.com/pdf-to-jpg" target="_blank" rel="noopener noreferrer">
                  SmallPDF
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://pdf2png.com/" target="_blank" rel="noopener noreferrer">
                  PDF2PNG
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center">
          💡 Pro tip: Zoom in on your PDF before taking a screenshot for better accuracy
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
