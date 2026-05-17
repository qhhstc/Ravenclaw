import { NextResponse, type NextRequest } from "next/server";
import { apiError, normalizeQuoteInput, quoteInclude } from "@/lib/quotes";
import { prisma } from "@/lib/prisma";
import { canManageSalesFlow, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ quoteId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireApiSession();
    const { quoteId } = await context.params;
    const item = await prisma.quote.findUnique({
      where: { id: Number(quoteId) },
      include: quoteInclude,
    });
    if (!item) return NextResponse.json({ message: "报价单不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "报价详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageSalesFlow(session.role)) return forbidden("当前角色不能编辑报价");
    const { quoteId } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const existing = await prisma.quote.findUnique({ where: { id: Number(quoteId) }, include: { order: true } });
    if (!existing) return NextResponse.json({ message: "报价单不存在或已删除" }, { status: 404 });
    if (existing.order || existing.status === "converted") return NextResponse.json({ message: "已转订单的报价不能编辑" }, { status: 409 });

    const normalized = normalizeQuoteInput(input, existing);
    const item = await prisma.$transaction(async (tx) => {
      if (normalized.items) {
        await tx.quoteItem.deleteMany({ where: { quoteId: Number(quoteId) } });
      }
      return tx.quote.update({
        where: { id: Number(quoteId) },
        data: {
          ...normalized.data,
          ...(normalized.items ? { items: { create: normalized.items } } : {}),
        },
        include: quoteInclude,
      });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "报价保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}
