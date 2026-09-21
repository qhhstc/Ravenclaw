import type { EntryData, EntryRow, EntryWeek } from "./channel-entry-types";

export const ENTRY_BLOCK_COLORS: Record<string, string> = { amazon: "#df8500", independent_site: "#7c3aed", tiktok: "#334155", b2b: "#14814a", other: "#64748b" };
export const entryRatio = (numerator: number | null, denominator: number | null) => numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;
export const entryChangeRate = (current: number | null, previous: number | null) => current !== null && previous !== null && previous !== 0 ? (current - previous) / Math.abs(previous) : null;
export const entryDelta = (current: number | null, previous: number | null) => current === null || previous === null ? null : current - previous;
export function sumKnown(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}
export function entryWeek(row: EntryRow | undefined, number: number): EntryWeek {
  return row?.weeks.find((week) => week.weekNumber === number) ?? { weekNumber: number, salesAmountOriginal: null, adSpendOriginal: null, salesAmountBase: null, adSpendBase: null };
}
export function monthTotals(row: EntryRow) {
  return { sales: sumKnown(row.weeks.map((week) => week.salesAmountBase)), ad: sumKnown(row.weeks.map((week) => week.adSpendBase)) };
}
function periodTotals(row: EntryRow, weekNumber: number | null) {
  if (weekNumber === null) return monthTotals(row);
  const week = entryWeek(row, weekNumber);
  return { sales: week.salesAmountBase, ad: week.adSpendBase };
}

type RoiStatus = "ready" | "missing" | "incomplete" | "no-ad";
export type ChannelRoiComparison = {
  row: EntryRow;
  sales: number | null;
  ad: number | null;
  roi: number | null;
  adRatio: number | null;
  activeWeeks: number[];
  incompleteWeeks: number[];
  status: RoiStatus;
  previousRoi: number | null;
  previousStatus: RoiStatus | null;
  roiDelta: number | null;
  roiRate: number | null;
};

function roiPeriod(weeks: EntryWeek[]) {
  const active = weeks.filter((week) => week.salesAmountBase !== null || week.adSpendBase !== null);
  const incompleteWeeks = active.filter((week) => week.salesAmountBase === null || week.adSpendBase === null).map((week) => week.weekNumber);
  const sales = sumKnown(weeks.map((week) => week.salesAmountBase));
  const ad = sumKnown(weeks.map((week) => week.adSpendBase));
  // Never divide sales covering more weeks by an incomplete advertising total.
  // Entirely blank weeks (including future weeks) do not mean zero activity.
  const status: RoiStatus = !active.length ? "missing" : incompleteWeeks.length ? "incomplete" : ad !== null && ad > 0 ? "ready" : "no-ad";
  return {
    sales, ad, status, activeWeeks: active.map((week) => week.weekNumber), incompleteWeeks,
    roi: status === "ready" ? entryRatio(sales, ad) : null,
    adRatio: status === "ready" || status === "no-ad" ? entryRatio(ad, sales) : null,
  };
}

export function compareChannelRoi(rows: EntryRow[], weekNumber: number | null = null, previousRows: EntryRow[] = []): ChannelRoiComparison[] {
  const previousById = new Map(previousRows.map((row) => [row.channelId, row]));
  return rows.map((row) => {
    const weeks = (weekNumber === null ? [1, 2, 3, 4, 5] : [weekNumber]).map((number) => entryWeek(row, number));
    const current = roiPeriod(weeks);
    const previous = weekNumber === null ? null : roiPeriod([entryWeek(weekNumber === 1 ? previousById.get(row.channelId) : row, weekNumber === 1 ? 5 : weekNumber - 1)]);
    const previousRoi = previous?.roi ?? null;
    return {
      row, ...current, previousRoi, previousStatus: previous?.status ?? null,
      roiDelta: entryDelta(current.roi, previousRoi),
      roiRate: entryChangeRate(current.roi, previousRoi),
    };
  });
}

export function sortChannelRoi(items: ChannelRoiComparison[], direction: "desc" | "asc" = "desc", metric: "roi" | "roiRate" = "roi") {
  return [...items].sort((a, b) => {
    const first = a[metric];
    const second = b[metric];
    if (first === null || second === null) return first === second ? a.row.channelId - b.row.channelId : first === null ? 1 : -1;
    return (direction === "desc" ? second - first : first - second) || a.row.channelId - b.row.channelId;
  });
}

export function analyzeEntry(data: EntryData, selectedWeek: number, statsWeek: number | null = null) {
  const previousById = new Map(data.previousRows.map((row) => [row.channelId, row]));
  const comparisons = data.rows.map((row) => {
    const current = entryWeek(row, selectedWeek);
    const previous = selectedWeek === 1 ? entryWeek(previousById.get(row.channelId), 5) : entryWeek(row, selectedWeek - 1);
    const salesDelta = entryDelta(current.salesAmountBase, previous.salesAmountBase);
    const adDelta = entryDelta(current.adSpendBase, previous.adSpendBase);
    const currentRoi = entryRatio(current.salesAmountBase, current.adSpendBase);
    const previousRoi = entryRatio(previous.salesAmountBase, previous.adSpendBase);
    const adRatio = entryRatio(current.adSpendBase, current.salesAmountBase);
    const alerts: string[] = [];
    if (current.salesAmountOriginal === null || current.adSpendOriginal === null) alerts.push("本周待补数据");
    if (salesDelta !== null && adDelta !== null && salesDelta < 0 && adDelta > 0) alerts.push("广告增加、销售下降");
    if (currentRoi !== null && previousRoi !== null && currentRoi < previousRoi) alerts.push(salesDelta !== null && salesDelta > 0 ? "销售上涨、ROI 下降" : "ROI 下降");
    if (adRatio !== null && adRatio >= 0.25) alerts.push("广告占销 ≥ 25%");
    const trend = current.salesAmountBase === null ? "missing" : previous.salesAmountBase === null ? "uncompared" : salesDelta! > 0 ? "up" : salesDelta! < 0 ? "down" : "flat";
    return { row, current, previous, salesDelta, adDelta, salesRate: entryChangeRate(current.salesAmountBase, previous.salesAmountBase), adRate: entryChangeRate(current.adSpendBase, previous.adSpendBase), currentRoi, previousRoi, adRatio, trend, alerts };
  });
  const totals = data.rows.map((row) => periodTotals(row, statsWeek));
  const sales = sumKnown(totals.map((item) => item.sales));
  const ad = sumKnown(totals.map((item) => item.ad));
  const adRatio = entryRatio(ad, sales);
  const previousTotals = data.previousRows.map((row) => periodTotals(row, statsWeek));
  const previousSales = sumKnown(previousTotals.map((item) => item.sales));
  const previousAd = sumKnown(previousTotals.map((item) => item.ad));
  const previousAdRatio = entryRatio(previousAd, previousSales);
  const monthComparison = {
    previousSales, previousAd, previousAdRatio,
    salesRate: entryChangeRate(sales, previousSales),
    adRate: entryChangeRate(ad, previousAd),
    adRatioRate: entryChangeRate(adRatio, previousAdRatio),
  };
  const blocks = Array.from(new Set(data.rows.map((row) => row.businessBlock))).map((block) => {
    const items = data.rows.filter((row) => row.businessBlock === block);
    const blockSales = sumKnown(items.map((row) => periodTotals(row, statsWeek).sales));
    const blockAd = sumKnown(items.map((row) => periodTotals(row, statsWeek).ad));
    return { key: block, name: items[0].businessBlockLabel, sales: blockSales, ad: blockAd, roi: entryRatio(blockSales, blockAd), count: items.length };
  });
  const weekly = [1, 2, 3, 4, 5].map((number) => ({
    week: `W${number}`, sales: sumKnown(data.rows.map((row) => entryWeek(row, number).salesAmountBase)), ad: sumKnown(data.rows.map((row) => entryWeek(row, number).adSpendBase)),
    completed: data.rows.filter((row) => entryWeek(row, number).salesAmountOriginal !== null && entryWeek(row, number).adSpendOriginal !== null).length,
  }));
  return {
    sales, ad, roi: entryRatio(sales, ad), adRatio, monthComparison, blocks, weekly, comparisons,
    up: comparisons.filter((item) => item.trend === "up").length,
    down: comparisons.filter((item) => item.trend === "down").length,
    completed: comparisons.filter((item) => item.current.salesAmountOriginal !== null && item.current.adSpendOriginal !== null).length,
    populated: totals.filter((item) => item.sales !== null || item.ad !== null).length,
    topSales: data.rows.map((row) => ({ row, sales: periodTotals(row, statsWeek).sales })).filter((item) => item.sales !== null).sort((a, b) => b.sales! - a.sales!).slice(0, 5),
  };
}
