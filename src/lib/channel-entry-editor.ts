import type { EntryDraft, EntryRow } from "./channel-entry-types";

export function entryDraftOf(row: EntryRow): EntryDraft {
  return { owner: row.owner, remark: row.remark, version: row.version, weeks: row.weeks.map(({ weekNumber, salesAmountOriginal, adSpendOriginal }) => ({ weekNumber, salesAmountOriginal, adSpendOriginal })) };
}

export function entryActorError(name: string) {
  return name.trim() ? "" : "请填写本次操作人的姓名，不是表格中的渠道负责人。";
}

export function entryHasSavedData(row: EntryRow) {
  return row.weeks.some((week) => week.salesAmountOriginal !== null || week.adSpendOriginal !== null);
}

export class EntryRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function entrySaveError(failure: unknown) {
  if (failure instanceof EntryRequestError && failure.status === 409) return "这行已被其他人修改，未覆盖对方数据。当前修改已保留，请先记录修改内容，再刷新核对。";
  if (failure instanceof TypeError) return "网络连接失败，修改已保留。请检查网络后重试。";
  return `${failure instanceof Error ? failure.message : "保存失败"}（修改已保留）`;
}

export type PendingEntryRow = { row: EntryRow; draft: EntryDraft };

// Stop on the first failed row. Successful rows stay saved; all other drafts stay local.
export async function saveEntryBatch(
  pending: PendingEntryRow[],
  persist: (item: PendingEntryRow) => Promise<EntryRow>,
  onSaved: (row: EntryRow, count: number) => void,
) {
  const saved: EntryRow[] = [];
  for (const item of pending) {
    let row: EntryRow;
    try { row = await persist(item); }
    catch (failure) { return { saved, failed: { channelId: item.row.channelId, message: entrySaveError(failure) } }; }
    saved.push(row);
    onSaved(row, saved.length);
  }
  return { saved, failed: null };
}
