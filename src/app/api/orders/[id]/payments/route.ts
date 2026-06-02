import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { decimal } from "@/lib/order-profit-calculations";
import { numberValue, optionalDate, positiveMoney, syncOrderPaymentSummary, textValue } from "@/lib/order-records";
import { apiError, orderDetailInclude, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canEditOrderPayments, canViewAllOrders, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const orderId = Number(id);
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { createdBy: true, salespersonId: true } });
    if (!order) return NextResponse.json({ message: "订单不存在或已被删除" }, { status: 404 });
    if (!canViewAllOrders(session.role) && order.createdBy !== session.userId && order.salespersonId !== session.userId) {
      return forbidden("只能查看自己负责的订单");
    }

    const items = await prisma.orderPayment.findMany({
      where: { orderId, status: { not: "void" } },
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      include: { creator: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "收款记录加载失败");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canEditOrderPayments(session.role)) return forbidden("当前角色不能登记收款");
    const { id } = await context.params;
    const orderId = Number(id);
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, salesAmount: true, totalAmount: true, paidAmount: true, currency: true, exchangeRate: true },
      });
      if (!order) throw new Error("订单不存在或已被删除");

      const amount = positiveMoney(input.amount, "收款金额");
      const existing = await tx.orderPayment.aggregate({ where: { orderId, status: { not: "void" } }, _sum: { amount: true } });
      const totalAmount = toNumber(order.salesAmount ?? order.totalAmount);
      const nextPaidAmount = toNumber(existing._sum.amount) + amount;
      if (nextPaidAmount > totalAmount + 0.01) throw new Error("收款金额不能超过订单未收金额");

      const currency = textValue(input.currency) ?? order.currency;
      const exchangeRate = numberValue(input.exchangeRate, toNumber(order.exchangeRate, 1));
      await tx.orderPayment.create({
        data: {
          orderId,
          paymentDate: optionalDate(input.paymentDate, new Date()) ?? new Date(),
          amount: decimal(amount),
          currency,
          exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
          baseAmount: decimal(amount * exchangeRate),
          paymentMethod: textValue(input.paymentMethod),
          referenceNo: textValue(input.referenceNo),
          payerName: textValue(input.payerName),
          remark: textValue(input.remark),
          createdBy: session.userId,
        },
      });
      await syncOrderPaymentSummary(tx, orderId);
      return tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "收款登记失败");
  }
}
