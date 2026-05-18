import type { NextRequest } from "next/server";
import { logApiDuration } from "@/lib/api-logger";
import { getDashboardOverviewData, hiddenDashboardOverview, parseDashboardOverviewFilters } from "@/lib/dashboard-overview";
import { ApiAuthError, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const session = await requireApiSession();
    const filters = parseDashboardOverviewFilters(request.nextUrl.searchParams);
    if (session.role !== "admin" && session.role !== "finance") {
      return Response.json(hiddenDashboardOverview(filters));
    }
    return Response.json(await getDashboardOverviewData(filters));
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json(
      { message: error instanceof Error ? error.message : "获取经营看板数据失败" },
      { status: 400 },
    );
  } finally {
    logApiDuration("/api/dashboard/overview", startedAt);
  }
}
