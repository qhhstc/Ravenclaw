import { Tag } from "antd";
import { channelTypeOptions } from "@/lib/basic-options";
import { businessBlockLabel } from "@/lib/business-blocks";
import type { ChannelDataRow } from "./channelDataTypes";

export const weekNumbers = [1, 2, 3, 4, 5] as const;

export function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function percent(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  HKD: "HK$",
};

export function currencySymbol(currency?: string | null) {
  const code = (currency || "CNY").toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

export function currencyMoney(value: number, currency?: string | null) {
  return `${currencySymbol(currency)}${money(value)}`;
}

export function ratio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function sumWeeks(row: ChannelDataRow, field: "salesAmountOriginal" | "adSpendOriginal") {
  return row.weeks.reduce((total, week) => total + Number(week[field] || 0), 0);
}

export function rowSales(row: ChannelDataRow) {
  return sumWeeks(row, "salesAmountOriginal");
}

export function rowAdSpend(row: ChannelDataRow) {
  return sumWeeks(row, "adSpendOriginal");
}

// 本位币(base)口径:原币 × 汇率。跨渠道汇总、占比都用 base,避免不同币种直接相加。
export function rowExchangeRate(row: ChannelDataRow) {
  return Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1;
}

export function rowSalesBase(row: ChannelDataRow) {
  return rowSales(row) * rowExchangeRate(row);
}

export function rowAdSpendBase(row: ChannelDataRow) {
  return rowAdSpend(row) * rowExchangeRate(row);
}

export function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function channelTypeLabel(value?: string | null) {
  return channelTypeOptions.find((option) => option.value === value)?.label ?? value ?? "-";
}

export function blockLabel(value?: string | null) {
  return businessBlockLabel(value);
}

// 板块固定配色:亚马逊/独立站/TikTok/B端 各一色,其它归灰,演示时一眼区分
const BLOCK_COLORS: Record<string, string> = {
  amazon: "orange",
  independent_site: "blue",
  tiktok: "magenta",
  b2b: "green",
};

export function blockColor(value?: string | null) {
  return BLOCK_COLORS[(value || "").toLowerCase()] ?? "default";
}

export function ratingText(row: ChannelDataRow) {
  return row.manualRating || row.aiRating || "";
}

export function ratingSourceText(row: ChannelDataRow) {
  if (row.manualRating) return "手动";
  if (row.aiRating) return "AI";
  return "";
}

export function actionText(row: ChannelDataRow) {
  return row.manualActionSuggestion || row.aiActionSuggestion || "";
}

export function actionSourceText(row: ChannelDataRow) {
  if (row.manualActionSuggestion) return "手动";
  if (row.aiActionSuggestion) return "AI";
  return "";
}

export function RoiTag({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--muted-weak)]">—</span>;
  if (value >= 5) return <Tag color="green">{ratio(value)}</Tag>;
  if (value > 0 && value < 3) return <Tag color="orange">{ratio(value)}</Tag>;
  return <Tag color="blue">{ratio(value)}</Tag>;
}

// tone="cost":占比高=坏(广告占销),超阈值标红;tone="share":占比高=中性/好(销售占比),不标红
export function PercentText({ value, tone = "cost" }: { value: number; tone?: "cost" | "share" }) {
  if (tone === "share") {
    const color = value > 0 ? "var(--chart-blue)" : "var(--muted-weak)";
    return <span style={{ color }}>{percent(value)}</span>;
  }
  const color = value >= 0.25 ? "var(--danger)" : value > 0 ? "var(--chart-blue)" : "var(--muted-weak)";
  return <span style={{ color }}>{percent(value)}</span>;
}

export function getWeek(row: ChannelDataRow, weekNumber: number) {
  return row.weeks.find((week) => week.weekNumber === weekNumber) ?? {
    weekNumber,
    salesAmountOriginal: 0,
    adSpendOriginal: 0,
  };
}

export function withUpdatedWeek(
  row: ChannelDataRow,
  weekNumber: number,
  field: "salesAmountOriginal" | "adSpendOriginal",
  value: number | null,
) {
  const weeks = weekNumbers.map((currentWeek) => {
    const week = getWeek(row, currentWeek);
    return currentWeek === weekNumber ? { ...week, [field]: Number(value || 0) } : week;
  });
  return { ...row, weeks };
}

export function rowKey(row: ChannelDataRow) {
  return String(row.channelId);
}
