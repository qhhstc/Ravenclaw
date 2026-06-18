import { Prisma } from "@prisma/client";
import { businessBlockOptions, inferBusinessBlock } from "@/lib/business-blocks";
import { prisma } from "@/lib/prisma";

// 板块业务排序:亚马逊 → 独立站 → TikTok → B端(沿用 businessBlockOptions 的定义顺序)
const BUSINESS_BLOCK_ORDER = businessBlockOptions.map((option) => option.value) as string[];

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
    NOT: {
      AND: [{ businessLine: "默认业务线" }, { channelName: "默认渠道" }],
    },
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
    orderBy: [{ sortOrder: "asc" }, { businessLine: "asc" }, { channelName: "asc" }, { brand: { name: "asc" } }, { platform: { name: "asc" } }, { store: { name: "asc" } }],
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
    // 成本/预算/汇率只写在 week1 行,读取必须固定取 week1,不能用偏向"有内容"的 firstMetric(可能命中 week3 导致读成 0)
    const week1Metric = channelMetrics.find((metric) => metric.weekNumber === 1) ?? firstMetric;
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
      // 币种以实际录入的 metric 为准(原表导入的手动渠道常为 USD),无录入时再退回渠道推断
      currency: firstMetric?.currency ?? channel.store?.defaultCurrency ?? channel.brand?.defaultCurrency ?? "CNY",
      // 汇率随行回传,保存时才能正确重算 base(否则 POST 会把 exchangeRate 当 undefined 回落到 1,污染 salesAmountBase)
      exchangeRate: toNumber(week1Metric?.exchangeRate, 1) || 1,
      productCostBase: toNumber(week1Metric?.productCostBase),
      otherCostBase: toNumber(week1Metric?.otherCostBase),
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
      nextBudgetBase: week1Metric?.nextBudgetBase === null || week1Metric?.nextBudgetBase === undefined ? null : toNumber(week1Metric.nextBudgetBase),
      budgetAdjustReason: firstMetric?.budgetAdjustReason ?? "",
      aiAnalyzedAt: firstMetric?.aiAnalyzedAt?.toISOString() ?? null,
      aiModel: firstMetric?.aiModel ?? "",
      aiConfidence: firstMetric?.aiConfidence ?? "",
      aiDataCoverage: firstMetric?.aiDataCoverage ?? "",
      aiRatingReason: firstMetric?.aiRatingReason ?? "",
      quarter: quarterTotals,
      remark: firstMetric?.remark ?? "",
      weeks,
    };
  }).sort((firstRow, secondRow) => {
    // 先按归一化板块聚拢(让"亚马逊/Amazon"、"独立站/Shopify"等中英文同板块合到一起),
    // 再按板块原始名(channelGroup)、二级(businessLine),最后用 sortOrder 做同组内稳定次序。
    const blockOrder = (block: string) => {
      const index = BUSINESS_BLOCK_ORDER.indexOf(block);
      return index === -1 ? BUSINESS_BLOCK_ORDER.length : index;
    };
    const blockCompare = blockOrder(firstRow.businessBlock) - blockOrder(secondRow.businessBlock);
    if (blockCompare !== 0) return blockCompare;
    const groupCompare = (firstRow.channelGroup ?? "").localeCompare(secondRow.channelGroup ?? "", "zh-Hans-CN");
    if (groupCompare !== 0) return groupCompare;
    const lineCompare = (firstRow.businessLine ?? "").localeCompare(secondRow.businessLine ?? "", "zh-Hans-CN");
    if (lineCompare !== 0) return lineCompare;
    if (firstRow.sortOrder !== secondRow.sortOrder) return firstRow.sortOrder - secondRow.sortOrder;
    return `${firstRow.businessLine}-${firstRow.channelName}`.localeCompare(`${secondRow.businessLine}-${secondRow.channelName}`, "zh-Hans-CN");
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
