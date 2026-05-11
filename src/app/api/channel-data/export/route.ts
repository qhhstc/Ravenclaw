import type { NextRequest } from "next/server";
import {
  createChannelDataExportWorkbook,
  excelFileName,
  workbookToResponse,
} from "@/lib/channel-data-excel";
import { parseChannelDataFilters } from "@/lib/channel-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const filters = parseChannelDataFilters(request.nextUrl.searchParams);
    const workbook = await createChannelDataExportWorkbook(filters);
    return workbookToResponse(workbook, excelFileName(filters.year, filters.month));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "导出 Excel 失败" },
      { status: 400 },
    );
  }
}
