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
  purchaseExchangeRate?: unknown;
  packagingUnitCost?: unknown;
  packagingExchangeRate?: unknown;
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

export function calculateItemProfit(item: ProfitItemInput, orderExchangeRate: unknown = 1) {
  const quantity = Math.max(Math.floor(toNumber(item.quantity)), 0);
  const salesExchangeRate = toNumber(orderExchangeRate, 1) || 1;
  const saleUnitPrice = Math.max(toNumber(item.saleUnitPrice ?? item.unitPrice), 0);
  const purchaseUnitCost = Math.max(toNumber(item.purchaseUnitCost ?? item.costPrice), 0);
  const purchaseExchangeRate = toNumber(item.purchaseExchangeRate, 1) || 1;
  const packagingUnitCost = Math.max(toNumber(item.packagingUnitCost), 0);
  const packagingExchangeRate = toNumber(item.packagingExchangeRate, 1) || 1;
  const salesSubtotal = roundMoney(quantity * saleUnitPrice);
  const purchaseCostSubtotal = roundMoney(quantity * purchaseUnitCost);
  const packagingCostSubtotal = roundMoney(quantity * packagingUnitCost);
  return {
    quantity,
    saleUnitPrice: roundMoney(saleUnitPrice),
    salesSubtotal,
    salesBase: roundMoney(salesSubtotal * salesExchangeRate),
    purchaseUnitCost: roundMoney(purchaseUnitCost),
    purchaseExchangeRate,
    purchaseCostSubtotal,
    purchaseCostBase: roundMoney(purchaseCostSubtotal * purchaseExchangeRate),
    packagingUnitCost: roundMoney(packagingUnitCost),
    packagingExchangeRate,
    packagingCostSubtotal,
    packagingCostBase: roundMoney(packagingCostSubtotal * packagingExchangeRate),
  };
}

export function automaticCostTotals(items: ProfitItemInput[], orderExchangeRate: unknown = 1) {
  return items.reduce(
    (summary, item) => {
      const calculated = calculateItemProfit(item, orderExchangeRate);
      return {
        salesAmount: roundMoney(summary.salesAmount + calculated.salesSubtotal),
        salesBase: roundMoney(summary.salesBase + calculated.salesBase),
        productPurchaseCost: roundMoney(summary.productPurchaseCost + calculated.purchaseCostSubtotal),
        productPurchaseCostBase: roundMoney(summary.productPurchaseCostBase + calculated.purchaseCostBase),
        packagingCost: roundMoney(summary.packagingCost + calculated.packagingCostSubtotal),
        packagingCostBase: roundMoney(summary.packagingCostBase + calculated.packagingCostBase),
      };
    },
    { salesAmount: 0, salesBase: 0, productPurchaseCost: 0, productPurchaseCostBase: 0, packagingCost: 0, packagingCostBase: 0 },
  );
}

export function calculateOrderProfit(items: ProfitItemInput[], costs: ProfitCostInput[] = [], orderExchangeRate: unknown = 1) {
  const automatic = automaticCostTotals(items, orderExchangeRate);
  const manualOtherCost = costs
    .filter((cost) => !["product_purchase", "packaging_material"].includes(cost.costType))
    .reduce((sum, cost) => {
      const exchangeRate = toNumber(cost.exchangeRate, 1) || 1;
      const amount = cost.baseAmount === undefined || cost.baseAmount === null || cost.baseAmount === "" ? toNumber(cost.amount) * exchangeRate : toNumber(cost.baseAmount);
      return roundMoney(sum + Math.max(amount, 0));
    }, 0);
  const totalCost = roundMoney(automatic.productPurchaseCostBase + automatic.packagingCostBase + manualOtherCost);
  const grossProfit = roundMoney(automatic.salesBase - totalCost);
  const grossMargin = automatic.salesBase > 0 ? roundRate(grossProfit / automatic.salesBase) : null;
  return {
    salesAmount: automatic.salesAmount,
    salesBase: automatic.salesBase,
    productPurchaseCost: automatic.productPurchaseCost,
    productPurchaseCostBase: automatic.productPurchaseCostBase,
    packagingCost: automatic.packagingCost,
    packagingCostBase: automatic.packagingCostBase,
    otherCost: manualOtherCost,
    totalCost,
    grossProfit,
    grossMargin,
  };
}

export function normalizeCostRows(costs: ProfitCostInput[], items: ProfitItemInput[], currency = "USD", exchangeRate = 1) {
  const automatic = automaticCostTotals(items, exchangeRate);
  const byType = new Map(costs.map((cost) => [cost.costType, cost]));
  return COST_TYPES.map((costType) => {
    const existing = byType.get(costType);
    const isAutomatic = costType === "product_purchase" || costType === "packaging_material";
    const automaticBaseAmount = costType === "product_purchase" ? automatic.productPurchaseCostBase : costType === "packaging_material" ? automatic.packagingCostBase : 0;
    const amount = isAutomatic ? automaticBaseAmount : Math.max(toNumber(existing?.amount), 0);
    const rowExchangeRate = isAutomatic ? 1 : toNumber(existing?.exchangeRate, exchangeRate) || exchangeRate || 1;
    return {
      costType,
      amount: roundMoney(amount),
      currency: isAutomatic ? BASE_CURRENCY : String((existing as { currency?: unknown } | undefined)?.currency || currency),
      exchangeRate: rowExchangeRate,
      baseAmount: roundMoney(amount * rowExchangeRate),
      remark: typeof (existing as { remark?: unknown } | undefined)?.remark === "string" ? (existing as { remark?: string }).remark : null,
    };
  });
}
