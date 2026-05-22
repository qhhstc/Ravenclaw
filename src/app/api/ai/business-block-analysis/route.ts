import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { analyzeBusinessBlocks } from "@/lib/ai/anthropic-client";
import { businessBlockOptions, inferBusinessBlock, ratio } from "@/lib/business-blocks";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, currentPeriod, parseOptionalInt, parsePositiveInt, quarterFromMonth, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";
import { canManageAccounts, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

type MetricWithChannel = Awaited<ReturnType<typeof fetchMetrics>>[number];
type BlockSnapshot = ReturnType<typeof buildBlockSnapshots>[number];

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function previousMonth(year: number, month: number) {
  if (month > 1) return { year, month: month - 1 };
  return { year: year - 1, month: 12 };
}

function parseInput(input: { year?: number; month?: number; brandId?: number | string | null }) {
  const fallback = currentPeriod();
  const month = Math.min(Math.max(parsePositiveInt(String(input.month || ""), fallback.month), 1), 12);
  return {
    year: parsePositiveInt(String(input.year || ""), fallback.year),
    month,
    quarter: quarterFromMonth(month),
    brandId: input.brandId === null || input.brandId === undefined ? undefined : parseOptionalInt(String(input.brandId)),
  };
}

async function fetchMetrics(filters: { year: number; month: number; brandId?: number }) {
  return prisma.channelMetricPeriod.findMany({
    where: {
      year: filters.year,
      month: filters.month,
      periodType: PERIOD_TYPE_WEEK,
      weekNumber: { in: [...WEEK_NUMBERS] },
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
    },
    include: {
      channel: {
        select: {
          id: true,
          businessLine: true,
          channelName: true,
          channelType: true,
          platform: { select: { name: true } },
          store: { select: { storeType: true } },
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

function groupedByBlock(metrics: MetricWithChannel[]) {
  const grouped = new Map<string, MetricWithChannel[]>();
  metrics.forEach((metric) => {
    const block = metricBlock(metric);
    grouped.set(block, [...(grouped.get(block) ?? []), metric]);
  });
  return grouped;
}

function decimal(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? null : new Prisma.Decimal(value);
}

function money(value: number) {
  return new Prisma.Decimal(roundMoney(value));
}

function blockWarningLevel(snapshot: BlockSnapshot, riskNotes: string[], rating: string | null) {
  if (snapshot.grossProfit < 0) return "D";
  if (rating === "C") return "C";
  if ((snapshot.roi !== null && snapshot.roi < 1) || (snapshot.monthOverMonth !== null && snapshot.monthOverMonth < -0.2)) return "C";
  if (riskNotes.length > 0 || rating === "B") return "B";
  return "A";
}

function fallbackWarning(snapshot: BlockSnapshot) {
  if (snapshot.grossProfit < 0) return "系统规则：经营毛利为负";
  if (snapshot.roi !== null && snapshot.roi < 1) return "系统规则：ROI 偏低";
  if (snapshot.monthOverMonth !== null && snapshot.monthOverMonth < -0.2) return "系统规则：环比下滑超过 20%";
  return "";
}

function buildBlockSnapshots(metrics: MetricWithChannel[], previousMetrics: MetricWithChannel[]) {
  const grouped = groupedByBlock(metrics);
  const previousGrouped = groupedByBlock(previousMetrics);
  const totalSales = metrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);

  return businessBlockOptions.map((option) => {
    const blockMetrics = grouped.get(option.value) ?? [];
    const salesAmount = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const adSpend = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    const productCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.productCostBase), 0);
    const otherCost = blockMetrics.reduce((sum, metric) => sum + toNumber(metric.otherCostBase), 0);
    const grossProfit = salesAmount - adSpend - productCost - otherCost;
    const previousSales = (previousGrouped.get(option.value) ?? []).reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const firstMetric = blockMetrics.find((metric) => metric.weekNumber === 1) ?? blockMetrics[0];

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
      currentAdSpend: roundMoney(adSpend),
      nextBudget: null as number | null,
      remark: firstMetric?.remark ?? null,
    };
  });
}

async function updatePlanStatus(filters: ReturnType<typeof parseInput>, snapshot: BlockSnapshot, status: string) {
  const brandId = filters.brandId ?? null;
  const existing = await prisma.businessBlockPlan.findFirst({
    where: { year: filters.year, month: filters.month, brandId, businessBlock: snapshot.businessBlock },
    select: { id: true },
  });
  const data = {
    quarter: filters.quarter,
    brandId,
    salesAmountBase: money(snapshot.salesAmount),
    adSpendBase: money(snapshot.adSpend),
    productCostBase: money(snapshot.productCost),
    otherCostBase: money(snapshot.otherCost),
    grossProfitBase: money(snapshot.grossProfit),
    grossMargin: decimal(snapshot.grossMargin),
    roi: decimal(snapshot.roi),
    monthOverMonth: decimal(snapshot.monthOverMonth),
    aiAnalysisStatus: status,
  };
  if (existing) {
    await prisma.businessBlockPlan.update({ where: { id: existing.id }, data });
    return;
  }
  await prisma.businessBlockPlan.create({
    data: { year: filters.year, month: filters.month, businessBlock: snapshot.businessBlock, ...data },
  });
}

async function writeBusinessWarning(filters: ReturnType<typeof parseInput>, snapshot: BlockSnapshot, analysis: { rating: string | null; summary: string; riskNotes: string[]; actionSuggestion: string }) {
  const warningText = analysis.riskNotes[0] || fallbackWarning(snapshot);
  if (!warningText) return;
  await prisma.businessWarning.create({
    data: {
      year: filters.year,
      month: filters.month,
      brandId: filters.brandId ?? null,
      businessBlock: snapshot.businessBlock,
      warningType: warningText,
      warningLevel: blockWarningLevel(snapshot, analysis.riskNotes, analysis.rating),
      currentValue: money(snapshot.grossProfit),
      monthOverMonth: decimal(snapshot.monthOverMonth),
      aiActionSuggestion: analysis.actionSuggestion,
      aiSummary: analysis.summary,
      aiRiskNotes: analysis.riskNotes,
      aiAnalysisStatus: "completed",
      remark: analysis.riskNotes.length ? "AI 风险提示" : "系统规则生成",
    },
  });
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  let filters: ReturnType<typeof parseInput> | null = null;
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("只有管理员可以触发全局四板块 AI 分析");
    filters = parseInput((await request.json()) as { year?: number; month?: number; brandId?: number | string | null });

    console.info(`[AI] business-block-analysis start year=${filters.year} month=${filters.month} brandId=${filters.brandId ?? "all"}`);

    const previous = previousMonth(filters.year, filters.month);
    const [metrics, previousMetrics] = await Promise.all([
      fetchMetrics(filters),
      fetchMetrics({ year: previous.year, month: previous.month, brandId: filters.brandId }),
    ]);

    if (!metrics.length) throw new Error("当前筛选范围暂无四板块经营数据，无法分析");

    const snapshots = buildBlockSnapshots(metrics, previousMetrics);
    await Promise.all(snapshots.map((snapshot) => updatePlanStatus(filters!, snapshot, "analyzing")));

    const analyses = await analyzeBusinessBlocks({ year: filters.year, month: filters.month, blocks: snapshots });
    const validAnalyses = analyses.filter((item) => businessBlockOptions.some((option) => option.value === item.businessBlock));
    const analysisMap = new Map(validAnalyses.map((analysis) => [analysis.businessBlock, analysis]));

    await prisma.businessWarning.deleteMany({ where: { year: filters.year, month: filters.month, brandId: filters.brandId ?? null } });

    await Promise.all(
      snapshots.map(async (snapshot) => {
        const analysis = analysisMap.get(snapshot.businessBlock);
        if (!analysis) {
          await updatePlanStatus(filters!, snapshot, "failed");
          return;
        }
        const nextBudget = analysis.budgetSuggestion?.nextBudget ?? null;
        const adjustAmount = nextBudget === null ? null : nextBudget - snapshot.adSpend;
        const existing = await prisma.businessBlockPlan.findFirst({
          where: { year: filters!.year, month: filters!.month, brandId: filters!.brandId ?? null, businessBlock: snapshot.businessBlock },
          select: { id: true },
        });
        const data = {
          quarter: filters!.quarter,
          brandId: filters!.brandId ?? null,
          salesAmountBase: money(snapshot.salesAmount),
          adSpendBase: money(snapshot.adSpend),
          productCostBase: money(snapshot.productCost),
          otherCostBase: money(snapshot.otherCost),
          grossProfitBase: money(snapshot.grossProfit),
          grossMargin: decimal(snapshot.grossMargin),
          roi: decimal(snapshot.roi),
          monthOverMonth: decimal(snapshot.monthOverMonth),
          aiRating: analysis.rating,
          aiSummary: analysis.summary,
          aiActionSuggestion: analysis.actionSuggestion,
          aiRiskNotes: analysis.riskNotes,
          aiAnalysisStatus: "completed",
          aiAnalyzedAt: new Date(),
          nextBudgetBase: decimal(nextBudget),
          budgetAdjustAmount: decimal(adjustAmount),
          budgetAdjustRatio: snapshot.adSpend > 0 && adjustAmount !== null ? decimal(adjustAmount / snapshot.adSpend) : null,
          budgetAdjustReason: analysis.budgetSuggestion?.reason ?? null,
        };
        if (existing) await prisma.businessBlockPlan.update({ where: { id: existing.id }, data });
        else await prisma.businessBlockPlan.create({ data: { year: filters!.year, month: filters!.month, businessBlock: snapshot.businessBlock, ...data } });
        await writeBusinessWarning(filters!, snapshot, analysis);
      }),
    );

    console.info(`[AI] business-block-analysis completed duration=${Math.round(performance.now() - startedAt)}ms blocks=${validAnalyses.length}`);
    return NextResponse.json({ blockAnalyses: validAnalyses, message: `已完成 ${validAnalyses.length} 个板块 AI 分析` });
  } catch (error) {
    if (filters) {
      await prisma.businessBlockPlan.updateMany({
        where: { year: filters.year, month: filters.month, brandId: filters.brandId ?? null },
        data: { aiAnalysisStatus: "failed" },
      }).catch(() => undefined);
    }
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 400;
    return NextResponse.json({ message: error instanceof Error ? error.message : "四板块 AI 分析失败" }, { status });
  }
}
