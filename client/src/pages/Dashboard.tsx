import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileSpreadsheet,
  Plus,
  Download,
  Clock,
  Zap,
  FileText,
  TrendingUp,
  Calendar,
  Settings,
  LogOut,
  Crown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isAuthenticated, loading: authLoading } = useSupabaseAuth();

  const { data: profile, isLoading: profileLoading } = trpc.user.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: usage, isLoading: usageLoading } = trpc.user.getUsage.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: conversions, isLoading: conversionsLoading } = trpc.conversion.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const portalMutation = trpc.stripe.createPortal.useMutation();

  const handleManageSubscription = async () => {
    try {
      const result = await portalMutation.mutateAsync({
        returnUrl: window.location.href,
      });
      if (result.success && 'url' in result && result.url) {
        window.location.href = result.url;
      } else {
        toast.error('Failed to open subscription management');
      }
    } catch (err) {
      toast.error('Something went wrong');
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation('/login');
    return null;
  }

  const isPro = profile?.subscriptionStatus === 'pro';
  const usagePercent = usage ? (usage.conversionsToday / 3) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg">SmartPDF Convert</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Button variant="default" size="sm" onClick={() => setLocation('/convert')}>
              <Plus className="h-4 w-4 mr-2" />
              New Conversion
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome */}
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-muted-foreground">
              Here's an overview of your PDF conversions
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Today's usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today's Usage</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : isPro ? (
                  <div className="text-2xl font-bold">{usage?.conversionsToday || 0}</div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {usage?.conversionsToday || 0} / 3
                    </div>
                    <Progress value={usagePercent} className="mt-2 h-2" />
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {isPro ? 'Unlimited conversions' : 'Resets at midnight'}
                </p>
              </CardContent>
            </Card>

            {/* This month */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{usage?.conversionsThisMonth || 0}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">conversions</p>
              </CardContent>
            </Card>

            {/* Total */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{usage?.totalConversions || 0}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">all time</p>
              </CardContent>
            </Card>

            {/* Plan */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Your Plan</CardTitle>
                {isPro ? (
                  <Crown className="h-4 w-4 text-yellow-500" />
                ) : (
                  <Zap className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                {profileLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{isPro ? 'Pro' : 'Free'}</div>
                )}
                {isPro ? (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-xs"
                    onClick={handleManageSubscription}
                  >
                    Manage subscription
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-xs text-blue-600"
                    onClick={() => setLocation('/pricing')}
                  >
                    Upgrade to Pro
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Subscription card for free users */}
          {!isPro && (
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Upgrade to Pro</h3>
                      <p className="text-blue-100">
                        Get unlimited conversions and priority processing
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => setLocation('/pricing')}>
                    Upgrade — $9/mo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent conversions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Conversions</CardTitle>
                  <CardDescription>Your latest PDF to Excel conversions</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocation('/convert')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {conversionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversions && conversions.length > 0 ? (
                <div className="space-y-4">
                  {conversions.map((conversion) => (
                    <div
                      key={conversion.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{conversion.originalFilename}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{conversion.tableCount || 0} tables</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(conversion.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          conversion.status === 'completed'
                            ? 'default'
                            : conversion.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {conversion.status}
                      </Badge>
                      {conversion.xlsxStoragePath && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(conversion.xlsxStoragePath!, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">No conversions yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your first PDF to get started
                  </p>
                  <Button onClick={() => setLocation('/convert')}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Conversion
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
