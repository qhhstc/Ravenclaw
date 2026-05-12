import { requireUser } from "@/lib/auth";
import AdminShell from "@/components/layout/AdminShell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  return <AdminShell userName={user.name} userRole={user.role}>{children}</AdminShell>;
}
