import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, normalizeOrderInput, orderDetailInclude, orderInclude } from "@/lib/orders";
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
        select: { orderNo: true, createdBy: true, salespersonId: true, orderStatus: true },
      });
      if (!existing) throw new Error("订单不存在或已被删除");
      if (!canEditOrder(session.role, existing, session.userId)) throw new ApiAuthError("只能编辑自己负责且未关闭的订单", 403);
      const normalized = normalizeOrderInput(input, existing.orderNo, session);
      await tx.orderItem.deleteMany({ where: { orderId: Number(id) } });
      await tx.orderCost.deleteMany({ where: { orderId: Number(id) } });
      const updated = await tx.order.update({
        where: { id: Number(id) },
        data: {
          ...normalized.data,
          orderNo: existing.orderNo,
          createdBy: existing.createdBy,
          salespersonId: session.role === "sales" ? session.userId : normalized.data.salespersonId,
          items: { create: normalized.items },
          costs: { create: normalized.costs },
        },
        include: orderInclude,
      });
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
      return updated;
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
