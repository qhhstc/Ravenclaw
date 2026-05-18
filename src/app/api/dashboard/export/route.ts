import type { NextRequest } from "next/server";
import { apiError } from "@/lib/orders";
import { createDashboardOverviewWorkbook, dashboardOverviewExportFileName } from "@/lib/dashboard-export";
import { parseDashboardOverviewFilters } from "@/lib/dashboard-overview";
import { workbookToResponse } from "@/lib/order-excel";
import { canExport, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canExport(session.role)) return forbidden("当前角色不能导出经营看板");
    const filters = parseDashboardOverviewFilters(request.nextUrl.searchParams);
    const workbook = await createDashboardOverviewWorkbook(filters);
    return workbookToResponse(workbook, dashboardOverviewExportFileName(filters));
  } catch (error) {
    return apiError(error, "经营看板导出失败");
  }
}
