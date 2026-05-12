import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, ORDER_STATUSES, orderDetailInclude } from "@/lib/orders";
import { ApiAuthError, canEditOrder, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const orderId = Number(id);
    const input = (await request.json()) as { toStatus?: string; remark?: string };
    const toStatus = typeof input.toStatus === "string" ? input.toStatus : "";
    if (!ORDER_STATUSES.includes(toStatus as (typeof ORDER_STATUSES)[number])) throw new Error("请选择有效的订单状态");

    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { createdBy: true, salespersonId: true, orderStatus: true },
      });
      if (!order) throw new Error("订单不存在或已删除");
      if (!canEditOrder(session.role, order, session.userId)) throw new ApiAuthError("只能更新自己负责且未关闭的订单状态", 403);

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { orderStatus: toStatus },
        include: orderDetailInclude,
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.orderStatus,
          toStatus,
          remark: typeof input.remark === "string" && input.remark.trim() ? input.remark.trim() : null,
          createdBy: session.userId,
        },
      });

      return updated;
    });

    const refreshed = await prisma.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
    return NextResponse.json({ item: refreshed ?? item });
  } catch (error) {
    return apiError(error, "订单状态更新失败");
  }
}
