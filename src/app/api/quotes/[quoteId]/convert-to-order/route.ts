import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, money, nextOrderNo, optionalDate, paymentStatusFor, toNumber } from "@/lib/orders";
import { getSession } from "@/lib/auth";

const ALLOWED_QUOTE_STATUSES = new Set(["accepted", "sent", "draft"]);

type Context = { params: Promise<{ quoteId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { quoteId } = await context.params;
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const session = await getSession();
    const order = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: Number(quoteId) },
        include: { inquiry: true, customer: true, store: true, channel: true, items: true, order: true },
      });
      if (!quote) throw new Error("报价单不存在或已删除");
      if (quote.order) throw new Error("该报价单已转订单，不能重复创建");
      if (quote.status === "converted") throw new Error("该报价单已转订单，不能重复创建");
      if (!ALLOWED_QUOTE_STATUSES.has(quote.status)) throw new Error("当前报价状态不允许转订单");
      if (!quote.items.length) throw new Error("报价单没有商品明细，无法转订单");

      const orderNo = await nextOrderNo(tx);
      const productAmount = toNumber(quote.productAmount);
      const shippingFee = toNumber(quote.shippingFee);
      const discountAmount = toNumber(quote.discountAmount);
      const taxAmount = toNumber(quote.taxAmount);
      const otherFee = toNumber(quote.otherFee);
      const totalAmount = toNumber(quote.totalAmount);
      const paidAmount = 0;
      const unpaidAmount = totalAmount;
      const orderDate = new Date();
      const dueDate = optionalDate(input.dueDate) ?? new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const createdOrder = await tx.order.create({
        data: {
          orderNo,
          orderSource: "quote",
          customerId: quote.customerId,
          inquiryId: quote.inquiryId,
          quoteId: quote.id,
          brandId: quote.brandId ?? quote.inquiry?.brandId ?? quote.customer?.brandId ?? quote.channel?.brandId ?? quote.store?.brandId ?? null,
          platformId: quote.platformId ?? quote.inquiry?.platformId ?? quote.channel?.platformId ?? quote.store?.platformId ?? null,
          storeId: quote.storeId ?? quote.inquiry?.storeId ?? quote.channel?.storeId ?? null,
          channelId: quote.channelId ?? quote.inquiry?.channelId ?? null,
          countryCode: quote.countryCode ?? quote.inquiry?.countryCode ?? quote.customer?.countryCode ?? quote.store?.primaryMarketCode ?? null,
          currency: quote.currency,
          productAmount,
          shippingFee,
          discountAmount,
          taxAmount,
          otherFee,
          totalAmount,
          paidAmount,
          unpaidAmount,
          orderStatus: "confirmed",
          paymentStatus: paymentStatusFor(totalAmount, paidAmount, "confirmed"),
          shippingStatus: "unshipped",
          orderDate,
          dueDate,
          createdBy: session?.userId ?? null,
          remark: `由报价单 ${quote.quoteNo} 转订单`,
          items: {
            create: quote.items.map((item) => ({
              sku: item.sku,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: null,
              totalPrice: item.totalPrice,
              totalCost: money(0),
              remark: item.remark,
            })),
          },
        },
        include: { items: true },
      });

      await tx.quote.update({ where: { id: quote.id }, data: { status: "converted", convertedAt: new Date() } });
      if (quote.inquiryId) await tx.inquiry.update({ where: { id: quote.inquiryId }, data: { status: "won" } });
      return createdOrder;
    });
    return NextResponse.json({ item: order });
  } catch (error) {
    return apiError(error, "报价转订单失败");
  }
}
