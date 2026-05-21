import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { BASE_CURRENCY, COST_TYPES, calculateItemProfit, calculateOrderProfit, decimal, decimalRate, normalizeCostRows, roundMoney, toNumber } from "@/lib/order-profit-calculations";
import { ApiAuthError, canViewAllOrders, type SessionUser } from "@/lib/permissions";

export const ORDER_SOURCES = ["quote", "wordpress_wholesale", "shopify", "amazon", "tiktok_shop", "manual", "influencer", "other"] as const;
export const ORDER_STATUSES = ["pending_payment", "paid", "preparing", "shipped", "in_transit", "customs_clearance", "delivered", "completed", "after_sales_reship", "cancelled", "refunded", "draft", "pending_confirm", "confirmed", "processing"] as const;
export const PAYMENT_STATUSES = ["unpaid", "partial_paid", "paid", "refunded"] as const;
export const SHIPPING_STATUSES = ["unshipped", "partial_shipped", "shipped", "delivered"] as const;
export const CLOSED_ORDER_STATUSES = ["cancelled", "refunded"];

export const orderInclude = {
  customer: { select: { id: true, name: true, companyName: true, countryCode: true, brandId: true, sourceChannelId: true } },
  salesperson: { select: { id: true, name: true, email: true } },
  brand: { select: { id: true, name: true, code: true } },
  platform: { select: { id: true, name: true, code: true } },
  store: { select: { id: true, name: true, defaultCurrency: true, primaryMarketCode: true, brandId: true, platformId: true } },
  channel: { select: { id: true, businessLine: true, channelName: true, store: { select: { id: true, name: true } }, platform: { select: { id: true, name: true } } } },
  influencerCollaboration: { select: { id: true, influencerName: true, platform: true, accountHandle: true, status: true } },
  quote: { select: { id: true, quoteNo: true, totalAmount: true, status: true } },
  inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
  creator: { select: { id: true, name: true, email: true } },
  items: { take: 3, orderBy: { id: "asc" }, include: { product: { select: { id: true, sku: true, name: true } } } },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  ...orderInclude,
  items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, sku: true, name: true, specification: true } } } },
  costs: { orderBy: { id: "asc" } },
  statusLogs: { orderBy: { createdAt: "desc" }, include: { creator: { select: { id: true, name: true, email: true } } } },
  payments: { where: { status: { not: "void" } }, orderBy: [{ paymentDate: "desc" }, { id: "desc" }], include: { creator: { select: { id: true, name: true, email: true } } } },
  shipments: { where: { status: { not: "cancelled" } }, orderBy: [{ shipmentDate: "desc" }, { id: "desc" }], include: { creator: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.OrderInclude;

export function apiError(error: unknown, fallback = "操作失败，请稍后重试") {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ message: "数据已存在，请检查唯一字段" }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ message: "该数据已被其他模块使用，无法删除" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ message: "数据不存在或已被删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
}

export function parseOptionalInt(value: string | null) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : undefined;
}

export function money(value: number) {
  return roundMoney(value);
}

export function optionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function optionalMoney(value: unknown, fallback?: unknown) {
  if (value === null || value === undefined || value === "") return toNumber(fallback);
  return toNumber(value);
}

function enumValue<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) {
  const normalized = textValue(value);
  return normalized && options.includes(normalized) ? normalized : fallback;
}

export function paymentStatusFor(totalAmount: number, paidAmount: number, orderStatus?: string, manualStatus?: unknown) {
  if (orderStatus === "refunded") return "refunded";
  const manual = textValue(manualStatus);
  if (manual && PAYMENT_STATUSES.includes(manual as (typeof PAYMENT_STATUSES)[number])) return manual;
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount < totalAmount) return "partial_paid";
  return "paid";
}

export type OrderItemInput = {
  productId?: number | null;
  sku?: string | null;
  productName: string;
  specification?: string | null;
  quantity: number;
  saleUnitPrice: number;
  purchaseUnitCost: number;
  purchaseCurrency: string;
  purchaseExchangeRate: number;
  packagingUnitCost: number;
  packagingCurrency: string;
  packagingExchangeRate: number;
  remark?: string | null;
};

export type OrderCostInput = {
  costType: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  remark?: string | null;
};

export function normalizeOrderItems(input: unknown): OrderItemInput[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("订单至少需要 1 行商品明细");
  return input.map((item, index) => {
    const row = item as Record<string, unknown>;
    const productName = textValue(row.productName);
    if (!productName) throw new Error(`第 ${index + 1} 行商品名称不能为空`);
    const calculated = calculateItemProfit(row);
    if (calculated.quantity <= 0) throw new Error(`第 ${index + 1} 行数量必须大于 0`);
    return {
      productId: optionalNumber(row.productId),
      sku: textValue(row.sku),
      productName,
      specification: textValue(row.specification),
      quantity: calculated.quantity,
      saleUnitPrice: calculated.saleUnitPrice || optionalMoney(row.unitPrice),
      purchaseUnitCost: calculated.purchaseUnitCost || optionalMoney(row.costPrice),
      purchaseCurrency: textValue(row.purchaseCurrency)?.toUpperCase() ?? "CNY",
      purchaseExchangeRate: Math.max(toNumber(row.purchaseExchangeRate, 1), 0.000001),
      packagingUnitCost: calculated.packagingUnitCost,
      packagingCurrency: textValue(row.packagingCurrency)?.toUpperCase() ?? "CNY",
      packagingExchangeRate: Math.max(toNumber(row.packagingExchangeRate, 1), 0.000001),
      remark: textValue(row.remark),
    };
  });
}

export function normalizeOrderCosts(input: unknown, items: OrderItemInput[], currency: string, exchangeRate: number): OrderCostInput[] {
  const costs = (Array.isArray(input) ? input.map((cost) => cost as Record<string, unknown>) : []).filter(
    (cost): cost is Record<string, unknown> & { costType: string } => typeof cost.costType === "string",
  );
  return normalizeCostRows(costs, items, currency, exchangeRate).map((cost) => ({
    costType: cost.costType,
    amount: cost.amount,
    currency: cost.currency,
    exchangeRate: cost.exchangeRate,
    baseAmount: cost.baseAmount,
    remark: cost.remark,
  }));
}

export function calculateOrderAmounts(input: Record<string, unknown>, items: OrderItemInput[], costs: OrderCostInput[]) {
  const profit = calculateOrderProfit(items, costs, input.exchangeRate);
  const paidAmount = money(Math.max(toNumber(input.paidAmount), 0));
  if (paidAmount > profit.salesAmount) throw new Error("已收金额不能大于订单销售总金额");
  const unpaidAmount = money(profit.salesAmount - paidAmount);
  return { ...profit, productAmount: profit.salesAmount, totalAmount: profit.salesAmount, paidAmount, unpaidAmount };
}

type OrderCountDelegate = {
  order: {
    count: (args: { where: { orderNo: { startsWith: string } } }) => Promise<number>;
  };
};

export async function nextOrderNo(tx: OrderCountDelegate) {
  const now = new Date();
  const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await tx.order.count({ where: { orderNo: { startsWith: `ORD-${month}-` } } });
  return `ORD-${month}-${String(count + 1).padStart(4, "0")}`;
}

export function normalizeOrderInput(input: Record<string, unknown>, forcedOrderNo?: string, session?: SessionUser | null) {
  const currency = textValue(input.currency) ?? "USD";
  const exchangeRate = Math.max(toNumber(input.exchangeRate, 1), 0.000001);
  const items = normalizeOrderItems(input.items);
  const costs = normalizeOrderCosts(input.costs, items, currency, exchangeRate);
  const orderStatus = enumValue(input.orderStatus, ORDER_STATUSES, "pending_payment");
  const amounts = calculateOrderAmounts({ ...input, exchangeRate }, items, costs);
  const orderDate = optionalDate(input.orderDate) ?? new Date();
  const customerName = textValue(input.customerName);
  const createdBy = optionalNumber(input.createdBy) ?? session?.userId ?? null;
  const salespersonId = session?.role === "sales" ? session.userId : optionalNumber(input.salespersonId) ?? createdBy;
  return {
    data: {
      orderNo: textValue(forcedOrderNo) ?? textValue(input.orderNo) ?? undefined,
      externalOrderNo: textValue(input.externalOrderNo),
      orderSource: enumValue(input.orderSource, ORDER_SOURCES, "manual"),
      customerId: optionalNumber(input.customerId),
      customerName,
      salespersonId,
      inquiryId: optionalNumber(input.inquiryId),
      quoteId: optionalNumber(input.quoteId),
      brandId: optionalNumber(input.brandId),
      platformId: optionalNumber(input.platformId),
      storeId: optionalNumber(input.storeId),
      channelId: optionalNumber(input.channelId),
      influencerCollaborationId: optionalNumber(input.influencerCollaborationId),
      countryCode: textValue(input.countryCode),
      currency,
      exchangeRate,
      baseCurrency: textValue(input.baseCurrency) ?? BASE_CURRENCY,
      productAmount: decimal(amounts.productAmount),
      shippingFee: decimal(0),
      discountAmount: decimal(0),
      taxAmount: decimal(0),
      otherFee: decimal(amounts.otherCost),
      totalAmount: decimal(amounts.totalAmount),
      salesAmount: decimal(amounts.salesAmount),
      totalCost: decimal(amounts.totalCost),
      grossProfit: decimal(amounts.grossProfit),
      grossMargin: decimalRate(amounts.grossMargin),
      paidAmount: decimal(amounts.paidAmount),
      unpaidAmount: decimal(amounts.unpaidAmount),
      orderStatus,
      paymentStatus: paymentStatusFor(amounts.salesAmount, amounts.paidAmount, orderStatus, input.paymentStatus),
      shippingStatus: enumValue(input.shippingStatus, SHIPPING_STATUSES, "unshipped"),
      orderDate,
      shipmentDate: optionalDate(input.shipmentDate) ?? optionalDate(input.actualShipDate),
      paymentMethod: textValue(input.paymentMethod),
      expectedShipDate: optionalDate(input.expectedShipDate),
      actualShipDate: optionalDate(input.actualShipDate) ?? optionalDate(input.shipmentDate),
      dueDate: optionalDate(input.dueDate),
      trackingNo: textValue(input.trackingNo),
      logisticsProvider: textValue(input.logisticsProvider),
      remark: textValue(input.remark),
      createdBy,
    },
    items: items.map((item) => {
      const calculated = calculateItemProfit(item, exchangeRate);
      return {
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        specification: item.specification,
        quantity: calculated.quantity,
        unitPrice: decimal(calculated.saleUnitPrice),
        costPrice: decimal(calculated.purchaseUnitCost),
        totalPrice: decimal(calculated.salesSubtotal),
        totalCost: decimal(calculated.purchaseCostBase + calculated.packagingCostBase),
        saleUnitPrice: decimal(calculated.saleUnitPrice),
        salesSubtotal: decimal(calculated.salesSubtotal),
        purchaseUnitCost: decimal(calculated.purchaseUnitCost),
        purchaseCurrency: item.purchaseCurrency,
        purchaseExchangeRate: new Prisma.Decimal(item.purchaseExchangeRate.toFixed(6)),
        purchaseCostSubtotal: decimal(calculated.purchaseCostSubtotal),
        purchaseCostBase: decimal(calculated.purchaseCostBase),
        packagingUnitCost: decimal(calculated.packagingUnitCost),
        packagingCurrency: item.packagingCurrency,
        packagingExchangeRate: new Prisma.Decimal(item.packagingExchangeRate.toFixed(6)),
        packagingCostSubtotal: decimal(calculated.packagingCostSubtotal),
        packagingCostBase: decimal(calculated.packagingCostBase),
        remark: item.remark,
      };
    }),
    costs: costs.map((cost) => ({
      costType: cost.costType,
      amount: decimal(cost.amount),
      currency: cost.currency,
      exchangeRate: new Prisma.Decimal(cost.exchangeRate.toFixed(6)),
      baseAmount: decimal(cost.baseAmount),
      remark: cost.remark,
    })),
  };
}

export function paymentDueWhere(status?: string | null): Prisma.OrderWhereInput {
  if (!status) return {};
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const base: Prisma.OrderWhereInput = { unpaidAmount: { gt: 0 }, orderStatus: { notIn: CLOSED_ORDER_STATUSES } };
  if (status === "pending") return base;
  if (status === "overdue") return { ...base, dueDate: { lt: now } };
  if (status === "today") return { ...base, dueDate: { gte: startOfToday, lt: endOfToday } };
  if (status === "next7days") return { ...base, dueDate: { gte: now, lte: sevenDaysLater } };
  return {};
}

export function buildOrderWhere(params: URLSearchParams, session?: SessionUser | null): Prisma.OrderWhereInput {
  const keyword = params.get("keyword")?.trim();
  const brandId = parseOptionalInt(params.get("brandId"));
  const platformId = parseOptionalInt(params.get("platformId"));
  const storeId = parseOptionalInt(params.get("storeId"));
  const channelId = parseOptionalInt(params.get("channelId"));
  const customerId = parseOptionalInt(params.get("customerId"));
  const salespersonId = parseOptionalInt(params.get("salespersonId"));
  const dateFrom = optionalDate(params.get("dateFrom"));
  const dateTo = optionalDate(params.get("dateTo"));
  const filters: Prisma.OrderWhereInput[] = [];
  if (session && !canViewAllOrders(session.role)) filters.push({ OR: [{ createdBy: session.userId }, { salespersonId: session.userId }] });
  if (keyword) filters.push({
    OR: [
      { orderNo: { contains: keyword } },
      { externalOrderNo: { contains: keyword } },
      { customerName: { contains: keyword } },
      { customer: { is: { name: { contains: keyword } } } },
      { customer: { is: { companyName: { contains: keyword } } } },
      { items: { some: { productName: { contains: keyword } } } },
      { items: { some: { sku: { contains: keyword } } } },
    ],
  });
  const simple: Prisma.OrderWhereInput = {
    ...(params.get("orderSource") ? { orderSource: params.get("orderSource")! } : {}),
    ...(params.get("orderStatus") ? { orderStatus: params.get("orderStatus")! } : {}),
    ...(params.get("paymentStatus") ? { paymentStatus: params.get("paymentStatus")! } : {}),
    ...(params.get("shippingStatus") ? { shippingStatus: params.get("shippingStatus")! } : {}),
    ...(brandId ? { brandId } : {}),
    ...(platformId ? { platformId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(channelId ? { channelId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(salespersonId ? { salespersonId } : {}),
    ...(params.get("countryCode") ? { countryCode: params.get("countryCode")! } : {}),
    ...(params.get("currency") ? { currency: params.get("currency")! } : {}),
    ...(dateFrom || dateTo ? { orderDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    ...paymentDueWhere(params.get("paymentDue")),
  };
  filters.push(simple);
  return filters.length > 1 ? { AND: filters } : simple;
}

export function dashboardPaymentDateRange() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  return { now, startOfToday, endOfToday };
}

export { COST_TYPES, toNumber };
