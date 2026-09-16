import { createHash } from "node:crypto";
import { Prisma, type ChannelMetricPeriod } from "@prisma/client";
import { businessBlockLabel, inferBusinessBlock } from "@/lib/business-blocks";
import { buildChannelWhere, PERIOD_TYPE_WEEK, WEEK_NUMBERS, toDecimal, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";
import type { EntryAudit, EntryChange, EntryData, EntryDraft, EntryPeriod, EntryRow } from "./channel-entry-types";

export class EntryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateEntryPeriod(year: unknown, month: unknown): EntryPeriod {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) throw new EntryError("请选择有效年月（2000–2100 年）");
  return { year: y, month: m };
}
export function currentEntryPeriod(): EntryPeriod {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "numeric" }).formatToParts(new Date());
  return { year: Number(parts.find((part) => part.type === "year")!.value), month: Number(parts.find((part) => part.type === "month")!.value) };
}
export function entryPeriodFromQuery(params: URLSearchParams) {
  const current = currentEntryPeriod();
  return validateEntryPeriod(params.get("year") ?? current.year, params.get("month") ?? current.month);
}
function priorMonth({ year, month }: EntryPeriod): EntryPeriod { return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }; }
function entered(value: unknown, flag: boolean | null) {
  const amount = toNumber(value);
  return amount !== 0 || flag === true ? amount : null;
}
function recordSnapshot(metrics: ChannelMetricPeriod[]): EntryDraft & { currency: string; exchangeRate: number } {
  const first = metrics.find((metric) => metric.weekNumber === 1) ?? metrics[0];
  return {
    owner: first?.decisionOwner ?? "", remark: first?.remark ?? "", currency: first?.currency ?? "CNY", exchangeRate: toNumber(first?.exchangeRate, 1),
    version: createHash("sha256").update(JSON.stringify(metrics.map((metric) => [metric.id, metric.updatedAt, metric.salesAmountOriginal, metric.adSpendOriginal, metric.entrySalesEntered, metric.entryAdSpendEntered, metric.currency, metric.exchangeRate, metric.decisionOwner, metric.remark]))).digest("hex"),
    weeks: WEEK_NUMBERS.map((weekNumber) => {
      const metric = metrics.find((item) => item.weekNumber === weekNumber);
      return { weekNumber, salesAmountOriginal: metric ? entered(metric.salesAmountOriginal, metric.entrySalesEntered) : null, adSpendOriginal: metric ? entered(metric.adSpendOriginal, metric.entryAdSpendEntered) : null };
    }),
  };
}

export async function getPublicChannelRows(year: number, month: number): Promise<EntryRow[]> {
  validateEntryPeriod(year, month);
  const channels = await prisma.channel.findMany({
    where: buildChannelWhere({ year, month }),
    include: { platform: { select: { name: true } }, store: { select: { storeType: true } } },
    orderBy: [{ sortOrder: "asc" }, { businessLine: "asc" }, { channelName: "asc" }],
  });
  const metrics = await prisma.channelMetricPeriod.findMany({ where: { year, month, periodType: PERIOD_TYPE_WEEK, weekNumber: { in: [...WEEK_NUMBERS] }, channelId: { in: channels.map((c) => c.id) } }, orderBy: { weekNumber: "asc" } });
  return channels.map((channel) => {
    const items = metrics.filter((metric) => metric.channelId === channel.id);
    const snapshot = recordSnapshot(items);
    const businessBlock = inferBusinessBlock({ businessBlock: items[0]?.businessBlock, businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType });
    return {
      channelId: channel.id, businessBlock, businessBlockLabel: businessBlockLabel(businessBlock), businessLine: channel.businessLine, channelName: channel.channelName,
      owner: snapshot.owner, remark: snapshot.remark, currency: snapshot.currency, exchangeRate: snapshot.exchangeRate, version: snapshot.version,
      updatedAt: items.length ? new Date(Math.max(...items.map((metric) => metric.updatedAt.getTime()))).toISOString() : null,
      editable: Boolean(channel.brandId && channel.platformId && items.length === 5 && snapshot.exchangeRate > 0),
      weeks: snapshot.weeks.map((week) => {
        const metric = items.find((item) => item.weekNumber === week.weekNumber);
        return { ...week, salesAmountBase: week.salesAmountOriginal === null ? null : toNumber(metric?.salesAmountBase), adSpendBase: week.adSpendOriginal === null ? null : toNumber(metric?.adSpendBase) };
      }),
    };
  });
}
export async function getPublicEntryData(year: number, month: number): Promise<EntryData> {
  const previousMonth = priorMonth({ year, month });
  const [rows, previousRows] = await Promise.all([getPublicChannelRows(year, month), previousMonth.year >= 2000 ? getPublicChannelRows(previousMonth.year, previousMonth.month) : Promise.resolve([])]);
  const latestWeek = Math.max(1, ...rows.flatMap((row) => row.weeks.filter((week) => week.salesAmountOriginal !== null || week.adSpendOriginal !== null).map((week) => week.weekNumber)));
  const timestamps = rows.map((row) => row.updatedAt).filter((date): date is string => date !== null);
  return { year, month, rows, previousMonth, previousRows, latestWeek, updatedAt: timestamps.length ? timestamps.sort().at(-1)! : null };
}

export async function preparePublicChannelMonth(year: number, month: number) {
  validateEntryPeriod(year, month);
  const channels = await prisma.channel.findMany({ where: buildChannelWhere({ year, month }), include: { brand: true, platform: true, store: true } });
  const ids = channels.map((channel) => channel.id);
  const [existing, history, rates] = await Promise.all([
    prisma.channelMetricPeriod.findMany({ where: { year, month, periodType: PERIOD_TYPE_WEEK, channelId: { in: ids } }, orderBy: { weekNumber: "asc" } }),
    prisma.channelMetricPeriod.findMany({ where: { periodType: PERIOD_TYPE_WEEK, channelId: { in: ids }, OR: [{ year: { lt: year } }, { year, month: { lt: month } }] }, orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "asc" }] }),
    prisma.exchangeRate.findMany({ where: { targetCurrency: "CNY", rateDate: { lte: new Date(Date.UTC(year, month, 0, 23, 59, 59)) } }, orderBy: { rateDate: "desc" } }),
  ]);
  const known = new Set(existing.map((metric) => `${metric.channelId}-${metric.weekNumber}`));
  const warnings: string[] = [];
  const pending: Prisma.ChannelMetricPeriodCreateManyInput[] = [];
  for (const channel of channels) {
    if (WEEK_NUMBERS.every((week) => known.has(`${channel.id}-${week}`))) continue;
    if (!channel.brandId || !channel.platformId) { warnings.push(`${channel.businessLine} / ${channel.channelName} 缺少品牌或平台，暂不可填报`); continue; }
    const last = existing.find((metric) => metric.channelId === channel.id) ?? history.find((metric) => metric.channelId === channel.id);
    const currency = last?.currency ?? channel.store?.defaultCurrency ?? channel.brand?.defaultCurrency ?? "CNY";
    const rate = last ? toNumber(last.exchangeRate) : currency === "CNY" ? 1 : toNumber(rates.find((item) => item.baseCurrency === currency)?.rate);
    if (rate <= 0) { warnings.push(`${channel.businessLine} / ${channel.channelName} 缺少 ${currency}→CNY 汇率，请在后台配置`); continue; }
    const businessBlock = inferBusinessBlock({ businessBlock: last?.businessBlock, businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType });
    for (const weekNumber of WEEK_NUMBERS) {
      if (known.has(`${channel.id}-${weekNumber}`)) continue;
      pending.push({ year, month, quarter: Math.ceil(month / 3), weekNumber, periodType: PERIOD_TYPE_WEEK, channelId: channel.id, brandId: channel.brandId, platformId: channel.platformId, storeId: channel.storeId, countryCode: last?.countryCode ?? channel.store?.primaryMarketCode ?? null, currency, exchangeRate: new Prisma.Decimal(rate.toFixed(6)), businessBlock, decisionOwner: last?.decisionOwner ?? null, entrySalesEntered: false, entryAdSpendEntered: false });
    }
  }
  const result = pending.length ? await prisma.channelMetricPeriod.createMany({ data: pending, skipDuplicates: true }) : { count: 0 };
  return { year, month, createdWeeks: result.count, totalChannels: channels.length, warnings };
}

function validateAmount(value: unknown, field: string, allowNegative: boolean): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 999999999999 || (!allowNegative && value < 0)) throw new EntryError(`${field} 必须是有效${allowNegative ? "" : "非负"}数字，未填写请留空`);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function boundedText(value: unknown, label: string, limit: number): string {
  if (typeof value !== "string" || value.length > limit) throw new EntryError(`${label}格式不正确，最多 ${limit} 字`);
  return value.trim();
}
export function changesBetween(before: EntryDraft, after: EntryDraft): EntryChange[] {
  const changes: EntryChange[] = [];
  for (const [key, label] of [["owner", "负责人"], ["remark", "备注"]] as const) if (before[key] !== after[key]) changes.push({ label, before: before[key], after: after[key] });
  for (const week of after.weeks) {
    const old = before.weeks.find((item) => item.weekNumber === week.weekNumber);
    for (const [key, label] of [["salesAmountOriginal", "销售"], ["adSpendOriginal", "广告"]] as const) if ((old?.[key] ?? null) !== week[key]) changes.push({ label: `W${week.weekNumber}${label}`, before: old?.[key] ?? null, after: week[key] });
  }
  return changes;
}

export async function updatePublicChannelEntry(input: { year: unknown; month: unknown; channelId: number; actorName: unknown; owner: unknown; remark: unknown; version: unknown; weeks: unknown; ipAddress?: string | null; userAgent?: string | null }) {
  const { year, month } = validateEntryPeriod(input.year, input.month);
  if (!Number.isInteger(input.channelId) || input.channelId < 1) throw new EntryError("渠道不正确");
  const actorName = boundedText(input.actorName, "填写人", 80);
  if (!actorName) throw new EntryError("请填写姓名（自行填写，不代表身份认证）");
  const owner = boundedText(input.owner, "负责人", 80), remark = boundedText(input.remark, "备注", 2000);
  if (typeof input.version !== "string") throw new EntryError("缺少版本信息，请刷新页面");
  if (!Array.isArray(input.weeks) || input.weeks.length !== 5) throw new EntryError("请提交完整 W1–W5 数据");
  const numbers = new Set<number>();
  const weeks = input.weeks.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new EntryError("周数据格式不正确");
    const value = item as Record<string, unknown>;
    if (typeof value.weekNumber !== "number" || !Number.isInteger(value.weekNumber) || value.weekNumber < 1 || value.weekNumber > 5 || numbers.has(value.weekNumber)) throw new EntryError("周次不正确或重复");
    numbers.add(value.weekNumber);
    return { weekNumber: value.weekNumber, salesAmountOriginal: validateAmount(value.salesAmountOriginal, `W${value.weekNumber}销售`, true), adSpendOriginal: validateAmount(value.adSpendOriginal, `W${value.weekNumber}广告`, false) };
  }).sort((a, b) => a.weekNumber - b.weekNumber);
  await prisma.$transaction(async (tx) => {
    const channel = await tx.channel.findFirst({ where: { ...buildChannelWhere({ year, month }), id: input.channelId } });
    if (!channel) throw new EntryError("渠道不存在或已停用", 404);
    const metrics = await tx.channelMetricPeriod.findMany({ where: { year, month, periodType: PERIOD_TYPE_WEEK, channelId: channel.id, weekNumber: { in: [...WEEK_NUMBERS] } }, orderBy: { weekNumber: "asc" } });
    if (metrics.length !== 5) throw new EntryError("本月填报未准备完整，请刷新或补齐本月行", 409);
    const before = recordSnapshot(metrics);
    if (before.version !== input.version) throw new EntryError("这行已被其他人修改，请先刷新核对后再保存，当前修改未覆盖其他人的数据", 409);
    const after: EntryDraft = { owner, remark, weeks, version: before.version };
    if (!changesBetween(before, after).length) return;
    for (const week of weeks) {
      const metric = metrics.find((item) => item.weekNumber === week.weekNumber)!;
      const rate = toNumber(metric.exchangeRate);
      if (rate <= 0) throw new EntryError("渠道汇率无效，请联系管理员");
      await tx.channelMetricPeriod.update({ where: { id: metric.id }, data: {
        salesAmountOriginal: toDecimal(week.salesAmountOriginal ?? 0), adSpendOriginal: toDecimal(week.adSpendOriginal ?? 0),
        salesAmountBase: toDecimal((week.salesAmountOriginal ?? 0) * rate), adSpendBase: toDecimal((week.adSpendOriginal ?? 0) * rate),
        entrySalesEntered: week.salesAmountOriginal !== null, entryAdSpendEntered: week.adSpendOriginal !== null,
        decisionOwner: owner || null, remark: remark || null,
      } });
    }
    await tx.channelEntryAudit.create({ data: { year, month, channelId: input.channelId, actorName, action: "update", beforeValue: JSON.stringify(before), afterValue: JSON.stringify(after), ipAddress: input.ipAddress?.slice(0, 64) || null, userAgent: input.userAgent?.slice(0, 500) || null } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  return (await getPublicChannelRows(year, month)).find((row) => row.channelId === input.channelId)!;
}

export async function getPublicChannelAudits(year: number, month: number): Promise<EntryAudit[]> {
  validateEntryPeriod(year, month);
  const audits = await prisma.channelEntryAudit.findMany({ where: { year, month }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, actorName: true, beforeValue: true, afterValue: true, createdAt: true, channel: { select: { channelName: true, businessLine: true } } } });
  return audits.map((item) => {
    let changes: EntryChange[] = [];
    try { const before = JSON.parse(item.beforeValue || "{}"); const after = JSON.parse(item.afterValue || "{}"); if (before.weeks && after.weeks) changes = changesBetween(before, after); } catch { /* Legacy log remains viewable without exposing metadata. */ }
    return { id: item.id, actorName: item.actorName, createdAt: item.createdAt.toISOString(), channel: item.channel, changes };
  });
}
