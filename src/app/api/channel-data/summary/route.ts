import { NextResponse, type NextRequest } from "next/server";
import { getMonthlyRows, getQuarterTotals, parseChannelDataFilters } from "@/lib/channel-data";

function sumRows(rows: Awaited<ReturnType<typeof getMonthlyRows>>) {
  return rows.reduce(
    (summary, row) => {
      const rowSales = row.weeks.reduce((total, week) => total + week.salesAmountOriginal, 0);
      const rowAdSpend = row.weeks.reduce((total, week) => total + week.adSpendOriginal, 0);
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
    const filters = parseChannelDataFilters(request.nextUrl.searchParams);
    const [rows, quarter] = await Promise.all([getMonthlyRows(filters), getQuarterTotals(filters)]);
    return NextResponse.json({ month: sumRows(rows), quarter });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "获取渠道汇总失败" },
      { status: 400 },
    );
  }
}
