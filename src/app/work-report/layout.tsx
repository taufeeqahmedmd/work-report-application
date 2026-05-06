import { AppShell } from '@/components/app-shell';

export default function WorkReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // /work-report is intentionally accessible to guests as well as authenticated users.
  // When signed in: render inside the authenticated AppShell.
  // When not signed in: render the form plain (no shell).
  return <AppShell allowGuest>{children}</AppShell>;
}
