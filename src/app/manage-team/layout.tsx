import { AppShell } from '@/components/app-shell';

export default function ManageTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
