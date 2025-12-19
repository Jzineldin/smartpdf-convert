import { Link, useLocation } from 'wouter';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { trpc } from '@/lib/trpc';
import DropZone from '@/components/upload/DropZone';
import PdfHelper from '@/components/upload/PdfHelper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  Download,
  ScanText,
  Table2,
  Edit3,
  Wand2,
  Check,
  X,
  Zap,
  Shield,
  Clock,
  Star,
  ArrowRight,
  Menu,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const FEATURES = [
  {
    icon: ScanText,
    title: 'Invoice Line Items',
    description: 'Extracts vendor, dates, line items, quantities, and totals automatically.',
  },
  {
    icon: Table2,
    title: 'Bank Statements',
    description: 'Pulls transactions, dates, amounts, and running balances from statements.',
  },
  {
    icon: Edit3,
    title: 'Real Spreadsheet Editor',
    description: 'Review and edit extracted data before exporting to Excel.',
  },
  {
    icon: Wand2,
    title: 'AI Confidence Scoring',
    description: 'Know exactly how accurate each extraction is before you use it.',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Upload',
    description: 'Drop your PDF file or click to browse',
  },
  {
    number: '2',
    title: 'AI Extracts',
    description: 'Our AI analyzes and extracts every table',
  },
  {
    number: '3',
    title: 'Download',
    description: 'Edit if needed and export as Excel',
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally something that works on our scanned invoices. Saves me 2 hours every week.",
    author: "Maria S.",
    role: "Bookkeeper",
  },
  {
    quote: "The invoice template extracts line items perfectly. No more manual data entry.",
    author: "James T.",
    role: "Accountant",
  },
  {
    quote: "We process 50+ invoices weekly. This tool paid for itself in the first week.",
    author: "Sarah K.",
    role: "Small Business Owner",
  },
];

const FAQ = [
  {
    question: 'What file types are supported?',
    answer: 'We support PDF, PNG, JPG, and WebP files up to 20MB. For best results with PDFs, we recommend taking a screenshot or converting to an image first.',
  },
  {
    question: 'How accurate is the extraction?',
    answer: 'Our AI achieves 90-99% accuracy on most documents. Complex layouts, handwriting, or very low-resolution scans may have lower accuracy, but we always show confidence scores and warnings.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes! All files are encrypted in transit and at rest. We automatically delete your files after 7 days, and we never share your data with third parties.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely! You can cancel your Pro subscription at any time from your dashboard. You\'ll continue to have access until the end of your billing period.',
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useSupabaseAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get Pro status for multi-file feature
  const { data: templatesData } = trpc.conversion.getTemplates.useQuery();
  const isPro = templatesData?.userIsPro ?? false;

  // Set SEO title for the homepage
  useEffect(() => {
    document.title = 'Invoice to Excel - AI Data Extraction | SmartPDF Convert';
  }, []);

  const handleFileSelect = (file: File, base64: string) => {
    // Store in sessionStorage and redirect to convert page
    sessionStorage.setItem('pendingFile', JSON.stringify({
      name: file.name,
      size: file.size,
      base64,
    }));
    setLocation('/convert');
  };

  const handleMultipleFilesSelect = (files: Array<{ file: File; base64: string }>) => {
    // Store multiple files in sessionStorage and redirect to convert page
    sessionStorage.setItem('pendingFiles', JSON.stringify(
      files.map(({ file, base64 }) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        base64,
      }))
    ));
    setLocation('/convert');
    toast.success(`${files.length} files ready for batch processing`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-blue-600" />
            <span className="font-bold text-xl">SmartPDF Convert</span>
          </Link>
          
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Button onClick={() => setLocation('/dashboard')}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setLocation('/login')}>
                  Sign in
                </Button>
                <Button onClick={() => setLocation('/signup')}>
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white dark:bg-gray-900 p-4 space-y-4">
            <a href="#features" className="block text-sm font-medium">Features</a>
            <a href="#pricing" className="block text-sm font-medium">Pricing</a>
            <a href="#faq" className="block text-sm font-medium">FAQ</a>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Button className="w-full" onClick={() => setLocation('/dashboard')}>Dashboard</Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/login')}>Sign in</Button>
                  <Button className="w-full" onClick={() => setLocation('/signup')}>Get Started</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMzQjgyRjYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
          
          <div className="container relative py-20 md:py-32">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <Badge variant="secondary" className="mb-4">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-Powered Extraction
              </Badge>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Extract Invoice Data Into{' '}
                <span className="text-blue-600">Clean Excel</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Upload invoices, bank statements, or any table. Our AI extracts line items, totals, and transactions into editable spreadsheets.
              </p>

              <div className="pt-8 max-w-lg mx-auto space-y-4">
                <DropZone
                  onFileSelect={handleFileSelect}
                  allowMultiple={isPro}
                  onMultipleFilesSelect={handleMultipleFilesSelect}
                />
                <PdfHelper />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
                <span className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  3 free conversions/day
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  No signup required
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  Instant results
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-gray-50 dark:bg-gray-800/50">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-muted-foreground">Three simple steps to extract your data</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {STEPS.map((step, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
              <p className="text-muted-foreground">Everything you need to extract tables from PDFs</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {FEATURES.map((feature, index) => (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <feature.icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-gray-50 dark:bg-gray-800/50">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Simple Pricing</h2>
              <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {/* Free Plan */}
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>Free</CardTitle>
                  <CardDescription>Try it out, no credit card</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-muted-foreground">/forever</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>3 conversions per day</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Generic table extraction</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Excel export</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <X className="h-4 w-4" />
                      <span>Invoice & specialized templates</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <X className="h-4 w-4" />
                      <span>Confidence scoring</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/convert')}>
                    Get Started
                  </Button>
                </CardFooter>
              </Card>

              {/* Pro Plan */}
              <Card className="border-blue-500 shadow-lg relative">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                  Most Popular
                </Badge>
                <CardHeader className="text-center">
                  <CardTitle>Pro</CardTitle>
                  <CardDescription>For accountants & small businesses</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">$29</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="font-medium">100 invoice extractions/month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Invoice template with line items</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Bank statement extraction</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Confidence scoring</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Conversion history</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => setLocation('/pricing')}>
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Secure payment via Stripe
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                7-day money-back guarantee
              </span>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Loved by Thousands</h2>
              <p className="text-muted-foreground">See what our users are saying</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {TESTIMONIALS.map((testimonial, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4">"{testimonial.quote}"</p>
                    <div>
                      <p className="font-medium">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-gray-50 dark:bg-gray-800/50">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">Everything you need to know</p>
            </div>

            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="container text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Extract Your Data?</h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto">
              Start converting PDFs to Excel for free. No credit card required.
            </p>
            <Button size="lg" variant="secondary" onClick={() => setLocation('/convert')}>
              Start Converting Now
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">SmartPDF Convert</span>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground">Features</a>
              <a href="#pricing" className="hover:text-foreground">Pricing</a>
              <a href="#faq" className="hover:text-foreground">FAQ</a>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              © 2024 SmartPDF Convert. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
