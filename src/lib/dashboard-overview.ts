import type { Prisma } from "@prisma/client";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, parseOptionalInt, parsePositiveInt, toNumber } from "@/lib/channel-data";
import { CLOSED_ORDER_STATUSES } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export type DashboardOverviewFilters = {
  year: number;
  month: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  countryCode?: string;
  currency?: string;
};

export type DashboardOverviewData = Awaited<ReturnType<typeof getDashboardOverviewData>>;

export function parseDashboardOverviewFilters(params: URLSearchParams): DashboardOverviewFilters {
  return {
    year: parsePositiveInt(params.get("year"), 2026),
    month: Math.min(Math.max(parsePositiveInt(params.get("month"), 5), 1), 12),
    brandId: parseOptionalInt(params.get("brandId")),
    platformId: parseOptionalInt(params.get("platformId")),
    storeId: parseOptionalInt(params.get("storeId")),
    countryCode: params.get("countryCode")?.trim() || undefined,
    currency: params.get("currency")?.trim() || undefined,
  };
}

function channelWhere(filters: DashboardOverviewFilters) {
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

function monthDateRange(year: number, month: number) {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function orderWhere(filters: DashboardOverviewFilters): Prisma.OrderWhereInput {
  const { start, end } = monthDateRange(filters.year, filters.month);
  return {
    orderStatus: { notIn: CLOSED_ORDER_STATUSES },
    orderDate: { gte: start, lt: end },
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.platformId ? { platformId: filters.platformId } : {}),
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.countryCode ? { countryCode: filters.countryCode } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
  };
}

function toBaseAmount(value: unknown, exchangeRate: unknown) {
  return toNumber(value) * toNumber(exchangeRate, 1);
}

export function hiddenDashboardOverview(filters: DashboardOverviewFilters) {
  return {
    filters,
    message: "当前角色已隐藏公司整体经营数据。",
    kpis: {
      salesAmount: 0,
      adSpend: 0,
      roi: null,
      adSpendRatio: null,
      channelCount: 0,
      paidChannelCount: 0,
      netProfit: 0,
      receivableAmount: 0,
      receivableCount: 0,
    },
    weeklyTrend: WEEK_NUMBERS.map((weekNumber) => ({ weekNumber, week: `W${weekNumber}`, salesAmount: 0, adSpend: 0 })),
    businessLineShare: [],
    roiRanking: [],
    weeklyTable: [],
  };
}

export async function getDashboardOverviewData(filters: DashboardOverviewFilters) {
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
          ...(filters.currency ? { currency: filters.currency } : {}),
        },
        select: {
          channelId: true,
          weekNumber: true,
          salesAmountBase: true,
          adSpendBase: true,
        },
      })
    : [];
  const orders = await prisma.order.findMany({
    where: orderWhere(filters),
    select: {
      grossProfit: true,
      unpaidAmount: true,
      exchangeRate: true,
    },
  });

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
  const netProfit = Number(orders.reduce((sum, order) => sum + toBaseAmount(order.grossProfit, order.exchangeRate), 0).toFixed(2));
  const receivableOrders = orders.filter((order) => toNumber(order.unpaidAmount) > 0);
  const receivableAmount = Number(receivableOrders.reduce((sum, order) => sum + toBaseAmount(order.unpaidAmount, order.exchangeRate), 0).toFixed(2));

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

  return {
    filters,
    kpis: {
      salesAmount: totalSales,
      adSpend: totalAdSpend,
      roi: ratio(totalSales, totalAdSpend),
      adSpendRatio: totalSales > 0 ? totalAdSpend / totalSales : null,
      channelCount: filters.countryCode ? channelsWithData.size : channels.length,
      paidChannelCount: paidChannelIds.size,
      netProfit,
      receivableAmount,
      receivableCount: receivableOrders.length,
    },
    weeklyTrend,
    businessLineShare,
    roiRanking,
    weeklyTable,
  };
}
