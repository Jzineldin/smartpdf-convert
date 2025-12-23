import { Link, useLocation } from 'wouter';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { trpc } from '@/lib/trpc';
import DropZone from '@/components/upload/DropZone';
import PdfHelper from '@/components/upload/PdfHelper';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Typewriter } from '@/components/ui/typewriter';
import { FloatingShapes } from '@/components/ui/floating-shapes';
import {
  FileSpreadsheet,
  Sparkles,
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
  Play,
  Users,
  FileCheck,
  TrendingUp,
  Lock,
  Building2,
  Award,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

// Pain-driven messaging targeting finance professionals
const HERO_WORDS = ['Invoices', 'Bank Statements', 'AP Reports', 'Financial Tables'];

const PAIN_POINTS = [
  {
    pain: 'Manually typing invoice line items into Excel',
    solution: 'AI extracts every line item, quantity, and amount automatically',
  },
  {
    pain: 'Re-keying bank transactions for reconciliation',
    solution: 'Upload statement, get transaction-ready data in seconds',
  },
  {
    pain: 'Month-end crunch with stacks of vendor invoices',
    solution: 'Batch process 10+ documents at once, all tables extracted',
  },
  {
    pain: 'Errors from OCR tools that miss columns or merge cells',
    solution: 'Confidence scoring flags uncertain extractions before they become problems',
  },
];

const FEATURES = [
  {
    icon: ScanText,
    title: 'Built for Financial Documents',
    description: 'Specialized for invoices, bank statements, and AP/AR reports. Not another generic PDF tool.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Shield,
    title: 'Confidence Scoring',
    description: 'Every cell shows extraction confidence. Know exactly which values need review before they hit your books.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    icon: Table2,
    title: 'Multi-Table Detection',
    description: 'Finds every table in complex documents. 30-page vendor reports? We extract all 27 tables automatically.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Zap,
    title: 'Batch Processing',
    description: 'Month-end invoice stack? Upload 10 files at once. Each table becomes a separate Excel sheet.',
    gradient: 'from-orange-500 to-red-500',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Drop Your Documents',
    description: 'Upload invoices, statements, or any financial PDF. Scanned, photographed, or digital - all work.',
    icon: FileSpreadsheet,
  },
  {
    number: '02',
    title: 'AI Analyzes & Extracts',
    description: 'GPT-4 Vision identifies every table, understands context, and extracts structured data with confidence scores.',
    icon: Sparkles,
  },
  {
    number: '03',
    title: 'Review, Edit, Export',
    description: 'Compare extracted data side-by-side with original PDF. Fix any flagged values, then export to Excel.',
    icon: FileCheck,
  },
];

const STATS = [
  { value: '15hrs', label: 'Saved Weekly', icon: Clock },
  { value: '98%', label: 'Extraction Accuracy', icon: TrendingUp },
  { value: '27', label: 'Tables from 1 Document', icon: Table2 },
  { value: '0', label: 'Manual Data Entry', icon: FileCheck },
];

const TESTIMONIALS = [
  {
    quote: "I was spending 4 hours every Monday keying invoice data into our ERP. Now it takes 30 minutes to review and import. Game changer for month-end close.",
    author: "Maria Santos",
    role: "Senior Accountant",
    company: "Martinez & Co",
    avatar: "MS",
    rating: 5,
  },
  {
    quote: "Bank reconciliation used to mean re-typing 200+ transactions. Now I upload the PDF and get clean data. The confidence scores caught a misread amount that would have cost us.",
    author: "James Thompson",
    role: "Financial Controller",
    company: "Apex Solutions",
    avatar: "JT",
    rating: 5,
  },
  {
    quote: "Our AP team processes 400+ vendor invoices monthly. This cut our data entry time by 80% and errors are down because the AI flags uncertain extractions.",
    author: "Sarah Kim",
    role: "AP Manager",
    company: "TechStart Inc",
    avatar: "SK",
    rating: 5,
  },
];

const LOGOS = [
  'Bookkeepers',
  'AP/AR Clerks',
  'Controllers',
  'Accountants',
  'Auditors',
  'Finance Teams',
];

const FAQ = [
  {
    question: 'How is this different from Adobe or free PDF converters?',
    answer: 'Generic PDF tools use basic OCR that fails on complex financial documents. We use GPT-4 Vision which understands document context - it knows a "Total" row is different from a line item, handles multi-page tables, and shows confidence scores so you catch errors before they become accounting problems.',
  },
  {
    question: 'What financial documents work best?',
    answer: 'Invoices with line items, bank/credit card statements, AP aging reports, vendor ledgers, and any document with tabular financial data. We handle scanned PDFs, photos of receipts, and digital exports equally well.',
  },
  {
    question: 'How accurate is the extraction?',
    answer: 'Typically 95-99% on clean documents. More importantly, we show confidence scores for every extraction so you know exactly which cells might need review. Low-confidence cells are highlighted so you can verify them against the original.',
  },
  {
    question: 'Is my financial data secure?',
    answer: 'Absolutely. All files are encrypted in transit (TLS 1.3) and at rest (AES-256). We process in isolated environments and auto-delete files after 24 hours. We never train on your data or share it with third parties.',
  },
  {
    question: 'Can I try before paying?',
    answer: 'Yes. You get 3 free extractions daily, no credit card required. Test on your actual invoices or statements to see the accuracy before committing.',
  },
  {
    question: 'How does batch processing work?',
    answer: 'Pro users can upload up to 10 documents at once. Each document is processed, and all tables are combined into a single Excel workbook with separate sheets. Perfect for processing a stack of vendor invoices at month-end.',
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useSupabaseAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: templatesData } = trpc.conversion.getTemplates.useQuery();
  const isPro = templatesData?.userIsPro ?? false;

  useEffect(() => {
    document.title = 'PDF to Excel Converter - Extract Tables from PDF Free | Xlify';
  }, []);

  const handleFileSelect = (file: File, base64: string) => {
    sessionStorage.setItem('pendingFile', JSON.stringify({
      name: file.name,
      size: file.size,
      base64,
    }));
    setLocation('/convert');
  };

  const handleMultipleFilesSelect = (files: Array<{ file: File; base64: string }>) => {
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
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl"><span className="text-blue-600">XL</span>ify</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button onClick={() => setLocation('/dashboard')}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setLocation('/login')}>
                  Sign in
                </Button>
                <Button onClick={() => setLocation('/signup')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25">
                  Get Started Free
                </Button>
              </>
            )}
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white/95 dark:bg-gray-950/95 backdrop-blur-lg p-4 space-y-4">
            <a href="#features" className="block text-sm font-medium py-2">Features</a>
            <a href="#how-it-works" className="block text-sm font-medium py-2">How It Works</a>
            <a href="#pricing" className="block text-sm font-medium py-2">Pricing</a>
            <a href="#faq" className="block text-sm font-medium py-2">FAQ</a>
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">Theme</span>
                <ThemeToggle />
              </div>
              {isAuthenticated ? (
                <Button className="w-full" onClick={() => setLocation('/dashboard')}>Dashboard</Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/login')}>Sign in</Button>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600" onClick={() => setLocation('/signup')}>Get Started Free</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <FloatingShapes variant="hero" />

          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-white to-white dark:from-blue-950/20 dark:via-gray-950 dark:to-gray-950" />

          <div className="container relative pt-20 pb-32 md:pt-32 md:pb-40">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              {/* Badge - Finance specific */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium animate-scale-in">
                <Clock className="h-4 w-4" />
                <span>Accountants save 15+ hours/week</span>
              </div>

              {/* Headline - Pain focused */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight animate-slide-up">
                Stop Re-Keying{' '}
                <span className="gradient-text">
                  <Typewriter words={HERO_WORDS} typingSpeed={80} deletingSpeed={40} pauseDuration={2500} />
                </span>
                <br />
                Into Excel
              </h1>

              {/* Subheadline - Specific value prop */}
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Upload financial PDFs. AI extracts every table with <strong className="text-foreground">confidence scores</strong> so you catch errors before they hit your books. Built for accountants, not generic OCR.
              </p>

              {/* Upload Box */}
              <div className="pt-4 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="p-1 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 animate-gradient">
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-2">
                    <DropZone
                      onFileSelect={handleFileSelect}
                      allowMultiple={isPro}
                      onMultipleFilesSelect={handleMultipleFilesSelect}
                    />
                  </div>
                </div>
                <PdfHelper />
              </div>

              {/* Trust indicators - Finance focused */}
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground pt-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  Try free - no signup
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Shield className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  SOC 2 compliant encryption
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  98% extraction accuracy
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Product Demo Preview */}
        <section className="py-16 -mt-16 relative z-10">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              {/* Browser mockup */}
              <div className="rounded-2xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 p-1.5 shadow-2xl shadow-gray-400/20 dark:shadow-black/40">
                {/* Browser chrome */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-t-xl px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white dark:bg-gray-700 rounded-md px-4 py-1.5 text-xs text-muted-foreground text-center">
                      xlify.app/results
                    </div>
                  </div>
                </div>

                {/* Product screenshot mockup */}
                <div className="bg-white dark:bg-gray-900 rounded-b-xl overflow-hidden">
                  <div className="grid grid-cols-2 gap-0.5 bg-gray-200 dark:bg-gray-700">
                    {/* Left side - PDF preview */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-6">
                      <div className="aspect-[3/4] bg-white dark:bg-gray-900 rounded-lg shadow-sm border dark:border-gray-700 p-4 flex flex-col">
                        <div className="text-xs font-medium text-muted-foreground mb-3">Invoice #INV-2024-001</div>
                        <div className="space-y-2 flex-1">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                          <div className="mt-4 space-y-1.5">
                            <div className="flex gap-2">
                              <div className="h-2.5 bg-blue-100 dark:bg-blue-900/30 rounded flex-1" />
                              <div className="h-2.5 bg-blue-100 dark:bg-blue-900/30 rounded w-16" />
                              <div className="h-2.5 bg-blue-100 dark:bg-blue-900/30 rounded w-12" />
                            </div>
                            <div className="flex gap-2">
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-16" />
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-12" />
                            </div>
                            <div className="flex gap-2">
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-16" />
                              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-12" />
                            </div>
                          </div>
                          <div className="mt-auto pt-4 border-t dark:border-gray-700">
                            <div className="flex justify-between items-center">
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                              <div className="h-4 bg-blue-500 rounded w-20" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - Spreadsheet preview */}
                    <div className="bg-white dark:bg-gray-900 p-6">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <FileCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-sm font-medium">Extracted Data</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">98% confidence</Badge>
                      </div>
                      <div className="rounded-lg border dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Qty</th>
                              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-gray-700">
                            <tr className="bg-white dark:bg-gray-900">
                              <td className="px-3 py-2">Website Design</td>
                              <td className="px-3 py-2">1</td>
                              <td className="px-3 py-2 text-right">$2,500</td>
                            </tr>
                            <tr className="bg-white dark:bg-gray-900">
                              <td className="px-3 py-2">Development Hours</td>
                              <td className="px-3 py-2">40</td>
                              <td className="px-3 py-2 text-right">$4,000</td>
                            </tr>
                            <tr className="bg-white dark:bg-gray-900">
                              <td className="px-3 py-2">Hosting (Annual)</td>
                              <td className="px-3 py-2">1</td>
                              <td className="px-3 py-2 text-right">$299</td>
                            </tr>
                          </tbody>
                          <tfoot className="bg-gray-50 dark:bg-gray-800 font-medium">
                            <tr>
                              <td className="px-3 py-2" colSpan={2}>Total</td>
                              <td className="px-3 py-2 text-right text-blue-600">$6,799</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <Edit3 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700">
                          Download Excel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Split-view comparison: Original PDF → Clean, editable Excel data
              </p>
            </div>
          </div>
        </section>

        {/* Pain Points Section */}
        <section className="py-20 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-950 dark:to-gray-900/30">
          <div className="container">
            <div className="text-center mb-12 max-w-2xl mx-auto">
              <Badge variant="secondary" className="mb-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">The Problem</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Sound Familiar?
              </h2>
              <p className="text-lg text-muted-foreground">
                Every finance team wastes hours on the same manual data entry.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {PAIN_POINTS.map((item, index) => (
                <div key={index} className="relative bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg shadow-gray-200/50 dark:shadow-none border dark:border-gray-800 overflow-hidden">
                  {/* Pain side */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <X className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-muted-foreground line-through decoration-red-300">{item.pain}</p>
                    </div>
                  </div>
                  {/* Solution side */}
                  <div className="flex items-start gap-4 pl-2 border-l-2 border-green-500 ml-4">
                    <div>
                      <p className="text-foreground font-medium">{item.solution}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Logo Cloud / Social Proof - Finance professionals */}
        <section className="py-16 border-y bg-gray-50/50 dark:bg-gray-900/50">
          <div className="container">
            <p className="text-center text-sm font-medium text-muted-foreground mb-8">
              TRUSTED BY FINANCE PROFESSIONALS AT
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {LOGOS.map((logo, index) => (
                <div key={index} className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                  <Users className="h-5 w-5" />
                  <span className="font-medium">{logo}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {STATS.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-4">
                    <stat.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="container">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <Badge variant="secondary" className="mb-4">Why Xlify</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Built for{' '}
                <span className="gradient-text">Financial Documents</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Not another generic PDF tool. Purpose-built for the documents finance teams actually work with.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {FEATURES.map((feature, index) => (
                <Card key={index} className="group relative overflow-hidden border-0 shadow-lg shadow-gray-200/50 dark:shadow-none dark:bg-gray-900 hover:shadow-xl transition-all duration-300 card-glow">
                  <CardContent className="p-6">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24">
          <div className="container">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <Badge variant="secondary" className="mb-4">How It Works</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                From Invoice to Excel in{' '}
                <span className="gradient-text">Under 2 Minutes</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                No training. No API setup. Just upload your document and get clean, verified data.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {STEPS.map((step, index) => (
                <div key={index} className="relative">
                  {/* Connector line */}
                  {index < STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-blue-200 to-transparent dark:from-blue-800" />
                  )}

                  <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg shadow-gray-200/50 dark:shadow-none border dark:border-gray-800">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-5xl font-bold text-blue-100 dark:text-blue-900/50">{step.number}</span>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <step.icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button size="lg" onClick={() => setLocation('/convert')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 gap-2">
                <Play className="h-4 w-4" />
                Extract Your First Invoice - Free
              </Button>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="container">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <Badge variant="secondary" className="mb-4">Real Results</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Accountants Who{' '}
                <span className="gradient-text">Got Their Time Back</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Finance teams are eliminating hours of manual data entry every week.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {TESTIMONIALS.map((testimonial, index) => (
                <Card key={index} className="border-0 shadow-lg shadow-gray-200/50 dark:shadow-none dark:bg-gray-900">
                  <CardContent className="p-6">
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>

                    {/* Quote */}
                    <p className="text-foreground mb-6 leading-relaxed">"{testimonial.quote}"</p>

                    {/* Author */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-semibold">{testimonial.author}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24">
          <div className="container">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <Badge variant="secondary" className="mb-4">Pricing</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Save 15+ Hours for{' '}
                <span className="gradient-text">$29/month</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                At $50/hr, that's $750+ in saved labor costs. Try free first.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <Card className="relative border-2 dark:bg-gray-900">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-2">Free</h3>
                  <p className="text-muted-foreground mb-6">Try it out, no commitment</p>

                  <div className="mb-8">
                    <span className="text-5xl font-bold">$0</span>
                    <span className="text-muted-foreground">/forever</span>
                  </div>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>3 conversions per day</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Generic table extraction</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Excel export</span>
                    </li>
                    <li className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <X className="h-3 w-3 text-gray-400" />
                      </div>
                      <span>Specialized templates</span>
                    </li>
                    <li className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <X className="h-3 w-3 text-gray-400" />
                      </div>
                      <span>Batch processing</span>
                    </li>
                  </ul>

                  <Button variant="outline" className="w-full" size="lg" onClick={() => setLocation('/convert')}>
                    Start Free
                  </Button>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="relative border-2 border-blue-500 dark:bg-gray-900 shadow-xl shadow-blue-500/10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>

                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-2">Pro</h3>
                  <p className="text-muted-foreground mb-6">For power users & teams</p>

                  <div className="mb-8">
                    <span className="text-5xl font-bold">$29</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span className="font-medium">100 extractions/month</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Invoice & bank statement templates</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Batch upload (10 files at once)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Confidence scoring</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Conversion history</span>
                    </li>
                  </ul>

                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" size="lg" onClick={() => setLocation('/pricing')}>
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Secure payment via Stripe
              </span>
              <span className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                7-day money-back guarantee
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Cancel anytime
              </span>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="container">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <Badge variant="secondary" className="mb-4">FAQ</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked{' '}
                <span className="gradient-text">Questions</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about Xlify.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="w-full space-y-4">
                {FAQ.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm px-6">
                    <AccordionTrigger className="text-left hover:no-underline py-5">
                      <span className="font-medium">{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
          <FloatingShapes className="opacity-30" />

          <div className="container relative text-center text-white">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Stop Typing. Start Extracting.
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Your next invoice batch doesn't have to mean hours of data entry. Try it free on your actual documents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" variant="secondary" onClick={() => setLocation('/convert')} className="text-blue-600 hover:text-blue-700 shadow-xl gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload Your First Invoice
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => setLocation('/pricing')}>
                See Pricing
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-16 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg"><span className="text-blue-600">XL</span>ify</span>
                <p className="text-sm text-muted-foreground">AI extraction for finance teams</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </nav>

            <p className="text-sm text-muted-foreground">
              © 2025 Xlify. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
