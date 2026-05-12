import type { NextRequest } from "next/server";
import { createProductExportWorkbook, productWorkbookResponse } from "@/lib/product-excel";
import { apiError } from "@/lib/products";
import { canExport, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canExport(session.role)) return forbidden("当前角色不能导出产品");
    const workbook = await createProductExportWorkbook(request.nextUrl.searchParams, session);
    return productWorkbookResponse(workbook, "产品列表.xlsx");
  } catch (error) {
    return apiError(error, "产品导出失败");
  }
}
