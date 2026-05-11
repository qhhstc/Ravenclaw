import { Tag } from "antd";
import { channelTypeOptions } from "@/lib/basic-options";
import type { ChannelDataRow } from "./channelDataTypes";

export const weekNumbers = [1, 2, 3, 4, 5] as const;

export function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value || 0);
}

export function currencyMoney(value: number) {
  return `¥${money(value)}`;
}

export function percent(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
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

export function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function channelTypeLabel(value?: string | null) {
  return channelTypeOptions.find((option) => option.value === value)?.label ?? value ?? "-";
}

export function RoiTag({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#9ca3af]">—</span>;
  if (value >= 5) return <Tag color="green">{ratio(value)}</Tag>;
  if (value > 0 && value < 3) return <Tag color="orange">{ratio(value)}</Tag>;
  return <Tag color="blue">{ratio(value)}</Tag>;
}

export function PercentText({ value }: { value: number }) {
  const color = value >= 0.25 ? "#cf1322" : value > 0 ? "#1677ff" : "#9ca3af";
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
