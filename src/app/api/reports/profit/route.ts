import { NextResponse, type NextRequest } from "next/server";
import { logApiDuration } from "@/lib/api-logger";
import { apiError } from "@/lib/orders";
import { getProfitReport } from "@/lib/profit-reports";
import { canViewProfitReports, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const session = await requireApiSession();
    if (!canViewProfitReports(session.role)) return forbidden("当前角色不能查看利润报表");
    const report = await getProfitReport(request.nextUrl.searchParams, session);
    return NextResponse.json(report);
  } catch (error) {
    return apiError(error, "利润报表加载失败");
  } finally {
    logApiDuration("/api/reports/profit", startedAt);
  }
}
