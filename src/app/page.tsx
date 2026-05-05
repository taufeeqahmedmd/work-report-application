'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Users, BarChart3, Shield, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { getISTYear } from '@/lib/date';
import type { SessionUser } from '@/types';

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
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        if (data.success && data.data) {
          router.replace(getDashboardUrl(data.data.role));
          return;
        }
      } catch {
        // No active session.
      }
      setCheckingAuth(false);
    };
    checkAuthAndRedirect();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { value: '99.9%', label: 'Uptime' },
    { value: '10K+', label: 'Reports' },
    { value: '500+', label: 'Users' },
    { value: '24/7', label: 'Support' },
  ];

  const features = [
    { icon: FileText, title: 'Daily Reports', description: 'Streamlined daily report creation with structured status tracking.' },
    { icon: Users, title: 'Team Management', description: 'Manage departments, users, and checkpoints with a centralized panel.' },
    { icon: BarChart3, title: 'Analytics', description: 'Get actionable trends and performance metrics across teams.' },
    { icon: Shield, title: 'Role-Based Access', description: 'Permission controls for admins, managers, and employees.' },
    { icon: Clock, title: 'Real-Time Tracking', description: 'Follow report activity and attendance updates as they happen.' },
    { icon: CheckCircle, title: 'Compliance', description: 'Keep reporting flows consistent and aligned with team protocols.' },
  ];

  return (
    <div className="min-h-screen bg-background pt-16">
      <section className="px-4 py-8">
        <div className="container max-w-6xl mx-auto">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold mb-3">Enterprise Analytics</p>
              <h1 className="text-5xl sm:text-6xl font-semibold leading-[0.95] tracking-[-0.02em] mb-4">
                Work Report
                <br />
                Management
                <br />
                System
              </h1>
              <p className="text-muted-foreground max-w-xl mb-6">
                A comprehensive solution for tracking employee work reports, managing teams, and analyzing productivity data.
              </p>
              <div className="flex gap-3">
                <Button asChild className="rounded-sm bg-primary text-primary-foreground px-5">
                  <Link href="/work-report">Submit Report <ArrowRight className="h-4 w-4 ml-2" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-sm px-5">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-md border bg-primary text-primary-foreground p-4 shadow-sm">
                <div className="rounded-sm border border-primary-foreground/20 bg-primary-foreground/5 p-3">
                  <p className="text-xs uppercase tracking-[0.06em] text-primary-foreground/70 mb-2">Team Overview</p>
                  <div className="space-y-2">
                    <div className="h-8 rounded-sm bg-primary-foreground/12" />
                    <div className="h-16 rounded-sm bg-primary-foreground/12" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-10 rounded-sm bg-primary-foreground/12" />
                      <div className="h-10 rounded-sm bg-primary-foreground/12" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 left-5 rounded-sm border bg-card px-3 py-2 shadow-sm">
                <p className="text-xs text-muted-foreground">KPI Pulse</p>
                <p className="text-sm font-semibold text-emerald-600">+18.4% this week</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="container max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border bg-card p-4 text-center">
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.06em] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 border-t">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold tracking-[-0.01em] mb-2">Enterprise-Grade Features</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Designed for structured reporting and high-visibility operations.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`rounded-md border p-4 ${index === 1 || index === 2 ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}
              >
                <div className={`w-10 h-10 rounded-sm flex items-center justify-center mb-3 ${index === 1 || index === 2 ? 'bg-primary-foreground/10' : 'bg-muted'}`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                <p className={`text-sm leading-relaxed ${index === 1 || index === 2 ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 border-t">
        <div className="container max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1fr_1fr] items-center">
          <div className="rounded-md border bg-primary text-primary-foreground p-4 min-h-[280px]">
            <div className="h-full rounded-sm border border-primary-foreground/20 bg-primary-foreground/5 p-4 flex flex-col">
              <p className="text-sm font-semibold mb-2">Submit Work Report</p>
              <div className="space-y-2 flex-1">
                <div className="h-8 rounded-sm bg-primary-foreground/12" />
                <div className="h-8 rounded-sm bg-primary-foreground/12" />
                <div className="h-20 rounded-sm bg-primary-foreground/12" />
              </div>
              <div className="h-9 rounded-sm bg-white text-primary text-sm font-semibold flex items-center justify-center mt-3">
                Submit
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.01em] mb-4">How it works</h2>
            <div className="space-y-4">
              {[
                { step: '1', title: 'User verification', desc: 'Enter your employee ID to validate account and permissions.' },
                { step: '2', title: 'Fill report', desc: 'Add your tasks, progress, attendance status, and work notes.' },
                { step: '3', title: 'Submit', desc: 'Submit and review updates from your dashboard analytics.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 rounded-sm border bg-card p-3">
                  <div className="h-6 w-6 rounded-sm bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center mt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="container max-w-6xl mx-auto">
          <div className="rounded-md border bg-primary text-primary-foreground p-10 text-center">
            <h2 className="text-4xl font-semibold tracking-[-0.01em] mb-3">Ready to get started?</h2>
            <p className="text-primary-foreground/80 mb-6 max-w-xl mx-auto">
              Join teams that use Work Report for daily compliance and operational visibility.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild className="rounded-sm bg-white text-primary hover:bg-white/90">
                <Link href="/work-report">Submit Report</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-sm border-white/40 text-white hover:bg-white/10">
                <Link href="/employee-reports">View Reports</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 px-4 border-t">
        <div className="container max-w-6xl mx-auto">
          <div className="grid gap-6 md:grid-cols-4 text-sm">
            <div>
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-foreground">
                  <span className="text-sm font-bold text-background">W</span>
                </div>
                <span className="font-semibold">Work Report</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Enterprise Analytics</p>
            </div>
            <div>
              <p className="font-medium mb-2">Product</p>
              <div className="space-y-1 text-muted-foreground">
                <Link href="/work-report" className="block hover:text-foreground">Submit Report</Link>
                <Link href="/employee-reports" className="block hover:text-foreground">View Reports</Link>
              </div>
            </div>
            <div>
              <p className="font-medium mb-2">Company</p>
              <div className="space-y-1 text-muted-foreground">
                <span className="block">About</span>
                <span className="block">Contact</span>
              </div>
            </div>
            <div>
              <p className="font-medium mb-2">Legal</p>
              <div className="space-y-1 text-muted-foreground">
                <span className="block">Security</span>
                <span className="block">Terms</span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
            <span>© {getISTYear()} Work Report. All rights reserved.</span>
            <span>v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
