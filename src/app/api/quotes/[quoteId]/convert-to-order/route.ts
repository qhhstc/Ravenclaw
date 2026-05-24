import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, nextOrderNo, normalizeOrderInput, optionalDate } from "@/lib/orders";
import { canCreateOrder, forbidden, requireApiSession } from "@/lib/permissions";

const ALLOWED_QUOTE_STATUSES = new Set(["accepted", "sent", "draft"]);

type Context = { params: Promise<{ quoteId: string }> };

type QuoteOrderSourceContext = {
  brand?: { name?: string | null; code?: string | null } | null;
  store?: { name?: string | null } | null;
  channel?: { businessLine?: string | null; channelGroup?: string | null; channelName?: string | null } | null;
};

function resolveOrderSourceFromQuote(quote: QuoteOrderSourceContext) {
  const text = [
    quote.brand?.name,
    quote.brand?.code,
    quote.store?.name,
    quote.channel?.businessLine,
    quote.channel?.channelGroup,
    quote.channel?.channelName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes("kidults") ? "kidultsbox" : "calembou";
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { quoteId } = await context.params;
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const session = await requireApiSession();
    if (!canCreateOrder(session.role)) return forbidden("当前角色不能转订单");
    const order = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: Number(quoteId) },
        include: { inquiry: true, customer: true, brand: { select: { name: true, code: true } }, store: true, channel: true, items: true, order: true },
      });
      if (!quote) throw new Error("报价单不存在或已删除");
      if (quote.order) throw new Error("该报价单已转订单，不能重复创建");
      if (quote.status === "converted") throw new Error("该报价单已转订单，不能重复创建");
      if (!ALLOWED_QUOTE_STATUSES.has(quote.status)) throw new Error("当前报价状态不允许转订单");
      if (!quote.items.length) throw new Error("报价单没有商品明细，无法转订单");

      const orderNo = await nextOrderNo(tx);
      const orderDate = new Date();
      const dueDate = optionalDate(input.dueDate) ?? new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const orderInput = {
        orderNo,
        orderSource: resolveOrderSourceFromQuote(quote),
        customerId: quote.customerId,
        customerName: quote.customer?.name,
        inquiryId: quote.inquiryId,
        quoteId: quote.id,
        brandId: quote.brandId ?? quote.inquiry?.brandId ?? quote.customer?.brandId ?? quote.channel?.brandId ?? quote.store?.brandId ?? null,
        platformId: quote.platformId ?? quote.inquiry?.platformId ?? quote.channel?.platformId ?? quote.store?.platformId ?? null,
        storeId: quote.storeId ?? quote.inquiry?.storeId ?? quote.channel?.storeId ?? null,
        channelId: quote.channelId ?? quote.inquiry?.channelId ?? null,
        countryCode: quote.countryCode ?? quote.inquiry?.countryCode ?? quote.customer?.countryCode ?? quote.store?.primaryMarketCode ?? null,
        currency: quote.currency,
        orderStatus: "pending_payment",
        paymentStatus: "unpaid",
        shippingStatus: "unshipped",
        orderDate,
        dueDate,
        paidAmount: 0,
        remark: `由报价单 ${quote.quoteNo} 转订单`,
        items: quote.items.map((item) => ({
          sku: item.sku,
          productName: item.productName,
          productNameEn: item.productName,
          quantity: item.quantity,
          saleUnitPrice: item.unitPrice,
          purchaseUnitCost: 0,
          packagingUnitCost: 0,
          remark: item.remark,
        })),
        costs: [
          { costType: "domestic_shipping", amount: 0, currency: quote.currency, exchangeRate: 1 },
          { costType: "international_shipping", amount: quote.shippingFee, currency: quote.currency, exchangeRate: 1 },
          { costType: "platform_fee", amount: quote.otherFee, currency: quote.currency, exchangeRate: 1 },
        ],
      };
      const normalized = normalizeOrderInput(orderInput, orderNo, session);

      const createdOrder = await tx.order.create({
        data: {
          ...normalized.data,
          orderNo,
          items: { create: normalized.items },
          costs: { create: normalized.costs },
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
