import { redirect } from "next/navigation";
import UserAccountManager from "@/components/system/UserAccountManager";
import { requireUser } from "@/lib/auth";
import { canManageAccounts } from "@/lib/permissions";

export default async function SystemSettingsPage() {
  const user = await requireUser();
  if (!canManageAccounts(user.role)) redirect("/dashboard");
  return <UserAccountManager />;
}
