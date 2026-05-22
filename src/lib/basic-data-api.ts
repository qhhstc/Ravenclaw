import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiAuthError, canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

const DEFAULT_PAGE_SIZE = 10;

type BasicResource =
  | "brand"
  | "platform"
  | "store"
  | "channel"
  | "country"
  | "currency"
  | "exchangeRate";

type ResourceConfig = {
  model: BasicResource;
  searchableFields: string[];
  statusField?: string;
  include?: Record<string, unknown>;
  orderBy?: Record<string, string>;
  select?: Record<string, unknown>;
  normalizeInput: (input: Record<string, unknown>) => Record<string, unknown>;
  buildWhere?: (params: URLSearchParams) => Record<string, unknown>;
};

const statusValues = new Set(["active", "inactive"]);

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function dateValue(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusValue(value: unknown) {
  const normalized = textValue(value) ?? "active";
  return statusValues.has(normalized) ? normalized : "active";
}

function requiredText(input: Record<string, unknown>, key: string) {
  const value = textValue(input[key]);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requiredNumber(input: Record<string, unknown>, key: string) {
  const value = numberValue(input[key]);
  if (value === null) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requiredDate(input: Record<string, unknown>, key: string) {
  const value = dateValue(input[key]);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function buildSearchWhere(params: URLSearchParams, fields: string[]) {
  const keyword = params.get("keyword")?.trim();
  if (!keyword) return {};

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: keyword,
      },
    })),
  };
}

function parsePagination(params: URLSearchParams) {
  const page = Math.max(Number(params.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(params.get("pageSize") || DEFAULT_PAGE_SIZE), 1), 100);
  return { page, pageSize };
}

function getDelegate(model: BasicResource) {
  return prisma[model] as unknown as {
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
    delete: (args: Record<string, unknown>) => Promise<unknown>;
  };
}

function mergeWhere(...items: Record<string, unknown>[]) {
  return items.reduce<Record<string, unknown>>((merged, item) => {
    Object.entries(item).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)) {
        merged[key] = value;
      }
    });
    return merged;
  }, {});
}

function apiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ message: "数据已存在，请检查唯一字段" }, { status: 409 });
    }
    if (error.code === "P2003") {
      return NextResponse.json({ message: "该数据已被其他模块使用，无法删除" }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ message: "数据不存在或已被删除" }, { status: 404 });
    }
  }

  const message = error instanceof Error ? error.message : "操作失败，请稍后重试";
  return NextResponse.json({ message }, { status: 400 });
}

function apiErrorWithAuth(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return apiError(error);
}

export function createCollectionHandlers(config: ResourceConfig) {
  const delegate = getDelegate(config.model);

  return {
    async GET(request: NextRequest) {
      try {
        await requireApiSession();
        const params = request.nextUrl.searchParams;
        const { page, pageSize } = parsePagination(params);
        const status = params.get("status");
        const statusWhere = config.statusField && status ? { [config.statusField]: status } : {};
        const where = mergeWhere(
          buildSearchWhere(params, config.searchableFields),
          statusWhere,
          config.buildWhere?.(params) ?? {},
        );

        const [items, total] = await Promise.all([
          delegate.findMany({
            where,
            include: config.include,
            select: config.select,
            orderBy: config.orderBy ?? { id: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          delegate.count({ where }),
        ]);

        return NextResponse.json({ items, total, page, pageSize });
      } catch (error) {
        return apiErrorWithAuth(error);
      }
    },

    async POST(request: NextRequest) {
      try {
        const session = await requireApiSession();
        if (!canManageProducts(session.role)) return forbidden("当前角色不能维护基础资料");
        const input = (await request.json()) as Record<string, unknown>;
        const item = await delegate.create({
          data: config.normalizeInput(input),
        });
        return NextResponse.json({ item });
      } catch (error) {
        return apiErrorWithAuth(error);
      }
    },
  };
}

export function createItemHandlers(config: ResourceConfig) {
  const delegate = getDelegate(config.model);

  return {
    async PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      try {
        const session = await requireApiSession();
        if (!canManageProducts(session.role)) return forbidden("当前角色不能维护基础资料");
        const { id } = await context.params;
        const input = (await request.json()) as Record<string, unknown>;
        const item = await delegate.update({
          where: { id: Number(id) },
          data: config.normalizeInput(input),
        });
        return NextResponse.json({ item });
      } catch (error) {
        return apiErrorWithAuth(error);
      }
    },

    async PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      try {
        const session = await requireApiSession();
        if (!canManageProducts(session.role)) return forbidden("当前角色不能维护基础资料");
        const { id } = await context.params;
        const input = (await request.json()) as Record<string, unknown>;
        const data = config.statusField && input.status ? { [config.statusField]: statusValue(input.status) } : config.normalizeInput(input);
        const item = await delegate.update({
          where: { id: Number(id) },
          data,
        });
        return NextResponse.json({ item });
      } catch (error) {
        return apiErrorWithAuth(error);
      }
    },

    async DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
      try {
        const session = await requireApiSession();
        if (!canManageProducts(session.role)) return forbidden("当前角色不能维护基础资料");
        const { id } = await context.params;
        await delegate.delete({
          where: { id: Number(id) },
        });
        return NextResponse.json({ ok: true });
      } catch (error) {
        return apiErrorWithAuth(error);
      }
    },
  };
}

export const basicResourceConfigs = {
  brands: {
    model: "brand",
    searchableFields: ["name", "code"],
    statusField: "status",
    orderBy: { updatedAt: "desc" },
    normalizeInput(input) {
      return {
        name: requiredText(input, "name"),
        code: requiredText(input, "code").toUpperCase(),
        website: textValue(input.website),
        defaultCurrency: requiredText(input, "defaultCurrency").toUpperCase(),
        description: textValue(input.description),
        status: statusValue(input.status),
      };
    },
  },
  platforms: {
    model: "platform",
    searchableFields: ["name", "code", "type"],
    statusField: "status",
    orderBy: { updatedAt: "desc" },
    normalizeInput(input) {
      return {
        name: requiredText(input, "name"),
        code: requiredText(input, "code").toUpperCase(),
        type: requiredText(input, "type"),
        status: statusValue(input.status),
      };
    },
  },
  stores: {
    model: "store",
    searchableFields: ["name", "domain", "manager"],
    statusField: "status",
    include: {
      brand: { select: { id: true, name: true, code: true } },
      platform: { select: { id: true, name: true, code: true } },
    },
    orderBy: { updatedAt: "desc" },
    normalizeInput(input) {
      const defaultCurrency = requiredText(input, "defaultCurrency").toUpperCase();
      return {
        brandId: requiredNumber(input, "brandId"),
        platformId: requiredNumber(input, "platformId"),
        name: requiredText(input, "name"),
        domain: textValue(input.domain),
        storeType: requiredText(input, "storeType"),
        marketScope: requiredText(input, "marketScope"),
        primaryMarketCode: textValue(input.primaryMarketCode)?.toUpperCase(),
        defaultCurrency,
        settlementCurrency: textValue(input.settlementCurrency)?.toUpperCase() ?? defaultCurrency,
        manager: textValue(input.manager),
        remark: textValue(input.remark),
        status: statusValue(input.status),
      };
    },
  },
  channels: {
    model: "channel",
    searchableFields: ["businessLine", "channelGroup", "channelName", "channelType"],
    statusField: "status",
    include: {
      brand: { select: { id: true, name: true, code: true } },
      platform: { select: { id: true, name: true, code: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: "asc" },
    buildWhere(params) {
      const brandId = numberValue(params.get("brandId"));
      const platformId = numberValue(params.get("platformId"));
      const storeId = numberValue(params.get("storeId"));
      const channelType = textValue(params.get("channelType"));
      return {
        ...(brandId ? { brandId } : {}),
        ...(platformId ? { platformId } : {}),
        ...(storeId ? { storeId } : {}),
        ...(channelType ? { channelType } : {}),
      };
    },
    normalizeInput(input) {
      return {
        brandId: requiredNumber(input, "brandId"),
        platformId: requiredNumber(input, "platformId"),
        storeId: numberValue(input.storeId),
        businessLine: requiredText(input, "businessLine"),
        channelGroup: requiredText(input, "channelGroup"),
        channelName: requiredText(input, "channelName"),
        channelType: requiredText(input, "channelType"),
        sortOrder: numberValue(input.sortOrder) ?? 0,
        status: statusValue(input.status),
      };
    },
  },
  countries: {
    model: "country",
    searchableFields: ["name", "code", "region"],
    statusField: "status",
    orderBy: { id: "desc" },
    normalizeInput(input) {
      return {
        name: requiredText(input, "name"),
        code: requiredText(input, "code").toUpperCase(),
        region: textValue(input.region),
        status: statusValue(input.status),
      };
    },
  },
  currencies: {
    model: "currency",
    searchableFields: ["code", "name", "symbol"],
    statusField: "status",
    orderBy: { id: "desc" },
    normalizeInput(input) {
      return {
        code: requiredText(input, "code").toUpperCase(),
        name: requiredText(input, "name"),
        symbol: requiredText(input, "symbol"),
        status: statusValue(input.status),
      };
    },
  },
  exchangeRates: {
    model: "exchangeRate",
    searchableFields: ["baseCurrency", "targetCurrency"],
    orderBy: { rateDate: "desc" },
    normalizeInput(input) {
      return {
        baseCurrency: requiredText(input, "baseCurrency").toUpperCase(),
        targetCurrency: requiredText(input, "targetCurrency").toUpperCase(),
        rate: new Prisma.Decimal(requiredText(input, "rate")),
        rateDate: requiredDate(input, "rateDate"),
      };
    },
  },
} satisfies Record<string, ResourceConfig>;
