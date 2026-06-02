import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/orders";
import { canEditOrder, canEditOrderPayments, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const attachment = await prisma.attachment.findUnique({ where: { id: Number(id) } });
    if (!attachment) return NextResponse.json({ message: "附件不存在或已删除" }, { status: 404 });
    if (attachment.bizType === "order") {
      const order = await prisma.order.findUnique({ where: { id: attachment.bizId }, select: { createdBy: true, salespersonId: true, orderStatus: true } });
      if (!order) throw new Error("订单不存在或已被删除");
      if (!canEditOrder(session.role, order, session.userId) && !canEditOrderPayments(session.role)) return forbidden("当前角色不能删除该附件");
    }
    if (attachment.bizType === "order_status_log") {
      const log = await prisma.orderStatusLog.findUnique({
        where: { id: attachment.bizId },
        include: { order: { select: { createdBy: true, salespersonId: true, orderStatus: true } } },
      });
      if (!log) throw new Error("状态记录不存在或已被删除");
      if (!canEditOrder(session.role, log.order, session.userId) && !canEditOrderPayments(session.role)) return forbidden("当前角色不能删除该附件");
    }
    await prisma.attachment.delete({ where: { id: Number(id) } });
    if (attachment.fileUrl.startsWith("/uploads/")) {
      const localPath = path.join(process.cwd(), "public", attachment.fileUrl);
      await unlink(localPath).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "附件删除失败");
  }
}
