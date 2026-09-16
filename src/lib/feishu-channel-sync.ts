import { Prisma } from "@prisma/client";
import { businessBlockLabel, resolveChannelBusinessBlock } from "@/lib/business-blocks";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, buildChannelWhere, toDecimal, toNumber } from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";

const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";
const FEISHU_PAGE_SIZE = 500;

type FeishuRecord = { record_id?: string; fields?: Record<string, unknown> };
type SyncError = { recordId?: string; rowLabel: string; message: string };

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`服务器未配置 ${name}`);
  return value;
}

function textField(fields: Record<string, unknown>, name: string) {
  const value = fields[name];
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "text" in value) return String((value as { text?: unknown }).text ?? "").trim();
  return String(value).trim();
}

function numberField(fields: Record<string, unknown>, name: string, fallback = 0) {
  const value = fields[name];
  if (typeof value === "object" && value !== null && "value" in value) return toNumber((value as { value?: unknown }).value, fallback);
  return toNumber(value, fallback);
}

function parseChannelId(code: string) {
  const match = code.match(/^CH-(\d+)$/i);
  return match ? Number(match[1]) : null;
}

async function feishuRequest<T>(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${FEISHU_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as { code?: number; msg?: string; data?: T };
  if (!response.ok || payload.code !== 0) throw new Error(payload.msg || `飞书接口请求失败（${response.status}）`);
  return payload.data as T;
}

async function getTenantAccessToken() {
  const appId = requiredEnv("FEISHU_APP_ID");
  const appSecret = requiredEnv("FEISHU_APP_SECRET");
  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = (await response.json().catch(() => ({}))) as { code?: number; msg?: string; tenant_access_token?: string };
  if (!response.ok || data.code !== 0) throw new Error(data.msg || `飞书鉴权失败（${response.status}）`);
  if (!data.tenant_access_token) throw new Error("飞书未返回 tenant_access_token");
  return data.tenant_access_token;
}

async function listAllRecords(token: string, appToken: string, tableId: string) {
  const records: FeishuRecord[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ page_size: String(FEISHU_PAGE_SIZE) });
    if (pageToken) query.set("page_token", pageToken);
    const data = await feishuRequest<{ items?: FeishuRecord[]; page_token?: string; has_more?: boolean }>(token, `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${query}`);
    records.push(...(data?.items ?? []));
    pageToken = data?.has_more ? data.page_token ?? "" : "";
  } while (pageToken);
  return records;
}

async function listFieldNames(token: string, appToken: string, tableId: string) {
  const data = await feishuRequest<{ items?: Array<{ field_name?: string }> }>(token, `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields?page_size=100`);
  return new Set((data?.items ?? []).map((field) => field.field_name).filter((name): name is string => Boolean(name)));
}

function rowLabel(fields: Record<string, unknown>) {
  return `${textField(fields, "年份")}-${textField(fields, "月份")} / ${textField(fields, "渠道编码") || textField(fields, "渠道")}`;
}

export async function syncFeishuChannelData() {
  const appToken = requiredEnv("FEISHU_BITABLE_APP_TOKEN");
  const tableId = requiredEnv("FEISHU_BITABLE_TABLE_ID");
  const token = await getTenantAccessToken();
  const fieldNames = await listFieldNames(token, appToken, tableId);
  const records = await listAllRecords(token, appToken, tableId);
  const errors: SyncError[] = [];
  const validRows: Array<{ record: FeishuRecord; channelId: number; year: number; month: number; fields: Record<string, unknown> }> = [];
  const seen = new Set<string>();

  for (const record of records) {
    const fields = record.fields ?? {};
    const label = rowLabel(fields);
    if (!Object.keys(fields).length) continue;
    const channelId = parseChannelId(textField(fields, "渠道编码"));
    const year = Math.trunc(numberField(fields, "年份"));
    const month = Math.trunc(numberField(fields, "月份"));
    if (!channelId) { errors.push({ recordId: record.record_id, rowLabel: label, message: "渠道编码格式不正确，应为 CH-0001" }); continue; }
    if (year < 2000 || year > 2100 || month < 1 || month > 12) { errors.push({ recordId: record.record_id, rowLabel: label, message: "年份或月份不正确" }); continue; }
    const key = `${year}-${month}-${channelId}`;
    if (seen.has(key)) { errors.push({ recordId: record.record_id, rowLabel: label, message: "同一渠道同一月份重复" }); continue; }
    seen.add(key);
    let invalid = false;
    for (const weekNumber of WEEK_NUMBERS) {
      const adSpend = numberField(fields, `W${weekNumber}广告`);
      if (adSpend < 0) {
        errors.push({ recordId: record.record_id, rowLabel: label, message: `W${weekNumber}广告不能为负数` });
        invalid = true;
      }
    }
    if (invalid) continue;
    validRows.push({ record, channelId, year, month, fields });
  }

  const channelIds = [...new Set(validRows.map((row) => row.channelId))];
  const channels = await prisma.channel.findMany({
    where: { id: { in: channelIds } },
    include: { brand: { select: { defaultCurrency: true } }, platform: { select: { name: true } }, store: { select: { id: true, primaryMarketCode: true, defaultCurrency: true, storeType: true } } },
  });
  const channelMap = new Map(channels.map((channel) => [channel.id, channel]));
  const operations: Prisma.PrismaPromise<unknown>[] = [];
  const syncedRecordIds: string[] = [];

  for (const row of validRows) {
    const channel = channelMap.get(row.channelId);
    const label = rowLabel(row.fields);
    if (!channel?.brandId || !channel.platformId) { errors.push({ recordId: row.record.record_id, rowLabel: label, message: "渠道不存在或缺少品牌/平台关联" }); continue; }
    const currency = textField(row.fields, "币种") || channel.store?.defaultCurrency || channel.brand?.defaultCurrency || "CNY";
    const exchangeRate = Math.max(numberField(row.fields, "汇率", 1), 0) || 1;
    const businessBlock = resolveChannelBusinessBlock({ channelGroup: channel.channelGroup, businessBlock: textField(row.fields, "板块"), businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType });
    for (const weekNumber of WEEK_NUMBERS) {
      const salesAmount = numberField(row.fields, `W${weekNumber}销售`);
      const adSpend = Math.max(numberField(row.fields, `W${weekNumber}广告`), 0);
      operations.push(prisma.channelMetricPeriod.upsert({
        where: { year_month_periodType_weekNumber_channelId: { year: row.year, month: row.month, periodType: PERIOD_TYPE_WEEK, weekNumber, channelId: row.channelId } },
        update: { quarter: Math.ceil(row.month / 3), brandId: channel.brandId, platformId: channel.platformId, storeId: channel.storeId, countryCode: channel.store?.primaryMarketCode ?? null, currency, salesAmountOriginal: toDecimal(salesAmount), adSpendOriginal: toDecimal(adSpend), exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)), salesAmountBase: toDecimal(salesAmount * exchangeRate), adSpendBase: toDecimal(adSpend * exchangeRate), businessBlock, remark: textField(row.fields, "备注") || null },
        create: { year: row.year, month: row.month, quarter: Math.ceil(row.month / 3), weekNumber, periodType: PERIOD_TYPE_WEEK, brandId: channel.brandId, platformId: channel.platformId, storeId: channel.storeId, channelId: row.channelId, countryCode: channel.store?.primaryMarketCode ?? null, currency, salesAmountOriginal: toDecimal(salesAmount), adSpendOriginal: toDecimal(adSpend), exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)), salesAmountBase: toDecimal(salesAmount * exchangeRate), adSpendBase: toDecimal(adSpend * exchangeRate), businessBlock, remark: textField(row.fields, "备注") || null },
      }));
    }
    if (row.record.record_id) syncedRecordIds.push(row.record.record_id);
  }
  if (operations.length) await prisma.$transaction(operations);

  const now = Date.now();
  const statusUpdates = records.filter((record) => record.record_id).map((record) => {
    const error = errors.find((item) => item.recordId === record.record_id);
    const fields = record.fields ?? {};
    const nextFields: Record<string, unknown> = {};
    const add = (name: string, value: unknown) => { if (fieldNames.has(name)) nextFields[name] = value; };
    add("同步状态", error ? "失败" : syncedRecordIds.includes(record.record_id as string) ? "已同步" : "跳过");
    add("最后同步时间", now);
    add("同步错误", error ? error.message : null);
    const rate = Math.max(numberField(fields, "汇率", 1), 0) || 1;
    const weekly = WEEK_NUMBERS.map((weekNumber) => ({ sales: numberField(fields, `W${weekNumber}销售`), ad: Math.max(numberField(fields, `W${weekNumber}广告`), 0) }));
    const sales = weekly.reduce((sum, week) => sum + week.sales, 0);
    const adSpend = weekly.reduce((sum, week) => sum + week.ad, 0);
    add("月销售额(CNY)", sales * rate);
    add("月广告费(CNY)", adSpend * rate);
    add("月ROI", adSpend > 0 ? sales / adSpend : 0);
    add("月广告占销", sales > 0 ? `${((adSpend / sales) * 100).toFixed(1)}%` : "—");
    const active = weekly.filter((week) => week.sales !== 0 || week.ad !== 0);
    const current = active.at(-1);
    const previous = active.at(-2);
    add("销售趋势", !current ? "无数据" : !previous ? "新增" : current.sales > previous.sales ? "上涨" : current.sales < previous.sales ? "下降" : "持平");
    return { record_id: record.record_id as string, fields: nextFields };
  }).filter((record) => Object.keys(record.fields).length > 0);
  for (let index = 0; index < statusUpdates.length; index += 500) {
    await feishuRequest(token, `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_update`, { method: "POST", body: JSON.stringify({ records: statusUpdates.slice(index, index + 500) }) });
  }
  return { totalRecords: records.length, successRows: syncedRecordIds.length, failedRows: errors.length, skippedRows: records.length - syncedRecordIds.length - errors.length, errors: errors.slice(0, 50), syncedAt: new Date(now).toISOString() };
}

export async function prepareFeishuChannelMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("年份不正确");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("月份不正确");
  const appToken = requiredEnv("FEISHU_BITABLE_APP_TOKEN");
  const tableId = requiredEnv("FEISHU_BITABLE_TABLE_ID");
  const token = await getTenantAccessToken();
  const records = await listAllRecords(token, appToken, tableId);
  const existing = new Set(records.map((record) => `${Math.trunc(numberField(record.fields ?? {}, "年份"))}-${Math.trunc(numberField(record.fields ?? {}, "月份"))}-${textField(record.fields ?? {}, "渠道编码")}`));
  const channels = await prisma.channel.findMany({
    where: buildChannelWhere({ year, month }),
    include: { brand: { select: { defaultCurrency: true } }, platform: { select: { name: true } }, store: { select: { defaultCurrency: true, storeType: true } } },
    orderBy: [{ sortOrder: "asc" }, { businessLine: "asc" }, { channelName: "asc" }],
  });
  const rows = channels.filter((channel) => !existing.has(`${year}-${month}-CH-${String(channel.id).padStart(4, "0")}`)).map((channel) => ({
    fields: {
      渠道: channel.channelName,
      年份: year,
      月份: month,
      板块: businessBlockLabel(resolveChannelBusinessBlock({ channelGroup: channel.channelGroup, businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType })),
      二级: channel.businessLine,
      负责人: "",
      渠道编码: `CH-${String(channel.id).padStart(4, "0")}`,
      币种: channel.store?.defaultCurrency || channel.brand?.defaultCurrency || "CNY",
      汇率: 1,
      备注: "",
      ...Object.fromEntries(WEEK_NUMBERS.flatMap((weekNumber) => [[`W${weekNumber}销售`, 0], [`W${weekNumber}广告`, 0]])),
      "月销售额(CNY)": 0,
      "月广告费(CNY)": 0,
      月ROI: 0,
      月广告占销: "—",
      "季销售额(CNY)": 0,
      "季广告费(CNY)": 0,
      季ROI: 0,
      季广告占销: "—",
      销售趋势: "无数据",
    },
  }));
  for (let index = 0; index < rows.length; index += 500) {
    await feishuRequest(token, `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_create`, { method: "POST", body: JSON.stringify({ records: rows.slice(index, index + 500) }) });
  }
  return { year, month, totalChannels: channels.length, createdRows: rows.length, skippedRows: channels.length - rows.length };
}
