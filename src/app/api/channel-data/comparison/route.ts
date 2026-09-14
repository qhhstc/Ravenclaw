import { NextResponse, type NextRequest } from "next/server";
import { getWeeklyComparison, parseChannelDataFilters } from "@/lib/channel-data";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!["admin", "finance"].includes(session.role)) return forbidden("当前角色不能查看渠道周环比分析");
    const filters = parseChannelDataFilters(request.nextUrl.searchParams);
    const weekNumber = Number(request.nextUrl.searchParams.get("weekNumber"));
    const comparison = await getWeeklyComparison({
      ...filters,
      ...(Number.isInteger(weekNumber) && weekNumber >= 1 && weekNumber <= 5 ? { weekNumber } : {}),
    });
    return NextResponse.json(comparison);
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "获取渠道周环比失败" }, { status: 400 });
  }
}
