import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/orders";

type Context = { params: Promise<{ quoteId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { quoteId } = await context.params;
    const item = await prisma.quote.findUnique({
      where: { id: Number(quoteId) },
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
        brand: { select: { id: true, name: true } },
        platform: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        channel: { select: { id: true, businessLine: true, channelName: true } },
        items: true,
        order: { select: { id: true, orderNo: true } },
      },
    });
    if (!item) return NextResponse.json({ message: "报价单不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "报价详情加载失败");
  }
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function moneyValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { quoteId } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const existing = await prisma.quote.findUnique({ where: { id: Number(quoteId) }, include: { order: true } });
    if (!existing) return NextResponse.json({ message: "报价单不存在或已删除" }, { status: 404 });
    if (existing.order || existing.status === "converted") return NextResponse.json({ message: "已转订单的报价不能编辑" }, { status: 409 });
    const productAmount = moneyValue(input.productAmount ?? existing.productAmount);
    const shippingFee = moneyValue(input.shippingFee ?? existing.shippingFee);
    const discountAmount = moneyValue(input.discountAmount ?? existing.discountAmount);
    const taxAmount = moneyValue(input.taxAmount ?? existing.taxAmount);
    const otherFee = moneyValue(input.otherFee ?? existing.otherFee);
    const totalAmount = Math.max(productAmount + shippingFee + taxAmount + otherFee - discountAmount, 0);
    const item = await prisma.quote.update({
      where: { id: Number(quoteId) },
      data: {
        currency: textValue(input.currency)?.toUpperCase() ?? existing.currency,
        productAmount,
        shippingFee,
        discountAmount,
        taxAmount,
        otherFee,
        totalAmount,
        status: textValue(input.status) ?? existing.status,
        remark: textValue(input.remark),
      },
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
        brand: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        order: { select: { id: true, orderNo: true } },
      },
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "报价保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}
