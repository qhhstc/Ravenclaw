import { Prisma } from "@prisma/client";
import { businessBlockLabel, inferBusinessBlock } from "@/lib/business-blocks";
import { buildChannelWhere, getMonthlyRows, PERIOD_TYPE_WEEK, WEEK_NUMBERS, toDecimal, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";

export type PublicChannelWeekInput = { weekNumber: number; salesAmountOriginal: number; adSpendOriginal: number };
export type PublicChannelRow = {
  channelId: number;
  businessBlock: string;
  businessBlockLabel: string;
  businessLine: string;
  channelName: string;
  owner: string;
  currency: string;
  exchangeRate: number;
  weeks: PublicChannelWeekInput[];
  filledWeeks: number;
  salesAmountBase: number;
  adSpendBase: number;
  roi: number | null;
  adRatio: number | null;
  status: "empty" | "partial" | "complete";
};

function baseMetrics(row: { weeks: PublicChannelWeekInput[]; exchangeRate?: number | null }) {
  const rate = Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1;
  const sales = row.weeks.reduce((sum, week) => sum + Number(week.salesAmountOriginal || 0), 0) * rate;
  const adSpend = row.weeks.reduce((sum, week) => sum + Number(week.adSpendOriginal || 0), 0) * rate;
  return { sales, adSpend, rate };
}

export async function getPublicChannelRows(year: number, month: number): Promise<PublicChannelRow[]> {
  const rows = await getMonthlyRows({ year, month });
  return rows.map((row) => {
    const weeks = row.weeks.map((week) => ({ weekNumber: week.weekNumber, salesAmountOriginal: week.salesAmountOriginal, adSpendOriginal: week.adSpendOriginal }));
    const { sales, adSpend } = baseMetrics({ weeks, exchangeRate: row.exchangeRate });
    const filledWeeks = weeks.filter((week) => week.salesAmountOriginal !== 0 || week.adSpendOriginal !== 0).length;
    return {
      channelId: row.channelId,
      businessBlock: row.businessBlock || "other",
      businessBlockLabel: businessBlockLabel(row.businessBlock),
      businessLine: row.businessLine,
      channelName: row.channelName,
      owner: row.decisionOwner || "",
      currency: row.currency,
      exchangeRate: Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1,
      weeks,
      filledWeeks,
      salesAmountBase: sales,
      adSpendBase: adSpend,
      roi: adSpend > 0 ? sales / adSpend : null,
      adRatio: sales > 0 ? adSpend / sales : null,
      status: filledWeeks === 0 ? "empty" : filledWeeks >= 5 ? "complete" : "partial",
    };
  });
}

export async function preparePublicChannelMonth(year: number, month: number) {
  const channels = await prisma.channel.findMany({
    where: buildChannelWhere({ year, month }),
    include: { brand: { select: { defaultCurrency: true } }, platform: { select: { name: true } }, store: { select: { defaultCurrency: true, storeType: true, primaryMarketCode: true } } },
    orderBy: [{ sortOrder: "asc" }, { businessLine: "asc" }, { channelName: "asc" }],
  });
  const ids = channels.map((channel) => channel.id);
  const existing = ids.length ? await prisma.channelMetricPeriod.findMany({ where: { year, month, periodType: PERIOD_TYPE_WEEK, weekNumber: 1, channelId: { in: ids } }, select: { channelId: true } }) : [];
  const existingIds = new Set(existing.map((metric) => metric.channelId));
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  for (const channel of channels) {
    if (existingIds.has(channel.id) || !channel.brandId || !channel.platformId) continue;
    const currency = channel.store?.defaultCurrency || channel.brand?.defaultCurrency || "CNY";
    const businessBlock = inferBusinessBlock({ businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType });
    const brandId = channel.brandId;
    const platformId = channel.platformId;
    for (const weekNumber of WEEK_NUMBERS) {
      operations.push(prisma.channelMetricPeriod.upsert({
        where: { year_month_periodType_weekNumber_channelId: { year, month, periodType: PERIOD_TYPE_WEEK, weekNumber, channelId: channel.id } },
        update: {},
        create: { year, month, quarter: Math.ceil(month / 3), weekNumber, periodType: PERIOD_TYPE_WEEK, brandId, platformId, storeId: channel.storeId, channelId: channel.id, countryCode: channel.store?.primaryMarketCode ?? null, currency, salesAmountOriginal: toDecimal(0), adSpendOriginal: toDecimal(0), exchangeRate: toDecimal(1), salesAmountBase: toDecimal(0), adSpendBase: toDecimal(0), businessBlock },
      }));
    }
  }
  if (operations.length) await prisma.$transaction(operations);
  return { year, month, totalChannels: channels.length, createdRows: operations.length / WEEK_NUMBERS.length, skippedRows: channels.length - operations.length / WEEK_NUMBERS.length };
}

export async function updatePublicChannelEntry(input: { year: number; month: number; channelId: number; actorName: string; weeks: PublicChannelWeekInput[]; ipAddress?: string | null; userAgent?: string | null }) {
  const actorName = input.actorName.trim().slice(0, 80);
  if (!actorName) throw new Error("请填写姓名");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new Error("年份不正确");
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) throw new Error("月份不正确");
  const channel = await prisma.channel.findUnique({ where: { id: input.channelId }, include: { brand: { select: { defaultCurrency: true } }, platform: { select: { name: true } }, store: { select: { defaultCurrency: true, storeType: true, primaryMarketCode: true } } } });
  if (!channel?.brandId || !channel.platformId || channel.status !== "active") throw new Error("渠道不存在或暂不可用");
  const before = await prisma.channelMetricPeriod.findMany({ where: { year: input.year, month: input.month, periodType: PERIOD_TYPE_WEEK, channelId: input.channelId }, orderBy: { weekNumber: "asc" }, select: { weekNumber: true, salesAmountOriginal: true, adSpendOriginal: true, remark: true, exchangeRate: true } });
  const brandId = channel.brandId;
  const platformId = channel.platformId;
  const currency = channel.store?.defaultCurrency || channel.brand?.defaultCurrency || "CNY";
  const exchangeRate = toNumber(before.find((item) => item.weekNumber === 1)?.exchangeRate, 1) || 1;
  const businessBlock = inferBusinessBlock({ businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType });
  const normalizedWeeks = WEEK_NUMBERS.map((weekNumber) => {
    const week = input.weeks.find((item) => item.weekNumber === weekNumber);
    const sales = toNumber(week?.salesAmountOriginal);
    const adSpend = toNumber(week?.adSpendOriginal);
    if (adSpend < 0) throw new Error(`W${weekNumber}广告费不能为负数`);
    return { weekNumber, sales, adSpend };
  });
  await prisma.$transaction(normalizedWeeks.map((week) => prisma.channelMetricPeriod.upsert({
    where: { year_month_periodType_weekNumber_channelId: { year: input.year, month: input.month, periodType: PERIOD_TYPE_WEEK, weekNumber: week.weekNumber, channelId: input.channelId } },
    update: { quarter: Math.ceil(input.month / 3), brandId, platformId, storeId: channel.storeId, countryCode: channel.store?.primaryMarketCode ?? null, currency, salesAmountOriginal: toDecimal(week.sales), adSpendOriginal: toDecimal(week.adSpend), exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)), salesAmountBase: toDecimal(week.sales * exchangeRate), adSpendBase: toDecimal(week.adSpend * exchangeRate), businessBlock },
    create: { year: input.year, month: input.month, quarter: Math.ceil(input.month / 3), weekNumber: week.weekNumber, periodType: PERIOD_TYPE_WEEK, brandId, platformId, storeId: channel.storeId, channelId: input.channelId, countryCode: channel.store?.primaryMarketCode ?? null, currency, salesAmountOriginal: toDecimal(week.sales), adSpendOriginal: toDecimal(week.adSpend), exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)), salesAmountBase: toDecimal(week.sales * exchangeRate), adSpendBase: toDecimal(week.adSpend * exchangeRate), businessBlock },
  })));
  await prisma.channelEntryAudit.create({ data: { year: input.year, month: input.month, channelId: input.channelId, actorName, action: "update", beforeValue: JSON.stringify(before.map((item) => ({ weekNumber: item.weekNumber, sales: toNumber(item.salesAmountOriginal), adSpend: toNumber(item.adSpendOriginal) }))), afterValue: JSON.stringify(normalizedWeeks), ipAddress: input.ipAddress?.slice(0, 64) || null, userAgent: input.userAgent?.slice(0, 500) || null } });
  const rows = await getPublicChannelRows(input.year, input.month);
  return rows.find((row) => row.channelId === input.channelId) ?? null;
}

export async function getPublicChannelAudits(year: number, month: number) {
  return prisma.channelEntryAudit.findMany({ where: { year, month }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, channelId: true, actorName: true, action: true, beforeValue: true, afterValue: true, createdAt: true, channel: { select: { channelName: true, businessLine: true } } } });
}
