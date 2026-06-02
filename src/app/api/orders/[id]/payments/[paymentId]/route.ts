import { NextResponse, type NextRequest } from "next/server";
import { syncOrderPaymentSummary } from "@/lib/order-records";
import { apiError, orderDetailInclude } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { canEditOrderPayments, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string; paymentId: string }> };

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canEditOrderPayments(session.role)) return forbidden("当前角色不能作废收款记录");
    const { id, paymentId } = await context.params;
    const orderId = Number(id);
    const item = await prisma.$transaction(async (tx) => {
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
