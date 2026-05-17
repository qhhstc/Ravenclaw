import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { CLOSED_ORDER_STATUSES, apiError, paymentDueWhere, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canViewProfitReports, forbidden, requireApiSession } from "@/lib/permissions";

const BASE_CURRENCY = "CNY";
const activeOrderWhere: Prisma.OrderWhereInput = { orderStatus: { notIn: CLOSED_ORDER_STATUSES } };

type FinanceOrder = {
  salesAmount: unknown;
  paidAmount: unknown;
  unpaidAmount: unknown;
  totalCost: unknown;
  grossProfit: unknown;
  exchangeRate: unknown;
  paymentStatus: string;
  shippingStatus: string;
  dueDate?: Date | null;
};

function dateValue(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function customerName(order: { customerName?: string | null; customer?: { name?: string | null; companyName?: string | null } | null }) {
  return order.customerName || order.customer?.companyName || order.customer?.name || "散客/平台订单";
}

function toBase(order: FinanceOrder, value: unknown) {
  return toNumber(value) * toNumber(order.exchangeRate, 1);
}

function sumBase(orders: FinanceOrder[], field: keyof Pick<FinanceOrder, "salesAmount" | "paidAmount" | "unpaidAmount" | "totalCost" | "grossProfit">) {
  return Number(orders.reduce((sum, order) => sum + toBase(order, order[field]), 0).toFixed(2));
}

function paymentRows(orders: FinanceOrder[]) {
  const rows = new Map<string, { paymentStatus: string; count: number; paidAmount: number; unpaidAmount: number }>();
  orders.forEach((order) => {
    const current = rows.get(order.paymentStatus) ?? { paymentStatus: order.paymentStatus, count: 0, paidAmount: 0, unpaidAmount: 0 };
    current.count += 1;
    current.paidAmount += toBase(order, order.paidAmount);
    current.unpaidAmount += toBase(order, order.unpaidAmount);
    rows.set(order.paymentStatus, current);
  });
  return [...rows.values()].map((row) => ({ ...row, paidAmount: Number(row.paidAmount.toFixed(2)), unpaidAmount: Number(row.unpaidAmount.toFixed(2)) }));
}

function shippingRows(orders: FinanceOrder[]) {
  const rows = new Map<string, { shippingStatus: string; count: number }>();
  orders.forEach((order) => {
    const current = rows.get(order.shippingStatus) ?? { shippingStatus: order.shippingStatus, count: 0 };
    current.count += 1;
    rows.set(order.shippingStatus, current);
  });
  return [...rows.values()];
}

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!canViewProfitReports(session.role)) return forbidden("当前角色不能查看财务中心");

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const [activeOrders, receivableOrders, shippingRiskOrders, recentPayments] = await Promise.all([
      prisma.order.findMany({
        where: activeOrderWhere,
        select: {
          salesAmount: true,
          paidAmount: true,
          unpaidAmount: true,
          totalCost: true,
          grossProfit: true,
          exchangeRate: true,
          paymentStatus: true,
          shippingStatus: true,
          dueDate: true,
        },
      }),
      prisma.order.findMany({
        where: { AND: [activeOrderWhere, paymentDueWhere("pending")] },
        include: { customer: { select: { name: true, companyName: true } }, salesperson: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { unpaidAmount: "desc" }],
        take: 12,
      }),
      prisma.order.findMany({
        where: { ...activeOrderWhere, shippingStatus: { in: ["unshipped", "partial_shipped"] } },
        include: { customer: { select: { name: true, companyName: true } }, salesperson: { select: { name: true } } },
        orderBy: [{ expectedShipDate: "asc" }, { orderDate: "asc" }],
        take: 10,
      }),
      prisma.orderPayment.findMany({
        where: { status: { not: "void" } },
        include: {
          order: { select: { id: true, orderNo: true, customerName: true, customer: { select: { name: true, companyName: true } } } },
          creator: { select: { name: true } },
        },
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
        take: 8,
      }),
    ]);

    const financeOrders = activeOrders as FinanceOrder[];
    const receivableSummaryRows = financeOrders.filter((order) => toNumber(order.unpaidAmount) > 0);
    const overdueRows = receivableSummaryRows.filter((order) => Boolean(order.dueDate && order.dueDate.getTime() < now.getTime()));
    const todayRows = receivableSummaryRows.filter((order) => Boolean(order.dueDate && order.dueDate >= startOfToday && order.dueDate < endOfToday));
    const next7Rows = receivableSummaryRows.filter((order) => Boolean(order.dueDate && order.dueDate >= now && order.dueDate <= sevenDaysLater));

    return NextResponse.json({
      summary: {
        baseCurrency: BASE_CURRENCY,
        orderCount: financeOrders.length,
        salesAmount: sumBase(financeOrders, "salesAmount"),
        paidAmount: sumBase(financeOrders, "paidAmount"),
        unpaidAmount: sumBase(financeOrders, "unpaidAmount"),
        totalCost: sumBase(financeOrders, "totalCost"),
        grossProfit: sumBase(financeOrders, "grossProfit"),
        receivableCount: receivableSummaryRows.length,
        receivableAmount: sumBase(receivableSummaryRows, "unpaidAmount"),
        overdueCount: overdueRows.length,
        overdueAmount: sumBase(overdueRows, "unpaidAmount"),
        dueTodayCount: todayRows.length,
        dueTodayAmount: sumBase(todayRows, "unpaidAmount"),
        dueNext7Count: next7Rows.length,
        dueNext7Amount: sumBase(next7Rows, "unpaidAmount"),
      },
      paymentStatusRows: paymentRows(financeOrders),
      shippingStatusRows: shippingRows(financeOrders),
      receivableOrders: receivableOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        customerName: customerName(order),
        salespersonName: order.salesperson?.name ?? "-",
        currency: order.currency,
        salesAmount: toNumber(order.salesAmount),
        paidAmount: toNumber(order.paidAmount),
        unpaidAmount: toNumber(order.unpaidAmount),
        paymentStatus: order.paymentStatus,
        dueDate: dateValue(order.dueDate),
        orderDate: dateValue(order.orderDate),
      })),
      shippingRiskOrders: shippingRiskOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        customerName: customerName(order),
        salespersonName: order.salesperson?.name ?? "-",
        currency: order.currency,
        salesAmount: toNumber(order.salesAmount),
        shippingStatus: order.shippingStatus,
        expectedShipDate: dateValue(order.expectedShipDate),
        orderDate: dateValue(order.orderDate),
      })),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        orderNo: payment.order.orderNo,
        customerName: customerName(payment.order),
        paymentDate: dateValue(payment.paymentDate),
        amount: toNumber(payment.amount),
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        referenceNo: payment.referenceNo,
        creatorName: payment.creator?.name ?? "-",
      })),
    });
  } catch (error) {
    return apiError(error, "财务中心数据加载失败");
  }
}
