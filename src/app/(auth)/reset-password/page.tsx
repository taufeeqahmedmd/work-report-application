'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Mail,
  ArrowRight
} from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'request' | 'email-sent' | 'reset' | 'success'>(token ? 'reset' : 'request');
  const [employeeId, setEmployeeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(!!token);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    if (token) verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/auth/reset-password?token=${token}`);
      const data = await response.json();
      if (!data.success) {
        setError(data.error || 'This reset link is invalid or has expired');
        setStep('request');
      }
    } catch {
      setError('Failed to verify reset link. Please try again.');
      setStep('request');
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });

      const data = await response.json();

      if (data.success) {
        const emailMatch = data.message?.match(/sent to (.+)/);
        if (emailMatch) {
          setMaskedEmail(emailMatch[1]);
        }
        if (data.data?.resetUrl) {
          // Reset URL sent (logged in development only via logger)
        }
        setStep('email-sent');
      } else {
        setError(data.error || 'Failed to request password reset');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while verifying token
  if (verifyingToken) {
    return (
      <div className="w-full max-w-sm flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Email sent confirmation
  if (step === 'email-sent') {
    return (
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-8 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground group-hover:scale-105 transition-transform">
              <span className="text-base font-bold text-background">W</span>
            </div>
            <span className="font-semibold text-lg group-hover:translate-x-0.5 transition-transform">WorkReport</span>
          </Link>
          
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a password reset link to{' '}
            {maskedEmail && <span className="font-medium text-foreground">{maskedEmail}</span>}
          </p>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-sm font-medium mb-2">What to do next:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• Check your inbox (and spam folder)</li>
              <li>• Click the &quot;Reset Password&quot; button in the email</li>
              <li>• Create your new password</li>
            </ul>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Link expires in 24 hours. Didn&apos;t receive the email?{' '}
            <button 
              onClick={() => setStep('request')} 
              className="text-foreground hover:underline font-medium"
            >
              Try again
            </button>
          </p>
        </div>
        
        <Button variant="outline" asChild className="w-full h-12">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Link>
        </Button>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-8 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground group-hover:scale-105 transition-transform">
              <span className="text-base font-bold text-background">W</span>
            </div>
            <span className="font-semibold text-lg group-hover:translate-x-0.5 transition-transform">WorkReport</span>
          </Link>
          
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {token ? 'Password Reset!' : 'Email Sent!'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {token 
              ? 'Your password has been reset successfully.'
              : 'Check your email for the password reset link.'}
          </p>
        </div>
        
        {token && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirecting to login...</span>
          </div>
        )}
        
        <Button asChild className="w-full h-12 text-base btn-shine">
          <Link href="/login">
            Go to Login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // Reset password form (with token)
  if (step === 'reset') {
    return (
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-8 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground group-hover:scale-105 transition-transform">
              <span className="text-base font-bold text-background">W</span>
            </div>
            <span className="font-semibold text-lg group-hover:translate-x-0.5 transition-transform">WorkReport</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Create New Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter a strong password for your account
          </p>
        </div>
        
        <form onSubmit={handleResetPassword} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-4 text-sm bg-destructive/10 text-destructive rounded-xl animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-2">
            <Label 
              htmlFor="newPassword"
              className={`text-sm font-medium transition-colors ${focused === 'newPassword' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              New Password
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setFocused('newPassword')}
                onBlur={() => setFocused(null)}
                required
                disabled={loading}
                minLength={6}
                className="h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
          </div>
          
          <div className="space-y-2">
            <Label 
              htmlFor="confirmPassword"
              className={`text-sm font-medium transition-colors ${focused === 'confirmPassword' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocused('confirmPassword')}
                onBlur={() => setFocused(null)}
                required
                disabled={loading}
                minLength={6}
                className="h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive animate-fade-in">Passwords do not match</p>
            )}
            {confirmPassword && newPassword === confirmPassword && (
              <p className="text-xs text-green-600 dark:text-green-400 animate-fade-in flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-12 text-base btn-shine" 
            disabled={loading || (confirmPassword !== '' && newPassword !== confirmPassword)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                Reset Password
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
        
        <p className="text-center text-sm text-muted-foreground mt-8">
          Remember your password?{' '}
          <Link href="/login" className="text-foreground font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // Request reset form (default)
  return (
    <div className="w-full max-w-sm animate-fade-in-up">
      {/* Logo & Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center space-x-2 mb-8 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground group-hover:scale-105 transition-transform">
            <span className="text-base font-bold text-background">W</span>
          </div>
          <span className="font-semibold text-lg group-hover:translate-x-0.5 transition-transform">WorkReport</span>
        </Link>
        <h1 className="text-2xl font-bold mb-2">Forgot Password?</h1>
        <p className="text-sm text-muted-foreground">
          No worries! Enter your employee ID and we&apos;ll send you a reset link.
        </p>
      </div>
      
      <form onSubmit={handleRequestReset} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-4 text-sm bg-destructive/10 text-destructive rounded-xl animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
        
        <div className="space-y-2">
          <Label 
            htmlFor="employeeId"
            className={`text-sm font-medium transition-colors ${focused === 'employeeId' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Employee ID
          </Label>
          <Input
            id="employeeId"
            type="text"
            placeholder="Enter your employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            onFocus={() => setFocused('employeeId')}
            onBlur={() => setFocused(null)}
            required
            disabled={loading}
            className="h-12"
          />
        </div>
        
        <Button type="submit" className="w-full h-12 text-base btn-shine" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              Send Reset Link
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
      
      <p className="text-center text-sm text-muted-foreground mt-8">
        <Link href="/login" className="inline-flex items-center text-foreground font-medium hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to login
        </Link>
      </p>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted animate-pulse" />
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-7 w-48 bg-muted rounded mx-auto mb-2 animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded mx-auto animate-pulse" />
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-12 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-12 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <Suspense fallback={<LoadingFallback />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
