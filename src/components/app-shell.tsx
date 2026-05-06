'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  TrendingUp,
  Users,
  CalendarDays,
  Shield,
  User,
  CalendarCheck,
  UserCheck,
  LogOut,
  LifeBuoy,
  Menu,
} from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import type { SessionUser } from '@/types';
import { DEFAULT_PAGE_ACCESS } from '@/types';
import { canMarkAttendance, canMarkHolidays } from '@/lib/permissions';

type ShellLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function buildSidebarLinks(session: SessionUser): ShellLink[] {
  const pageAccess = session.pageAccess ?? DEFAULT_PAGE_ACCESS[session.role];
  const isManagerLike = session.role === 'manager' || session.role === 'teamhead';

  const links: ShellLink[] = [];

  if (pageAccess.dashboard) {
    links.push({ href: '/employee-dashboard', label: 'Dashboard', icon: LayoutDashboard });
  }
  if (pageAccess.submit_report) {
    links.push({ href: '/work-report', label: 'Submit Report', icon: FileText });
  }
  if (pageAccess.employee_reports) {
    links.push({
      href: isManagerLike ? '/team-report' : '/employee-reports',
      label: isManagerLike ? 'Team Reports' : 'Reports',
      icon: TrendingUp,
    });
  }
  if (isManagerLike) {
    links.push({ href: '/manage-team', label: 'Team Management', icon: Users });
  }
  // Managers/team heads use Team Reports (heatmap) only; skip duplicate Analytics link.
  if (pageAccess.management_dashboard && !isManagerLike) {
    links.push({ href: '/management-dashboard', label: 'Analytics', icon: CalendarDays });
  }
  if (pageAccess.admin_dashboard) {
    links.push({ href: '/admin', label: 'Admin Portal', icon: Shield });
  }
  if (pageAccess.super_admin_dashboard) {
    links.push({ href: '/super-admin', label: 'Super Admin', icon: Shield });
  }
  if (canMarkAttendance(session)) {
    links.push({ href: '/mark-attendance', label: 'Mark Attendance', icon: UserCheck });
  }
  if (canMarkHolidays(session)) {
    links.push({ href: '/holidays', label: 'Holidays', icon: CalendarCheck });
  }

  links.push({ href: '/profile', label: 'Profile', icon: User });

  return links;
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === '/employee-dashboard') return pathname === '/employee-dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  links,
  pathname,
  onNavigate,
  onLogout,
}: {
  links: ShellLink[];
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-4 border-b border-primary-foreground/10">
        <h2 className="text-2xl font-semibold leading-none">Work Report</h2>
        <p className="text-[11px] mt-1 uppercase tracking-[0.08em] text-primary-foreground/70">
          Enterprise Analytics
        </p>
      </div>
      <nav className="px-2 py-3 space-y-1 flex-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] ${
                active
                  ? 'bg-primary-foreground/15 text-primary-foreground'
                  : 'text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 py-3 border-t border-primary-foreground/10 space-y-1">
        <a
          href="mailto:websites@k-innovative.com"
          onClick={() => onNavigate?.()}
          className="w-full flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground"
        >
          <LifeBuoy className="h-4 w-4" /> Support
        </a>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary-foreground/80 hover:bg-primary-foreground/8 hover:text-primary-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  allowGuest = false,
}: {
  children: React.ReactNode;
  /** When true, render children without the authenticated shell if there is no session. */
  allowGuest?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setSession(data.data);
        } else {
          setSession(null);
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession(null);
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Failed to logout');
    }
  };

  const links = useMemo(() => (session ? buildSidebarLinks(session) : []), [session]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.06em]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    if (allowGuest) {
      return <>{children}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold">Login Required</h1>
          <p className="text-sm text-muted-foreground">Please sign in to continue.</p>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const headerInitial = session.name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="px-3 sm:px-4 md:px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:flex lg:flex-col rounded-md border border-primary/30 bg-primary text-primary-foreground overflow-hidden min-h-[calc(100vh-2rem)]">
            <SidebarNav links={links} pathname={pathname} onLogout={handleLogout} />
          </aside>

          <div className="flex flex-col min-w-0">
            {/* Mobile/Tablet header bar */}
            <div className="lg:hidden mb-3 flex items-center justify-between rounded-md border bg-card px-3 py-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open navigation"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-sm border text-muted-foreground hover:bg-muted"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 bg-primary text-primary-foreground border-r-0 w-72">
                  <SidebarNav
                    links={links}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                    onLogout={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                  />
                </SheetContent>
              </Sheet>
              <Link href="/" className="text-sm font-semibold tracking-[-0.01em]">
                Work Report
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle className="h-8 w-8 rounded-sm border border-border bg-card text-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted shrink-0" />
              <Link
                href="/profile"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                aria-label="Profile"
              >
                {headerInitial}
              </Link>
              </div>
            </div>

            {/* Desktop theme control when the page has no header toggle of its own. */}
            {!['/employee-dashboard', '/team-report', '/management-dashboard'].includes(pathname) && (
              <div className="hidden lg:flex justify-end mb-3">
                <ThemeToggle className="h-8 w-8 rounded-sm border border-border bg-card text-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted shrink-0" />
              </div>
            )}
            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
