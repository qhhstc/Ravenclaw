import { entryDraftOf } from "./channel-entry-editor";
import type { EntryDraft, EntryPeriod, EntryRow } from "./channel-entry-types";

export const ENTRY_DRAFT_TTL = 7 * 86400000;
export type CachedEntry = { base: EntryDraft; draft: EntryDraft };
export type EntryDraftCache = EntryPeriod & { schema: 1; savedAt: number; writerId: string; actorName: string; entries: Record<string, CachedEntry> };
export type DraftConflict = { field: string; label: string; mine: string | number | null; server: string | number | null };
export const entryDraftKey = (period: EntryPeriod) => `channel-entry-drafts:v1:${period.year}-${period.month}`;

function fields(draft: EntryDraft) {
  return [
    { field: "owner", label: "渠道负责人", value: draft.owner },
    { field: "remark", label: "备注", value: draft.remark },
    ...draft.weeks.flatMap((week) => (["salesAmountOriginal", "adSpendOriginal"] as const).map((key) => ({ field: `${week.weekNumber}:${key}`, label: `W${week.weekNumber}${key === "salesAmountOriginal" ? "销售" : "广告"}`, value: week[key] }))),
  ];
}

function assign(draft: EntryDraft, field: string, value: string | number | null) {
  if (field === "owner" || field === "remark") { draft[field] = String(value ?? ""); return; }
  const [number, key] = field.split(":");
  const week = draft.weeks.find((item) => item.weekNumber === Number(number));
  if (week && (key === "salesAmountOriginal" || key === "adSpendOriginal")) week[key] = value as number | null;
}

export function sameEntryValues(a: EntryDraft, b: EntryDraft) {
  const other = new Map(fields(b).map((field) => [field.field, field.value]));
  return fields(a).every((field) => other.get(field.field) === field.value);
}

export function rebaseEntryDraft(cached: CachedEntry, row: EntryRow) {
  const latest = entryDraftOf(row);
  const merged = structuredClone(latest);
  const base = structuredClone(latest);
  const previous = new Map(fields(cached.base).map((field) => [field.field, field.value]));
  const server = new Map(fields(latest).map((field) => [field.field, field.value]));
  const conflicts: DraftConflict[] = [];
  for (const field of fields(cached.draft)) {
    const old = previous.get(field.field)!;
    const current = server.get(field.field)!;
    if (field.value === old || field.value === current) continue;
    assign(merged, field.field, field.value);
    if (current !== old) {
      conflicts.push({ field: field.field, label: field.label, mine: field.value, server: current });
      // Retain the original base for unresolved fields so another reload cannot bypass the conflict.
      assign(base, field.field, old);
    }
  }
  return { base, draft: sameEntryValues(merged, latest) ? null : merged, conflicts };
}

export function resolveEntryDraft(draft: EntryDraft, row: EntryRow, conflicts: DraftConflict[], choice: "mine" | "server") {
  const merged = structuredClone(draft);
  const base = entryDraftOf(row);
  merged.version = base.version;
  for (const conflict of conflicts) assign(merged, conflict.field, choice === "mine" ? conflict.mine : conflict.server);
  return { base, draft: sameEntryValues(merged, base) ? null : merged };
}

export function restoreEntryDrafts(entries: Record<string, CachedEntry>, rows: EntryRow[]) {
  const drafts: Record<number, EntryDraft> = {}, bases: Record<number, EntryDraft> = {}, conflicts: Record<number, DraftConflict[]> = {};
  const unavailable: Record<string, CachedEntry> = {};
  for (const [id, cached] of Object.entries(entries)) {
    const row = rows.find((item) => item.channelId === Number(id));
    if (!row?.editable) { unavailable[id] = cached; continue; }
    const restored = rebaseEntryDraft(cached, row);
    if (!restored.draft) continue; // An uncertain prior save may already have succeeded.
    drafts[row.channelId] = restored.draft;
    bases[row.channelId] = restored.base;
    if (restored.conflicts.length) conflicts[row.channelId] = restored.conflicts;
  }
  return { drafts, bases, conflicts, unavailable };
}

function isDraft(value: unknown): value is EntryDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as EntryDraft;
  if (typeof draft.owner !== "string" || draft.owner.length > 80 || typeof draft.remark !== "string" || draft.remark.length > 2000 || typeof draft.version !== "string" || !draft.version.length || draft.version.length > 128 || !Array.isArray(draft.weeks) || draft.weeks.length !== 5) return false;
  const seen = new Set<number>();
  for (const week of draft.weeks) {
    if (!week || !Number.isInteger(week.weekNumber) || week.weekNumber < 1 || week.weekNumber > 5 || seen.has(week.weekNumber)) return false;
    seen.add(week.weekNumber);
    for (const value of [week.salesAmountOriginal, week.adSpendOriginal]) if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 999999999999)) return false;
  }
  return true;
}

export function parseEntryDraftCache(raw: string, period: EntryPeriod, now = Date.now()): EntryDraftCache | null {
  if (raw.length > 2000000) throw new Error("本机草稿过大，暂不能自动恢复");
  const cache = JSON.parse(raw) as EntryDraftCache;
  if (!cache || cache.schema !== 1 || cache.year !== period.year || cache.month !== period.month || typeof cache.savedAt !== "number" || !Number.isFinite(cache.savedAt) || cache.savedAt > now + 60000 || typeof cache.writerId !== "string" || cache.writerId.length > 100 || typeof cache.actorName !== "string" || cache.actorName.length > 80 || !cache.entries || typeof cache.entries !== "object" || Array.isArray(cache.entries)) throw new Error("本机草稿格式不正确，原备份已保留");
  const entries = Object.entries(cache.entries);
  if (entries.length > 500 || entries.some(([id, entry]) => !/^[1-9]\d*$/.test(id) || !entry || !isDraft(entry.base) || !isDraft(entry.draft))) throw new Error("本机草稿内容不完整，原备份已保留");
  return now - cache.savedAt > ENTRY_DRAFT_TTL ? null : cache;
}

export function makeEntryDraftCache(period: EntryPeriod, actorName: string, drafts: Record<number, EntryDraft>, bases: Record<number, EntryDraft>, rows: EntryRow[], writerId: string, unavailable: Record<string, CachedEntry> = {}, savedAt = Date.now()): EntryDraftCache {
  const entries = { ...unavailable };
  for (const [id, draft] of Object.entries(drafts)) {
    const row = rows.find((item) => item.channelId === Number(id));
    const base = bases[Number(id)] ?? (row ? entryDraftOf(row) : null);
    if (base) entries[id] = { base, draft };
  }
  return { schema: 1, ...period, actorName, savedAt, writerId, entries };
}

export function persistEntryDraftCache(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, cache: EntryDraftCache, replace?: EntryDraftCache) {
  const raw = storage.getItem(entryDraftKey(cache));
  const existing = raw ? parseEntryDraftCache(raw, cache) : null;
  if (existing && existing.writerId !== cache.writerId && Date.now() - existing.savedAt <= ENTRY_DRAFT_TTL) {
    if (!replace || JSON.stringify(existing) !== JSON.stringify(replace)) {
      if (!Object.keys(cache.entries).length && !replace) return;
      throw new Error("另一窗口更新了本月草稿，请先保存到网站或重新加载草稿；原备份未覆盖。");
    }
  }
  if (Object.keys(cache.entries).length) storage.setItem(entryDraftKey(cache), JSON.stringify(cache));
  else storage.removeItem(entryDraftKey(cache));
}
