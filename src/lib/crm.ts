import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiAuthError, canViewAllOrders, canViewProfitReports, type SessionUser } from "@/lib/permissions";

export const CUSTOMER_TYPES = ["individual", "company", "wholesaler", "distributor", "agent", "influencer", "supplier_contact", "other"] as const;
export const CUSTOMER_LEVELS = ["A", "B", "C", "D"] as const;
export const CUSTOMER_STATUSES = ["new", "contacted", "quoted", "negotiating", "won", "repeat", "lost", "invalid"] as const;
export const FOLLOWUP_TYPES = ["email", "whatsapp", "phone", "wechat", "meeting", "note", "other"] as const;
export const CLOSED_CUSTOMER_STATUSES = ["won", "lost", "invalid"];

export const customerInclude = {
  brand: { select: { id: true, name: true, code: true } },
  sourceChannel: {
    select: {
      id: true,
      businessLine: true,
      channelGroup: true,
      channelName: true,
      channelType: true,
      store: { select: { id: true, name: true } },
      platform: { select: { id: true, name: true } },
    },
  },
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CustomerInclude;

export const customerDetailInclude = {
  ...customerInclude,
  contacts: { orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
  followups: {
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  },
  inquiries: {
    include: {
      brand: { select: { id: true, name: true, code: true } },
      channel: {
        select: {
          id: true,
          businessLine: true,
          channelGroup: true,
          channelName: true,
          channelType: true,
          store: { select: { id: true, name: true } },
          platform: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  },
  quotes: {
    include: {
      inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
      order: { select: { id: true, orderNo: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
  orders: {
    include: {
      items: true,
      salesperson: { select: { id: true, name: true, email: true } },
      payments: {
        include: { creator: { select: { id: true, name: true, email: true } } },
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      },
    },
    orderBy: { orderDate: "desc" },
  },
} satisfies Prisma.CustomerInclude;

function crmOrderScopeWhere(session: SessionUser): Prisma.OrderWhereInput {
  if (canViewAllOrders(session.role)) return {};
  return { OR: [{ createdBy: session.userId }, { salespersonId: session.userId }] };
}

const customerOrderSafeSelect = {
  id: true,
  orderNo: true,
  orderDate: true,
  currency: true,
  exchangeRate: true,
  salesAmount: true,
  paidAmount: true,
  orderStatus: true,
  paymentStatus: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      sku: true,
      productName: true,
      productNameCn: true,
      productNameEn: true,
      quantity: true,
      saleUnitPrice: true,
      salesSubtotal: true,
    },
  },
} satisfies Prisma.OrderSelect;

const customerOrderProfitSelect = {
  ...customerOrderSafeSelect,
  baseCurrency: true,
  totalCost: true,
  grossProfit: true,
  grossMargin: true,
  salesperson: { select: { id: true, name: true, email: true } },
  payments: {
    where: { status: { not: "void" } },
    include: { creator: { select: { id: true, name: true, email: true } } },
    orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
  },
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      sku: true,
      productName: true,
      productNameCn: true,
      productNameEn: true,
      quantity: true,
      saleUnitPrice: true,
      salesSubtotal: true,
      purchaseUnitCost: true,
      purchaseCurrency: true,
      purchaseCostSubtotal: true,
      purchaseCostBase: true,
      packagingUnitCost: true,
      packagingCurrency: true,
      packagingCostSubtotal: true,
      packagingCostBase: true,
    },
  },
} satisfies Prisma.OrderSelect;

export function customerDetailIncludeForSession(session: SessionUser): Prisma.CustomerInclude {
  const canSeeProfit = canViewProfitReports(session.role);
  return {
    ...customerDetailInclude,
    orders: {
      where: crmOrderScopeWhere(session),
      select: canSeeProfit ? customerOrderProfitSelect : customerOrderSafeSelect,
      orderBy: { orderDate: "desc" },
    },
  };
}

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

export function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

export function optionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function requiredText(input: Record<string, unknown>, key: string, label: string) {
  const value = textValue(input[key]);
  if (!value) throw new Error(`${label}不能为空`);
  return value;
}

export function enumValue<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) {
  const normalized = textValue(value);
  return normalized && options.includes(normalized) ? normalized : fallback;
}

export function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const text = textValue(value);
  if (!text) return [];
  return text.split(/[，,]/).map((item) => item.trim()).filter(Boolean);
}

export function normalizeCustomerInput(input: Record<string, unknown>): Prisma.CustomerUncheckedCreateInput {
  const email = textValue(input.email);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("邮箱格式不正确");

  return {
    name: requiredText(input, "name", "客户名称"),
    companyName: textValue(input.companyName),
    customerType: enumValue(input.customerType, CUSTOMER_TYPES, "company"),
    countryCode: textValue(input.countryCode),
    email,
    phone: textValue(input.phone),
    whatsapp: textValue(input.whatsapp),
    website: textValue(input.website),
    sourceChannelId: optionalNumber(input.sourceChannelId),
    brandId: optionalNumber(input.brandId),
    ownerId: optionalNumber(input.ownerId),
    level: enumValue(input.level, CUSTOMER_LEVELS, "C"),
    status: enumValue(input.status, CUSTOMER_STATUSES, "new"),
    tags: normalizeTags(input.tags),
    remark: textValue(input.remark),
    nextFollowupAt: optionalDate(input.nextFollowupAt),
  };
}

export function normalizeContactInput(input: Record<string, unknown>) {
  const email = textValue(input.email);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("联系人邮箱格式不正确");
  return {
    name: requiredText(input, "name", "联系人姓名"),
    position: textValue(input.position),
    email,
    phone: textValue(input.phone),
    whatsapp: textValue(input.whatsapp),
    isPrimary: Boolean(input.isPrimary),
    remark: textValue(input.remark),
  };
}

export function normalizeFollowupInput(input: Record<string, unknown>) {
  return {
    followupType: enumValue(input.followupType, FOLLOWUP_TYPES, "note"),
    content: requiredText(input, "content", "跟进内容"),
    result: textValue(input.result),
    nextFollowupAt: optionalDate(input.nextFollowupAt),
    ownerId: optionalNumber(input.ownerId),
  };
}

export function followupStatusWhere(status?: string | null): Prisma.CustomerWhereInput {
  if (!status) return {};
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  if (status === "due") {
    return { nextFollowupAt: { gte: startOfToday, lt: endOfToday }, status: { notIn: CLOSED_CUSTOMER_STATUSES } };
  }
  if (status === "overdue") {
    return { nextFollowupAt: { lt: now }, status: { notIn: CLOSED_CUSTOMER_STATUSES } };
  }
  if (status === "next7days") {
    return { nextFollowupAt: { gte: now, lte: sevenDaysLater }, status: { notIn: CLOSED_CUSTOMER_STATUSES } };
  }
  if (status === "none") {
    return { nextFollowupAt: null };
  }
  return {};
}

export function buildCustomerWhere(params: URLSearchParams): Prisma.CustomerWhereInput {
  const keyword = params.get("keyword")?.trim();
  const brandId = parseOptionalInt(params.get("brandId"));
  const sourceChannelId = parseOptionalInt(params.get("sourceChannelId"));
  const ownerId = parseOptionalInt(params.get("ownerId"));

  return {
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { companyName: { contains: keyword } },
            { email: { contains: keyword } },
            { whatsapp: { contains: keyword } },
            { website: { contains: keyword } },
          ],
        }
      : {}),
    ...(params.get("customerType") ? { customerType: params.get("customerType")! } : {}),
    ...(params.get("status") ? { status: params.get("status")! } : {}),
    ...(params.get("level") ? { level: params.get("level")! } : {}),
    ...(brandId ? { brandId } : {}),
    ...(sourceChannelId ? { sourceChannelId } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(params.get("countryCode") ? { countryCode: params.get("countryCode")! } : {}),
    ...followupStatusWhere(params.get("followupStatus")),
  };
}

export function crmCustomerScopeWhere(session: SessionUser): Prisma.CustomerWhereInput {
  if (session.role === "sales") return { ownerId: session.userId };
  return {};
}

export function scopedCustomerWhere(params: URLSearchParams, session: SessionUser): Prisma.CustomerWhereInput {
  return { AND: [buildCustomerWhere(params), crmCustomerScopeWhere(session)] };
}

export function scopedCustomerUniqueWhere(customerId: number, session: SessionUser): Prisma.CustomerWhereInput {
  return { AND: [{ id: customerId }, crmCustomerScopeWhere(session)] };
}

export async function assertCanAccessCustomer(tx: { customer: { count: (args: { where: Prisma.CustomerWhereInput }) => Promise<number> } }, customerId: number, session: SessionUser) {
  const count = await tx.customer.count({ where: scopedCustomerUniqueWhere(customerId, session) });
  if (!count) throw new ApiAuthError("客户不存在或无权访问", 403);
}

export async function assertCanAccessContact(tx: { customerContact: { findUnique: (args: { where: { id: number }; select: { customerId: true } }) => Promise<{ customerId: number } | null> }; customer: { count: (args: { where: Prisma.CustomerWhereInput }) => Promise<number> } }, contactId: number, session: SessionUser) {
  const contact = await tx.customerContact.findUnique({ where: { id: contactId }, select: { customerId: true } });
  if (!contact) throw new ApiAuthError("联系人不存在或已被删除", 404);
  await assertCanAccessCustomer(tx, contact.customerId, session);
  return contact;
}

export async function assertCanAccessFollowup(tx: { customerFollowup: { findUnique: (args: { where: { id: number }; select: { customerId: true } }) => Promise<{ customerId: number } | null> }; customer: { count: (args: { where: Prisma.CustomerWhereInput }) => Promise<number> } }, followupId: number, session: SessionUser) {
  const followup = await tx.customerFollowup.findUnique({ where: { id: followupId }, select: { customerId: true } });
  if (!followup) throw new ApiAuthError("跟进记录不存在或已被删除", 404);
  await assertCanAccessCustomer(tx, followup.customerId, session);
  return followup;
}

export function normalizeCustomerInputForSession(input: Record<string, unknown>, session: SessionUser): Prisma.CustomerUncheckedCreateInput {
  const data = normalizeCustomerInput(input);
  if (session.role === "sales") data.ownerId = session.userId;
  return data;
}

export function crmDateRange() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  return { now, startOfToday, endOfToday, sevenDaysLater };
}
