import test from "node:test";
import assert from "node:assert/strict";
import { entryDraftOf } from "../src/lib/channel-entry-editor";
import { ENTRY_DRAFT_TTL, entryDraftKey, makeEntryDraftCache, parseEntryDraftCache, persistEntryDraftCache, rebaseEntryDraft, resolveEntryDraft, restoreEntryDrafts } from "../src/lib/channel-entry-drafts";
import type { EntryRow } from "../src/lib/channel-entry-types";

const period = { year: 2026, month: 9 };
function row(): EntryRow {
  return { channelId: 123, businessBlock: "amazon", businessBlockLabel: "亚马逊", businessLine: "测试", channelName: "测试", owner: "负责人", remark: "", currency: "USD", exchangeRate: 6.65, version: "v1", updatedAt: null, editable: true, weeks: [1, 2, 3, 4, 5].map((weekNumber) => ({ weekNumber, salesAmountOriginal: null, adSpendOriginal: null, salesAmountBase: null, adSpendBase: null })) };
}
function fixture() {
  const original = row(), base = entryDraftOf(original), draft = entryDraftOf(original);
  draft.weeks[0].salesAmountOriginal = 0;
  draft.remark = "待保存";
  return { original, base, draft, cache: makeEntryDraftCache(period, "测试人", { 123: draft }, { 123: base }, [original], "first-window") };
}
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

test("cache preserves null/zero, actor, original base and separate month keys", () => {
  const { cache } = fixture();
  assert.deepEqual(parseEntryDraftCache(JSON.stringify(cache), period), cache);
  assert.equal(cache.entries[123].draft.weeks[0].salesAmountOriginal, 0);
  assert.equal(cache.entries[123].base.weeks[0].salesAmountOriginal, null);
  assert.notEqual(entryDraftKey(period), entryDraftKey({ ...period, month: 8 }));
  assert.throws(() => parseEntryDraftCache(JSON.stringify(cache), { ...period, year: 2027 }));
});

test("expired caches cannot restore and malformed caches are not accepted", () => {
  const { cache } = fixture();
  assert.equal(parseEntryDraftCache(JSON.stringify(cache), period, cache.savedAt + ENTRY_DRAFT_TTL + 1), null);
  assert.throws(() => parseEntryDraftCache("not json", period));
  assert.throws(() => parseEntryDraftCache(JSON.stringify({ ...cache, savedAt: Date.now() + 120000 }), period));
  const bad = structuredClone(cache);
  bad.entries[123].draft.weeks[1].weekNumber = 1;
  assert.throws(() => parseEntryDraftCache(JSON.stringify(bad), period));
  bad.entries[123].draft.weeks[1].weekNumber = 2;
  bad.entries[123].draft.weeks[1].salesAmountOriginal = 1e30;
  assert.throws(() => parseEntryDraftCache(JSON.stringify(bad), period));
});

test("rebase keeps independent server edits and current FX version without mutating input", () => {
  const { original, base, draft } = fixture();
  const server = structuredClone(original);
  server.version = "v2"; server.exchangeRate = 6.7; server.owner = "另一人修改";
  server.weeks[1].adSpendOriginal = 10;
  const snapshot = JSON.stringify({ server, base, draft });
  const result = rebaseEntryDraft({ base, draft }, server);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.draft?.version, "v2");
  assert.equal(result.draft?.owner, "另一人修改");
  assert.equal(result.draft?.weeks[0].salesAmountOriginal, 0);
  assert.equal(result.draft?.weeks[1].adSpendOriginal, 10);
  assert.equal(result.draft?.remark, "待保存");
  assert.equal(JSON.stringify({ server, base, draft }), snapshot);
});

test("same-field conflicts survive repeated restoration until explicitly resolved", () => {
  const { original, base, draft } = fixture();
  const server = structuredClone(original);
  server.version = "v2"; server.weeks[0].salesAmountOriginal = 150;
  const first = rebaseEntryDraft({ base, draft }, server);
  assert.equal(first.conflicts.length, 1);
  assert.deepEqual(first.conflicts[0], { field: "1:salesAmountOriginal", label: "W1销售", mine: 0, server: 150 });
  const cache = makeEntryDraftCache(period, "测试人", { 123: first.draft! }, { 123: first.base }, [server], "new-window");
  const restored = restoreEntryDrafts(parseEntryDraftCache(JSON.stringify(cache), period)!.entries, [server]);
  assert.deepEqual(restored.conflicts[123], first.conflicts);
  for (const choice of ["mine", "server"] as const) {
    const resolved = resolveEntryDraft(restored.drafts[123], server, restored.conflicts[123], choice);
    assert.equal(resolved.draft?.weeks[0].salesAmountOriginal, choice === "mine" ? 0 : 150);
    assert.equal(resolved.draft?.remark, "待保存", "unrelated local changes must survive either choice");
    assert.deepEqual(rebaseEntryDraft({ base: resolved.base, draft: resolved.draft! }, server).conflicts, []);
  }
});

test("a repeated save already on the server is removed, but stopped channels remain downloadable", () => {
  const { original, base, draft, cache } = fixture();
  const server = { ...original, owner: draft.owner, remark: draft.remark, version: "v2", weeks: original.weeks.map((week, index) => ({ ...week, ...draft.weeks[index] })) };
  assert.equal(rebaseEntryDraft({ base, draft }, server).draft, null);
  assert.deepEqual(restoreEntryDrafts(cache.entries, [server]).drafts, {});
  assert.deepEqual(restoreEntryDrafts(cache.entries, []).unavailable, cache.entries);
  assert.deepEqual(restoreEntryDrafts(cache.entries, [{ ...server, editable: false }]).unavailable, cache.entries);
});

test("clearing a conflict in favor of saved data can remove the last dirty value", () => {
  const { original, base, draft } = fixture();
  draft.remark = "";
  const server = structuredClone(original); server.version = "v2"; server.weeks[0].salesAmountOriginal = 10;
  const result = rebaseEntryDraft({ base, draft }, server);
  assert.equal(resolveEntryDraft(result.draft!, server, result.conflicts, "server").draft, null);
});

test("one window cannot overwrite or delete another window's draft without exact confirmation", () => {
  const storage = memoryStorage(), { cache } = fixture();
  persistEntryDraftCache(storage, cache);
  const other = { ...cache, writerId: "other-window" };
  assert.throws(() => persistEntryDraftCache(storage, other), /另一窗口/);
  persistEntryDraftCache(storage, { ...other, entries: {} });
  assert.equal(storage.getItem(entryDraftKey(period)), JSON.stringify(cache));
  const stale = { ...cache, savedAt: cache.savedAt - 1 };
  assert.throws(() => persistEntryDraftCache(storage, other, stale));
  persistEntryDraftCache(storage, other, cache);
  assert.equal(storage.getItem(entryDraftKey(period)), JSON.stringify(other));
  assert.throws(() => persistEntryDraftCache(storage, cache), /另一窗口/);
  persistEntryDraftCache(storage, { ...other, entries: {} });
  assert.equal(storage.getItem(entryDraftKey(period)), null);
});

test("storage failure is visible, malformed backups remain intact, expired backups may be replaced", () => {
  const storage = memoryStorage(), { cache } = fixture();
  storage.setItem(entryDraftKey(period), "broken backup");
  assert.throws(() => persistEntryDraftCache(storage, cache));
  assert.equal(storage.getItem(entryDraftKey(period)), "broken backup");
  storage.setItem(entryDraftKey(period), JSON.stringify({ ...cache, writerId: "expired-window", savedAt: Date.now() - ENTRY_DRAFT_TTL - 10 }));
  persistEntryDraftCache(storage, cache);
  assert.equal(storage.getItem(entryDraftKey(period)), JSON.stringify(cache));
  assert.throws(() => persistEntryDraftCache({ ...storage, setItem: () => { throw new Error("QuotaExceededError"); } }, cache), /QuotaExceeded/);
});
