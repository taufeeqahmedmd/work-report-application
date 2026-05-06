'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MonthlyHeatmapDashboard } from '@/components/monthly-heatmap-dashboard';
import type { SessionUser } from '@/types';

export default function TeamReportPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) setSession(data.data);
        else setSession(null);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login?callbackUrl=/team-report');
      return;
    }
    if (session.role === 'employee') {
      router.replace('/employee-dashboard');
      return;
    }
    if (session.role === 'admin' || session.role === 'superadmin' || session.role === 'boardmember') {
      router.replace('/management-dashboard');
      return;
    }
    if (session.role !== 'manager' && session.role !== 'teamhead') {
      router.replace('/employee-reports');
    }
  }, [loading, session, router]);

  if (loading || !session || session.role !== 'manager' && session.role !== 'teamhead') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <MonthlyHeatmapDashboard variant="team" />;
}
