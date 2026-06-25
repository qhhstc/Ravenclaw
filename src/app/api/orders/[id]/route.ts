import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOrderPaymentSummary, syncOrderShipmentSummary } from "@/lib/order-records";
import { decimal } from "@/lib/order-profit-calculations";
import { syncOrderCustomer } from "@/lib/order-customer-sync";
import { apiError, normalizeOrderInput, orderDetailInclude, orderInclude, toNumber } from "@/lib/orders";
import { ApiAuthError, canDeleteOrder, canEditOrder, canEditOrderPayments, canViewAllOrders, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

type ExistingOrderForEdit = {
  paidAmount: unknown;
  paymentStatus: string | null;
  paymentMethod: string | null;
  costs: {
    costType: string;
    amount: unknown;
    currency: string;
    exchangeRate: unknown;
    baseAmount: unknown;
    remark: string | null;
  }[];
};

function withPreservedPaymentInput(input: Record<string, unknown>, existing: ExistingOrderForEdit) {
  const safeCosts = existing.costs.map((cost) => ({
    costType: cost.costType,
    amount: toNumber(cost.amount),
    currency: cost.currency,
    exchangeRate: Math.max(toNumber(cost.exchangeRate, 1), 0.000001),
    baseAmount: toNumber(cost.baseAmount),
    remark: cost.remark,
  }));
  return {
    ...input,
    costs: Array.isArray(input.costs) ? input.costs : safeCosts,
    paidAmount: toNumber(existing.paidAmount),
    paymentStatus: existing.paymentStatus ?? undefined,
    paymentMethod: existing.paymentMethod ?? undefined,
  };
}

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
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("商品明细未正确加载，请刷新订单详情后重试");
    }
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: Number(id) },
        select: {
          orderNo: true,
          createdBy: true,
          salespersonId: true,
          orderStatus: true,
          paidAmount: true,
          paymentStatus: true,
          paymentMethod: true,
          costs: {
            orderBy: { id: "asc" },
            select: { costType: true, amount: true, currency: true, exchangeRate: true, baseAmount: true, remark: true },
          },
          _count: { select: { payments: true, shipments: true } },
        },
      });
      if (!existing) throw new Error("订单不存在或已被删除");
      if (!canEditOrder(session.role, existing, session.userId)) throw new ApiAuthError("只能编辑自己负责且未关闭的订单", 403);
      const normalized = normalizeOrderInput(canEditOrderPayments(session.role, existing, session.userId) ? input : withPreservedPaymentInput(input, existing), existing.orderNo, session);
      const customerSync = await syncOrderCustomer(
        tx,
        {
          customerId: toNumber(normalized.data.customerId),
          customerName: normalized.data.customerName,
          countryCode: normalized.data.countryCode,
          channelId: toNumber(normalized.data.channelId),
          brandId: toNumber(normalized.data.brandId),
          salespersonId: toNumber(session.role === "sales" ? session.userId : normalized.data.salespersonId),
          createdBy: existing.createdBy,
          orderSource: String(normalized.data.orderSource ?? ""),
          orderNo: existing.orderNo,
        },
        session,
      );
      await tx.orderItem.deleteMany({ where: { orderId: Number(id) } });
      await tx.orderCost.deleteMany({ where: { orderId: Number(id) } });
      await tx.order.update({
        where: { id: Number(id) },
        data: {
          ...normalized.data,
          orderNo: existing.orderNo,
          createdBy: existing.createdBy,
          salespersonId: session.role === "sales" ? session.userId : normalized.data.salespersonId,
          customerId: customerSync.customerId,
          customerName: customerSync.customerName ?? normalized.data.customerName,
          items: { create: normalized.items },
          costs: { create: normalized.costs },
        },
      });
      if (existing._count.payments > 0) {
        await syncOrderPaymentSummary(tx, Number(id));
      } else if (canEditOrderPayments(session.role, existing, session.userId) && toNumber(normalized.data.paidAmount) > 0) {
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
