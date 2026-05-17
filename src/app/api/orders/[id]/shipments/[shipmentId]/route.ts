import { NextRequest } from "next/server";
import { syncOrderShipmentSummary } from "@/lib/order-records";
import { apiError, orderDetailInclude } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canEditOrder, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string; shipmentId: string }> };

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id, shipmentId } = await context.params;
    const orderId = Number(id);
    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { createdBy: true, salespersonId: true, orderStatus: true },
      });
      if (!order) throw new Error("订单不存在或已被删除");
      if (!canEditOrder(session.role, order, session.userId)) throw new Error("当前角色不能取消发货记录");
      const result = await tx.orderShipment.updateMany({
        where: { id: Number(shipmentId), orderId, status: { not: "cancelled" } },
        data: { status: "cancelled" },
      });
      if (result.count === 0) throw new Error("发货记录不存在或已取消");
      await syncOrderShipmentSummary(tx, orderId);
      return tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
    });
    return Response.json({ item });
  } catch (error) {
    return apiError(error, "发货记录取消失败");
  }
}
