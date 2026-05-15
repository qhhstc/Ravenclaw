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
type BusinessPlan = Awaited<ReturnType<typeof fetchPlans>>[number];
type BusinessWarning = Awaited<ReturnType<typeof fetchWarnings>>[number];

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

async function fetchPlans(filters: BusinessDashboardFilters) {
  return prisma.businessBlockPlan.findMany({
    where: { year: filters.year, month: filters.month, brandId: filters.brandId ?? null },
  });
}

async function fetchWarnings(filters: BusinessDashboardFilters) {
  return prisma.businessWarning.findMany({
    where: { year: filters.year, month: filters.month, brandId: filters.brandId ?? null },
    orderBy: [{ warningLevel: "desc" }, { updatedAt: "desc" }],
    take: 20,
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

function parseRiskNotes(value?: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").slice(0, 3);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  } catch {
    return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  }
}

function warningLevelValue(value?: string | null) {
  const level = value?.trim().toUpperCase();
  return level === "A" || level === "B" || level === "C" || level === "D" ? level : "";
}

function planMap(plans: BusinessPlan[]) {
  return new Map(plans.map((plan) => [plan.businessBlock, plan]));
}

function aggregateByBlock(metrics: MetricWithChannel[], previousSalesByBlock: Map<string, number>, plans: BusinessPlan[]) {
  const totalSales = metrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
  const grouped = new Map<string, MetricWithChannel[]>();
  const plansByBlock = planMap(plans);
  metrics.forEach((metric) => {
    const block = metricBlock(metric);
    grouped.set(block, [...(grouped.get(block) ?? []), metric]);
  });

  return businessBlockOptions.map((option) => {
    const blockMetrics = grouped.get(option.value) ?? [];
    const plan = plansByBlock.get(option.value);
    const salesAmount = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const adSpend = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    const productCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.productCostBase), 0);
    const otherCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.otherCostBase), 0);
    const grossProfit = salesAmount - adSpend - productCost - otherCost;
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
      rating: displayRating({ aiRating: plan?.aiRating, manualRating: plan?.manualRating }),
      keyAction: displayAction({ aiActionSuggestion: plan?.aiActionSuggestion, manualActionSuggestion: plan?.manualActionSuggestion }),
      aiAnalysisStatus: plan?.aiAnalysisStatus ?? "pending",
      aiSummary: plan?.aiSummary ?? "",
      aiRiskNotes: parseRiskNotes(plan?.aiRiskNotes),
      aiAnalyzedAt: plan?.aiAnalyzedAt?.toISOString() ?? null,
      nextBudget: plan?.nextBudgetBase === null || plan?.nextBudgetBase === undefined ? null : toNumber(plan.nextBudgetBase),
      budgetAdjustReason: plan?.budgetAdjustReason ?? "",
      remark: plan?.remark ?? "",
    };
  });
}

function buildFallbackWarnings(metrics: MetricWithChannel[]) {
  const grouped = new Map<string, MetricWithChannel[]>();
  metrics.forEach((metric) => {
    const block = metricBlock(metric);
    grouped.set(block, [...(grouped.get(block) ?? []), metric]);
  });

  return Array.from(grouped.entries())
    .map(([block, blockMetrics]) => {
      const salesAmount = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
      const adSpend = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
      const productCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.productCostBase), 0);
      const otherCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.otherCostBase), 0);
      const grossProfit = salesAmount - adSpend - productCost - otherCost;
      const roiValue = ratio(salesAmount, adSpend);
      const warningType = grossProfit < 0 ? "系统规则：经营毛利为负" : roiValue !== null && roiValue < 1 ? "系统规则：ROI 偏低" : "";
      if (!warningType) return null;
      return {
        businessBlock: block,
        blockName: businessBlockLabel(block),
        channelId: null,
        channelName: "-",
        warningType,
        currentValue: roundMoney(grossProfit),
        monthOverMonth: null,
        suggestedAction: "请结合渠道明细排查投放、成本和转化。",
        decisionOwner: "",
        decisionDeadline: null,
        warningLevel: grossProfit < 0 ? "D" : "C",
        remark: "系统规则生成",
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function buildWarnings(warnings: BusinessWarning[], metrics: MetricWithChannel[]) {
  if (!warnings.length) return buildFallbackWarnings(metrics);
  return warnings.map((warning) => ({
    businessBlock: warning.businessBlock,
    blockName: businessBlockLabel(warning.businessBlock),
    channelId: warning.channelId,
    channelName: "-",
    warningType: warning.warningType,
    currentValue: roundMoney(toNumber(warning.currentValue)),
    monthOverMonth: warning.monthOverMonth === null || warning.monthOverMonth === undefined ? null : toNumber(warning.monthOverMonth),
    suggestedAction: displayAction({ aiActionSuggestion: warning.aiActionSuggestion, manualActionSuggestion: warning.manualActionSuggestion }),
    decisionOwner: warning.decisionOwner || "",
    decisionDeadline: warning.decisionDeadline?.toISOString() ?? null,
    warningLevel: warningLevelValue(warning.warningLevel) || "B",
    remark: warning.remark || warning.aiSummary || "",
  }));
}

function buildBudgetSuggestions(blockPerformance: ReturnType<typeof aggregateByBlock>, plans: BusinessPlan[]) {
  const plansByBlock = planMap(plans);
  return blockPerformance.map((item) => {
    const plan = plansByBlock.get(item.businessBlock);
    const nextBudget = plan?.nextBudgetBase === null || plan?.nextBudgetBase === undefined ? null : toNumber(plan.nextBudgetBase);
    const adjustAmount = plan?.budgetAdjustAmount === null || plan?.budgetAdjustAmount === undefined ? (nextBudget === null ? null : nextBudget - item.adSpend) : toNumber(plan.budgetAdjustAmount);
    const adjustRatio = plan?.budgetAdjustRatio === null || plan?.budgetAdjustRatio === undefined ? (item.adSpend > 0 && adjustAmount !== null ? adjustAmount / item.adSpend : null) : toNumber(plan.budgetAdjustRatio);
    return {
      businessBlock: item.businessBlock,
      blockName: item.blockName,
      currentAdSpend: item.adSpend,
      nextBudget: nextBudget === null ? null : roundMoney(nextBudget),
      adjustAmount: adjustAmount === null ? null : roundMoney(adjustAmount),
      adjustRatio,
      adjustReason: plan?.budgetAdjustReason || "待填写 / 待 AI 分析",
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
  { field: "预算建议", description: "读取四板块经营计划中的下月建议预算和调整逻辑，后续由 AI 经营分析补充。" },
  { field: "AI 分析状态", description: "状态：pending / analyzing / completed / failed。" },
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
    const [metrics, previousMetrics, plans, warnings] = await Promise.all([
      fetchMetrics(filters),
      fetchMetrics(filters, previous.year, previous.month),
      fetchPlans(filters),
      fetchWarnings(filters),
    ]);
    const previousSalesByBlock = new Map<string, number>();
    previousMetrics.forEach((metric) => {
      const block = metricBlock(metric);
      previousSalesByBlock.set(block, (previousSalesByBlock.get(block) ?? 0) + toNumber(metric.salesAmountBase));
    });

    const blockPerformance = aggregateByBlock(metrics, previousSalesByBlock, plans);
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
      warnings: buildWarnings(warnings, metrics),
      budgetSuggestions: canViewBudget ? buildBudgetSuggestions(blockPerformance, plans) : [],
      fieldDefinitions,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: error instanceof Error ? error.message : "四板块经营数据加载失败" }, { status: 400 });
  } finally {
    logApiDuration("/api/dashboard/business-blocks", startedAt);
  }
}
