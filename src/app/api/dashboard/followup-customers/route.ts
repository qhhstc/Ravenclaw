import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLOSED_CUSTOMER_STATUSES, apiError, crmDateRange } from "@/lib/crm";

export async function GET() {
  try {
    const { now, startOfToday, endOfToday, sevenDaysLater } = crmDateRange();
    const activeWhere = { status: { notIn: CLOSED_CUSTOMER_STATUSES } };
    const [todayCount, overdueCount, next7DaysCount, items] = await Promise.all([
      prisma.customer.count({ where: { ...activeWhere, nextFollowupAt: { gte: startOfToday, lt: endOfToday } } }),
      prisma.customer.count({ where: { ...activeWhere, nextFollowupAt: { lt: now } } }),
      prisma.customer.count({ where: { ...activeWhere, nextFollowupAt: { gte: now, lte: sevenDaysLater } } }),
      prisma.customer.findMany({
        where: { ...activeWhere, nextFollowupAt: { not: null } },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          brand: { select: { id: true, name: true } },
        },
        orderBy: { nextFollowupAt: "asc" },
        take: 20,
      }),
    ]);

    const sortedItems = items
      .map((item) => ({ ...item, overdue: item.nextFollowupAt ? item.nextFollowupAt < now : false }))
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(a.nextFollowupAt) - Number(b.nextFollowupAt))
      .slice(0, 5);

    return NextResponse.json({ todayCount, overdueCount, next7DaysCount, items: sortedItems });
  } catch (error) {
    return apiError(error, "待跟进客户加载失败");
  }
}
