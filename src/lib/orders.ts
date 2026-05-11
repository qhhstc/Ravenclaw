import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export const ORDER_SOURCES = ["quote", "wordpress_wholesale", "shopify", "amazon", "tiktok_shop", "manual", "influencer", "other"] as const;
export const ORDER_STATUSES = ["draft", "pending_confirm", "confirmed", "processing", "shipped", "completed", "cancelled", "refunded"] as const;
export const PAYMENT_STATUSES = ["unpaid", "partial_paid", "paid", "refunded"] as const;
export const SHIPPING_STATUSES = ["unshipped", "partial_shipped", "shipped", "delivered"] as const;
export const CLOSED_ORDER_STATUSES = ["cancelled", "refunded"];

export const orderInclude = {
  customer: { select: { id: true, name: true, companyName: true, countryCode: true, brandId: true, sourceChannelId: true } },
  brand: { select: { id: true, name: true, code: true } },
  platform: { select: { id: true, name: true, code: true } },
  store: { select: { id: true, name: true, defaultCurrency: true, primaryMarketCode: true, brandId: true, platformId: true } },
  channel: { select: { id: true, businessLine: true, channelName: true, store: { select: { id: true, name: true } } } },
  quote: { select: { id: true, quoteNo: true, totalAmount: true, status: true } },
  inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
  creator: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  ...orderInclude,
  items: { orderBy: { id: "asc" } },
} satisfies Prisma.OrderInclude;

export function apiError(error: unknown, fallback = "操作失败，请稍后重试") {
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

export function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const numeric = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function money(value: number) {
  return Math.round(value * 100) / 100;
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
  sku?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number | null;
  remark?: string | null;
};

export function normalizeOrderItems(input: unknown): OrderItemInput[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("订单至少需要 1 行商品明细");
  return input.map((item, index) => {
    const row = item as Record<string, unknown>;
    const productName = textValue(row.productName);
    if (!productName) throw new Error(`第 ${index + 1} 行商品名称不能为空`);
    const quantity = Math.max(Math.floor(toNumber(row.quantity, 0)), 0);
    const unitPrice = toNumber(row.unitPrice, -1);
    if (quantity <= 0) throw new Error(`第 ${index + 1} 行数量必须大于 0`);
    if (unitPrice < 0) throw new Error(`第 ${index + 1} 行售价不能小于 0`);
    const costPrice = row.costPrice === null || row.costPrice === undefined || row.costPrice === "" ? null : Math.max(toNumber(row.costPrice), 0);
    return { sku: textValue(row.sku), productName, quantity, unitPrice, costPrice, remark: textValue(row.remark) };
  });
}

export function calculateOrderAmounts(input: Record<string, unknown>, items: OrderItemInput[]) {
  const productAmount = money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const shippingFee = Math.max(toNumber(input.shippingFee), 0);
  const discountAmount = Math.max(toNumber(input.discountAmount), 0);
  const taxAmount = Math.max(toNumber(input.taxAmount), 0);
  const otherFee = Math.max(toNumber(input.otherFee), 0);
  const totalAmount = money(productAmount + shippingFee + taxAmount + otherFee - discountAmount);
  const paidAmount = money(Math.max(toNumber(input.paidAmount), 0));
  if (totalAmount < 0) throw new Error("订单总金额不能小于 0");
  if (paidAmount > totalAmount) throw new Error("已收金额不能大于订单总金额");
  const unpaidAmount = money(totalAmount - paidAmount);
  return { productAmount, shippingFee, discountAmount, taxAmount, otherFee, totalAmount, paidAmount, unpaidAmount };
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

export function normalizeOrderInput(input: Record<string, unknown>, forcedOrderNo?: string) {
  const items = normalizeOrderItems(input.items);
  const orderStatus = enumValue(input.orderStatus, ORDER_STATUSES, "draft");
  const amounts = calculateOrderAmounts(input, items);
  const orderDate = optionalDate(input.orderDate) ?? new Date();
  return {
    data: {
      orderNo: textValue(forcedOrderNo) ?? textValue(input.orderNo) ?? undefined,
      externalOrderNo: textValue(input.externalOrderNo),
      orderSource: enumValue(input.orderSource, ORDER_SOURCES, "manual"),
      customerId: optionalNumber(input.customerId),
      inquiryId: optionalNumber(input.inquiryId),
      quoteId: optionalNumber(input.quoteId),
      brandId: optionalNumber(input.brandId),
      platformId: optionalNumber(input.platformId),
      storeId: optionalNumber(input.storeId),
      channelId: optionalNumber(input.channelId),
      countryCode: textValue(input.countryCode),
      currency: textValue(input.currency) ?? "USD",
      ...amounts,
      orderStatus,
      paymentStatus: paymentStatusFor(amounts.totalAmount, amounts.paidAmount, orderStatus, input.paymentStatus),
      shippingStatus: enumValue(input.shippingStatus, SHIPPING_STATUSES, "unshipped"),
      orderDate,
      expectedShipDate: optionalDate(input.expectedShipDate),
      actualShipDate: optionalDate(input.actualShipDate),
      dueDate: optionalDate(input.dueDate),
      trackingNo: textValue(input.trackingNo),
      logisticsProvider: textValue(input.logisticsProvider),
      remark: textValue(input.remark),
      createdBy: optionalNumber(input.createdBy),
    },
    items: items.map((item) => ({
      ...item,
      totalPrice: money(item.quantity * item.unitPrice),
      totalCost: money(item.quantity * (item.costPrice ?? 0)),
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

export function buildOrderWhere(params: URLSearchParams): Prisma.OrderWhereInput {
  const keyword = params.get("keyword")?.trim();
  const brandId = parseOptionalInt(params.get("brandId"));
  const platformId = parseOptionalInt(params.get("platformId"));
  const storeId = parseOptionalInt(params.get("storeId"));
  const channelId = parseOptionalInt(params.get("channelId"));
  const customerId = parseOptionalInt(params.get("customerId"));
  const dateFrom = optionalDate(params.get("dateFrom"));
  const dateTo = optionalDate(params.get("dateTo"));
  return {
    ...(keyword ? {
      OR: [
        { orderNo: { contains: keyword } },
        { externalOrderNo: { contains: keyword } },
        { customer: { is: { name: { contains: keyword } } } },
        { customer: { is: { companyName: { contains: keyword } } } },
        { items: { some: { productName: { contains: keyword } } } },
      ],
    } : {}),
    ...(params.get("orderSource") ? { orderSource: params.get("orderSource")! } : {}),
    ...(params.get("orderStatus") ? { orderStatus: params.get("orderStatus")! } : {}),
    ...(params.get("paymentStatus") ? { paymentStatus: params.get("paymentStatus")! } : {}),
    ...(params.get("shippingStatus") ? { shippingStatus: params.get("shippingStatus")! } : {}),
    ...(brandId ? { brandId } : {}),
    ...(platformId ? { platformId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(channelId ? { channelId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(params.get("countryCode") ? { countryCode: params.get("countryCode")! } : {}),
    ...(params.get("currency") ? { currency: params.get("currency")! } : {}),
    ...(dateFrom || dateTo ? { orderDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    ...paymentDueWhere(params.get("paymentDue")),
  };
}

export function dashboardPaymentDateRange() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  return { now, startOfToday, endOfToday };
}
