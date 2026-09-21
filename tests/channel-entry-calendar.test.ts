import test from "node:test";
import assert from "node:assert/strict";
import { entryCalendarWeeks, entryMonthComparisonScope, previousEntryWeek, displayedEntryWeeks } from "../src/lib/channel-entry-calendar";
import { analyzeEntry } from "../src/lib/channel-entry-analysis";
import type { EntryData, EntryRow } from "../src/lib/channel-entry-types";

function row(id: number, amounts: Array<number | null>): EntryRow {
  return { channelId: id, businessBlock: "amazon", businessBlockLabel: "亚马逊", businessLine: "测试", channelName: "整体", owner: "", remark: "", currency: "USD", exchangeRate: 6.65, version: "v1", updatedAt: null, editable: true, weeks: [1, 2, 3, 4, 5].map((weekNumber) => ({ weekNumber, salesAmountOriginal: amounts[weekNumber - 1] ?? null, adSpendOriginal: amounts[weekNumber - 1] === null || amounts[weekNumber - 1] === undefined ? null : 10, salesAmountBase: amounts[weekNumber - 1] ?? null, adSpendBase: amounts[weekNumber - 1] === null || amounts[weekNumber - 1] === undefined ? null : 10 })) };
}
function september(): EntryData {
  return { year: 2026, month: 9, previousMonth: { year: 2026, month: 8 }, rows: [row(1, [100, 200, 300])], previousRows: [row(1, [50, 100, 150, 1000, 1000])], latestWeek: 3, updatedAt: null, asOfDate: "2026-09-21" };
}

test("calendar matches original import: Monday–Sunday, owned by ending month", () => {
  assert.deepEqual(entryCalendarWeeks({ year: 2026, month: 8 }).map((week) => week.label), ["07/27–08/02", "08/03–08/09", "08/10–08/16", "08/17–08/23", "08/24–08/30"]);
  assert.deepEqual(entryCalendarWeeks({ year: 2026, month: 9 }).map((week) => week.label), ["08/31–09/06", "09/07–09/13", "09/14–09/20", "09/21–09/27"]);
  assert.equal(entryCalendarWeeks({ year: 2024, month: 2 }).length, 4);
});

test("cross-month and cross-year comparisons use actual consecutive weeks", () => {
  assert.deepEqual(previousEntryWeek({ year: 2026, month: 8 }, 1), { year: 2026, month: 7, weekNumber: 4 });
  assert.deepEqual(previousEntryWeek({ year: 2026, month: 9 }, 1), { year: 2026, month: 8, weekNumber: 5 });
  assert.deepEqual(previousEntryWeek({ year: 2027, month: 1 }, 1), { year: 2026, month: 12, weekNumber: 4 });
  assert.deepEqual(previousEntryWeek({ year: 2024, month: 1 }, 1), { year: 2023, month: 12, weekNumber: 5 });
  assert.equal(previousEntryWeek({ year: 2026, month: 9 }, 5), null);
});

test("unfinished month compares equal reported progress without changing headline amounts", () => {
  const data = september();
  const snapshot = JSON.stringify(data);
  const result = analyzeEntry(data, 3);
  assert.equal(result.sales, 600);
  assert.equal(result.monthComparison.previousSales, 300);
  assert.equal(result.monthComparison.salesRate, 1);
  assert.equal(result.comparisonScope.label, "W1–W3");
  assert.equal(result.comparisonScope.partial, true);
  assert.equal(JSON.stringify(data), snapshot);
  assert.equal(result.weekly.length, 4);
  assert.equal(result.weekly[2].dateLabel, "09/14–09/20");
});

test("single-week comparison stays same-week and past months retain whole-month totals", () => {
  const data = september();
  assert.equal(analyzeEntry(data, 3, 3).monthComparison.previousSales, 150);
  data.asOfDate = "2026-10-01";
  assert.equal(analyzeEntry(data, 3).monthComparison.previousSales, 2300);
  assert.equal(analyzeEntry(data, 3).comparisonScope.partial, false);
});

test("empty months do not fabricate zero growth; confirmed zero is still entered", () => {
  const data = september(); data.rows = [row(1, [])];
  assert.equal(analyzeEntry(data, 1).monthComparison.salesRate, null);
  data.rows = [row(1, [0])];
  assert.equal(analyzeEntry(data, 1).comparisonScope.latest, 1);
  assert.equal(analyzeEntry(data, 1).monthComparison.salesRate, -1);
});

test("legacy values outside the calendar stay visible but never invent a comparison date", () => {
  const data = september(); data.rows[0].weeks[4] = row(1, [null, null, null, null, 400]).weeks[4];
  assert.deepEqual(displayedEntryWeeks(data, data.rows), [1, 2, 3, 4, 5]);
  const result = analyzeEntry(data, 5);
  assert.equal(result.sales, 1000);
  assert.equal(result.comparisonScope.unknownDates, true);
  assert.equal(result.monthComparison.salesRate, null);
  assert.equal(result.comparisons[0].previous.salesAmountBase, null);
});

test("a fifth reported week cannot be invented in a four-week reference month", () => {
  const data = september(); data.year = 2026; data.month = 8; data.asOfDate = "2026-08-30"; data.previousMonth = { year: 2026, month: 7 }; data.rows = [row(1, [100, 100, 100, 100, 100])];
  assert.equal(entryMonthComparisonScope(data, null).comparable, false);
  assert.equal(entryMonthComparisonScope(data, null).label, "无相同周数区间");
});
