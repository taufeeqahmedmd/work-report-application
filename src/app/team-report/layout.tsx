import { AppShell } from '@/components/app-shell';

export default function TeamReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
