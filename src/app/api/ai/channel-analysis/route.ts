import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { analyzeChannelData } from "@/lib/ai/anthropic-client";
import { inferBusinessBlock, ratio } from "@/lib/business-blocks";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, parsePositiveInt, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";
import { canManageAccounts, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  let input: { year?: number; month?: number; channelId?: number | string; businessBlock?: string } | null = null;
  let year: number | null = null;
  let month: number | null = null;
  let channelId: number | null = null;
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能触发 AI 渠道分析");
    input = (await request.json()) as { year?: number; month?: number; channelId?: number | string; businessBlock?: string };
    year = parsePositiveInt(String(input.year || ""), 2026);
    month = Math.min(Math.max(parsePositiveInt(String(input.month || ""), 5), 1), 12);
    channelId = Number(input.channelId);
    if (!Number.isInteger(channelId)) throw new Error("channelId 不正确");

    console.info(`[AI] channel-analysis start year=${year} month=${month} channelId=${channelId}`);
    await prisma.channelMetricPeriod.updateMany({ where: { year, month, channelId, periodType: PERIOD_TYPE_WEEK }, data: { aiAnalysisStatus: "analyzing" } });

    const metrics = await prisma.channelMetricPeriod.findMany({
      where: { year, month, channelId, periodType: PERIOD_TYPE_WEEK, weekNumber: { in: [...WEEK_NUMBERS] } },
      orderBy: { weekNumber: "asc" },
      include: {
        channel: { include: { platform: { select: { name: true } }, store: { select: { storeType: true } } } },
      },
    });
    if (!metrics.length) throw new Error("未找到该渠道本月数据");

    const firstMetric = metrics[0];
    const salesAmount = metrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const adSpend = metrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    const productCost = metrics.reduce((sum, metric) => sum + toNumber(metric.productCostBase), 0);
    const otherCost = metrics.reduce((sum, metric) => sum + toNumber(metric.otherCostBase), 0);
    const grossProfit = salesAmount - adSpend - productCost - otherCost;
    const allMonthMetrics = await prisma.channelMetricPeriod.findMany({ where: { year, month, periodType: PERIOD_TYPE_WEEK }, select: { salesAmountBase: true } });
    const totalSales = allMonthMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const previousMonth = month > 1 ? { year, month: month - 1 } : { year: year - 1, month: 12 };
    const previousMetrics = await prisma.channelMetricPeriod.findMany({ where: { ...previousMonth, channelId, periodType: PERIOD_TYPE_WEEK }, select: { salesAmountBase: true } });
    const previousSales = previousMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const businessBlock = input.businessBlock || inferBusinessBlock({ businessBlock: firstMetric.businessBlock, businessLine: firstMetric.channel.businessLine, platformName: firstMetric.channel.platform?.name, storeType: firstMetric.channel.store?.storeType, channelType: firstMetric.channel.channelType });

    const result = await analyzeChannelData({
      year,
      month,
      businessBlock,
      channelName: firstMetric.channel.channelName,
      weeks: metrics.map((metric) => ({ weekNumber: metric.weekNumber || 0, salesAmount: toNumber(metric.salesAmountBase), adSpend: toNumber(metric.adSpendBase) })),
      monthSales: roundMoney(salesAmount),
      monthAdSpend: roundMoney(adSpend),
      roi: ratio(salesAmount, adSpend),
      adSpendRatio: ratio(adSpend, salesAmount),
      salesShare: ratio(salesAmount, totalSales),
      productCost: roundMoney(productCost),
      otherCost: roundMoney(otherCost),
      grossProfit: roundMoney(grossProfit),
      grossMargin: ratio(grossProfit, salesAmount),
      monthOverMonth: previousSales > 0 ? (salesAmount - previousSales) / previousSales : null,
      manualRating: firstMetric.manualRating,
      remark: firstMetric.remark,
      decisionOwner: firstMetric.decisionOwner,
      decisionDeadline: firstMetric.decisionDeadline?.toISOString() || null,
    });

    await prisma.channelMetricPeriod.updateMany({
      where: { year, month, channelId, periodType: PERIOD_TYPE_WEEK },
      data: {
        aiRating: result.rating,
        ratingSource: result.rating ? "ai" : "none",
        aiAnalysisStatus: "completed",
        aiSummary: result.summary,
        aiActionSuggestion: result.actionSuggestion,
        aiRiskNotes: JSON.stringify(result.riskNotes),
        aiAnalyzedAt: new Date(),
      },
    });
    await prisma.channelMetricPeriod.updateMany({
      where: { year, month, channelId, periodType: PERIOD_TYPE_WEEK, weekNumber: 1 },
      data: {
        nextBudgetBase: result.budgetSuggestion ? new Prisma.Decimal(result.budgetSuggestion.nextBudget) : null,
        budgetAdjustReason: result.budgetSuggestion?.reason ?? null,
      },
    });

    console.info(`[AI] channel-analysis completed duration=${Math.round(performance.now() - startedAt)}ms channelId=${channelId}`);
    return NextResponse.json({ result });
  } catch (error) {
    if (Number.isInteger(channelId) && year && month) {
      await prisma.channelMetricPeriod.updateMany({
        where: { year, month, channelId: channelId!, periodType: PERIOD_TYPE_WEEK },
        data: { aiAnalysisStatus: "failed" },
      }).catch(() => undefined);
    }
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 400;
    return NextResponse.json({ message: error instanceof Error ? error.message : "AI 渠道分析失败" }, { status });
  }
}
