import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileSpreadsheet, Check, X, Zap, Shield, CreditCard, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from 'sonner';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try it out, no credit card needed',
    features: [
      { text: '3 conversions per day', included: true },
      { text: 'Generic table extraction', included: true },
      { text: 'Basic spreadsheet editor', included: true },
      { text: 'Excel export', included: true },
      { text: 'Invoice & specialized templates', included: false },
      { text: 'Conversion history', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For accountants & small businesses',
    features: [
      { text: '100 invoice extractions/month', included: true },
      { text: 'Invoice template with line items', included: true },
      { text: 'Bank statement extraction', included: true },
      { text: 'All specialized templates', included: true },
      { text: 'Confidence scoring', included: true },
      { text: 'Conversion history & exports', included: true },
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
];

const FAQ = [
  {
    question: 'What\'s included in the 100 invoice extractions?',
    answer: 'Each invoice you process counts as one extraction. Multi-page invoices count as one extraction. Unused extractions don\'t roll over to the next month.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.',
  },
  {
    question: 'Can I try Pro templates before subscribing?',
    answer: 'Yes! Click "Try with Sample" on any Pro template to see the extraction quality with our demo documents. No credit card required.',
  },
  {
    question: 'What happens when I hit my limit?',
    answer: 'Free users get 3 conversions per day (resets at midnight UTC). Pro users get 100 invoice extractions per month. Need more? Contact us for custom plans.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely! Cancel from your dashboard anytime. You\'ll keep access until the end of your billing period.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes! All files are encrypted in transit and at rest. We automatically delete your files after processing. We never share your data.',
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);

  const { data: profile } = trpc.user.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const checkoutMutation = trpc.stripe.createCheckout.useMutation();

  const isPro = profile?.subscriptionStatus === 'pro';

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      setLocation('/login');
      return;
    }

    setLoading(true);
    try {
      const result = await checkoutMutation.mutateAsync({
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });

      if (result.success && 'url' in result && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to start checkout');
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg">SmartPDF Convert</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button variant="outline" size="sm" onClick={() => setLocation('/dashboard')}>
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLocation('/login')}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => setLocation('/signup')}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container py-16">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? 'border-blue-500 shadow-lg relative' : ''}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.name === 'Free' ? (
                  <Button variant="outline" className="w-full" disabled>
                    {isPro ? 'Free Tier' : 'Current Plan'}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={handleUpgrade}
                    disabled={loading || isPro}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : isPro ? (
                      'Current Plan'
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        {plan.cta}
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-16 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <span>Secure payment via Stripe</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>7-day money-back guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            <span>Cancel anytime</span>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 SmartPDF Convert. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
