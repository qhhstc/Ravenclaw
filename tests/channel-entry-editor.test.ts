import test from "node:test";
import assert from "node:assert/strict";
import { entryActorError, entryDraftOf, entryHasSavedData, EntryRequestError, entrySaveError, saveEntryBatch } from "../src/lib/channel-entry-editor";
import type { EntryRow } from "../src/lib/channel-entry-types";

function row(channelId: number): EntryRow {
  return { channelId, businessBlock: "amazon", businessBlockLabel: "亚马逊", businessLine: `渠道${channelId}`, channelName: "整体", owner: "负责人", remark: "", currency: "CNY", exchangeRate: 1, version: "v1", updatedAt: null, editable: true, weeks: [1, 2, 3, 4, 5].map((weekNumber) => ({ weekNumber, salesAmountOriginal: null, adSpendOriginal: null, salesAmountBase: null, adSpendBase: null })) };
}

test("actor name is required independently of the channel owner", () => {
  assert.ok(entryActorError(""));
  assert.ok(entryActorError(" \t\n "));
  assert.equal(entryActorError("程菲"), "");
  assert.equal(entryActorError(" 程菲 "), "");
});

test("prepared empty records are not labeled saved data, confirmed zero is", () => {
  const blank = row(1);
  assert.equal(entryHasSavedData(blank), false);
  blank.weeks[0].salesAmountOriginal = 0;
  assert.equal(entryHasSavedData(blank), true);
});

test("drafts are independent of original saved weeks", () => {
  const original = row(1);
  const draft = entryDraftOf(original);
  draft.weeks[0].salesAmountOriginal = 50;
  draft.owner = "新负责人";
  assert.equal(original.weeks[0].salesAmountOriginal, null);
  assert.equal(original.owner, "负责人");
});

test("batch saves in order, reports each saved row, and keeps drafts immutable", async () => {
  const items = [row(1), row(2)].map((row) => ({ row, draft: entryDraftOf(row) }));
  const snapshot = JSON.stringify(items);
  const calls: number[] = [], progress: number[] = [];
  const result = await saveEntryBatch(items, async ({ row }) => { calls.push(row.channelId); return { ...row, version: "v2" }; }, (row, count) => {
    assert.equal(row.version, "v2"); progress.push(count);
  });
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(progress, [1, 2]);
  assert.equal(result.saved.length, 2);
  assert.equal(result.failed, null);
  assert.equal(JSON.stringify(items), snapshot);
});

test("partial batch stops after failure and never reports remaining rows as saved", async () => {
  const items = [row(1), row(2), row(3)].map((row) => ({ row, draft: entryDraftOf(row) }));
  const calls: number[] = [], progress: number[] = [];
  const result = await saveEntryBatch(items, async ({ row }) => {
    calls.push(row.channelId);
    if (row.channelId === 2) throw new TypeError("Failed to fetch");
    return row;
  }, (_row, count) => progress.push(count));
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(progress, [1]);
  assert.equal(result.saved.length, 1);
  assert.equal(result.failed?.channelId, 2);
  assert.match(result.failed!.message, /网络连接失败.*修改已保留/);
});

test("conflicts remain errors without implicit overwrite or retry", async () => {
  let calls = 0;
  const result = await saveEntryBatch([{ row: row(1), draft: entryDraftOf(row(1)) }], async () => {
    calls++; throw new EntryRequestError("stale revision", 409);
  }, () => { assert.fail("No row was saved"); });
  assert.equal(calls, 1);
  assert.equal(result.saved.length, 0);
  assert.match(result.failed!.message, /其他人修改/);
  assert.match(result.failed!.message, /未覆盖/);
  assert.match(result.failed!.message, /刷新核对/);
  assert.match(entrySaveError(new EntryRequestError("广告费必须非负", 400)), /广告费必须非负/);
});
