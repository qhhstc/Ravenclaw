import { Prisma } from "@prisma/client";

export const BASE_CURRENCY = "CNY";

export const COST_TYPES = [
  "product_purchase",
  "domestic_shipping",
  "packaging_material",
  "international_shipping",
  "customs_fee",
  "port_charge",
  "trucking_fee",
  "platform_fee",
  "payment_fee",
  "other",
] as const;

export type CostType = (typeof COST_TYPES)[number];

export type ProfitItemInput = {
  quantity?: unknown;
  saleUnitPrice?: unknown;
  unitPrice?: unknown;
  purchaseUnitCost?: unknown;
  costPrice?: unknown;
  packagingUnitCost?: unknown;
};

export type ProfitCostInput = {
  costType: string;
  amount?: unknown;
  exchangeRate?: unknown;
  baseAmount?: unknown;
};

export function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const numeric = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundRate(value: number | null) {
  return value === null ? null : Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function decimal(value: number) {
  return new Prisma.Decimal(roundMoney(value).toFixed(2));
}

export function decimalRate(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value.toFixed(4));
}

export function calculateItemProfit(item: ProfitItemInput) {
  const quantity = Math.max(Math.floor(toNumber(item.quantity)), 0);
  const saleUnitPrice = Math.max(toNumber(item.saleUnitPrice ?? item.unitPrice), 0);
  const purchaseUnitCost = Math.max(toNumber(item.purchaseUnitCost ?? item.costPrice), 0);
  const packagingUnitCost = Math.max(toNumber(item.packagingUnitCost), 0);
  return {
    quantity,
    saleUnitPrice: roundMoney(saleUnitPrice),
    salesSubtotal: roundMoney(quantity * saleUnitPrice),
    purchaseUnitCost: roundMoney(purchaseUnitCost),
    purchaseCostSubtotal: roundMoney(quantity * purchaseUnitCost),
    packagingUnitCost: roundMoney(packagingUnitCost),
    packagingCostSubtotal: roundMoney(quantity * packagingUnitCost),
  };
}

export function automaticCostTotals(items: ProfitItemInput[]) {
  return items.reduce(
    (summary, item) => {
      const calculated = calculateItemProfit(item);
      return {
        salesAmount: roundMoney(summary.salesAmount + calculated.salesSubtotal),
        productPurchaseCost: roundMoney(summary.productPurchaseCost + calculated.purchaseCostSubtotal),
        packagingCost: roundMoney(summary.packagingCost + calculated.packagingCostSubtotal),
      };
    },
    { salesAmount: 0, productPurchaseCost: 0, packagingCost: 0 },
  );
}

export function calculateOrderProfit(items: ProfitItemInput[], costs: ProfitCostInput[] = []) {
  const automatic = automaticCostTotals(items);
  const manualOtherCost = costs
    .filter((cost) => !["product_purchase", "packaging_material"].includes(cost.costType))
    .reduce((sum, cost) => {
      const exchangeRate = toNumber(cost.exchangeRate, 1) || 1;
      const amount = cost.baseAmount === undefined || cost.baseAmount === null || cost.baseAmount === "" ? toNumber(cost.amount) * exchangeRate : toNumber(cost.baseAmount);
      return roundMoney(sum + Math.max(amount, 0));
    }, 0);
  const totalCost = roundMoney(automatic.productPurchaseCost + automatic.packagingCost + manualOtherCost);
  const grossProfit = roundMoney(automatic.salesAmount - totalCost);
  const grossMargin = automatic.salesAmount > 0 ? roundRate(grossProfit / automatic.salesAmount) : null;
  return {
    salesAmount: automatic.salesAmount,
    productPurchaseCost: automatic.productPurchaseCost,
    packagingCost: automatic.packagingCost,
    otherCost: manualOtherCost,
    totalCost,
    grossProfit,
    grossMargin,
  };
}

export function normalizeCostRows(costs: ProfitCostInput[], items: ProfitItemInput[], currency = "USD", exchangeRate = 1) {
  const automatic = automaticCostTotals(items);
  const byType = new Map(costs.map((cost) => [cost.costType, cost]));
  return COST_TYPES.map((costType) => {
    const existing = byType.get(costType);
    const amount = costType === "product_purchase" ? automatic.productPurchaseCost : costType === "packaging_material" ? automatic.packagingCost : Math.max(toNumber(existing?.amount), 0);
    const rowExchangeRate = toNumber(existing?.exchangeRate, exchangeRate) || exchangeRate || 1;
    return {
      costType,
      amount: roundMoney(amount),
      currency: String((existing as { currency?: unknown } | undefined)?.currency || currency),
      exchangeRate: rowExchangeRate,
      baseAmount: roundMoney(amount * rowExchangeRate),
      remark: typeof (existing as { remark?: unknown } | undefined)?.remark === "string" ? (existing as { remark?: string }).remark : null,
    };
  });
}
