import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { analyzeChannelData, getAiModelName } from "@/lib/ai/anthropic-client";
import { inferBusinessBlock, ratio } from "@/lib/business-blocks";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, currentPeriod, parsePositiveInt, quarterFromMonth, toNumber } from "@/lib/channel-data";
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
    const fallback = currentPeriod();
    year = parsePositiveInt(String(input.year || ""), fallback.year);
    month = Math.min(Math.max(parsePositiveInt(String(input.month || ""), fallback.month), 1), 12);
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
    const allMonthMetrics = await prisma.channelMetricPeriod.findMany({ where: { year, month, periodType: PERIOD_TYPE_WEEK }, select: { salesAmountBase: true } });
    const totalSales = allMonthMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const previousMonth = month > 1 ? { year, month: month - 1 } : { year: year - 1, month: 12 };
    const previousMetrics = await prisma.channelMetricPeriod.findMany({ where: { ...previousMonth, channelId, periodType: PERIOD_TYPE_WEEK }, select: { salesAmountBase: true, adSpendBase: true } });
    const previousSales = previousMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const previousAdSpend = previousMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    const previousRoi = ratio(previousSales, previousAdSpend);
    const currentRoi = ratio(salesAmount, adSpend);
    const quarter = quarterFromMonth(month);
    const quarterMetrics = await prisma.channelMetricPeriod.findMany({ where: { year, quarter, channelId, periodType: PERIOD_TYPE_WEEK }, select: { salesAmountBase: true, adSpendBase: true } });
    const quarterSales = quarterMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const quarterAdSpend = quarterMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    // 数据覆盖:渠道只有销售/广告,不录成本
    const filledWeeks = metrics.filter((metric) => toNumber(metric.salesAmountBase) > 0 || toNumber(metric.adSpendBase) > 0).length;
    const dataCoverage = {
      filledWeeks,
      totalWeeks: WEEK_NUMBERS.length,
      hasCost: false, // 渠道数据不录成本,固定 false
      hasPreviousMonth: previousMetrics.length > 0,
    };
    const businessBlock = input.businessBlock || inferBusinessBlock({ businessBlock: firstMetric.businessBlock, businessLine: firstMetric.channel.businessLine, platformName: firstMetric.channel.platform?.name, storeType: firstMetric.channel.store?.storeType, channelType: firstMetric.channel.channelType });

    const result = await analyzeChannelData({
      year,
      month,
      businessBlock,
      channelName: firstMetric.channel.channelName,
      currency: "CNY",
      weeks: metrics.map((metric) => ({ weekNumber: metric.weekNumber || 0, salesAmount: toNumber(metric.salesAmountBase), adSpend: toNumber(metric.adSpendBase) })),
      monthSales: roundMoney(salesAmount),
      monthAdSpend: roundMoney(adSpend),
      roi: currentRoi,
      adSpendRatio: ratio(adSpend, salesAmount),
      salesShare: ratio(salesAmount, totalSales),
      productCost: 0,
      otherCost: 0,
      grossProfit: 0,
      grossMargin: null,
      monthOverMonth: previousSales > 0 ? (salesAmount - previousSales) / previousSales : null,
      roiMonthOverMonth: previousRoi !== null && previousRoi > 0 && currentRoi !== null ? (currentRoi - previousRoi) / previousRoi : null,
      grossMarginMonthOverMonth: null,
      adSpendMonthOverMonth: previousAdSpend > 0 ? (adSpend - previousAdSpend) / previousAdSpend : null,
      quarterSales: roundMoney(quarterSales),
      quarterAdSpend: roundMoney(quarterAdSpend),
      dataCoverage,
      manualRating: firstMetric.manualRating,
      remark: firstMetric.remark,
      decisionOwner: firstMetric.decisionOwner,
      decisionDeadline: firstMetric.decisionDeadline?.toISOString() || null,
    });

    const coverageText = `数据覆盖 ${dataCoverage.filledWeeks}/${dataCoverage.totalWeeks} 周${dataCoverage.hasPreviousMonth ? "" : " · 无上月可比"}`;
    const aiModel = getAiModelName() || null;
    // 渠道级预警:rating=C 或 ROI<1(投放口径)时生成预警
    const channelBrandId = firstMetric.brandId ?? null;
    const roiValue = currentRoi ?? 0;
    const needWarning = result.rating === "C" || (adSpend > 0 && roiValue < 1);
    const warningLevel = adSpend > 0 && roiValue < 1 ? "C" : "C";
    const warningType = adSpend > 0 && roiValue < 1 ? `渠道 ROI ${roiValue.toFixed(2)} 低于 1` : result.riskNotes[0] || "渠道评级为 C，需关注";
    // 两步写回包进单事务,避免部分成功留下"已完成却缺预算"的不一致状态
    await prisma.$transaction([
      prisma.channelMetricPeriod.updateMany({
        where: { year, month, channelId, periodType: PERIOD_TYPE_WEEK },
        data: {
          aiRating: result.rating,
          ratingSource: result.rating ? "ai" : "none",
          aiAnalysisStatus: "completed",
          aiSummary: result.summary,
          aiActionSuggestion: result.actionSuggestion,
          aiRiskNotes: JSON.stringify(result.riskNotes),
          aiAnalyzedAt: new Date(),
          aiModel,
          aiConfidence: result.confidence,
          aiDataCoverage: coverageText,
          aiRatingReason: result.ratingReason || null,
        },
      }),
      prisma.channelMetricPeriod.updateMany({
        where: { year, month, channelId, periodType: PERIOD_TYPE_WEEK, weekNumber: 1 },
        data: {
          nextBudgetBase: result.budgetSuggestion ? new Prisma.Decimal(result.budgetSuggestion.nextBudget) : null,
          budgetAdjustReason: result.budgetSuggestion?.reason ?? null,
        },
      }),
      // 先清该渠道当月旧的渠道级预警,避免重复
      prisma.businessWarning.deleteMany({ where: { year, month, channelId } }),
      ...(needWarning
        ? [
            prisma.businessWarning.create({
              data: {
                year,
                month,
                brandId: channelBrandId,
                businessBlock,
                channelId,
                warningType,
                warningLevel,
                currentValue: new Prisma.Decimal(roundMoney(currentRoi ?? 0)),
                aiActionSuggestion: result.actionSuggestion,
                aiSummary: result.summary,
                aiRiskNotes: result.riskNotes,
                aiAnalysisStatus: "completed",
                decisionOwner: firstMetric.decisionOwner,
                decisionDeadline: firstMetric.decisionDeadline,
                remark: `渠道:${firstMetric.channel.channelName}`,
              },
            }),
          ]
        : []),
    ]);

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
