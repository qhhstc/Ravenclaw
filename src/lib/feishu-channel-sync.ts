import { Prisma } from "@prisma/client";
import { inferBusinessBlock } from "@/lib/business-blocks";
import { PERIOD_TYPE_WEEK, WEEK_NUMBERS, toDecimal, toNumber } from "@/lib/channel-data";
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
  const data = await feishuRequest<{ tenant_access_token?: string }>("", "/auth/v3/tenant_access_token/internal", {
    method: "POST",
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  if (!data?.tenant_access_token) throw new Error("飞书未返回 tenant_access_token");
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

function rowLabel(fields: Record<string, unknown>) {
  return `${textField(fields, "年份")}-${textField(fields, "月份")} / ${textField(fields, "渠道编码") || textField(fields, "渠道")}`;
}

export async function syncFeishuChannelData() {
  const appToken = requiredEnv("FEISHU_BITABLE_APP_TOKEN");
  const tableId = requiredEnv("FEISHU_BITABLE_TABLE_ID");
  const token = await getTenantAccessToken();
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
    const businessBlock = inferBusinessBlock({ businessLine: channel.businessLine, platformName: channel.platform?.name, storeType: channel.store?.storeType, channelType: channel.channelType });
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
    return { record_id: record.record_id as string, fields: { 同步状态: error ? "失败" : syncedRecordIds.includes(record.record_id as string) ? "已同步" : "跳过", 最后同步时间: now, ...(error ? { 同步错误: error.message } : { 同步错误: null }) } };
  });
  for (let index = 0; index < statusUpdates.length; index += 500) {
    await feishuRequest(token, `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_update`, { method: "POST", body: JSON.stringify({ records: statusUpdates.slice(index, index + 500) }) });
  }
  return { totalRecords: records.length, successRows: syncedRecordIds.length, failedRows: errors.length, skippedRows: records.length - syncedRecordIds.length - errors.length, errors: errors.slice(0, 50), syncedAt: new Date(now).toISOString() };
}
