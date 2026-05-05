'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import type { SessionUser } from '@/types';

// Get dashboard URL based on user role
function getDashboardUrl(role: SessionUser['role']): string {
  switch (role) {
    case 'superadmin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'boardmember':
      return '/management-dashboard';
    case 'manager':
    case 'teamhead':
    case 'employee':
    default:
      return '/employee-dashboard';
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const errorParam = searchParams.get('error');

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(errorParam || '');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        if (data.success && data.data) {
          // User is already logged in, redirect to dashboard
          const dashboardUrl = getDashboardUrl(data.data.role);
          router.replace(callbackUrl || dashboardUrl);
          return;
        }
      } catch {
        // Not logged in, show login form
      }
      setCheckingAuth(false);
    };
    
    checkAuth();
  }, [router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Redirect to callback URL if provided, otherwise to role-based dashboard
        const redirectUrl = callbackUrl || getDashboardUrl(data.data.role);
        router.push(redirectUrl);
        router.refresh();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="w-full max-w-sm flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card px-8 py-9 shadow-sm">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center space-x-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <span className="text-base font-bold text-primary-foreground">W</span>
          </div>
          <span className="font-semibold text-[34px] leading-none tracking-[-0.02em]">WorkReport</span>
        </Link>
        <h1 className="text-5xl font-semibold leading-tight tracking-[-0.02em] mb-2">Welcome back</h1>
        <p className="text-lg text-muted-foreground leading-snug">
          Enter your credentials to access your account
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm bg-destructive/10 text-destructive rounded-md animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="employeeId" className="text-sm text-foreground/90">
            Employee ID
          </Label>
          <Input
            id="employeeId"
            type="text"
            placeholder="Enter your employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            disabled={loading}
            autoComplete="username"
            className="h-11 rounded-md"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm text-foreground/90">
              Password
            </Label>
            <Link
              href="/reset-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              className="h-11 pr-12 rounded-md"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      {/* Google Sign In Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 text-base"
        disabled={loading || checkingAuth}
        onClick={() => {
          const callbackUrlParam = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
          window.location.href = `/api/auth/google${callbackUrlParam}`;
        }}
      >
        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign in with Google
      </Button>
      
      <p className="text-center text-sm text-muted-foreground mt-9">
        Don&apos;t have an account?{' '}
        <span className="text-foreground font-medium">Contact your administrator</span>
      </p>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted animate-pulse" />
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-7 w-40 bg-muted rounded mx-auto mb-2 animate-pulse" />
        <div className="h-4 w-56 bg-muted rounded mx-auto animate-pulse" />
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-12 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-12 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-12 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
