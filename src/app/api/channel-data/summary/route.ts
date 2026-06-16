import { NextResponse, type NextRequest } from "next/server";
import { getMonthlyRows, getQuarterTotals, parseChannelDataFilters } from "@/lib/channel-data";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

function sumRows(rows: Awaited<ReturnType<typeof getMonthlyRows>>) {
  return rows.reduce(
    (summary, row) => {
      // 跨渠道汇总统一按本位币(原币×汇率),避免不同币种直接相加
      const rate = Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1;
      const rowSales = row.weeks.reduce((total, week) => total + week.salesAmountOriginal * rate, 0);
      const rowAdSpend = row.weeks.reduce((total, week) => total + week.adSpendOriginal * rate, 0);
      return {
        salesAmount: summary.salesAmount + rowSales,
        adSpend: summary.adSpend + rowAdSpend,
        channelCount: summary.channelCount + 1,
        advertisedChannelCount: summary.advertisedChannelCount + (rowAdSpend > 0 ? 1 : 0),
      };
    },
    { salesAmount: 0, adSpend: 0, channelCount: 0, advertisedChannelCount: 0 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!["admin", "finance"].includes(session.role)) return forbidden("当前角色不能查看全局渠道经营汇总");
    const filters = parseChannelDataFilters(request.nextUrl.searchParams);
    const [rows, quarter] = await Promise.all([getMonthlyRows(filters), getQuarterTotals(filters)]);
    return NextResponse.json({ month: sumRows(rows), quarter });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "获取渠道汇总失败" },
      { status: 400 },
    );
  }
}
