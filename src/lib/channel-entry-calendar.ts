import type { EntryData, EntryDraft, EntryPeriod, EntryRow } from "./channel-entry-types";

const DAY = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export type EntryCalendarWeek = { weekNumber: number; startDate: string; endDate: string; label: string };

// Existing customer import maps a Monday–Sunday range by its ending month and ceil(endDay / 7).
export function entryCalendarWeeks({ year, month }: EntryPeriod): EntryCalendarWeek[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstSunday = 1 + (7 - first.getUTCDay()) % 7;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: EntryCalendarWeek[] = [];
  for (let day = firstSunday; day <= lastDay; day += 7) {
    const end = new Date(Date.UTC(year, month - 1, day));
    const startDate = iso(new Date(end.getTime() - 6 * DAY));
    const endDate = iso(end);
    result.push({ weekNumber: Math.ceil(day / 7), startDate, endDate, label: `${startDate.slice(5).replace("-", "/")}–${endDate.slice(5).replace("-", "/")}` });
  }
  return result;
}

export function entryWeekLabel(period: EntryPeriod, weekNumber: number) {
  const week = entryCalendarWeeks(period).find((item) => item.weekNumber === weekNumber);
  return week ? `W${weekNumber}（${week.label}）` : `W${weekNumber}（日期待核对）`;
}

export function previousEntryWeek(period: EntryPeriod, weekNumber: number) {
  const week = entryCalendarWeeks(period).find((item) => item.weekNumber === weekNumber);
  if (!week) return null;
  const end = new Date(Date.parse(week.endDate) - 7 * DAY);
  return { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1, weekNumber: Math.ceil(end.getUTCDate() / 7) };
}

export function previousEntryWeekLabel(period: EntryPeriod, weekNumber: number) {
  const previous = previousEntryWeek(period, weekNumber);
  return previous ? `${previous.year === period.year ? "" : `${previous.year}年`}${previous.month}月 ${entryWeekLabel(previous, previous.weekNumber)}` : "日期待核对";
}

export function currentEntryDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`;
}

export function latestCalendarEntryWeek(period: EntryPeriod, rows: EntryRow[]) {
  const valid = new Set(entryCalendarWeeks(period).map((week) => week.weekNumber));
  return Math.max(0, ...rows.flatMap((row) => row.weeks.filter((week) => valid.has(week.weekNumber) && (week.salesAmountOriginal !== null || week.adSpendOriginal !== null)).map((week) => week.weekNumber)));
}

export function displayedEntryWeeks(period: EntryPeriod, rows: Array<{ weeks: EntryDraft["weeks"] }> = []) {
  return [...new Set([...entryCalendarWeeks(period).map((week) => week.weekNumber), ...rows.flatMap((row) => row.weeks.filter((week) => (week.salesAmountOriginal ?? 0) !== 0 || (week.adSpendOriginal ?? 0) !== 0).map((week) => week.weekNumber))])].sort((a, b) => a - b);
}

export function entryMonthComparisonScope(data: EntryData, selected: number | null) {
  const calendar = entryCalendarWeeks(data);
  const valid = new Set(calendar.map((week) => week.weekNumber));
  const previousValid = new Set(entryCalendarWeeks(data.previousMonth).map((week) => week.weekNumber));
  const unknownDates = data.rows.some((row) => row.weeks.some((week) => (selected === null || selected === week.weekNumber) && !valid.has(week.weekNumber) && ((week.salesAmountOriginal ?? 0) !== 0 || (week.adSpendOriginal ?? 0) !== 0)));
  const latest = latestCalendarEntryWeek(data, data.rows);
  const today = data.asOfDate ?? currentEntryDate();
  const currentMonth = Number(today.slice(0, 4)) * 100 + Number(today.slice(5, 7));
  const partial = selected === null && !unknownDates && data.year * 100 + data.month >= currentMonth && (latest < calendar.length || today <= calendar.at(-1)!.endDate);
  const weeks = selected !== null ? [selected] : partial ? calendar.filter((week) => week.weekNumber <= latest).map((week) => week.weekNumber) : null;
  const previousUnknown = data.previousRows.some((row) => row.weeks.some((week) => (weeks === null || weeks.includes(week.weekNumber)) && !previousValid.has(week.weekNumber) && ((week.salesAmountOriginal ?? 0) !== 0 || (week.adSpendOriginal ?? 0) !== 0)));
  return {
    weeks, partial, latest, unknownDates: unknownDates || previousUnknown,
    comparable: !unknownDates && !previousUnknown && (weeks === null || (weeks.length > 0 && weeks.every((week) => valid.has(week) && previousValid.has(week)))),
    label: selected !== null ? previousValid.has(selected) ? `W${selected}` : "无对应周" : partial ? latest ? latest <= previousValid.size ? latest === 1 ? "W1" : `W1–W${latest}` : "无相同周数区间" : "暂无同期数据" : "全月",
  };
}
