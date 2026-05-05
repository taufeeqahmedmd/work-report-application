'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container max-w-4xl mx-auto">
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

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Details Card */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-2xl font-bold text-background">
                    {profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-xl">{profile.name}</CardTitle>
                  <span className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium mt-1 ${getRoleBadgeClass(profile.role)}`}>
                    {profile.role === 'boardmember'
                      ? 'Board Member'
                      : profile.role === 'teamhead'
                        ? 'Team Head'
                        : profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Employee ID</p>
                  <p className="font-medium">{profile.employeeId}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{profile.department}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{profile.status}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="font-medium">{formatDate(profile.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization Hierarchy Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Organization Hierarchy
              </CardTitle>
              <CardDescription>Your position in the organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.entity && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Entity</p>
                    <p className="font-medium">{profile.entity.name}</p>
                  </div>
                </div>
              )}
              
              {profile.branch && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Branch</p>
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
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Reporting Manager{profile.managers.length > 1 ? 's' : ''}
                  </h4>
                  <div className="space-y-2">
                    {profile.managers.map((manager) => (
                      <div key={manager.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {manager.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{manager.name}</p>
                          <p className="text-xs text-muted-foreground">{manager.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Secure your account with a new password. We&apos;ll send an OTP to your email for verification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passwordChangeStep === 'idle' && (
                <div className="flex flex-col items-center py-6">
                  <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                    To change your password, we&apos;ll send a one-time password (OTP) to your registered email address for verification.
                  </p>
                  <Button onClick={handleSendOTP} className="gap-2">
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
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm mb-4">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

