import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, normalizeOrderInput, orderDetailInclude, orderInclude } from "@/lib/orders";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const item = await prisma.order.findUnique({ where: { id: Number(id) }, include: orderDetailInclude });
    if (!item) return NextResponse.json({ message: "订单不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "订单详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: Number(id) }, select: { orderNo: true } });
      if (!existing) throw new Error("订单不存在或已被删除");
      const normalized = normalizeOrderInput(input, existing.orderNo);
      await tx.orderItem.deleteMany({ where: { orderId: Number(id) } });
      return tx.order.update({
        where: { id: Number(id) },
        data: { ...normalized.data, orderNo: existing.orderNo, items: { create: normalized.items } },
        include: orderInclude,
      });
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
    const { id } = await context.params;
    await prisma.order.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "订单删除失败");
  }
}
