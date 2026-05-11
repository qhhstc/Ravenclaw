import type { NextRequest } from "next/server";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, parseOptionalInt, parsePositiveInt, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type DashboardFilters = {
  year: number;
  month: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  countryCode?: string;
};

function parseFilters(params: URLSearchParams): DashboardFilters {
  return {
    year: parsePositiveInt(params.get("year"), 2026),
    month: Math.min(Math.max(parsePositiveInt(params.get("month"), 5), 1), 12),
    brandId: parseOptionalInt(params.get("brandId")),
    platformId: parseOptionalInt(params.get("platformId")),
    storeId: parseOptionalInt(params.get("storeId")),
    countryCode: params.get("countryCode")?.trim() || undefined,
  };
}

function channelWhere(filters: DashboardFilters) {
  return {
    status: "active",
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.platformId ? { platformId: filters.platformId } : {}),
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const channels = await prisma.channel.findMany({
      where: channelWhere(filters),
      select: {
        id: true,
        businessLine: true,
        channelName: true,
        sortOrder: true,
        brand: { select: { id: true, name: true } },
        platform: { select: { id: true, name: true } },
        store: { select: { id: true, name: true, primaryMarketCode: true } },
      },
      orderBy: [{ businessLine: "asc" }, { sortOrder: "asc" }],
    });

    const channelIds = channels.map((channel) => channel.id);
    const metrics = channelIds.length
      ? await prisma.channelMetricPeriod.findMany({
          where: {
            year: filters.year,
            month: filters.month,
            periodType: PERIOD_TYPE_WEEK,
            weekNumber: { in: [...WEEK_NUMBERS] },
            channelId: { in: channelIds },
            ...(filters.countryCode ? { countryCode: filters.countryCode } : {}),
          },
          select: {
            channelId: true,
            weekNumber: true,
            salesAmountBase: true,
            adSpendBase: true,
          },
        })
      : [];

    const metricsByChannel = new Map<number, typeof metrics>();
    metrics.forEach((metric) => {
      const current = metricsByChannel.get(metric.channelId) ?? [];
      current.push(metric);
      metricsByChannel.set(metric.channelId, current);
    });

    const totalSales = metrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
    const totalAdSpend = metrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0);
    const channelsWithData = new Set(metrics.map((metric) => metric.channelId));
    const paidChannelIds = new Set(metrics.filter((metric) => toNumber(metric.adSpendBase) > 0).map((metric) => metric.channelId));

    const weeklyTrend = WEEK_NUMBERS.map((weekNumber) => {
      const weekMetrics = metrics.filter((metric) => metric.weekNumber === weekNumber);
      return {
        weekNumber,
        week: `W${weekNumber}`,
        salesAmount: weekMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0),
        adSpend: weekMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0),
      };
    });

    const businessLineMap = new Map<string, number>();
    channels.forEach((channel) => {
      const line = channel.businessLine || "其他";
      const salesAmount = (metricsByChannel.get(channel.id) ?? []).reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0);
      businessLineMap.set(line, (businessLineMap.get(line) ?? 0) + salesAmount);
    });
    const businessLineShare = Array.from(businessLineMap.entries())
      .map(([name, salesAmount]) => ({
        name,
        salesAmount,
        ratio: totalSales > 0 ? salesAmount / totalSales : 0,
      }))
      .filter((item) => item.salesAmount > 0)
      .sort((a, b) => b.salesAmount - a.salesAmount);

    const channelSummaries = channels.map((channel) => {
      const channelMetrics = metricsByChannel.get(channel.id) ?? [];
      const weeks = Object.fromEntries(
        WEEK_NUMBERS.map((weekNumber) => {
          const weekMetrics = channelMetrics.filter((metric) => metric.weekNumber === weekNumber);
          return [
            String(weekNumber),
            {
              salesAmount: weekMetrics.reduce((sum, metric) => sum + toNumber(metric.salesAmountBase), 0),
              adSpend: weekMetrics.reduce((sum, metric) => sum + toNumber(metric.adSpendBase), 0),
            },
          ];
        }),
      );
      const monthSales = Object.values(weeks).reduce((sum, week) => sum + week.salesAmount, 0);
      const monthAdSpend = Object.values(weeks).reduce((sum, week) => sum + week.adSpend, 0);
      return {
        channelId: channel.id,
        businessLine: channel.businessLine || "其他",
        channelName: channel.channelName,
        storeName: channel.store?.name ?? "-",
        brandName: channel.brand?.name ?? "-",
        platformName: channel.platform?.name ?? "-",
        weeks,
        monthSales,
        monthAdSpend,
        roi: ratio(monthSales, monthAdSpend),
      };
    });

    const roiRanking = channelSummaries
      .filter((item) => item.monthAdSpend > 0)
      .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))
      .slice(0, 8)
      .map((item, index) => ({
        rank: index + 1,
        channelId: item.channelId,
        channelName: item.channelName,
        storeName: item.storeName,
        salesAmount: item.monthSales,
        adSpend: item.monthAdSpend,
        roi: item.roi,
      }));

    const weeklyTable = channelSummaries
      .filter((item) => item.monthSales > 0 || item.monthAdSpend > 0)
      .sort((a, b) => b.monthSales - a.monthSales)
      .slice(0, 8);

    return Response.json({
      filters,
      kpis: {
        salesAmount: totalSales,
        adSpend: totalAdSpend,
        roi: ratio(totalSales, totalAdSpend),
        adSpendRatio: totalSales > 0 ? totalAdSpend / totalSales : null,
        channelCount: filters.countryCode ? channelsWithData.size : channels.length,
        paidChannelCount: paidChannelIds.size,
      },
      weeklyTrend,
      businessLineShare,
      roiRanking,
      weeklyTable,
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "获取经营看板数据失败" },
      { status: 400 },
    );
  }
}
