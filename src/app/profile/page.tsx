'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  User, 
  Mail, 
  Building2, 
  Briefcase, 
  Shield, 
  Calendar,
  Lock,
  Send,
  Check,
  Eye,
  EyeOff,
  Users,
  GitBranch,
  ArrowLeft,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { ProfileData } from '@/app/api/profile/route';

type PasswordChangeStep = 'idle' | 'sending' | 'otp_sent' | 'verifying' | 'success';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Password change state
  const [passwordChangeStep, setPasswordChangeStep] = useState<PasswordChangeStep>('idle');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.data);
      } else {
        toast.error(data.error || 'Failed to load profile');
        if (response.status === 401) {
          router.push('/login');
        }
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setPasswordChangeStep('sending');
    try {
      const response = await fetch('/api/profile/send-otp', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setMaskedEmail(data.data?.email || '');
        setPasswordChangeStep('otp_sent');
        toast.success(data.message || 'OTP sent to your email');
      } else {
        toast.error(data.error || 'Failed to send OTP');
        setPasswordChangeStep('idle');
      }
    } catch {
      toast.error('Failed to send OTP');
      setPasswordChangeStep('idle');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setPasswordChangeStep('verifying');
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await response.json();
      
      if (data.success) {
        setPasswordChangeStep('success');
        toast.success('Password changed successfully! Redirecting to login...');
        // Auto logout and redirect to login
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        toast.error(data.error || 'Failed to change password');
        setPasswordChangeStep('otp_sent');
      }
    } catch {
      toast.error('Failed to change password');
      setPasswordChangeStep('otp_sent');
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'admin':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'manager':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'teamhead':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'boardmember':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Unable to load profile</p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 bg-background overflow-x-hidden">
      <div className="px-3 sm:px-4 md:px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:flex lg:flex-col rounded-md border border-primary/30 bg-primary text-primary-foreground overflow-hidden min-h-[calc(100vh-7.5rem)]">
            <div className="px-5 py-4 border-b border-primary-foreground/10">
              <h2 className="text-2xl font-semibold leading-none">Work Report</h2>
              <p className="text-[11px] mt-1 uppercase tracking-[0.08em] text-primary-foreground/70">Enterprise Analytics</p>
            </div>
            <nav className="px-2 py-3 space-y-1">
              <Link href="/employee-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <User className="h-4 w-4" /> Dashboard
              </Link>
              <Link href="/employee-reports" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <Briefcase className="h-4 w-4" /> Reports
              </Link>
              <Link href="/manage-team" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <Users className="h-4 w-4" /> Team Management
              </Link>
              <Link href="/management-dashboard" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <GitBranch className="h-4 w-4" /> Analytics
              </Link>
              <Link href="/admin" className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground">
                <Shield className="h-4 w-4" /> Admin Portal
              </Link>
            </nav>
          </aside>

          <main className="space-y-4">
            <div className="rounded-md border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-sm">
                  <Link href="/employee-dashboard" className="border-b-2 border-primary pb-1 font-medium">Dashboard</Link>
                  <Link href="/work-report" className="text-muted-foreground hover:text-foreground">Submit Report</Link>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full border flex items-center justify-center text-yellow-500">◐</div>
                  <div className="flex items-center gap-2 rounded-full border px-2 py-1">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {profile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium">{profile.name.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
            </div>

        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/employee-dashboard" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground mt-1">View your account details and manage your password</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-md border bg-card p-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-background">
                    {profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.01em]">{profile.name}</h2>
                  <span className={`inline-flex text-xs px-2.5 py-1 rounded-sm font-medium mt-1 uppercase tracking-[0.05em] ${getRoleBadgeClass(profile.role)}`}>
                    {profile.role === 'boardmember'
                      ? 'Board Member'
                      : profile.role === 'teamhead'
                        ? 'Team Head'
                        : profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </span>
                </div>
              </div>
            <div className="space-y-3 mt-5">
              <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Employee ID</p>
                  <p className="font-medium">{profile.employeeId}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Department</p>
                  <p className="font-medium">{profile.department}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{profile.status}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Member Since</p>
                  <p className="font-medium">{formatDate(profile.createdAt)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Organization Hierarchy Card */}
          <section className="rounded-md border bg-card p-5">
              <h3 className="text-2xl font-semibold tracking-[-0.01em] flex items-center gap-2 mb-1">
                <GitBranch className="h-5 w-5" />
                Organization Hierarchy
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Your position in the organization</p>
            <div className="space-y-4">
              {profile.entity && (
                <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Entity</p>
                    <p className="font-medium">{profile.entity.name}</p>
                  </div>
                </div>
              )}
              
              {profile.branch && (
                <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/45">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Branch</p>
                    <p className="font-medium">{profile.branch.name}</p>
                  </div>
                </div>
              )}
              
              {!profile.entity && !profile.branch && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No organization hierarchy assigned
                </p>
              )}

              {/* Reporting Managers */}
              {profile.managers && profile.managers.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Reporting Manager{profile.managers.length > 1 ? 's' : ''}
                  </h4>
                  <div className="space-y-2">
                    {profile.managers.map((manager) => (
                      <div key={manager.id} className="flex items-center gap-3 p-3 rounded-sm bg-primary text-primary-foreground">
                        <div className="h-8 w-8 rounded-sm bg-primary-foreground/12 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-foreground">
                            {manager.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{manager.name}</p>
                          <p className="text-xs text-primary-foreground/70">{manager.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Change Password Card */}
          <section className="xl:col-span-2 rounded-md border bg-card p-6">
              <h3 className="text-4xl font-semibold tracking-[-0.01em] text-center flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </h3>
              <p className="text-center text-muted-foreground mt-2 mb-6">
                Secure your account with a new password. We&apos;ll send an OTP to your email for verification.
              </p>
            <div>
              {passwordChangeStep === 'idle' && (
                <div className="flex flex-col items-center py-8 rounded-sm bg-muted/35 border max-w-2xl mx-auto">
                  <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                    To change your password, we&apos;ll send a one-time password (OTP) to your registered email address for verification.
                  </p>
                  <Button onClick={handleSendOTP} className="gap-2 rounded-sm">
                    <Send className="h-4 w-4" />
                    Send OTP to Email
                  </Button>
                </div>
              )}

              {passwordChangeStep === 'sending' && (
                <div className="flex flex-col items-center py-6">
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Sending OTP to your email...</p>
                </div>
              )}

              {(passwordChangeStep === 'otp_sent' || passwordChangeStep === 'verifying') && (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md mx-auto">
                  <div className="p-4 rounded-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm mb-4 border">
                    <p className="font-medium">OTP sent successfully!</p>
                    <p className="text-emerald-600 dark:text-emerald-400">Check your email at {maskedEmail}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      className="text-center text-lg tracking-widest"
                      required
                      disabled={passwordChangeStep === 'verifying'}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                        required
                        disabled={passwordChangeStep === 'verifying'}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={6}
                        required
                        disabled={passwordChangeStep === 'verifying'}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPasswordChangeStep('idle');
                        setOtp('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      disabled={passwordChangeStep === 'verifying'}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 gap-2"
                      disabled={passwordChangeStep === 'verifying'}
                    >
                      {passwordChangeStep === 'verifying' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Change Password
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    className="text-sm text-muted-foreground hover:text-foreground underline w-full text-center mt-2"
                    disabled={passwordChangeStep === 'verifying'}
                  >
                    Resend OTP
                  </button>
                </form>
              )}

              {passwordChangeStep === 'success' && (
                <div className="flex flex-col items-center py-6">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Password Changed Successfully!</p>
                  <p className="text-sm text-muted-foreground mt-1">Redirecting to login page...</p>
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-3" />
                </div>
              )}
            </div>
          </section>
        </div>
          </main>
        </div>
      </div>
    </div>
  );
}

