import { redirect } from "next/navigation";
import ProfitReportPage from "@/components/reports/ProfitReportPage";
import { requireUser } from "@/lib/auth";
import { canViewProfitReports } from "@/lib/permissions";

export default async function ProfitReportRoutePage() {
  const user = await requireUser();
  if (!canViewProfitReports(user.role)) redirect("/orders");
  return <ProfitReportPage />;
}
