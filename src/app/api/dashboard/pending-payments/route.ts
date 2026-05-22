import { NextResponse } from "next/server";
import { apiError, paymentDueWhere, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canViewAllOrders, requireApiSession } from "@/lib/permissions";

function isOverdue(value?: Date | null) {
  return Boolean(value && value.getTime() < Date.now());
}

export async function GET() {
  try {
    const session = await requireApiSession();
    const pendingWhere = paymentDueWhere("pending");
    const overdueWhere = paymentDueWhere("overdue");
    const scopeWhere = canViewAllOrders(session.role) ? {} : { OR: [{ createdBy: session.userId }, { salespersonId: session.userId }] };
    const [pendingOrders, overdueOrderCount] = await Promise.all([
      prisma.order.findMany({
        where: { AND: [pendingWhere, scopeWhere] },
        select: {
          id: true,
          orderNo: true,
          customerName: true,
          countryCode: true,
          totalAmount: true,
          paidAmount: true,
          unpaidAmount: true,
          currency: true,
          exchangeRate: true,
          dueDate: true,
          paymentStatus: true,
          customer: { select: { id: true, name: true, companyName: true } },
        },
        orderBy: [{ dueDate: "asc" }, { unpaidAmount: "desc" }],
      }),
      prisma.order.count({ where: { AND: [overdueWhere, scopeWhere] } }),
    ]);

    const sorted = [...pendingOrders].sort((a, b) => {
      const overdueDelta = Number(isOverdue(b.dueDate)) - Number(isOverdue(a.dueDate));
      if (overdueDelta) return overdueDelta;
      const aTime = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return toNumber(b.unpaidAmount) - toNumber(a.unpaidAmount);
    });

    return NextResponse.json({
      pendingOrderCount: pendingOrders.length,
      pendingAmount: pendingOrders.reduce((sum, order) => sum + toNumber(order.unpaidAmount) * (toNumber(order.exchangeRate, 1) || 1), 0),
      overdueOrderCount,
      items: sorted.slice(0, 5).map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        customerName: order.customerName ?? order.customer?.name ?? order.customer?.companyName ?? "散客/平台订单",
        countryCode: order.countryCode,
        totalAmount: toNumber(order.totalAmount),
        paidAmount: toNumber(order.paidAmount),
        unpaidAmount: toNumber(order.unpaidAmount),
        unpaidAmountBase: toNumber(order.unpaidAmount) * (toNumber(order.exchangeRate, 1) || 1),
        currency: order.currency,
        dueDate: order.dueDate,
        paymentStatus: order.paymentStatus,
        overdue: isOverdue(order.dueDate),
      })),
    });
  } catch (error) {
    return apiError(error, "待回款订单加载失败");
  }
}
