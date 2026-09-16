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

export function analyzeEntry(data: EntryData, selectedWeek: number) {
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
  const totals = data.rows.map(monthTotals);
  const sales = sumKnown(totals.map((item) => item.sales));
  const ad = sumKnown(totals.map((item) => item.ad));
  const blocks = Array.from(new Set(data.rows.map((row) => row.businessBlock))).map((block) => {
    const items = data.rows.filter((row) => row.businessBlock === block);
    const blockSales = sumKnown(items.map((row) => monthTotals(row).sales));
    const blockAd = sumKnown(items.map((row) => monthTotals(row).ad));
    return { key: block, name: items[0].businessBlockLabel, sales: blockSales, ad: blockAd, roi: entryRatio(blockSales, blockAd), count: items.length };
  });
  const weekly = [1, 2, 3, 4, 5].map((number) => ({
    week: `W${number}`, sales: sumKnown(data.rows.map((row) => entryWeek(row, number).salesAmountBase)), ad: sumKnown(data.rows.map((row) => entryWeek(row, number).adSpendBase)),
    completed: data.rows.filter((row) => entryWeek(row, number).salesAmountOriginal !== null && entryWeek(row, number).adSpendOriginal !== null).length,
  }));
  return {
    sales, ad, roi: entryRatio(sales, ad), adRatio: entryRatio(ad, sales), blocks, weekly, comparisons,
    up: comparisons.filter((item) => item.trend === "up").length,
    down: comparisons.filter((item) => item.trend === "down").length,
    completed: comparisons.filter((item) => item.current.salesAmountOriginal !== null && item.current.adSpendOriginal !== null).length,
    populated: totals.filter((item) => item.sales !== null || item.ad !== null).length,
    topSales: data.rows.map((row) => ({ row, sales: monthTotals(row).sales })).filter((item) => item.sales !== null).sort((a, b) => b.sales! - a.sales!).slice(0, 5),
  };
}
