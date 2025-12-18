import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, FileSpreadsheet, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Success() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Trigger confetti animation
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Welcome to Pro!</CardTitle>
          <CardDescription className="text-base">
            Your subscription is now active. Enjoy unlimited PDF conversions!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">Pro Benefits Unlocked</span>
            </div>
            <ul className="text-sm text-blue-100 space-y-1">
              <li>✓ Unlimited conversions</li>
              <li>✓ Priority processing</li>
              <li>✓ All premium templates</li>
              <li>✓ Conversion history</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button className="w-full" onClick={() => setLocation('/convert')}>
              Start Converting
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            A receipt has been sent to your email. You can manage your subscription from the dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
