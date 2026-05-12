import type { NextRequest } from "next/server";
import { apiError } from "@/lib/orders";
import { createOrderListWorkbook, orderExportFileName, workbookToResponse } from "@/lib/order-excel";
import { canExport, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canExport(session.role)) return forbidden("当前角色不能导出订单");
    const workbook = await createOrderListWorkbook(request.nextUrl.searchParams, session);
    return workbookToResponse(workbook, orderExportFileName(request.nextUrl.searchParams));
  } catch (error) {
    return apiError(error, "订单导出失败");
  }
}
