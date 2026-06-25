import { NextResponse, type NextRequest } from "next/server";
import { syncOrderPaymentSummary } from "@/lib/order-records";
import { apiError, orderDetailInclude } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canEditOrderPayments, requireApiSession, ApiAuthError } from "@/lib/permissions";

type Context = { params: Promise<{ id: string; paymentId: string }> };

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id, paymentId } = await context.params;
    const orderId = Number(id);
    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, createdBy: true, salespersonId: true, orderStatus: true },
      });
      if (!order) throw new Error("订单不存在或已被删除");
      if (!canEditOrderPayments(session.role, order, session.userId)) throw new ApiAuthError("当前角色不能作废收款记录", 403);
      const result = await tx.orderPayment.updateMany({
        where: { id: Number(paymentId), orderId, status: { not: "void" } },
        data: { status: "void" },
      });
      if (result.count === 0) throw new Error("收款记录不存在或已作废");
      await syncOrderPaymentSummary(tx, orderId);
      return tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "收款记录作废失败");
  }
}
