import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  Receipt,
  Landmark,
  CreditCard,
  Package,
  TrendingUp,
  Lock,
  Check,
  Crown,
  Play,
  FileText,
  Building2,
  Wallet,
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPro: boolean;
}

// Sample document paths for each Pro template
const sampleDocuments: Record<string, string> = {
  invoice: '/samples/sample-invoice.webp',
  bank_statement: '/samples/sample-bank-statement.jpg',
  expense_report: '/samples/sample-expense-report.png',
  inventory: '/samples/sample-inventory.png',
  sales_report: '/samples/sample-sales-report.png',
};

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
  isPro: boolean;
  onUpgradeClick?: () => void;
  onTrySample?: (templateId: string, sampleUrl: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Table,
  Receipt,
  Landmark,
  CreditCard,
  Package,
  TrendingUp,
  // More descriptive alternatives
  FileText,      // Generic documents
  Building2,     // Bank statements
  Wallet,        // Expense reports
  ClipboardList, // Inventory
  BarChart3,     // Sales reports
};

// TEMPORARY: Set to true for testing, false for production
const TESTING_MODE = true;

export default function TemplateSelector({
  templates,
  selectedTemplate,
  onSelectTemplate,
  isPro,
  onUpgradeClick,
  onTrySample
}: TemplateSelectorProps) {
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  
  // In testing mode, treat user as Pro
  const effectiveIsPro = TESTING_MODE || isPro;

  const handleTemplateClick = (template: Template) => {
    if (template.isPro && !effectiveIsPro) {
      // Show upgrade prompt
      if (onUpgradeClick) {
        onUpgradeClick();
      }
      return;
    }
    onSelectTemplate(template.id);
  };

  const handleTrySample = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    const sampleUrl = sampleDocuments[template.id];
    if (sampleUrl && onTrySample) {
      onTrySample(template.id, sampleUrl);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choose Extraction Template</h3>
        {!effectiveIsPro && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
            <Crown className="h-3 w-3" />
            Upgrade for specialized templates
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {templates.map((template) => {
          const Icon = iconMap[template.icon] || Table;
          const isSelected = selectedTemplate === template.id;
          const isLocked = template.isPro && !effectiveIsPro;
          const isHovered = hoveredTemplate === template.id;
          const hasSample = !!sampleDocuments[template.id];

          return (
            <Card
              key={template.id}
              className={cn(
                "relative cursor-pointer transition-all duration-200",
                isSelected && "ring-2 ring-primary border-primary",
                isLocked && "opacity-75",
                !isLocked && !isSelected && "hover:border-primary/50 hover:shadow-md",
              )}
              onClick={() => handleTemplateClick(template)}
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {template.isPro && (
                      <Badge 
                        variant={effectiveIsPro ? "secondary" : "default"}
                        className={cn(
                          "text-xs",
                          !effectiveIsPro && "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
                        )}
                      >
                        {effectiveIsPro ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            PRO
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            PRO
                          </>
                        )}
                      </Badge>
                    )}
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="font-medium text-sm mb-1">{template.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>

                {/* Try Sample button for Pro templates (visible to non-Pro users) */}
                {template.isPro && !effectiveIsPro && hasSample && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 gap-2 text-xs h-8 border-primary/50 text-primary hover:bg-primary/10"
                    onClick={(e) => handleTrySample(e, template)}
                  >
                    <Play className="h-3 w-3" />
                    Try with Sample
                  </Button>
                )}

                {/* Locked overlay on hover */}
                {isLocked && isHovered && !hasSample && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Button 
                      size="sm" 
                      className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpgradeClick) onUpgradeClick();
                      }}
                    >
                      <Crown className="h-4 w-4" />
                      Upgrade to Pro
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pro benefits callout */}
      {!effectiveIsPro && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                Unlock Specialized Templates
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Pro templates use optimized AI prompts for specific document types, 
                delivering higher accuracy and structured data extraction.
              </p>
              <ul className="mt-2 space-y-1">
                <li className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Check className="h-3 w-3" />
                  Invoice extraction with line items & totals
                </li>
                <li className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Check className="h-3 w-3" />
                  Bank statement with transaction categorization
                </li>
                <li className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Check className="h-3 w-3" />
                  Automatic validation & error detection
                </li>
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-2">
                <Play className="h-3 w-3" />
                Click "Try with Sample" on any Pro template to test it free!
              </p>
            </div>
            <Button 
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              onClick={onUpgradeClick}
            >
              Upgrade
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
