import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConfidenceScoreProps {
  confidence: number;
  tableCount?: number;
  pageCount?: number;
  className?: string;
}

export default function ConfidenceScore({ 
  confidence, 
  tableCount = 1,
  pageCount = 1,
  className = '' 
}: ConfidenceScoreProps) {
  const percentage = Math.round(confidence * 100);
  
  const getConfidenceLevel = () => {
    if (percentage >= 90) return { label: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-500', icon: CheckCircle };
    if (percentage >= 75) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-500', icon: CheckCircle };
    if (percentage >= 60) return { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-500', icon: AlertTriangle };
    return { label: 'Low', color: 'text-red-600', bgColor: 'bg-red-500', icon: XCircle };
  };

  const { label, color, bgColor, icon: Icon } = getConfidenceLevel();

  const getConfidenceDescription = () => {
    if (percentage >= 90) return 'High accuracy extraction. Data is ready to use.';
    if (percentage >= 75) return 'Good extraction quality. Minor review recommended.';
    if (percentage >= 60) return 'Some data may need verification. Please review carefully.';
    return 'Low confidence. Manual verification strongly recommended.';
  };

  const getBorderColor = () => {
    if (percentage >= 75) return 'border-l-green-500';
    if (percentage >= 60) return 'border-l-yellow-500';
    return 'border-l-red-500';
  };

  return (
    <Card className={`border-l-4 ${getBorderColor()} ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="font-semibold text-lg">AI Confidence Score</span>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>This score indicates how confident the AI is in the accuracy of the extracted data. Higher scores mean more reliable results.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold ${color}`}>{percentage}%</span>
            <Badge variant="outline" className={color}>
              {label}
            </Badge>
          </div>
        </div>

        <Progress value={percentage} className="h-3 mb-3" />

        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">{getConfidenceDescription()}</p>
          <div className="flex gap-3 text-muted-foreground">
            {tableCount > 0 && (
              <span>{tableCount} table{tableCount > 1 ? 's' : ''} extracted</span>
            )}
            {pageCount > 1 && (
              <span>• {pageCount} pages</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
