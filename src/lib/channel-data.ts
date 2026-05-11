import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const WEEK_NUMBERS = [1, 2, 3, 4, 5] as const;
export const PERIOD_TYPE_WEEK = "week";

export type ChannelDataFilters = {
  year: number;
  month: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  businessLine?: string;
  channelType?: string;
};

export type ChannelDataWeekInput = {
  weekNumber: number;
  salesAmountOriginal: number;
  adSpendOriginal: number;
};

export type ChannelDataRowInput = {
  channelId: number;
  brandId?: number;
  platformId?: number;
  storeId?: number | null;
  countryCode?: string | null;
  currency?: string;
  exchangeRate?: number;
  remark?: string | null;
  weeks: ChannelDataWeekInput[];
};

export function quarterFromMonth(month: number) {
  return Math.ceil(month / 3);
}

export function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const numericValue = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
}

export function parseOptionalInt(value: string | null) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : undefined;
}

export function parseChannelDataFilters(params: URLSearchParams): ChannelDataFilters {
  return {
    year: parsePositiveInt(params.get("year"), 2026),
    month: Math.min(Math.max(parsePositiveInt(params.get("month"), 5), 1), 12),
    brandId: parseOptionalInt(params.get("brandId")),
    platformId: parseOptionalInt(params.get("platformId")),
    storeId: parseOptionalInt(params.get("storeId")),
    businessLine: params.get("businessLine")?.trim() || undefined,
    channelType: params.get("channelType")?.trim() || undefined,
  };
}

export function buildChannelWhere(filters: ChannelDataFilters): Prisma.ChannelWhereInput {
  return {
    status: "active",
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.platformId ? { platformId: filters.platformId } : {}),
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.businessLine ? { businessLine: filters.businessLine } : {}),
    ...(filters.channelType ? { channelType: filters.channelType } : {}),
  };
}

export async function getFilteredChannelIds(filters: ChannelDataFilters) {
  const channels = await prisma.channel.findMany({
    where: buildChannelWhere(filters),
    select: { id: true },
  });
  return channels.map((channel) => channel.id);
}

export async function getMonthlyRows(filters: ChannelDataFilters) {
  const channels = await prisma.channel.findMany({
    where: buildChannelWhere(filters),
    include: {
      brand: { select: { id: true, name: true, code: true, defaultCurrency: true } },
      platform: { select: { id: true, name: true, code: true, type: true } },
      store: {
        select: {
          id: true,
          name: true,
          domain: true,
          storeType: true,
          marketScope: true,
          primaryMarketCode: true,
          defaultCurrency: true,
          settlementCurrency: true,
        },
      },
    },
    orderBy: [{ businessLine: "asc" }, { brand: { name: "asc" } }, { platform: { name: "asc" } }, { store: { name: "asc" } }, { sortOrder: "asc" }],
  });

  const metrics = await prisma.channelMetricPeriod.findMany({
    where: {
      year: filters.year,
      month: filters.month,
      periodType: PERIOD_TYPE_WEEK,
      weekNumber: { in: [...WEEK_NUMBERS] },
      channelId: { in: channels.map((channel) => channel.id) },
    },
  });

  const metricMap = new Map(metrics.map((metric) => [`${metric.channelId}-${metric.weekNumber}`, metric]));

  return channels.map((channel) => {
    const weeks = WEEK_NUMBERS.map((weekNumber) => {
      const metric = metricMap.get(`${channel.id}-${weekNumber}`);
      return {
        weekNumber,
        salesAmountOriginal: toNumber(metric?.salesAmountOriginal),
        adSpendOriginal: toNumber(metric?.adSpendOriginal),
      };
    });
    const firstMetricWithRemark = metrics.find((metric) => metric.channelId === channel.id && metric.remark);

    return {
      channelId: channel.id,
      businessLine: channel.businessLine,
      channelGroup: channel.channelGroup,
      channelName: channel.channelName,
      channelType: channel.channelType,
      sortOrder: channel.sortOrder,
      status: channel.status,
      brand: channel.brand,
      platform: channel.platform,
      store: channel.store,
      countryCode: channel.store?.primaryMarketCode ?? null,
      currency: channel.store?.defaultCurrency ?? channel.brand?.defaultCurrency ?? "CNY",
      remark: firstMetricWithRemark?.remark ?? "",
      weeks,
    };
  });
}

export async function getQuarterTotals(filters: ChannelDataFilters) {
  const quarter = quarterFromMonth(filters.month);
  const channelIds = await getFilteredChannelIds(filters);

  if (channelIds.length === 0) {
    return { quarter, months: [], salesAmount: 0, adSpend: 0 };
  }

  const metrics = await prisma.channelMetricPeriod.findMany({
    where: {
      year: filters.year,
      quarter,
      periodType: PERIOD_TYPE_WEEK,
      channelId: { in: channelIds },
    },
    select: {
      month: true,
      salesAmountBase: true,
      adSpendBase: true,
    },
  });

  const months = Array.from(new Set(metrics.map((metric) => metric.month))).sort((a, b) => a - b);

  return metrics.reduce(
    (summary, metric) => ({
      quarter,
      months,
      salesAmount: summary.salesAmount + toNumber(metric.salesAmountBase),
      adSpend: summary.adSpend + toNumber(metric.adSpendBase),
    }),
    { quarter, months, salesAmount: 0, adSpend: 0 },
  );
}

export function normalizeMoney(value: unknown) {
  const numericValue = toNumber(value);
  return Math.max(numericValue, 0);
}

export function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}
