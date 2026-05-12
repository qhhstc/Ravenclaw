import type { NextRequest } from "next/server";
import { apiError } from "@/lib/orders";
import { createProfitReportWorkbook, profitExportFileName } from "@/lib/profit-reports";
import { workbookToResponse } from "@/lib/order-excel";
import { canExport, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canExport(session.role)) return forbidden("当前角色不能导出利润报表");
    const type = request.nextUrl.searchParams.get("type") || "orders";
    const workbook = await createProfitReportWorkbook(request.nextUrl.searchParams, session, type);
    return workbookToResponse(workbook, profitExportFileName(type, request.nextUrl.searchParams.get("year")));
  } catch (error) {
    return apiError(error, "利润报表导出失败");
  }
}
