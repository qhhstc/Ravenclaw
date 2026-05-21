import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";

type OrderCustomerInput = {
  customerId?: number | null;
  customerName?: string | null;
  countryCode?: string | null;
  channelId?: number | null;
  brandId?: number | null;
  salespersonId?: number | null;
  createdBy?: number | null;
};

type CustomerSyncDelegate = {
  customer: {
    findUnique: (args: { where: { id: number }; select: CustomerSelect }) => Promise<CustomerMatch | null>;
    findMany: (args: { where: Prisma.CustomerWhereInput; select: CustomerSelect; take?: number; orderBy?: Prisma.CustomerOrderByWithRelationInput[] }) => Promise<CustomerMatch[]>;
    create: (args: { data: Prisma.CustomerUncheckedCreateInput; select: CustomerSelect }) => Promise<CustomerMatch>;
    update: (args: { where: { id: number }; data: Prisma.CustomerUncheckedUpdateInput; select: CustomerSelect }) => Promise<CustomerMatch>;
  };
};

type CustomerSelect = {
  id: true;
  name: true;
  countryCode: true;
  brandId: true;
  sourceChannelId: true;
  ownerId: true;
};

type CustomerMatch = {
  id: number;
  name: string;
  countryCode: string | null;
  brandId: number | null;
  sourceChannelId: number | null;
  ownerId: number | null;
};

export type OrderCustomerSyncResult = {
  customerId: number | null;
  customerName: string | null;
  action: "selected" | "matched" | "created" | "skipped" | "ambiguous";
};

const customerSelect = {
  id: true,
  name: true,
  countryCode: true,
  brandId: true,
  sourceChannelId: true,
  ownerId: true,
} satisfies CustomerSelect;

const SKIP_CUSTOMER_NAMES = new Set(["散客", "散客/平台订单", "平台订单", "客户", "未知客户", "anonymous", "guest", "walk-in"]);
const PLATFORM_ORDER_SOURCES = new Set(["amazon", "tiktok_shop", "shopify", "wordpress_wholesale"]);

function trimmedText(value?: string | null) {
  return value?.trim() || null;
}

function shouldSkipCustomerName(name: string, orderSource?: string | null) {
  const normalized = name.trim().toLowerCase();
  if (name.trim().length < 2) return true;
  if (SKIP_CUSTOMER_NAMES.has(normalized)) return true;
  if (orderSource && PLATFORM_ORDER_SOURCES.has(orderSource) && /^(amazon|tiktok|shopify|wordpress|平台|散客|guest|anonymous)/i.test(name.trim())) return true;
  return false;
}

function nullableId(value?: number | null) {
  return value && value > 0 ? value : null;
}

function customerPatch(customer: CustomerMatch, input: OrderCustomerInput) {
  const data: Prisma.CustomerUncheckedUpdateInput = {};
  const countryCode = trimmedText(input.countryCode);
  const sourceChannelId = nullableId(input.channelId);
  const brandId = nullableId(input.brandId);
  const ownerId = nullableId(input.salespersonId) ?? nullableId(input.createdBy);
  if (!customer.countryCode && countryCode) data.countryCode = countryCode;
  if (!customer.sourceChannelId && sourceChannelId) data.sourceChannelId = sourceChannelId;
  if (!customer.brandId && brandId) data.brandId = brandId;
  if (!customer.ownerId && ownerId) data.ownerId = ownerId;
  return data;
}

async function patchCustomerIfNeeded(tx: CustomerSyncDelegate, customer: CustomerMatch, input: OrderCustomerInput) {
  const data = customerPatch(customer, input);
  if (Object.keys(data).length === 0) return customer;
  return tx.customer.update({ where: { id: customer.id }, data, select: customerSelect });
}

export async function syncOrderCustomer(
  tx: CustomerSyncDelegate,
  input: OrderCustomerInput & { orderSource?: string | null; orderNo?: string | null },
  session?: SessionUser | null,
): Promise<OrderCustomerSyncResult> {
  const explicitCustomerId = nullableId(input.customerId);
  if (explicitCustomerId) {
    const existing = await tx.customer.findUnique({ where: { id: explicitCustomerId }, select: customerSelect });
    if (!existing) throw new Error("选择的客户不存在或已被删除");
    const customer = await patchCustomerIfNeeded(tx, existing, input);
    return { customerId: customer.id, customerName: customer.name, action: "selected" };
  }

  const customerName = trimmedText(input.customerName);
  if (!customerName || shouldSkipCustomerName(customerName, input.orderSource)) {
    return { customerId: null, customerName, action: "skipped" };
  }

  const countryCode = trimmedText(input.countryCode);
  const exactMatches = await tx.customer.findMany({
    where: { name: customerName, ...(countryCode ? { countryCode } : {}) },
    select: customerSelect,
    take: 2,
    orderBy: [{ id: "asc" }],
  });
  if (exactMatches.length === 1) {
    const customer = await patchCustomerIfNeeded(tx, exactMatches[0], input);
    return { customerId: customer.id, customerName: customer.name, action: "matched" };
  }
  if (exactMatches.length > 1) {
    return { customerId: null, customerName, action: "ambiguous" };
  }

  if (!countryCode) {
    const nameOnlyMatches = await tx.customer.findMany({
      where: { name: customerName },
      select: customerSelect,
      take: 2,
      orderBy: [{ id: "asc" }],
    });
    if (nameOnlyMatches.length === 1) {
      const customer = await patchCustomerIfNeeded(tx, nameOnlyMatches[0], input);
      return { customerId: customer.id, customerName: customer.name, action: "matched" };
    }
    if (nameOnlyMatches.length > 1) {
      return { customerId: null, customerName, action: "ambiguous" };
    }
  }

  const ownerId = nullableId(input.salespersonId) ?? nullableId(input.createdBy) ?? session?.userId ?? null;
  const created = await tx.customer.create({
    data: {
      name: customerName,
      customerType: "company",
      countryCode,
      sourceChannelId: nullableId(input.channelId),
      brandId: nullableId(input.brandId),
      ownerId,
      level: "C",
      status: "new",
      tags: [],
      remark: input.orderNo ? `由订单 ${input.orderNo} 自动创建` : "由订单自动创建",
    },
    select: customerSelect,
  });
  return { customerId: created.id, customerName: created.name, action: "created" };
}
