import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { decimal, toNumber } from "@/lib/order-profit-calculations";
import { ApiAuthError } from "@/lib/permissions";

export const inquiryInclude = {
  customer: { select: { id: true, name: true, companyName: true, countryCode: true, brandId: true, sourceChannelId: true } },
  brand: { select: { id: true, name: true, code: true } },
  platform: { select: { id: true, name: true, code: true } },
  store: { select: { id: true, name: true, defaultCurrency: true } },
  channel: { select: { id: true, businessLine: true, channelName: true } },
  quotes: { select: { id: true, quoteNo: true, status: true, totalAmount: true, currency: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 3 },
} satisfies Prisma.InquiryInclude;

export const quoteInclude = {
  customer: { select: { id: true, name: true, companyName: true, countryCode: true } },
  inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
  brand: { select: { id: true, name: true, code: true } },
  platform: { select: { id: true, name: true, code: true } },
  store: { select: { id: true, name: true } },
  channel: { select: { id: true, businessLine: true, channelName: true } },
  items: { orderBy: { id: "asc" } },
  order: { select: { id: true, orderNo: true } },
} satisfies Prisma.QuoteInclude;

export function apiError(error: unknown, fallback = "询盘报价操作失败") {
  if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ message: "单号已存在，请重试" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ message: "记录不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function moneyValue(value: unknown) {
  const numeric = toNumber(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
}

export function buildInquiryWhere(params: URLSearchParams): Prisma.InquiryWhereInput {
  const keyword = params.get("keyword")?.trim();
  return {
    ...(keyword
      ? {
          OR: [
            { inquiryNo: { contains: keyword } },
            { title: { contains: keyword } },
            { content: { contains: keyword } },
            { customer: { is: { name: { contains: keyword } } } },
            { customer: { is: { companyName: { contains: keyword } } } },
          ],
        }
      : {}),
    ...(params.get("status") ? { status: params.get("status")! } : {}),
    ...(params.get("customerId") ? { customerId: Number(params.get("customerId")) } : {}),
    ...(params.get("brandId") ? { brandId: Number(params.get("brandId")) } : {}),
  };
}

export function buildQuoteWhere(params: URLSearchParams): Prisma.QuoteWhereInput {
  const keyword = params.get("keyword")?.trim();
  return {
    ...(keyword
      ? {
          OR: [
            { quoteNo: { contains: keyword } },
            { customer: { is: { name: { contains: keyword } } } },
            { customer: { is: { companyName: { contains: keyword } } } },
            { inquiry: { is: { inquiryNo: { contains: keyword } } } },
            { inquiry: { is: { title: { contains: keyword } } } },
          ],
        }
      : {}),
    ...(params.get("status") ? { status: params.get("status")! } : {}),
    ...(params.get("inquiryId") ? { inquiryId: Number(params.get("inquiryId")) } : {}),
    ...(params.get("customerId") ? { customerId: Number(params.get("customerId")) } : {}),
    ...(params.get("brandId") ? { brandId: Number(params.get("brandId")) } : {}),
  };
}

export function normalizeInquiryInput(input: Record<string, unknown>) {
  const title = textValue(input.title);
  if (!title) throw new Error("询盘标题不能为空");
  return {
    customerId: optionalNumber(input.customerId),
    brandId: optionalNumber(input.brandId),
    platformId: optionalNumber(input.platformId),
    storeId: optionalNumber(input.storeId),
    channelId: optionalNumber(input.channelId),
    countryCode: textValue(input.countryCode)?.toUpperCase(),
    status: textValue(input.status) ?? "new",
    title,
    content: textValue(input.content),
  };
}

export function normalizeQuoteItems(input: unknown) {
  if (!Array.isArray(input) || input.length === 0) throw new Error("报价单至少需要 1 行商品明细");
  return input.map((item, index) => {
    const row = item as Record<string, unknown>;
    const productName = textValue(row.productName);
    if (!productName) throw new Error(`第 ${index + 1} 行商品名称不能为空`);
    const quantity = Math.max(Math.floor(Number(row.quantity ?? 1)), 1);
    const unitPrice = moneyValue(row.unitPrice);
    return {
      sku: textValue(row.sku),
      productName,
      quantity,
      unitPrice: decimal(unitPrice),
      totalPrice: decimal(quantity * unitPrice),
      remark: textValue(row.remark),
    };
  });
}

export function normalizeQuoteInput(input: Record<string, unknown>, source?: Record<string, unknown> | null) {
  const items = "items" in input ? normalizeQuoteItems(input.items) : null;
  const productAmount = items ? items.reduce((sum, item) => sum + Number(item.totalPrice), 0) : moneyValue(input.productAmount ?? source?.productAmount);
  const shippingFee = moneyValue(input.shippingFee ?? source?.shippingFee);
  const discountAmount = moneyValue(input.discountAmount ?? source?.discountAmount);
  const taxAmount = moneyValue(input.taxAmount ?? source?.taxAmount);
  const otherFee = moneyValue(input.otherFee ?? source?.otherFee);
  const totalAmount = Math.max(productAmount + shippingFee + taxAmount + otherFee - discountAmount, 0);

  return {
    data: {
      inquiryId: optionalNumber(input.inquiryId) ?? optionalNumber(source?.inquiryId),
      customerId: optionalNumber(input.customerId) ?? optionalNumber(source?.customerId),
      brandId: optionalNumber(input.brandId) ?? optionalNumber(source?.brandId),
      platformId: optionalNumber(input.platformId) ?? optionalNumber(source?.platformId),
      storeId: optionalNumber(input.storeId) ?? optionalNumber(source?.storeId),
      channelId: optionalNumber(input.channelId) ?? optionalNumber(source?.channelId),
      countryCode: textValue(input.countryCode)?.toUpperCase() ?? textValue(source?.countryCode),
      currency: textValue(input.currency)?.toUpperCase() ?? textValue(source?.currency) ?? "USD",
      productAmount: decimal(productAmount),
      shippingFee: decimal(shippingFee),
      discountAmount: decimal(discountAmount),
      taxAmount: decimal(taxAmount),
      otherFee: decimal(otherFee),
      totalAmount: decimal(totalAmount),
      status: textValue(input.status) ?? textValue(source?.status) ?? "draft",
      remark: textValue(input.remark),
    },
    items,
  };
}

export async function nextInquiryNo(count: (args: { where: { inquiryNo: { startsWith: string } } }) => Promise<number>) {
  const now = new Date();
  const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const current = await count({ where: { inquiryNo: { startsWith: `INQ-${month}-` } } });
  return `INQ-${month}-${String(current + 1).padStart(4, "0")}`;
}

export async function nextQuoteNo(count: (args: { where: { quoteNo: { startsWith: string } } }) => Promise<number>) {
  const now = new Date();
  const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const current = await count({ where: { quoteNo: { startsWith: `QUO-${month}-` } } });
  return `QUO-${month}-${String(current + 1).padStart(4, "0")}`;
}
