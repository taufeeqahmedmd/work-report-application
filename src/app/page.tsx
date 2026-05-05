'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Users, BarChart3, Shield, Clock, CheckCircle, Sparkles, Zap, ArrowUpRight, Loader2 } from 'lucide-react';
import { getISTYear } from '@/lib/date';
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

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is logged in and redirect to dashboard
    const checkAuthAndRedirect = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        if (data.success && data.data) {
          // User is logged in, redirect to their dashboard
          const dashboardUrl = getDashboardUrl(data.data.role);
          router.replace(dashboardUrl);
          return;
        }
      } catch {
        // Not logged in, show homepage
      }
      setCheckingAuth(false);
      setMounted(true);
    };
    
    checkAuthAndRedirect();
  }, [router]);

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const features = [
    {
      icon: FileText,
      title: 'Daily Reports',
      description: 'Submit daily work reports with an intuitive, streamlined form.',
    },
    {
      icon: Users,
      title: 'Team Management',
      description: 'Manage employees, assign roles, and organize teams efficiently.',
    },
    {
      icon: BarChart3,
      title: 'Analytics',
      description: 'Visualize data with powerful charts and track performance metrics.',
    },
    {
      icon: Shield,
      title: 'Role-Based Access',
      description: 'Secure access control with multiple role levels.',
    },
    {
      icon: Clock,
      title: 'Real-Time Tracking',
      description: 'Monitor work reports and get instant productivity updates.',
    },
    {
      icon: CheckCircle,
      title: 'Leave Management',
      description: 'Track working days and leaves for better attendance.',
    },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime' },
    { value: '10K+', label: 'Reports' },
    { value: '500+', label: 'Users' },
    { value: '24/7', label: 'Support' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-muted rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-muted rounded-full blur-3xl opacity-30" />
        </div>
        
        <div className="container max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-background/50 backdrop-blur-sm text-sm mb-8 hover-lift cursor-default ${mounted ? 'animate-fade-in-down' : 'opacity-0'}`}>
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot"></span>
            <span>Now available for teams</span>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {/* Main heading */}
          <h1 className={`text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 ${mounted ? 'animate-fade-in-up opacity-0 delay-100' : 'opacity-0'}`}>
            Work Report
            <br />
            <span className="text-muted-foreground">Management System</span>
          </h1>
          
          {/* Subtitle */}
          <p className={`text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 ${mounted ? 'animate-fade-in-up opacity-0 delay-200' : 'opacity-0'}`}>
            A comprehensive solution for tracking employee work reports, 
            managing teams, and analyzing productivity data. Built for modern businesses.
          </p>
          
          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-16 ${mounted ? 'animate-fade-in-up opacity-0 delay-300' : 'opacity-0'}`}>
            <Button asChild size="lg" className="h-12 px-8 text-base btn-shine active-press">
              <Link href="/work-report">
                Submit Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base hover-lift active-press">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          
          {/* Stats */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto ${mounted ? 'animate-fade-in-up opacity-0 delay-400' : 'opacity-0'}`}>
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="text-center group cursor-default"
              >
                <p className="text-3xl md:text-4xl font-bold mb-1 group-hover:scale-110 transition-transform">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 border-t">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm text-muted-foreground mb-4">
              <Zap className="h-4 w-4" />
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              All the tools to track, manage, and analyze employee work reports efficiently.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`group p-6 rounded-xl border bg-card interactive-card gradient-border ${mounted ? 'animate-fade-in-up opacity-0' : 'opacity-0'}`}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-all duration-300 group-hover:scale-110">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2 group-hover:translate-x-1 transition-transform">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Learn more</span>
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 border-t bg-muted/30">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-border" />
            
            {[
              { step: '1', title: 'Enter ID', desc: 'Start by entering your unique employee identifier.' },
              { step: '2', title: 'Fill Report', desc: 'Select your status and describe your daily work.' },
              { step: '3', title: 'Submit', desc: 'Submit and track your history through the portal.' },
            ].map((item, index) => (
              <div 
                key={index} 
                className={`text-center group ${mounted ? 'animate-fade-in-up opacity-0' : 'opacity-0'}`}
                style={{ animationDelay: `${(index + 1) * 150}ms` }}
              >
                <div className="w-16 h-16 rounded-full bg-foreground text-background text-xl font-bold flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform relative z-10">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 border-t">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center p-12 rounded-2xl border bg-card interactive-card">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Submit your daily work report now or sign in to access your dashboard and analytics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="h-12 px-8 text-base btn-shine active-press">
                <Link href="/work-report">
                  Submit Report
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base hover-lift active-press">
                <Link href="/employee-reports">View Reports</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground group-hover:scale-110 transition-transform">
                <span className="text-sm font-bold text-background">W</span>
              </div>
              <span className="font-semibold">WorkReport</span>
            </div>
            
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <Link href="/work-report" className="link-hover hover:text-foreground transition-colors">
                Submit Report
              </Link>
              <Link href="/employee-reports" className="link-hover hover:text-foreground transition-colors">
                View Reports
              </Link>
              <Link href="/login" className="link-hover hover:text-foreground transition-colors">
                Sign in
              </Link>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © {getISTYear()} WorkReport
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
