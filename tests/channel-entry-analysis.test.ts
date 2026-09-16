import test from "node:test";
import assert from "node:assert/strict";
import { analyzeEntry, entryChangeRate, entryRatio, sumKnown } from "../src/lib/channel-entry-analysis";
import type { EntryData, EntryRow } from "../src/lib/channel-entry-types";

function row(id: number, sales: number | null, ad: number | null, weekNumber = 1): EntryRow {
  return { channelId: id, businessBlock: "amazon", businessBlockLabel: "亚马逊", businessLine: `渠道${id}`, channelName: "整体", owner: "", remark: "", currency: "CNY", exchangeRate: 1, version: "test", updatedAt: null, editable: true, weeks: [1, 2, 3, 4, 5].map((week) => ({ weekNumber: week, salesAmountOriginal: week === weekNumber ? sales : null, adSpendOriginal: week === weekNumber ? ad : null, salesAmountBase: week === weekNumber ? sales : null, adSpendBase: week === weekNumber ? ad : null })) };
}
const data = (rows: EntryRow[], previousRows: EntryRow[] = []): EntryData => ({ year: 2027, month: 1, rows, previousRows, previousMonth: { year: 2026, month: 12 }, latestWeek: 1, updatedAt: null });

test("missing is not zero; zero remains a confirmed input", () => {
  assert.equal(sumKnown([null, null]), null);
  assert.equal(sumKnown([null, 0]), 0);
  const result = analyzeEntry(data([row(1, null, null), row(2, 0, 0)]), 1);
  assert.equal(result.completed, 1);
  assert.equal(result.down, 0);
  assert.equal(result.weekly[1].sales, null);
});
test("January W1 compares to prior December W5, not latest nonzero week", () => {
  const result = analyzeEntry(data([row(1, 0, 20)], [row(1, 100, 10, 5)]), 1);
  assert.equal(result.down, 1);
  assert.equal(result.comparisons[0].salesRate, -1);
  assert.ok(result.comparisons[0].alerts.includes("广告增加、销售下降"));
  assert.equal(analyzeEntry(data([row(1, 0, 20)], [row(1, 100, 10, 4)]), 1).down, 0);
});
test("ROI is ratio of totals, not average channel ratios", () => {
  const result = analyzeEntry(data([row(1, 100, 10), row(2, 200, 100)]), 1);
  assert.equal(result.roi, 300 / 110);
});
test("zero/negative denominators never produce infinity", () => {
  assert.equal(entryChangeRate(100, 0), null);
  assert.equal(entryRatio(100, 0), null);
  assert.equal(entryRatio(20, -100), null);
  assert.equal(entryChangeRate(0, -100), 1);
});
