import type { NextRequest } from "next/server";
import { businessBlockLabel, businessBlockOptions, displayAction, displayRating, inferBusinessBlock, ratio } from "@/lib/business-blocks";
import { logApiDuration } from "@/lib/api-logger";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, parseOptionalInt, parsePositiveInt, quarterFromMonth, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";
import { ApiAuthError, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

type BusinessDashboardFilters = {
  year: number;
  month: number;
  quarter: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  countryCode?: string;
  currency?: string;
};

type MetricWithChannel = Awaited<ReturnType<typeof fetchMetrics>>[number];

function parseFilters(params: URLSearchParams): BusinessDashboardFilters {
  const month = Math.min(Math.max(parsePositiveInt(params.get("month"), 5), 1), 12);
  return {
    year: parsePositiveInt(params.get("year"), 2026),
    month,
    quarter: Math.min(Math.max(parsePositiveInt(params.get("quarter"), quarterFromMonth(month)), 1), 4),
    brandId: parseOptionalInt(params.get("brandId")),
    platformId: parseOptionalInt(params.get("platformId")),
    storeId: parseOptionalInt(params.get("storeId")),
    countryCode: params.get("countryCode")?.trim() || undefined,
    currency: params.get("currency")?.trim() || undefined,
  };
}

function previousMonth(filters: BusinessDashboardFilters) {
  if (filters.month > 1) return { year: filters.year, month: filters.month - 1 };
  return { year: filters.year - 1, month: 12 };
}

async function fetchMetrics(filters: BusinessDashboardFilters, year = filters.year, month = filters.month) {
  return prisma.channelMetricPeriod.findMany({
    where: {
      year,
      month,
      periodType: PERIOD_TYPE_WEEK,
      weekNumber: { in: [...WEEK_NUMBERS] },
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.platformId ? { platformId: filters.platformId } : {}),
      ...(filters.storeId ? { storeId: filters.storeId } : {}),
      ...(filters.countryCode ? { countryCode: filters.countryCode } : {}),
      ...(filters.currency ? { currency: filters.currency } : {}),
    },
    include: {
      channel: {
        select: {
          id: true,
          businessLine: true,
          channelGroup: true,
          channelName: true,
          channelType: true,
          platform: { select: { id: true, name: true } },
          store: { select: { id: true, name: true, storeType: true } },
        },
      },
    },
  });
}

function metricBlock(metric: MetricWithChannel) {
  return inferBusinessBlock({
    businessBlock: metric.businessBlock,
    businessLine: metric.channel.businessLine,
    platformName: metric.channel.platform?.name,
    storeType: metric.channel.store?.storeType,
    channelType: metric.channel.channelType,
  });
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function warningLevelValue(value?: string | null) {
  const level = value?.trim().toUpperCase();
  return level === "A" || level === "B" || level === "C" || level === "D" ? level : "";
}

function aggregateByBlock(metrics: MetricWithChannel[], previousSalesByBlock: Map<string, number>) {
  const totalSales = metrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
  const grouped = new Map<string, MetricWithChannel[]>();
  metrics.forEach((metric) => {
    const block = metricBlock(metric);
    grouped.set(block, [...(grouped.get(block) ?? []), metric]);
  });

  return businessBlockOptions.map((option) => {
    const blockMetrics = grouped.get(option.value) ?? [];
    const salesAmount = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const adSpend = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    const productCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.productCostBase), 0);
    const otherCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.otherCostBase), 0);
    const grossProfit = salesAmount - adSpend - productCost - otherCost;
    const ratingMetric = blockMetrics.find((metric) => metric.aiRating || metric.manualRating) ?? blockMetrics[0];
    const actionMetric = blockMetrics.find((metric) => metric.aiActionSuggestion || metric.manualActionSuggestion) ?? blockMetrics[0];
    const previousSales = previousSalesByBlock.get(option.value) ?? 0;

    return {
      businessBlock: option.value,
      blockName: option.label,
      salesAmount: roundMoney(salesAmount),
      salesShare: ratio(salesAmount, totalSales),
      adSpend: roundMoney(adSpend),
      productCost: roundMoney(productCost),
      otherCost: roundMoney(otherCost),
      grossProfit: roundMoney(grossProfit),
      grossMargin: ratio(grossProfit, salesAmount),
      roi: ratio(salesAmount, adSpend),
      monthOverMonth: previousSales > 0 ? (salesAmount - previousSales) / previousSales : null,
      rating: displayRating({ aiRating: ratingMetric?.aiRating, manualRating: ratingMetric?.manualRating, ratingSource: ratingMetric?.ratingSource }),
      keyAction: displayAction({ aiActionSuggestion: actionMetric?.aiActionSuggestion, manualActionSuggestion: actionMetric?.manualActionSuggestion }),
      aiAnalysisStatus: ratingMetric?.aiAnalysisStatus ?? "pending",
      aiAnalyzedAt: ratingMetric?.aiAnalyzedAt?.toISOString() ?? null,
    };
  });
}

function buildWarnings(metrics: MetricWithChannel[]) {
  const grouped = new Map<number, MetricWithChannel[]>();
  metrics.forEach((metric) => grouped.set(metric.channelId, [...(grouped.get(metric.channelId) ?? []), metric]));

  return Array.from(grouped.values())
    .map((channelMetrics) => {
      const firstMetric = channelMetrics.find((metric) => metric.warningLevel || metric.warningType || metric.manualActionSuggestion || metric.decisionDeadline) ?? channelMetrics[0];
      const salesAmount = channelMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
      const adSpend = channelMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
      const productCost = channelMetrics.reduce((sum, metric) => sum + toNumber(metric.productCostBase), 0);
      const otherCost = channelMetrics.reduce((sum, metric) => sum + toNumber(metric.otherCostBase), 0);
      const grossProfit = salesAmount - adSpend - productCost - otherCost;
      const roiValue = ratio(salesAmount, adSpend);
      const warningType = firstText(firstMetric.warningType, grossProfit < 0 ? "经营毛利为负" : null, roiValue !== null && roiValue < 1 ? "ROI 偏低" : null);
      const warningLevel = firstText(warningLevelValue(firstMetric.warningLevel), grossProfit < 0 ? "D" : roiValue !== null && roiValue < 1 ? "C" : null);
      if (!warningType && !warningLevel && !firstMetric.manualActionSuggestion && !firstMetric.aiActionSuggestion) return null;

      return {
        businessBlock: metricBlock(firstMetric),
        blockName: businessBlockLabel(metricBlock(firstMetric)),
        channelId: firstMetric.channelId,
        channelName: firstMetric.channel.channelName,
        warningType: warningType || "待 AI 分析",
        currentValue: roundMoney(salesAmount),
        monthOverMonth: null,
        suggestedAction: displayAction({ aiActionSuggestion: firstMetric.aiActionSuggestion, manualActionSuggestion: firstMetric.manualActionSuggestion }),
        decisionOwner: firstMetric.decisionOwner || "-",
        decisionDeadline: firstMetric.decisionDeadline?.toISOString() ?? null,
        warningLevel: warningLevel || "B",
        remark: firstMetric.remark || "",
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function buildBudgetSuggestions(blockPerformance: ReturnType<typeof aggregateByBlock>, metrics: MetricWithChannel[]) {
  const nextBudgetByBlock = new Map<string, { nextBudget: number; reason: string }>();
  metrics
    .filter((metric) => metric.weekNumber === 1)
    .forEach((metric) => {
      const block = metricBlock(metric);
      const current = nextBudgetByBlock.get(block) ?? { nextBudget: 0, reason: "" };
      current.nextBudget += toNumber(metric.nextBudgetBase);
      current.reason = current.reason || metric.budgetAdjustReason || "";
      nextBudgetByBlock.set(block, current);
    });

  return blockPerformance.map((item) => {
    const budget = nextBudgetByBlock.get(item.businessBlock) ?? { nextBudget: 0, reason: "" };
    const adjustAmount = budget.nextBudget - item.adSpend;
    return {
      businessBlock: item.businessBlock,
      blockName: item.blockName,
      currentAdSpend: item.adSpend,
      nextBudget: budget.nextBudget > 0 ? roundMoney(budget.nextBudget) : null,
      adjustAmount: budget.nextBudget > 0 ? roundMoney(adjustAmount) : null,
      adjustRatio: item.adSpend > 0 && budget.nextBudget > 0 ? adjustAmount / item.adSpend : null,
      adjustReason: budget.reason || "待填写 / 待 AI 分析",
    };
  });
}

const fieldDefinitions = [
  { field: "销售额", description: "当前筛选范围内渠道周报 W1-W5 销售额合计。" },
  { field: "广告投入", description: "当前筛选范围内渠道周报 W1-W5 广告费合计。" },
  { field: "产品成本", description: "渠道周期数据中的产品成本合计，暂由手动录入或导入维护。" },
  { field: "其他成本", description: "渠道周期数据中的其他成本合计，空值按 0 计算。" },
  { field: "经营毛利", description: "销售额 - 广告投入 - 产品成本 - 其他成本。" },
  { field: "毛利率", description: "经营毛利 ÷ 销售额；销售额为 0 时显示 —。" },
  { field: "ROI", description: "销售额 ÷ 广告投入；广告投入为 0 时显示 —。" },
  { field: "广告占销", description: "广告投入 ÷ 销售额；销售额为 0 时显示 —。" },
  { field: "销售占比", description: "当前板块销售额 ÷ 全部板块销售额。" },
  { field: "环比上月", description: "当前月销售额相对上月销售额的变化比例。" },
  { field: "SABC 评级", description: "当前版本支持手动评级，后续接入 AI API 后可自动生成评级和建议动作。" },
  { field: "预算建议", description: "当前版本支持手动维护下月建议预算和调整逻辑，后续由 AI 经营分析补充。" },
  { field: "AI 分析状态", description: "预留状态：pending / analyzing / completed / failed。当前不调用真实 AI API。" },
];

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const session = await requireApiSession();
    const filters = parseFilters(request.nextUrl.searchParams);
    const canViewGlobal = session.role === "admin" || session.role === "finance";
    const canViewProfit = session.role === "admin" || session.role === "finance";
    const canViewBudget = session.role === "admin";
    const canEditDecisions = session.role === "admin";

    if (!canViewGlobal) {
      return Response.json({
        filters,
        visibility: { role: session.role, scope: "limited", canViewGlobal, canViewProfit, canViewBudget, canEditDecisions },
        totals: null,
        blockPerformance: [],
        warnings: [],
        budgetSuggestions: [],
        fieldDefinitions,
        message: "当前角色只能查看自己负责范围的数据，已隐藏公司整体经营毛利、预算建议和全局经营表现。",
      });
    }

    const previous = previousMonth(filters);
    const [metrics, previousMetrics] = await Promise.all([fetchMetrics(filters), fetchMetrics(filters, previous.year, previous.month)]);
    const previousSalesByBlock = new Map<string, number>();
    previousMetrics.forEach((metric) => {
      const block = metricBlock(metric);
      previousSalesByBlock.set(block, (previousSalesByBlock.get(block) ?? 0) + toNumber(metric.salesAmountBase));
    });

    const blockPerformance = aggregateByBlock(metrics, previousSalesByBlock);
    const totalSales = blockPerformance.reduce((sum, item) => sum + item.salesAmount, 0);
    const totalAdSpend = blockPerformance.reduce((sum, item) => sum + item.adSpend, 0);
    const totalProductCost = blockPerformance.reduce((sum, item) => sum + item.productCost, 0);
    const totalOtherCost = blockPerformance.reduce((sum, item) => sum + item.otherCost, 0);
    const totalGrossProfit = totalSales - totalAdSpend - totalProductCost - totalOtherCost;

    return Response.json({
      filters,
      visibility: { role: session.role, scope: "global", canViewGlobal, canViewProfit, canViewBudget, canEditDecisions },
      totals: {
        salesAmount: roundMoney(totalSales),
        adSpend: roundMoney(totalAdSpend),
        productCost: roundMoney(totalProductCost),
        otherCost: roundMoney(totalOtherCost),
        grossProfit: roundMoney(totalGrossProfit),
        grossMargin: ratio(totalGrossProfit, totalSales),
        roi: ratio(totalSales, totalAdSpend),
      },
      blockPerformance,
      warnings: buildWarnings(metrics),
      budgetSuggestions: canViewBudget ? buildBudgetSuggestions(blockPerformance, metrics) : [],
      fieldDefinitions,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: error instanceof Error ? error.message : "四板块经营数据加载失败" }, { status: 400 });
  } finally {
    logApiDuration("/api/dashboard/business-blocks", startedAt);
  }
}
