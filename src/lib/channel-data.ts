import { Prisma } from "@prisma/client";
import { inferBusinessBlock } from "@/lib/business-blocks";
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
  businessBlock?: string | null;
  productCostBase?: number;
  otherCostBase?: number;
  manualRating?: string | null;
  ratingSource?: string | null;
  aiAnalysisStatus?: string | null;
  manualActionSuggestion?: string | null;
  warningType?: string | null;
  warningLevel?: string | null;
  decisionOwner?: string | null;
  decisionDeadline?: string | null;
  nextBudgetBase?: number | null;
  budgetAdjustReason?: string | null;
  remark?: string | null;
  weeks: ChannelDataWeekInput[];
};

export function quarterFromMonth(month: number) {
  return Math.ceil(month / 3);
}

export function currentPeriod(now = new Date()) {
  const month = now.getMonth() + 1;
  return { year: now.getFullYear(), month, quarter: quarterFromMonth(month) };
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
  const fallback = currentPeriod();
  return {
    year: parsePositiveInt(params.get("year"), fallback.year),
    month: Math.min(Math.max(parsePositiveInt(params.get("month"), fallback.month), 1), 12),
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
  const quarter = quarterFromMonth(filters.month);
  const quarterMetrics = await prisma.channelMetricPeriod.findMany({
    where: {
      year: filters.year,
      quarter,
      periodType: PERIOD_TYPE_WEEK,
      channelId: { in: channels.map((channel) => channel.id) },
    },
    select: {
      channelId: true,
      salesAmountBase: true,
      adSpendBase: true,
      productCostBase: true,
      otherCostBase: true,
    },
  });
  const quarterMap = new Map<number, { salesAmount: number; adSpend: number; productCost: number; otherCost: number }>();
  quarterMetrics.forEach((metric) => {
    const current = quarterMap.get(metric.channelId) ?? { salesAmount: 0, adSpend: 0, productCost: 0, otherCost: 0 };
    current.salesAmount += toNumber(metric.salesAmountBase);
    current.adSpend += toNumber(metric.adSpendBase);
    current.productCost += toNumber(metric.productCostBase);
    current.otherCost += toNumber(metric.otherCostBase);
    quarterMap.set(metric.channelId, current);
  });

  return channels.map((channel) => {
    const weeks = WEEK_NUMBERS.map((weekNumber) => {
      const metric = metricMap.get(`${channel.id}-${weekNumber}`);
      return {
        weekNumber,
        salesAmountOriginal: toNumber(metric?.salesAmountOriginal),
        adSpendOriginal: toNumber(metric?.adSpendOriginal),
      };
    });
    const channelMetrics = metrics.filter((metric) => metric.channelId === channel.id);
    const firstMetric =
      channelMetrics.find((metric) => metric.aiRating || metric.aiSummary || metric.aiActionSuggestion || metric.aiRiskNotes || metric.aiAnalyzedAt) ??
      channelMetrics.find(
        (metric) =>
          metric.manualRating ||
          metric.manualActionSuggestion ||
          metric.remark ||
          metric.decisionOwner ||
          metric.decisionDeadline ||
          metric.nextBudgetBase ||
          metric.budgetAdjustReason ||
          metric.warningType ||
          metric.warningLevel,
      ) ??
      channelMetrics.find((metric) => metric.weekNumber === 1) ??
      channelMetrics[0];
    const businessBlock = inferBusinessBlock({
      businessBlock: firstMetric?.businessBlock,
      businessLine: channel.businessLine,
      platformName: channel.platform?.name,
      storeType: channel.store?.storeType,
      channelType: channel.channelType,
    });
    const quarterTotals = quarterMap.get(channel.id) ?? { salesAmount: 0, adSpend: 0, productCost: 0, otherCost: 0 };

    return {
      channelId: channel.id,
      businessBlock,
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
      productCostBase: toNumber(firstMetric?.productCostBase),
      otherCostBase: toNumber(firstMetric?.otherCostBase),
      manualRating: firstMetric?.manualRating ?? "",
      aiRating: firstMetric?.aiRating ?? "",
      ratingSource: firstMetric?.ratingSource ?? "none",
      aiAnalysisStatus: firstMetric?.aiAnalysisStatus ?? "pending",
      aiSummary: firstMetric?.aiSummary ?? "",
      aiActionSuggestion: firstMetric?.aiActionSuggestion ?? "",
      manualActionSuggestion: firstMetric?.manualActionSuggestion ?? "",
      aiRiskNotes: firstMetric?.aiRiskNotes ?? "",
      warningType: firstMetric?.warningType ?? "",
      warningLevel: firstMetric?.warningLevel ?? "",
      decisionOwner: firstMetric?.decisionOwner ?? "",
      decisionDeadline: firstMetric?.decisionDeadline?.toISOString() ?? null,
      nextBudgetBase: firstMetric?.nextBudgetBase === null || firstMetric?.nextBudgetBase === undefined ? null : toNumber(firstMetric.nextBudgetBase),
      budgetAdjustReason: firstMetric?.budgetAdjustReason ?? "",
      aiAnalyzedAt: firstMetric?.aiAnalyzedAt?.toISOString() ?? null,
      quarter: quarterTotals,
      remark: firstMetric?.remark ?? "",
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
