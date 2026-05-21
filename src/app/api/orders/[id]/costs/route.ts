import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, calculateOrderAmounts, normalizeOrderCosts, toNumber } from "@/lib/orders";
import { decimal, decimalRate } from "@/lib/order-profit-calculations";
import { canEditOrderCosts, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canEditOrderCosts(session.role)) return forbidden("当前角色不能修改订单成本");
    const { id } = await context.params;
    const orderId = Number(id);
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new Error("订单不存在或已被删除");
      const items = order.items.map((row) => ({
        productId: row.productId,
        sku: row.sku,
        productName: row.productName,
        specification: row.specification,
        quantity: Number(row.quantity),
        saleUnitPrice: toNumber(row.saleUnitPrice),
        purchaseUnitCost: toNumber(row.purchaseUnitCost),
        purchaseCurrency: row.purchaseCurrency,
        purchaseExchangeRate: toNumber(row.purchaseExchangeRate, 1),
        packagingUnitCost: toNumber(row.packagingUnitCost),
        packagingCurrency: row.packagingCurrency,
        packagingExchangeRate: toNumber(row.packagingExchangeRate, 1),
        remark: row.remark,
      }));
      const costs = normalizeOrderCosts(input.costs, items, order.currency, toNumber(order.exchangeRate, 1));
      const amounts = calculateOrderAmounts({ paidAmount: order.paidAmount, exchangeRate: order.exchangeRate }, items, costs);
      await tx.orderCost.deleteMany({ where: { orderId } });
      return tx.order.update({
        where: { id: orderId },
        data: {
          totalCost: decimal(amounts.totalCost),
          grossProfit: decimal(amounts.grossProfit),
          grossMargin: decimalRate(amounts.grossMargin),
          otherFee: decimal(amounts.otherCost),
          costs: {
            create: costs.map((cost) => ({
              costType: cost.costType,
              amount: decimal(cost.amount),
              currency: cost.currency,
              exchangeRate: cost.exchangeRate,
              baseAmount: decimal(cost.baseAmount),
              remark: cost.remark,
            })),
          },
        },
        include: { costs: true },
      });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "订单成本保存失败");
  }
}
