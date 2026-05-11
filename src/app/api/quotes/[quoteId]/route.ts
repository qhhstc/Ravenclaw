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
