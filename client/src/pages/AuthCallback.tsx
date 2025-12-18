import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your account...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from the URL (Supabase uses hash-based routing for auth)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        // Also check query params (some flows use query params)
        const queryParams = new URLSearchParams(window.location.search);
        const code = queryParams.get('code');
        const errorParam = queryParams.get('error');
        const errorDescription = queryParams.get('error_description');

        // Handle errors
        if (errorParam) {
          setStatus('error');
          setMessage(errorDescription || 'Authentication failed. Please try again.');
          return;
        }

        // Handle code exchange (PKCE flow)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Code exchange error:', error);
            setStatus('error');
            setMessage(error.message || 'Failed to verify your account.');
            return;
          }
          setStatus('success');
          setMessage('Account verified successfully!');
          setTimeout(() => setLocation('/convert'), 1500);
          return;
        }

        // Handle token-based auth (older flow)
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('Session error:', error);
            setStatus('error');
            setMessage(error.message || 'Failed to verify your account.');
            return;
          }
          setStatus('success');
          setMessage(type === 'signup' ? 'Account verified successfully!' : 'Signed in successfully!');
          setTimeout(() => setLocation('/convert'), 1500);
          return;
        }

        // Check if user is already authenticated (auto-confirm scenarios)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus('success');
          setMessage('You are signed in!');
          setTimeout(() => setLocation('/convert'), 1500);
          return;
        }

        // No valid auth data found
        setStatus('error');
        setMessage('Invalid or expired confirmation link. Please try signing up again.');
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleAuthCallback();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && (
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="h-12 w-12 text-red-500" />
            )}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verifying...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {status === 'success' && (
            <p className="text-center text-sm text-muted-foreground">
              Redirecting you to the app...
            </p>
          )}
          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => setLocation('/signup')} variant="default">
                Try Signing Up Again
              </Button>
              <Button onClick={() => setLocation('/login')} variant="outline">
                Go to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
