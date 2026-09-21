import type { EntryFxQuote } from "./channel-entry-fx-types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const RETRY_DELAY = 60 * 1000;

export function validFxDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function parseEntryFxQuote(value: unknown, currency: string, asOf: string) {
  if (!value || typeof value !== "object") throw new Error("汇率响应无效");
  const data = value as Record<string, unknown>;
  if (data.base !== currency || data.quote !== "CNY" || typeof data.rate !== "number" || !Number.isFinite(data.rate) || data.rate <= 0 || data.rate > 1000000 || !validFxDate(data.date) || data.date > asOf) throw new Error("汇率响应无效");
  return { rate: data.rate, rateDate: data.date };
}

// Reference-only cache. Fetching a quote never updates stored accounting amounts or shared order rates.
export function createEntryFxQuoteService(fetcher: typeof fetch = fetch, clock: () => number = Date.now) {
  const cache = new Map<string, { quote: EntryFxQuote | null; expiresAt: number; attemptedAt: number; pending: Promise<EntryFxQuote> | null }>();
  return async (currency: string, options: { asOf?: string; force?: boolean } = {}): Promise<EntryFxQuote> => {
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("币种格式不正确");
    const now = clock();
    const today = new Date(now).toISOString().slice(0, 10);
    const asOf = options.asOf ?? today;
    if (!validFxDate(asOf) || asOf > today) throw new Error("汇率日期不正确");
    if (currency === "CNY") return { currency, targetCurrency: "CNY", rate: 1, rateDate: asOf, checkedAt: new Date(now).toISOString(), source: "same_currency", stale: false, error: null };
    const key = `${currency}:${options.asOf ?? "latest"}`;
    const previous = cache.get(key);
    if (previous?.pending) return previous.pending;
    if (previous?.quote && now < previous.expiresAt && (!options.force || now - previous.attemptedAt < RETRY_DELAY)) return previous.quote;
    const slot = { quote: previous?.quote ?? null, expiresAt: 0, attemptedAt: now, pending: null as Promise<EntryFxQuote> | null };
    cache.set(key, slot);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    slot.pending = (async () => {
      let quote: EntryFxQuote;
      try {
        const url = new URL(`https://api.frankfurter.dev/v2/providers/ecb/rate/${currency.toLowerCase()}/cny`);
        if (options.asOf) url.searchParams.set("date", asOf);
        const response = await fetcher(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error("汇率服务暂不可用");
        const parsed = parseEntryFxQuote(await response.json(), currency, asOf);
        const stale = Date.parse(asOf) - Date.parse(parsed.rateDate) > 7 * DAY;
        quote = { currency, targetCurrency: "CNY", ...parsed, checkedAt: new Date(now).toISOString(), source: "ecb", stale, error: stale ? "参考数据超过 7 天未更新，请核对后手动输入" : null };
        slot.expiresAt = now + (options.asOf ? DAY : HOUR);
      } catch {
        quote = { currency, targetCurrency: "CNY", rate: slot.quote?.rate ?? null, rateDate: slot.quote?.rateDate ?? null, checkedAt: new Date(now).toISOString(), source: "ecb", stale: true, error: "参考汇率获取失败，可稍后重试或手动输入；查询不会改动核算金额" };
        slot.expiresAt = now + RETRY_DELAY;
      }
      slot.quote = quote;
      return quote;
    })().finally(() => { slot.pending = null; });
    return slot.pending;
  };
}

export const getEntryFxQuote = createEntryFxQuoteService();
