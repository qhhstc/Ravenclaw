import test from "node:test";
import assert from "node:assert/strict";
import { analyzeEntry, compareChannelRoi, entryChangeRate, entryRatio, sortChannelRoi, sumKnown } from "../src/lib/channel-entry-analysis";
import type { EntryData, EntryRow } from "../src/lib/channel-entry-types";
import { resolveChannelBusinessBlock } from "../src/lib/business-blocks";

function row(id: number, sales: number | null, ad: number | null, weekNumber = 1): EntryRow {
  return { channelId: id, businessBlock: "amazon", businessBlockLabel: "亚马逊", businessLine: `渠道${id}`, channelName: "整体", owner: "", remark: "", currency: "CNY", exchangeRate: 1, version: "test", updatedAt: null, editable: true, weeks: [1, 2, 3, 4, 5].map((week) => ({ weekNumber: week, salesAmountOriginal: week === weekNumber ? sales : null, adSpendOriginal: week === weekNumber ? ad : null, salesAmountBase: week === weekNumber ? sales : null, adSpendBase: week === weekNumber ? ad : null })) };
}
const data = (rows: EntryRow[], previousRows: EntryRow[] = []): EntryData => ({ year: 2027, month: 1, rows, previousRows, previousMonth: { year: 2026, month: 12 }, latestWeek: 1, updatedAt: null });
function twoWeeks(id: number, previousSales: number | null, previousAd: number | null, sales: number | null, ad: number | null) {
  const result = row(id, previousSales, previousAd);
  result.weeks[1] = row(id, sales, ad, 2).weeks[1];
  return result;
}

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

test("source channel group wins over legacy all-DTC metadata", () => {
  assert.equal(resolveChannelBusinessBlock({ channelGroup: "亚马逊", businessBlock: "independent_site", businessLine: "CALEMBOU-US", platformName: "Manual" }), "amazon");
  assert.equal(resolveChannelBusinessBlock({ channelGroup: "TikTok", businessBlock: "independent_site", businessLine: "商品卡", platformName: "Manual" }), "tiktok");
  assert.equal(resolveChannelBusinessBlock({ channelGroup: "独立站", businessLine: "calembou付费社媒" }), "independent_site");
  assert.equal(resolveChannelBusinessBlock({ channelGroup: "B端", platformName: "Manual" }), "b2b");
});

test("unknown groups fall through to explicit block/platform, not independent site", () => {
  assert.equal(resolveChannelBusinessBlock({ channelGroup: "Google Ads", businessBlock: "b2b" }), "b2b");
  assert.equal(resolveChannelBusinessBlock({ businessLine: "BAHOMU-US", platformName: "Amazon" }), "amazon");
  assert.equal(resolveChannelBusinessBlock({ businessLine: "自定义渠道", storeType: "tiktok_shop" }), "tiktok");
  assert.equal(resolveChannelBusinessBlock({ businessLine: "自定义渠道", platformName: "Manual" }), "other");
});

test("board chart uses resolved categories and preserves amount totals", () => {
  const rows = [row(1, 100, 20), row(2, 200, 30), row(3, 300, 40)];
  for (const [index, group] of ["亚马逊", "独立站", "TikTok"].entries()) rows[index].businessBlock = resolveChannelBusinessBlock({ channelGroup: group, businessBlock: "independent_site" });
  const result = analyzeEntry(data(rows), 1);
  assert.deepEqual(result.blocks.map((block) => block.key), ["amazon", "independent_site", "tiktok"]);
  assert.equal(result.sales, 600);
  assert.equal(result.ad, 90);
});

test("channel ROI ranks individual channels, never the aggregate or average weekly ratio", () => {
  const first = row(1, 100, 10);
  first.weeks[1] = row(1, 200, 100, 2).weeks[1];
  const second = row(2, 200, 20);
  const result = sortChannelRoi(compareChannelRoi([first, second]));
  assert.deepEqual(result.map((item) => item.row.channelId), [2, 1]);
  assert.equal(result[0].roi, 10);
  assert.equal(result[1].roi, 300 / 110);
  assert.equal(result[1].adRatio, 110 / 300);
  assert.deepEqual(result[1].activeWeeks, [1, 2]);
});

test("single-week ROI ignores other weeks and recalculates as saved data changes", () => {
  const first = row(1, 100, 10);
  first.weeks[1] = row(1, 20, 10, 2).weeks[1];
  assert.equal(compareChannelRoi([first], 1)[0].roi, 10);
  assert.equal(compareChannelRoi([first], 2)[0].roi, 2);
  assert.equal(compareChannelRoi([first], 3)[0].status, "missing");
  first.weeks[1].salesAmountBase = 50;
  assert.equal(compareChannelRoi([first], 2)[0].roi, 5);
});

test("missing spend never yields an inflated monthly ROI", () => {
  const first = row(1, 100, 10);
  first.weeks[1] = row(1, 200, null, 2).weeks[1];
  const result = compareChannelRoi([first])[0];
  assert.equal(result.sales, 300);
  assert.equal(result.ad, 10);
  assert.equal(result.roi, null);
  assert.equal(result.adRatio, null);
  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.incompleteWeeks, [2]);
  assert.equal(compareChannelRoi([first], 1)[0].roi, 10);
});

test("sales and spend recorded in disjoint weeks cannot be compared", () => {
  const first = row(1, 100, null);
  first.weeks[1] = row(1, null, 10, 2).weeks[1];
  const result = compareChannelRoi([first])[0];
  assert.equal(result.roi, null);
  assert.deepEqual(result.incompleteWeeks, [1, 2]);
});

test("zero sales is a valid ROI; missing and zero spend are distinct", () => {
  const result = compareChannelRoi([row(1, 0, 10), row(2, 100, 0), row(3, 0, 0), row(4, 100, null), row(5, null, null), row(6, null, 10)]);
  assert.equal(result[0].roi, 0);
  assert.equal(result[0].status, "ready");
  assert.equal(result[1].status, "no-ad");
  assert.equal(result[1].roi, null);
  assert.equal(result[1].adRatio, 0);
  assert.equal(result[2].status, "no-ad");
  assert.equal(result[3].status, "incomplete");
  assert.equal(result[4].status, "missing");
  assert.equal(result[5].status, "incomplete");
});

test("ROI uses base currency per week, not original currency or current FX", () => {
  const first = row(1, 100, 10);
  first.currency = "USD";
  first.exchangeRate = 7;
  first.weeks[0].salesAmountBase = 700;
  first.weeks[0].adSpendBase = 70;
  first.weeks[1] = row(1, 100, 20, 2).weeks[1];
  first.weeks[1].salesAmountBase = 600;
  first.weeks[1].adSpendBase = 120;
  const result = compareChannelRoi([first])[0];
  assert.equal(result.sales, 1300);
  assert.equal(result.ad, 190);
  assert.equal(result.roi, 1300 / 190);
});

test("both ROI sorts keep undefined last, negatives valid, equal scores stable, and source untouched", () => {
  const rows = [row(5, null, null), row(1, -100, 10), row(2, 0, 10), row(4, 100, 10), row(3, 200, 20)];
  rows[3].businessLine = rows[4].businessLine;
  const source = JSON.stringify(rows);
  const result = compareChannelRoi(rows);
  assert.deepEqual(sortChannelRoi(result).map((item) => item.row.channelId), [3, 4, 2, 1, 5]);
  assert.deepEqual(sortChannelRoi(result, "asc").map((item) => item.row.channelId), [1, 2, 3, 4, 5]);
  assert.deepEqual(result.map((item) => item.row.channelId), [5, 1, 2, 4, 3]);
  assert.equal(JSON.stringify(rows), source);
  assert.deepEqual(compareChannelRoi([]), []);
});

test("weekly ROI compares each channel to its own previous week with increases, decreases and flat values", () => {
  const result = compareChannelRoi([
    twoWeeks(1, 100, 20, 180, 30),
    twoWeeks(2, 400, 40, 180, 30),
    twoWeeks(3, 100, 20, 150, 30),
  ], 2);
  assert.deepEqual(result.map(({ roi, previousRoi, roiDelta, roiRate }) => ({ roi, previousRoi, roiDelta, roiRate })), [
    { roi: 6, previousRoi: 5, roiDelta: 1, roiRate: 0.2 },
    { roi: 6, previousRoi: 10, roiDelta: -4, roiRate: -0.4 },
    { roi: 5, previousRoi: 5, roiDelta: 0, roiRate: 0 },
  ]);
  assert.equal(result[0].sales, 180);
  assert.equal(result[0].ad, 30);
});

test("January W1 ROI matches December W5 by channel ID, never falls back to W4", () => {
  const current = [row(1, 180, 30), row(2, 200, 20), row(3, 100, 10)];
  const previous = [row(2, 100, 20, 5), row(1, 400, 40, 5), row(3, 50, 10, 4), row(4, 900, 10, 5)];
  current.forEach((item) => { item.businessLine = "重复渠道名"; });
  previous.forEach((item) => { item.businessLine = "重复渠道名"; });
  const january = data(current, previous);
  const result = compareChannelRoi(january.rows, 1, january.previousRows);
  assert.deepEqual(result.map((item) => item.previousRoi), [10, 5, null]);
  assert.deepEqual(result.map((item) => item.roiRate), [-0.4, 1, null]);
  assert.equal(result[2].previousStatus, "missing");
  assert.equal(result[2].roiDelta, null);
  assert.equal(result.length, 3);
});

test("ROI change distinguishes zero baseline, zero current ROI and negative baselines", () => {
  const result = compareChannelRoi([
    twoWeeks(1, 0, 10, 20, 10),
    twoWeeks(2, 50, 10, 0, 10),
    twoWeeks(3, -50, 10, -20, 10),
  ], 2);
  assert.equal(result[0].roiDelta, 2);
  assert.equal(result[0].roiRate, null);
  assert.equal(result[0].previousStatus, "ready");
  assert.equal(result[1].roiDelta, -5);
  assert.equal(result[1].roiRate, -1);
  assert.equal(result[2].roiDelta, 3);
  assert.equal(result[2].roiRate, 0.6);
});

test("missing fields or zero ad spend in either week never produce a trend", () => {
  const result = compareChannelRoi([
    twoWeeks(1, 100, null, 200, 20),
    twoWeeks(2, 100, 0, 200, 20),
    twoWeeks(3, null, null, 200, 20),
    twoWeeks(4, 100, 10, 200, null),
    twoWeeks(5, 100, 10, 200, 0),
    twoWeeks(6, 100, 10, null, null),
  ], 2);
  for (const item of result) {
    assert.equal(item.roiDelta, null);
    assert.equal(item.roiRate, null);
  }
  assert.deepEqual(result.slice(0, 3).map((item) => item.previousStatus), ["incomplete", "no-ad", "missing"]);
  assert.deepEqual(result.slice(3).map((item) => item.status), ["incomplete", "no-ad", "missing"]);
});

test("ROI change sorting is signed, stable and keeps unavailable rates last in both directions", () => {
  const result = compareChannelRoi([
    twoWeeks(1, 100, 10, 50, 10), // -50%
    twoWeeks(2, 10, 10, 20, 10), // +100%, not the highest current ROI
    twoWeeks(3, 0, 10, 1000, 10), // undefined rate despite highest ROI
    twoWeeks(4, 100, 10, 100, 10), // flat
    twoWeeks(5, 100, 10, 200, 10), // +100%, stable ID tie break
  ], 2);
  assert.deepEqual(sortChannelRoi(result, "desc", "roiRate").map((item) => item.row.channelId), [2, 5, 4, 1, 3]);
  assert.deepEqual(sortChannelRoi(result, "asc", "roiRate").map((item) => item.row.channelId), [1, 4, 2, 5, 3]);
  assert.deepEqual(sortChannelRoi(result).map((item) => item.row.channelId), [3, 5, 4, 1, 2]);
  assert.deepEqual(result.map((item) => item.row.channelId), [1, 2, 3, 4, 5]);
});

test("monthly ROI remains unchanged and has no weekly comparison fields", () => {
  const first = twoWeeks(1, 100, 10, 200, 100);
  const result = compareChannelRoi([first], null, [row(1, 500, 10, 5)])[0];
  assert.equal(result.roi, 300 / 110);
  assert.equal(result.previousRoi, null);
  assert.equal(result.previousStatus, null);
  assert.equal(result.roiDelta, null);
  assert.equal(result.roiRate, null);
});
