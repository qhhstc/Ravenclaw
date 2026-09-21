import { Prisma, type ChannelMetricPeriod } from "@prisma/client";
import { prisma } from "./prisma";
import { currentEntryPeriod, EntryError, getPublicEntryData, publicEntryChannelWhere, recordSnapshot, validateEntryPeriod } from "./public-channel-entry";
import { getEntryFxQuote } from "./channel-entry-fx-quotes";

export function validateEntryFxRate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1000000) throw new EntryError("请输入有效的正数汇率（最多 6 位小数）");
  const rate = new Prisma.Decimal(value.toString()).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
  if (rate.lte(0)) throw new EntryError("汇率过小，请检查输入");
  return rate;
}

export function revalueEntryMetric(metric: Pick<ChannelMetricPeriod, "salesAmountOriginal" | "adSpendOriginal" | "refundAmountOriginal">, rate: Prisma.Decimal) {
  const convert = (value: Prisma.Decimal) => {
    const result = value.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (result.abs().gte("10000000000000000")) throw new EntryError("折算后金额过大，请检查汇率");
    return result;
  };
  return { exchangeRate: rate, salesAmountBase: convert(metric.salesAmountOriginal), adSpendBase: convert(metric.adSpendOriginal), refundAmountBase: convert(metric.refundAmountOriginal) };
}

export async function applyPublicEntryExchangeRate(input: {
  year: unknown; month: unknown; currency: unknown; rate: unknown; actorName: unknown; versions: unknown;
  source: unknown; quoteDate?: unknown; ipAddress?: string | null; userAgent?: string | null;
}) {
  const { year, month } = validateEntryPeriod(input.year, input.month);
  const current = currentEntryPeriod();
  if (year !== current.year || month !== current.month) throw new EntryError("只允许调整当前月份汇率，历史和未来月份不自动重算");
  if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency) || input.currency === "CNY") throw new EntryError("请选择需要折算的外币");
  const currency = input.currency;
  const rate = validateEntryFxRate(input.rate);
  if (typeof input.actorName !== "string" || !input.actorName.trim() || input.actorName.length > 80) throw new EntryError("请填写本次调整人的姓名（最多 80 字）");
  const actorName = input.actorName.trim();
  if (input.source !== "manual" && input.source !== "reference") throw new EntryError("请选择汇率来源");
  if (!Array.isArray(input.versions) || !input.versions.length || input.versions.length > 1000) throw new EntryError("请先加载本月渠道数据");
  const versions = new Map<number, string>();
  for (const entry of input.versions) {
    if (!entry || !Number.isInteger(entry.channelId) || entry.channelId <= 0 || typeof entry.version !== "string" || versions.has(entry.channelId)) throw new EntryError("渠道版本信息不正确，请刷新核对");
    versions.set(entry.channelId, entry.version);
  }
  if (input.source === "reference") {
    const quote = await getEntryFxQuote(currency);
    if (quote.rate === null || quote.stale || quote.rateDate !== input.quoteDate || !validateEntryFxRate(quote.rate).eq(rate)) throw new EntryError("参考汇率不可用或已变化，请重新获取并确认", 409);
  }
  const changedChannels = await prisma.$transaction(async (tx) => {
    const metrics = await tx.channelMetricPeriod.findMany({
      where: { year, month, periodType: "week", weekNumber: { in: [1, 2, 3, 4, 5] }, currency, channel: publicEntryChannelWhere(year, month) },
      orderBy: [{ channelId: "asc" }, { weekNumber: "asc" }],
    });
    const ids = [...new Set(metrics.map((metric) => metric.channelId))];
    if (ids.length !== versions.size || ids.some((id) => !versions.has(id))) throw new EntryError("本月渠道范围已变化，请刷新核对后再调整汇率", 409);
    const groups = ids.map((channelId) => ({ channelId, items: metrics.filter((metric) => metric.channelId === channelId) }));
    for (const { channelId, items } of groups) {
      if (items.length !== 5 || recordSnapshot(items).version !== versions.get(channelId)) throw new EntryError("有渠道数据已被修改或币种不一致，请刷新核对后再调整汇率", 409);
    }
    let changed = 0;
    for (const { channelId, items } of groups) {
      const updates = items.map((item) => revalueEntryMetric(item, rate));
      if (items.every((item, i) => item.exchangeRate.eq(rate) && item.salesAmountBase.eq(updates[i].salesAmountBase) && item.adSpendBase.eq(updates[i].adSpendBase) && item.refundAmountBase.eq(updates[i].refundAmountBase))) continue;
      const after: ChannelMetricPeriod[] = [];
      for (const [index, item] of items.entries()) after.push(await tx.channelMetricPeriod.update({ where: { id: item.id }, data: updates[index] }));
      const snapshot = (values: ChannelMetricPeriod[]) => ({
        ...recordSnapshot(values),
        baseAmounts: values.map((value) => ({ weekNumber: value.weekNumber, sales: value.salesAmountBase.toString(), ad: value.adSpendBase.toString(), refund: value.refundAmountBase.toString() })),
      });
      await tx.channelEntryAudit.create({ data: { year, month, channelId, actorName, action: "exchange_rate", beforeValue: JSON.stringify(snapshot(items)), afterValue: JSON.stringify({ ...snapshot(after), fx: { source: input.source, quoteDate: input.source === "reference" ? input.quoteDate : null } }), ipAddress: input.ipAddress?.slice(0, 64) || null, userAgent: input.userAgent?.slice(0, 500) || null } });
      changed++;
    }
    return changed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  return { changedChannels, rate: Number(rate), currency, data: await getPublicEntryData(year, month) };
}
