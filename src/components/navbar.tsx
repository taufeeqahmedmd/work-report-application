'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { Menu, LogOut, User, LayoutDashboard, FileText, BarChart3, ChevronDown, ArrowRight, Home, CalendarDays, UserCheck } from 'lucide-react';
import type { SessionUser, PageAccess } from '@/types';
import { DEFAULT_PAGE_ACCESS } from '@/types';
import { canMarkAttendance, canMarkHolidays } from '@/lib/permissions';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Get user's page access permissions
  const getPageAccess = (): PageAccess => {
    if (user?.pageAccess) {
      return user.pageAccess;
    }
    if (user?.role) {
      return DEFAULT_PAGE_ACCESS[user.role];
    }
    return DEFAULT_PAGE_ACCESS.employee;
  };

  const pageAccess = user ? getPageAccess() : null;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchSession();
  }, [pathname]);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Board members only see Management Dashboard - no other nav links
  const isBoardMember = user?.role === 'boardmember';

  // Build nav links based on pageAccess permissions
  type NavLink = {
    href: string;
    label: string;
    icon: typeof Home;
    requireAuth?: boolean;
    accessKey: keyof PageAccess;
    requireDepartment?: string;
  };

  const allNavLinks: NavLink[] = [
    { href: '/employee-dashboard', label: 'Dashboard', icon: Home, requireAuth: true, accessKey: 'dashboard' as keyof PageAccess },
    { href: '/work-report', label: 'Submit Report', icon: FileText, accessKey: 'submit_report' as keyof PageAccess },
    { href: '/mark-attendance', label: 'Mark Attendance', icon: UserCheck, requireAuth: true, accessKey: 'mark_attendance' as keyof PageAccess },
  ];

  const navLinks = allNavLinks.filter(link => {
    if (!user) return !link.requireAuth;
    // Check department requirement if specified
    if (link.requireDepartment && user.department !== link.requireDepartment) {
      return false;
    }
    const key = link.accessKey;
    return pageAccess?.[key] === true;
  });

  // View Reports link - based on pageAccess
  const viewReportsLabel = user?.role === 'manager' ? 'Team Reports' : 'Employee Reports';
  const viewReportsLink = { href: '/employee-reports', label: viewReportsLabel, icon: BarChart3 };
  const showViewReports = user && pageAccess?.employee_reports === true;

  // Admin links - based on pageAccess
  const adminLinks = [
    { href: '/management-dashboard', label: 'Management Dashboard', icon: BarChart3, accessKey: 'management_dashboard' as keyof PageAccess },
    { href: '/managers-dashboard', label: 'Managers Dashboard', icon: BarChart3, accessKey: 'management_dashboard' as keyof PageAccess },
    { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, accessKey: 'admin_dashboard' as keyof PageAccess },
    { href: '/super-admin', label: 'Super Admin Dashboard', icon: LayoutDashboard, accessKey: 'super_admin_dashboard' as keyof PageAccess },
  ];

  const filteredAdminLinks = adminLinks.filter(
    (link) => user && pageAccess?.[link.accessKey] === true
  );

  // Holidays link - show if user can mark holidays (Manager, Admin, Super Admin, or Operations with permission)
  const canMarkHolidaysAccess = canMarkHolidays(user);

  // Mark Attendance link - show for any user with mark_attendance permission
  const canMarkAttendanceAccess = canMarkAttendance(user);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-background/80 backdrop-blur-xl border-b shadow-sm' 
          : 'bg-background border-b'
      }`}
    >
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground group-hover:scale-105 transition-transform">
            <span className="text-sm font-bold text-background">W</span>
          </div>
          <span className="font-semibold hidden sm:inline-block group-hover:translate-x-0.5 transition-transform">WorkReport</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-1">
          {/* Board members don't see regular nav links */}
          {!isBoardMember && navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? 'bg-muted text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span className="relative z-10">{link.label}</span>
                {!isActive && (
                  <span className="absolute inset-0 rounded-lg bg-muted scale-0 group-hover:scale-100 transition-transform origin-center -z-0" />
                )}
              </Link>
            );
          })}
          {/* View Reports - only for managers/admins (not board members) */}
          {showViewReports && !isBoardMember && (
            <Link
              href={viewReportsLink.href}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group ${
                pathname === viewReportsLink.href 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="relative z-10">{viewReportsLink.label}</span>
              {pathname !== viewReportsLink.href && (
                <span className="absolute inset-0 rounded-lg bg-muted scale-0 group-hover:scale-100 transition-transform origin-center -z-0" />
              )}
            </Link>
          )}
          
          {filteredAdminLinks.length > 0 && (
            isBoardMember ? (
              // Board members see Management directly, not in a dropdown
              <Link
                href="/management-dashboard"
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group ${
                  pathname === '/management-dashboard' 
                    ? 'bg-muted text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span className="relative z-10">Management</span>
                {pathname !== '/management-dashboard' && (
                  <span className="absolute inset-0 rounded-lg bg-muted scale-0 group-hover:scale-100 transition-transform origin-center -z-0" />
                )}
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200">
                    Admin
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48 animate-scale-in">
                  {filteredAdminLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link href={link.href} className="cursor-pointer flex items-center justify-between">
                        {link.label}
                        <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </Link>
                    </DropdownMenuItem>
                  ))}
          {canMarkHolidaysAccess && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/holidays" className="cursor-pointer flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Holidays
                          </span>
                          <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
          {canMarkAttendanceAccess && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/mark-attendance" className="cursor-pointer flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            Mark Attendance
                          </span>
                          <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {loading ? (
            <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-muted">
                  <Avatar className="h-7 w-7 transition-transform hover:scale-105">
                    <AvatarFallback className="bg-foreground text-background text-xs font-medium">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block text-sm font-medium">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 animate-scale-in" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className={`inline-flex w-fit text-xs px-2 py-0.5 rounded font-medium mt-1 ${
                      user.role === 'superadmin' 
                        ? 'role-superadmin' 
                                    : user.role === 'admin' 
                          ? 'role-admin' 
                          : user.role === 'boardmember'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            : 'role-employee'
                    }`}>
                      {user.role === 'boardmember' ? 'Board Member' : user.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="btn-shine">
              <Link href="/login">Sign in</Link>
            </Button>
          )}

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
                      <span className="text-sm font-bold text-background">W</span>
                    </div>
                    <span className="font-semibold">WorkReport</span>
                  </div>
                </div>

                {user && (
                  <div className="p-4 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-foreground text-background font-medium">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {/* Board members don't see regular nav links */}
                  {!isBoardMember && navLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200 active-press ${
                          isActive 
                            ? 'bg-foreground text-background font-medium' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    );
                  })}
                  {/* View Reports - only for managers/admins (not board members) */}
                  {showViewReports && !isBoardMember && (
                    <Link
                      href={viewReportsLink.href}
                      className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200 active-press ${
                        pathname === viewReportsLink.href 
                          ? 'bg-foreground text-background font-medium' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <viewReportsLink.icon className="h-4 w-4" />
                      {viewReportsLink.label}
                    </Link>
                  )}
                  
                  {filteredAdminLinks.length > 0 && (
                    <>
                      <div className="pt-4 pb-2 px-4">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Admin
                        </span>
                      </div>
                      {filteredAdminLinks.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200 active-press ${
                              isActive 
                                ? 'bg-foreground text-background font-medium' 
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <link.icon className="h-4 w-4" />
                            {link.label}
                          </Link>
                        );
                      })}
                {canMarkHolidaysAccess && (
                        <Link
                          href="/holidays"
                          className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200 active-press ${
                            pathname === '/holidays'
                              ? 'bg-foreground text-background font-medium' 
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <CalendarDays className="h-4 w-4" />
                          Holidays
                        </Link>
                      )}
                {canMarkAttendanceAccess && (
                        <Link
                          href="/mark-attendance"
                          className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200 active-press ${
                            pathname === '/mark-attendance'
                              ? 'bg-foreground text-background font-medium' 
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <UserCheck className="h-4 w-4" />
                          Mark Attendance
                        </Link>
                      )}
                    </>
                  )}
                </nav>

                <div className="p-4 border-t space-y-2">
                  {user && (
                    <Button 
                      asChild
                      variant="outline" 
                      className="w-full active-press"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/profile">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </Button>
                  )}
                  {user ? (
                    <Button 
                      variant="outline" 
                      className="w-full active-press text-destructive hover:text-destructive"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </Button>
                  ) : (
                    <Button 
                      asChild 
                      className="w-full btn-shine"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/login">Sign in</Link>
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
