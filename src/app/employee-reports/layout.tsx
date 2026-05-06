import { AppShell } from '@/components/app-shell';

export default function EmployeeReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
