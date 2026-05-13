import type { NextRequest } from "next/server";
import {
  createChannelDataExportWorkbook,
  excelFileName,
  workbookToResponse,
} from "@/lib/channel-data-excel";
import { parseChannelDataFilters } from "@/lib/channel-data";
import { ApiAuthError, canExport, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canExport(session.role)) return forbidden("当前角色不能导出渠道经营数据");
    const filters = parseChannelDataFilters(request.nextUrl.searchParams);
    const workbook = await createChannelDataExportWorkbook(filters);
    return workbookToResponse(workbook, excelFileName(filters.year, filters.month));
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json(
      { message: error instanceof Error ? error.message : "导出 Excel 失败" },
      { status: 400 },
    );
  }
}
