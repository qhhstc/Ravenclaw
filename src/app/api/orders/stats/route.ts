import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, buildOrderWhere, paymentDueWhere, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

function monthRange(params: URLSearchParams) {
  const now = new Date();
  const year = Number(params.get("year")) || 2026;
  const month = Number(params.get("month")) || 5;
  const from = params.get("dateFrom") ? new Date(String(params.get("dateFrom"))) : new Date(Date.UTC(year, month - 1, 1));
  const to = params.get("dateTo") ? new Date(String(params.get("dateTo"))) : new Date(Date.UTC(year, month, 1));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const fallbackFrom = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const fallbackTo = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    return { from: fallbackFrom, to: fallbackTo };
  }
  return { from, to };
}

function mergeWhere(base: Prisma.OrderWhereInput, extra: Prisma.OrderWhereInput): Prisma.OrderWhereInput {
  return { AND: [base, extra] };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const { from, to } = monthRange(params);
    const filteredWhere = buildOrderWhere(params);
    const monthWhere = mergeWhere(filteredWhere, { orderDate: { gte: from, lt: to } });
    const pendingWhere = mergeWhere(filteredWhere, paymentDueWhere("pending"));
    const overdueWhere = mergeWhere(filteredWhere, paymentDueWhere("overdue"));

    const [monthOrders, pendingPaymentCount, overduePaymentCount] = await Promise.all([
      prisma.order.findMany({ where: monthWhere, select: { totalAmount: true, paidAmount: true, unpaidAmount: true } }),
      prisma.order.count({ where: pendingWhere }),
      prisma.order.count({ where: overdueWhere }),
    ]);

    const totals = monthOrders.reduce(
      (summary, order) => ({
        totalAmount: summary.totalAmount + toNumber(order.totalAmount),
        paidAmount: summary.paidAmount + toNumber(order.paidAmount),
        unpaidAmount: summary.unpaidAmount + toNumber(order.unpaidAmount),
      }),
      { totalAmount: 0, paidAmount: 0, unpaidAmount: 0 },
    );

    return NextResponse.json({
      monthOrderCount: monthOrders.length,
      monthTotalAmount: totals.totalAmount,
      monthPaidAmount: totals.paidAmount,
      monthUnpaidAmount: totals.unpaidAmount,
      pendingPaymentCount,
      overduePaymentCount,
    });
  } catch (error) {
    return apiError(error, "订单统计加载失败");
  }
}
