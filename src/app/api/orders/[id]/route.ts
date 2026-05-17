import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOrderPaymentSummary, syncOrderShipmentSummary } from "@/lib/order-records";
import { decimal } from "@/lib/order-profit-calculations";
import { apiError, normalizeOrderInput, orderDetailInclude, orderInclude, toNumber } from "@/lib/orders";
import { ApiAuthError, canDeleteOrder, canEditOrder, canViewAllOrders, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const item = await prisma.order.findUnique({ where: { id: Number(id) }, include: orderDetailInclude });
    if (!item) return NextResponse.json({ message: "订单不存在或已删除" }, { status: 404 });
    if (!canViewAllOrders(session.role) && item.createdBy !== session.userId && item.salespersonId !== session.userId) {
      return forbidden("只能查看自己负责的订单");
    }
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "订单详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: Number(id) },
        select: { orderNo: true, createdBy: true, salespersonId: true, orderStatus: true, _count: { select: { payments: true, shipments: true } } },
      });
      if (!existing) throw new Error("订单不存在或已被删除");
      if (!canEditOrder(session.role, existing, session.userId)) throw new ApiAuthError("只能编辑自己负责且未关闭的订单", 403);
      const normalized = normalizeOrderInput(input, existing.orderNo, session);
      await tx.orderItem.deleteMany({ where: { orderId: Number(id) } });
      await tx.orderCost.deleteMany({ where: { orderId: Number(id) } });
      await tx.order.update({
        where: { id: Number(id) },
        data: {
          ...normalized.data,
          orderNo: existing.orderNo,
          createdBy: existing.createdBy,
          salespersonId: session.role === "sales" ? session.userId : normalized.data.salespersonId,
          items: { create: normalized.items },
          costs: { create: normalized.costs },
        },
      });
      if (existing._count.payments > 0) {
        await syncOrderPaymentSummary(tx, Number(id));
      } else if (toNumber(normalized.data.paidAmount) > 0) {
        await tx.orderPayment.create({
          data: {
            orderId: Number(id),
            paymentDate: normalized.data.orderDate,
            amount: normalized.data.paidAmount,
            currency: normalized.data.currency,
            exchangeRate: normalized.data.exchangeRate,
            baseAmount: decimal(toNumber(normalized.data.paidAmount) * toNumber(normalized.data.exchangeRate, 1)),
            paymentMethod: normalized.data.paymentMethod,
            referenceNo: "initial-paid-amount",
            createdBy: session.userId,
          },
        });
        await syncOrderPaymentSummary(tx, Number(id));
      }
      if (existing._count.shipments > 0) await syncOrderShipmentSummary(tx, Number(id));
      if (existing.orderStatus !== normalized.data.orderStatus) {
        await tx.orderStatusLog.create({
          data: {
            orderId: Number(id),
            fromStatus: existing.orderStatus,
            toStatus: String(normalized.data.orderStatus ?? existing.orderStatus),
            remark: typeof input.statusRemark === "string" && input.statusRemark.trim() ? input.statusRemark.trim() : null,
            createdBy: session.userId,
          },
        });
      }
      return tx.order.findUnique({ where: { id: Number(id) }, include: orderInclude });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "订单保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canDeleteOrder(session.role)) return forbidden("当前角色不能删除订单");
    const { id } = await context.params;
    await prisma.order.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "订单删除失败");
  }
}
