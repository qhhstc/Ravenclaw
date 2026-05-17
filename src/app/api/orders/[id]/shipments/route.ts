import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { decimal } from "@/lib/order-profit-calculations";
import { numberValue, optionalDate, syncOrderShipmentSummary, textValue } from "@/lib/order-records";
import { apiError, orderDetailInclude, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canEditOrder, canViewAllOrders, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

const SHIPMENT_STATUSES = ["shipped", "in_transit", "delivered"] as const;

function shipmentStatus(value: unknown) {
  return typeof value === "string" && SHIPMENT_STATUSES.includes(value as (typeof SHIPMENT_STATUSES)[number]) ? value : "shipped";
}

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

    const items = await prisma.orderShipment.findMany({
      where: { orderId, status: { not: "cancelled" } },
      orderBy: [{ shipmentDate: "desc" }, { id: "desc" }],
      include: { creator: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "发货记录加载失败");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const orderId = Number(id);
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, createdBy: true, salespersonId: true, orderStatus: true, currency: true, exchangeRate: true },
      });
      if (!order) throw new Error("订单不存在或已被删除");
      if (!canEditOrder(session.role, order, session.userId)) throw new Error("当前角色不能登记发货");

      const status = shipmentStatus(input.status);
      const shipmentDate = optionalDate(input.shipmentDate, new Date()) ?? new Date();
      const exchangeRate = numberValue(input.exchangeRate, toNumber(order.exchangeRate, 1));
      const freightAmount = Math.max(0, numberValue(input.freightAmount));
      await tx.orderShipment.create({
        data: {
          orderId,
          shipmentDate,
          deliveredAt: status === "delivered" ? optionalDate(input.deliveredAt, shipmentDate) : optionalDate(input.deliveredAt),
          status,
          isFinalShipment: input.isFinalShipment === undefined ? true : Boolean(input.isFinalShipment),
          logisticsProvider: textValue(input.logisticsProvider),
          trackingNo: textValue(input.trackingNo),
          packageCount: Math.max(1, Math.floor(numberValue(input.packageCount, 1))),
          freightAmount: decimal(freightAmount),
          currency: textValue(input.currency) ?? order.currency,
          exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
          remark: textValue(input.remark),
          createdBy: session.userId,
        },
      });
      await syncOrderShipmentSummary(tx, orderId);
      return tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "发货登记失败");
  }
}
