"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { App, Alert, Button, Checkbox, DatePicker, Drawer, Empty, Input, InputNumber, Modal, Select, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BarChartOutlined, DownloadOutlined, EditOutlined, HistoryOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import type { EntryAudit, EntryData, EntryDraft, EntryPeriod, EntryRow } from "@/lib/channel-entry-types";
import { ENTRY_BLOCK_COLORS, entryWeek } from "@/lib/channel-entry-analysis";
import { entryActorError, entryDraftOf, entryHasSavedData, EntryRequestError, saveEntryBatch } from "@/lib/channel-entry-editor";
import { displayedEntryWeeks, entryCalendarWeeks, entryWeekLabel, latestCalendarEntryWeek } from "@/lib/channel-entry-calendar";
import { entryDraftKey, makeEntryDraftCache, parseEntryDraftCache, persistEntryDraftCache, rebaseEntryDraft, resolveEntryDraft, restoreEntryDrafts, type CachedEntry, type DraftConflict, type EntryDraftCache } from "@/lib/channel-entry-drafts";
import EntryDashboard from "./EntryDashboard";
import EntryExchangeRate from "./EntryExchangeRate";
import ThemeToggle from "@/components/common/ThemeToggle";

dayjs.locale("zh-cn");

async function jsonResponse<T>(response: Response): Promise<T> {
  let data;
  try { data = await response.json(); }
  catch { throw new EntryRequestError(`服务响应异常（${response.status}），请稍后重试`, response.status); }
  if (!response.ok) throw new EntryRequestError(data.message || `请求失败 (${response.status})`, response.status);
  return data as T;
}
function displayAuditValue(value: string | number | null) { return value === null || value === "" ? "未填写" : String(value); }

export default function PublicChannelEntryPage({ initialPeriod }: { initialPeriod: EntryPeriod }) {
  const { message, modal } = App.useApp();
  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState<EntryData | null>(null);
  const [drafts, setDrafts] = useState<Record<number, EntryDraft>>({});
  const [draftBases, setDraftBases] = useState<Record<number, EntryDraft>>({});
  const [draftConflicts, setDraftConflicts] = useState<Record<number, DraftConflict[]>>({});
  const [unavailableDrafts, setUnavailableDrafts] = useState<Record<string, CachedEntry>>({});
  const [pendingRestore, setPendingRestore] = useState<EntryDraftCache | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [draftWriterId, setDraftWriterId] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [conflictId, setConflictId] = useState<number | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(64);
  const [actorName, setActorName] = useState("");
  const [actorLoaded, setActorLoaded] = useState(false);
  const [actorTouched, setActorTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ saved: number; total: number } | null>(null);
  const [fxApplying, setFxApplying] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [saveNotice, setSaveNotice] = useState("");
  const saveLock = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statsWeek, setStatsWeek] = useState(0);
  const selectedWeek = statsWeek || Math.max(1, latestCalendarEntryWeek(data ?? period, data?.rows ?? []));
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<string | undefined>();
  const [onlyDirty, setOnlyDirty] = useState(false);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audits, setAudits] = useState<EntryAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const dirtyCount = Object.keys(drafts).length;
  const working = loading || saveProgress !== null || fxApplying;
  const busy = working || pendingRestore !== null;
  const actorError = actorTouched ? entryActorError(actorName) : "";

  useEffect(() => {
    let name = "";
    try { name = localStorage.getItem("channel-entry-actor") || ""; } catch { /* Private browsing can disable storage. */ }
    queueMicrotask(() => { setActorName(name); setActorLoaded(true); setDraftWriterId(crypto.randomUUID()); });
  }, []);
  useEffect(() => { if (actorLoaded) { try { localStorage.setItem("channel-entry-actor", actorName); } catch { /* Name still works for this session. */ } } }, [actorName, actorLoaded]);
  useEffect(() => {
    const toolbar = document.getElementById("entry-global-toolbar");
    if (!toolbar) return;
    const observer = new ResizeObserver(() => setToolbarHeight(Math.ceil(toolbar.getBoundingClientRect().height)));
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!draftWriterId) return;
    const controller = new AbortController();
    let live = true;
    async function load() {
      setLoading(true); setCacheReady(false); setError("");
      try {
        const prepared = await jsonResponse<{ warnings: string[] }>(await fetch("/api/channel-entry/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(period), signal: controller.signal }));
        const query = new URLSearchParams({ year: String(period.year), month: String(period.month) });
        const next = await jsonResponse<EntryData>(await fetch(`/api/channel-entry?${query}`, { cache: "no-store", signal: controller.signal }));
        if (!live) return;
        setData(next); setDrafts({}); setDraftBases({}); setDraftConflicts({}); setUnavailableDrafts({}); setConflictId(null); setRowErrors({}); setSaveNotice(""); setOnlyDirty(false); setWarnings(prepared.warnings || []);
        try {
          const raw = localStorage.getItem(entryDraftKey(period));
          const cached = raw ? parseEntryDraftCache(raw, period) : null;
          if (cached && Object.keys(cached.entries).length && cached.writerId === draftWriterId) {
            const restored = restoreEntryDrafts(cached.entries, next.rows);
            setDrafts(restored.drafts); setDraftBases(restored.bases); setDraftConflicts(restored.conflicts); setUnavailableDrafts(restored.unavailable);
            setRowErrors(Object.fromEntries(Object.entries(restored.conflicts).map(([id, conflicts]) => [id, `有 ${conflicts.length} 处修改冲突，请核对后保存。`])));
            setSaveNotice("本机草稿已恢复，保存后才会计入看板"); setPendingRestore(null);
          } else setPendingRestore(cached && Object.keys(cached.entries).length ? cached : null);
          setStorageWarning(""); setCacheReady(true);
        } catch {
          setPendingRestore(null); setStorageWarning("本机草稿暂不可用，旧备份未删除。请及时保存到网站，避免刷新丢失输入。");
        }
        window.history.replaceState(null, "", `/channel-entry?${query}`);
      } catch (failure) { if (live && !controller.signal.aborted) { setData(null); setError(failure instanceof Error ? failure.message : "数据加载失败"); } }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; controller.abort(); };
  }, [period, refreshKey, draftWriterId]);
  useEffect(() => {
    if (loading || !cacheReady || !draftWriterId || pendingRestore || !data || data.year !== period.year || data.month !== period.month) return;
    try {
      persistEntryDraftCache(localStorage, makeEntryDraftCache(period, actorName, drafts, draftBases, data.rows, draftWriterId, unavailableDrafts));
    } catch (failure) {
      queueMicrotask(() => setStorageWarning(failure instanceof Error ? failure.message : "本机草稿备份失败，请及时保存到网站；关闭页面可能丢失输入。"));
    }
  }, [drafts, draftBases, data, period, actorName, unavailableDrafts, loading, cacheReady, draftWriterId, pendingRestore]);
  useEffect(() => {
    if (!dirtyCount && !fxApplying && !saveProgress) return;
    const flush = () => {
      if (!cacheReady || !draftWriterId || pendingRestore || !data || data.year !== period.year || data.month !== period.month) return;
      try { persistEntryDraftCache(localStorage, makeEntryDraftCache(period, actorName, drafts, draftBases, data.rows, draftWriterId, unavailableDrafts)); } catch { /* The beforeunload warning still protects in-memory edits. */ }
    };
    const warn = (event: BeforeUnloadEvent) => { flush(); event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("pagehide", flush); };
  }, [dirtyCount, fxApplying, saveProgress, drafts, draftBases, data, period, actorName, cacheReady, draftWriterId, pendingRestore, unavailableDrafts]);
  useEffect(() => {
    if (focusedId === null) return;
    const element = tableRef.current?.querySelector(`[data-row-key="${focusedId}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedId, search, blockFilter, onlyDirty]);

  function locateRow(id: number) {
    setSearch(""); setBlockFilter(undefined); setOnlyDirty(false); setFocusedId(null);
    requestAnimationFrame(() => setFocusedId(id));
  }

  function guard(action: () => void) {
    if (busy || saveLock.current) return;
    if (!dirtyCount) { action(); return; }
    try {
      if (!cacheReady || !data) throw new Error("草稿备份不可用");
      persistEntryDraftCache(localStorage, makeEntryDraftCache(period, actorName, drafts, draftBases, data.rows, draftWriterId, unavailableDrafts));
      action();
    } catch {
      modal.confirm({ title: `有 ${dirtyCount} 行未保存`, content: "本机草稿备份暂不可用，切换会丢失当前输入。建议先保存到网站。", okText: "放弃当前输入", cancelText: "继续填写", okButtonProps: { danger: true }, onOk: action });
    }
  }
  function restoreCachedDrafts() {
    if (!pendingRestore || !data || working) return;
    const restored = restoreEntryDrafts(pendingRestore.entries, data.rows);
    try {
      persistEntryDraftCache(localStorage, makeEntryDraftCache(period, actorName, restored.drafts, restored.bases, data.rows, draftWriterId, restored.unavailable), pendingRestore);
      setDrafts(restored.drafts); setDraftBases(restored.bases); setDraftConflicts(restored.conflicts); setUnavailableDrafts(restored.unavailable);
      setRowErrors(Object.fromEntries(Object.entries(restored.conflicts).map(([id, conflicts]) => [id, `有 ${conflicts.length} 处修改冲突，请核对后保存。`])));
      setPendingRestore(null); setStorageWarning("");
      setSaveNotice(Object.keys(restored.drafts).length ? "本机草稿已恢复，保存后才会计入看板" : "已核对草稿：可填写的内容已在服务器保存，无需重复提交");
    } catch {
      setStorageWarning("本机备份可能已被另一窗口更新，或暂不可写入。原草稿未覆盖，可先下载留存。");
    }
  }
  function discardCachedDrafts() {
    if (!pendingRestore || working) return;
    const backup = pendingRestore;
    modal.confirm({ title: "丢弃这份本机草稿？", content: "未提交的内容将从本机备份中移除，服务器数据不变。", okText: "丢弃草稿", cancelText: "保留", okButtonProps: { danger: true }, onOk: () => {
      try { persistEntryDraftCache(localStorage, { ...backup, writerId: draftWriterId, savedAt: Date.now(), entries: {} }, backup); setPendingRestore(null); setStorageWarning(""); }
      catch { setStorageWarning("草稿已在其他窗口更新，未删除。请先下载留存。 "); }
    } });
  }
  function downloadDrafts(cache: EntryDraftCache) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(cache, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `未保存草稿_${cache.year}-${cache.month}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function clearUnavailableDrafts() {
    modal.confirm({ title: "清除不可填写渠道的本机草稿？", content: "建议先下载留存。不会删除任何服务器记录。", okText: "清除本机草稿", cancelText: "保留", okButtonProps: { danger: true }, onOk: () => setUnavailableDrafts({}) });
  }
  function resolveConflict(choice: "mine" | "server") {
    if (conflictId === null || !data || working) return;
    const row = data.rows.find((row) => row.channelId === conflictId);
    const draft = drafts[conflictId];
    if (!row || !draft) return;
    const resolved = resolveEntryDraft(draft, row, draftConflicts[conflictId] ?? [], choice);
    setDrafts((current) => { const next = { ...current }; if (resolved.draft) next[conflictId] = resolved.draft; else delete next[conflictId]; return next; });
    setDraftBases((current) => ({ ...current, [conflictId]: resolved.base }));
    setDraftConflicts((current) => { const next = { ...current }; delete next[conflictId]; return next; });
    setRowErrors((current) => { const next = { ...current }; delete next[conflictId]; return next; });
    setConflictId(null); setSaveNotice("已完成核对，未提交的改动请点击保存");
  }
  function edit(row: EntryRow, updater: (draft: EntryDraft) => EntryDraft) {
    if (busy) return;
    setSaveNotice("");
    const changed = updater(drafts[row.channelId] ?? entryDraftOf(row));
    const rebased = rebaseEntryDraft({ base: draftBases[row.channelId] ?? entryDraftOf(row), draft: changed }, row);
    setDraftBases((current) => ({ ...current, [row.channelId]: rebased.base }));
    setDraftConflicts((current) => { const next = { ...current }; if (rebased.conflicts.length) next[row.channelId] = rebased.conflicts; else delete next[row.channelId]; return next; });
    setRowErrors((current) => { const next = { ...current }; if (rebased.conflicts.length) next[row.channelId] = `有 ${rebased.conflicts.length} 处修改冲突，请核对后保存。`; else delete next[row.channelId]; return next; });
    setDrafts((current) => {
      const result = { ...current };
      if (!rebased.draft) delete result[row.channelId];
      else result[row.channelId] = rebased.draft;
      return result;
    });
  }
  function checkActor() {
    setActorTouched(true);
    if (!entryActorError(actorName)) return true;
    const field = document.getElementById("entry-actor");
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  async function saveRows(rows: EntryRow[]) {
    if (busy || saveLock.current) return;
    const pending = rows.filter((row) => drafts[row.channelId]).map((row) => ({ row, draft: drafts[row.channelId] }));
    const conflict = pending.find(({ row }) => draftConflicts[row.channelId]?.length);
    if (conflict) { setConflictId(conflict.row.channelId); return; }
    if (!pending.length || !checkActor()) return;
    saveLock.current = true;
    setSaveNotice(""); setSaveProgress({ saved: 0, total: pending.length });
    try {
      const result = await saveEntryBatch(pending, async ({ row, draft }) => {
        setSavingId(row.channelId);
        const response = await jsonResponse<{ row: EntryRow }>(await fetch(`/api/channel-entry/rows/${row.channelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...period, ...draft, actorName: actorName.trim() }) }));
        return response.row;
      }, (row, saved) => {
        setData((current) => current ? { ...current, rows: current.rows.map((item) => item.channelId === row.channelId ? row : item), updatedAt: row.updatedAt } : current);
        setDrafts((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
        setDraftBases((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
        setDraftConflicts((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
        setRowErrors((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
        setSaveProgress({ saved, total: pending.length });
      });
      if (result.failed) {
        const failed = result.failed;
        setRowErrors((current) => ({ ...current, [failed.channelId]: failed.message }));
        setSaveNotice(`已保存 ${result.saved.length} 行，${pending.length - result.saved.length} 行未保存。请查看红字提示。`);
        if (failed.status === 409 || failed.status === 404) {
          try {
            const latest = await jsonResponse<EntryData>(await fetch(`/api/channel-entry?year=${period.year}&month=${period.month}`, { cache: "no-store" }));
            const savedIds = new Set(result.saved.map((row) => row.channelId));
            const remaining = Object.fromEntries(Object.entries(drafts).filter(([id]) => !savedIds.has(Number(id))));
            const cached = makeEntryDraftCache(period, actorName, remaining, draftBases, data?.rows ?? [], draftWriterId, unavailableDrafts);
            const restored = restoreEntryDrafts(cached.entries, latest.rows);
            setData(latest); setDrafts(restored.drafts); setDraftBases(restored.bases); setDraftConflicts(restored.conflicts); setUnavailableDrafts(restored.unavailable);
            setRowErrors(Object.fromEntries(Object.entries(restored.conflicts).map(([id, conflicts]) => [id, `有 ${conflicts.length} 处修改冲突，请核对后保存。`])));
            setSaveNotice("最新数据已载入，你的修改已保留；核对后再次保存即可");
            const firstConflict = Object.keys(restored.conflicts).map(Number)[0];
            if (firstConflict !== undefined) setConflictId(firstConflict);
          } catch { /* Existing inputs and local backup remain available if reloading fails. */ }
        }
        locateRow(failed.channelId);
      } else {
        const notice = `已保存 ${result.saved.length} 行，看板已更新`;
        setSaveNotice(notice);
        message.open({ key: "channel-entry-save", type: "success", content: notice });
      }
    } finally { setSavingId(null); setSaveProgress(null); saveLock.current = false; }
  }
  function undoRow(row: EntryRow) {
    if (busy || saveLock.current) return;
    modal.confirm({ title: `撤销 ${row.businessLine} 的未保存修改？`, content: "只撤销这行尚未提交的修改，不影响已保存的数据。", okText: "撤销修改", cancelText: "继续填写", onOk: () => {
      setDrafts((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
      setDraftBases((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
      setDraftConflicts((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
      setRowErrors((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
      setSaveNotice("");
    } });
  }
  async function showAudits() {
    setAuditOpen(true); setAuditLoading(true); setAuditError("");
    try {
      const query = new URLSearchParams({ year: String(period.year), month: String(period.month) });
      const result = await jsonResponse<{ audits: EntryAudit[] }>(await fetch(`/api/channel-entry/audits?${query}`, { cache: "no-store" }));
      setAudits(result.audits);
    } catch (failure) { setAuditError(failure instanceof Error ? failure.message : "修改记录加载失败"); }
    finally { setAuditLoading(false); }
  }
  function exportData() {
    if (!data) return;
    const cell = (value: unknown) => { let text = value === null ? "" : String(value); if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
    const header = ["年份", "月份", "板块", "业务线", "渠道", "负责人", "币种", "汇率", ...[1, 2, 3, 4, 5].flatMap((w) => [`W${w}销售`, `W${w}广告`]), "备注"];
    const lines = data.rows.map((row) => [period.year, period.month, row.businessBlockLabel, row.businessLine, row.channelName, row.owner, row.currency, row.exchangeRate, ...row.weeks.flatMap((w) => [w.salesAmountOriginal, w.adSpendOriginal]), row.remark]);
    const url = URL.createObjectURL(new Blob(["\uFEFF", [header, ...lines].map((line) => line.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `渠道填报_${period.year}-${String(period.month).padStart(2, "0")}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  function requestExport() {
    if (dirtyCount) modal.confirm({ title: `还有 ${dirtyCount} 行未保存`, content: "导出只包含已保存的数据，不包含当前未提交的修改。", okText: "导出已保存数据", cancelText: "返回填写", onOk: exportData });
    else exportData();
  }
  const visibleRows = useMemo(() => (data?.rows ?? []).filter((row) => (!onlyDirty || drafts[row.channelId]) && (!blockFilter || row.businessBlock === blockFilter) && `${row.businessLine} ${row.channelName} ${drafts[row.channelId]?.owner ?? row.owner}`.toLowerCase().includes(search.toLowerCase())), [data, drafts, search, blockFilter, onlyDirty]);
  const hiddenDirtyCount = dirtyCount - visibleRows.filter((row) => drafts[row.channelId]).length;
  const failedIds = Object.keys(rowErrors).map(Number).filter((id) => drafts[id]);
  const weekNumbers = displayedEntryWeeks(period, [...(data?.rows ?? []), ...Object.values(drafts)]);
  const calendar = entryCalendarWeeks(period);
  const unavailableCount = Object.keys(unavailableDrafts).length;
  const columns: ColumnsType<EntryRow> = [
    { title: "板块", key: "block", width: 95, fixed: "left", render: (_, row) => <span className="entry-block-badge" style={{ background: ENTRY_BLOCK_COLORS[row.businessBlock] || ENTRY_BLOCK_COLORS.other }}>{row.businessBlockLabel}</span> },
    { title: "渠道 / 录入币种", key: "channel", width: 215, fixed: "left", render: (_, row) => <div className="entry-channel-name"><b>{row.businessLine}</b><span>{row.channelName}</span><small>{row.currency} · 折算汇率 {row.exchangeRate}</small></div> },
    { title: "渠道负责人", key: "owner", width: 120, render: (_, row) => <Input aria-label={`${row.businessLine} 负责人`} disabled={busy || !row.editable} maxLength={80} value={drafts[row.channelId]?.owner ?? row.owner} placeholder="负责人" className={drafts[row.channelId] && drafts[row.channelId].owner !== row.owner ? "entry-input-changed" : undefined} onChange={(event) => edit(row, (draft) => ({ ...draft, owner: event.target.value }))} /> },
    ...weekNumbers.map((weekNumber) => ({
      title: <span className="entry-week-label"><b>W{weekNumber}</b><small>{calendar.find((week) => week.weekNumber === weekNumber)?.label ?? "日期待核对"}</small></span>, key: `week-${weekNumber}`, className: weekNumber === selectedWeek ? "entry-week-current" : undefined,
      children: (["salesAmountOriginal", "adSpendOriginal"] as const).map((field) => ({ title: field === "salesAmountOriginal" ? "销售额" : "广告费", key: `${weekNumber}-${field}`, width: 117, align: "right" as const,
        render: (_: unknown, row: EntryRow) => {
          const value = (drafts[row.channelId]?.weeks ?? row.weeks).find((w) => w.weekNumber === weekNumber)?.[field] ?? null;
          const changed = value !== (row.weeks.find((week) => week.weekNumber === weekNumber)?.[field] ?? null);
          return <InputNumber<number> aria-label={`${row.businessLine} ${row.channelName} W${weekNumber}${field === "salesAmountOriginal" ? "销售" : "广告"}`} disabled={busy || !row.editable} value={value} placeholder="未填" controls={false} precision={2} min={field === "adSpendOriginal" ? 0 : undefined} max={999999999999} className={`${value === null ? "entry-input-blank" : ""}${changed ? " entry-input-changed" : ""}`} onChange={(amount) => edit(row, (draft) => ({ ...draft, weeks: draft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, [field]: amount } : week) }))} />;
        },
      })),
    })),
    { title: "备注", key: "remark", width: 190, render: (_, row) => <Input.TextArea aria-label={`${row.businessLine} 备注`} disabled={busy || !row.editable} value={drafts[row.channelId]?.remark ?? row.remark} className={drafts[row.channelId] && drafts[row.channelId].remark !== row.remark ? "entry-input-changed" : undefined} placeholder="活动、退款等说明（选填）" maxLength={2000} autoSize={{ minRows: 1, maxRows: 3 }} onChange={(event) => edit(row, (draft) => ({ ...draft, remark: event.target.value }))} /> },
    { title: "保存状态", key: "save", width: 180, fixed: "right", render: (_, row) => <div className="entry-save-cell">
      {drafts[row.channelId] ? <>
        <Tag color={rowErrors[row.channelId] ? "red" : "orange"}>{rowErrors[row.channelId] ? "保存失败" : "未保存"}</Tag>
        <div className="entry-row-actions"><Button size="small" type="primary" icon={<SaveOutlined />} loading={savingId === row.channelId} disabled={busy && savingId !== row.channelId} onClick={() => void saveRows([row])}>{draftConflicts[row.channelId]?.length ? "核对改动" : rowErrors[row.channelId] ? "重试保存" : "保存本行"}</Button><Button size="small" type="text" disabled={busy} onClick={() => undoRow(row)}>撤销</Button></div>
        {rowErrors[row.channelId] ? <small className="entry-field-error">{rowErrors[row.channelId]}</small> : <small>保存后计入看板</small>}
      </> : <>
        <Tag color={!row.editable ? "orange" : entryHasSavedData(row) ? "green" : "default"}>{!row.editable ? "待配置" : entryHasSavedData(row) ? "已保存" : "未填写"}</Tag>
        <small>{entryWeek(row, selectedWeek).salesAmountOriginal !== null && entryWeek(row, selectedWeek).adSpendOriginal !== null ? `W${selectedWeek} 已填齐` : `W${selectedWeek} 待填写`}</small>
      </>}
    </div> },
  ];

  return <div className="channel-entry-shell" style={{ "--entry-global-toolbar-height": `${toolbarHeight}px` } as CSSProperties}>
    <header className="entry-hero"><nav><a href="#entry-dashboard"><BarChartOutlined /> 经营看板</a><a href="#entry-input"><EditOutlined /> 负责人填报</a></nav><ThemeToggle /></header>
    <main className="public-channel-entry">
      <div className="entry-toolbar" id="entry-global-toolbar"><div className="entry-period-control">
        <label htmlFor="entry-month">统计月份</label><DatePicker id="entry-month" aria-label="统计月份" picker="month" allowClear={false} disabled={busy} value={dayjs(`${period.year}-${String(period.month).padStart(2, "0")}-01`)} format="YYYY年M月" minDate={dayjs("2000-01-01")} maxDate={dayjs("2100-12-31")} onChange={(value) => { if (value) guard(() => { setStatsWeek(0); setPeriod({ year: value.year(), month: value.month() + 1 }); }); }} />
        <label htmlFor="entry-stats-week">统计范围</label><Select id="entry-stats-week" aria-label="统计范围" className="entry-stats-week" disabled={working} value={statsWeek} onChange={setStatsWeek} options={[{ value: 0, label: "全月" }, ...weekNumbers.map((value) => ({ value, label: entryWeekLabel(period, value) }))]} />
        <Button icon={<ReloadOutlined />} disabled={busy} onClick={() => guard(() => setRefreshKey((k) => k + 1))}>刷新</Button>
      </div><div className="entry-tools"><Button icon={<PlusOutlined />} disabled={busy} onClick={() => guard(() => setRefreshKey((k) => k + 1))}>补齐本月行</Button><Button icon={<HistoryOutlined />} disabled={!data || busy} onClick={() => void showAudits()}>修改记录</Button><Button icon={<DownloadOutlined />} disabled={!data || busy} onClick={requestExport}>导出</Button></div></div>
      {error ? <Alert type="error" showIcon title="数据加载失败" description={error} action={<Button onClick={() => setRefreshKey((k) => k + 1)}>重试</Button>} /> : null}
      {warnings.length ? <Alert type="warning" showIcon title="部分渠道需要后台配置" description={warnings.join("；")} /> : null}
      {storageWarning && <Alert type="warning" showIcon title={storageWarning} />}
      {loading ? <div className="entry-loading"><Spin size="large" /><span>正在准备 {period.year} 年 {period.month} 月数据…</span></div> : data ? <>
        {pendingRestore && <Alert type="info" showIcon title={`发现本机 ${Object.keys(pendingRestore.entries).length} 行未提交草稿`} description={`${pendingRestore.actorName || "未填写姓名"} · ${new Date(pendingRestore.savedAt).toLocaleString("zh-CN")}。恢复后会先核对服务器最新数据，不会自动提交。`} action={<div className="entry-draft-actions"><Button type="primary" onClick={restoreCachedDrafts} disabled={working}>恢复草稿</Button><Button onClick={() => downloadDrafts(pendingRestore)}>下载留存</Button><Button type="text" danger onClick={discardCachedDrafts} disabled={working}>丢弃</Button></div>} />}
        {unavailableCount > 0 && <Alert type="warning" showIcon title={`${unavailableCount} 行草稿对应的渠道暂不可填写，备份仍保留在本机`} action={<div className="entry-draft-actions"><Button onClick={() => downloadDrafts(makeEntryDraftCache(period, actorName, {}, {}, data.rows, draftWriterId, unavailableDrafts))}>下载草稿</Button><Button type="text" danger disabled={working} onClick={clearUnavailableDrafts}>清除备份</Button></div>} />}
        <EntryExchangeRate key={`${data.year}-${data.month}`} data={data} actorName={actorName} onActorChange={setActorName} dirtyCount={dirtyCount + unavailableCount + Object.keys(pendingRestore?.entries ?? {}).length} busy={busy} onBusyChange={setFxApplying} onApplied={(next) => { setData(next); setRowErrors({}); setSaveNotice("汇率已更新，看板已重新计算"); }} />
        <EntryDashboard data={data} statsWeek={statsWeek} selectedWeek={selectedWeek} onLocate={locateRow} />
        <section id="entry-input" className="entry-section" ref={tableRef}>
          <div className="entry-section-heading"><div><h2>负责人填报</h2><p>留空表示未填，0 表示确认无发生；橙框表示尚未保存的修改。</p></div><Tag color={dirtyCount ? "orange" : "default"}>{dirtyCount ? `${dirtyCount} 行待保存` : "无未保存改动"}</Tag></div>
          <div className={`entry-input-toolbar${actorError ? " entry-toolbar-invalid" : ""}`}>
            <div className="entry-save-controls">
              <div className="entry-actor-field">
                <label htmlFor="entry-actor"><span className="entry-required" aria-hidden="true">*</span> 填写人姓名</label>
                <Input id="entry-actor" aria-label="填写人姓名" aria-required="true" aria-invalid={Boolean(actorError)} aria-describedby={actorError ? "entry-actor-error" : "entry-actor-help"} status={actorError ? "error" : undefined} value={actorName} onChange={(event) => setActorName(event.target.value)} onBlur={() => { if (dirtyCount) setActorTouched(true); }} maxLength={80} placeholder="填写你本人的姓名" disabled={busy} />
                {actorError ? <small id="entry-actor-error" className="entry-field-error" role="alert">{actorError}</small> : <small id="entry-actor-help">用于修改留痕，与渠道负责人分开填写。</small>}
              </div>
              <div className="entry-save-actions">
                <Button type="primary" icon={<SaveOutlined />} loading={saveProgress !== null} disabled={!dirtyCount || (busy && saveProgress === null)} onClick={() => void saveRows(data.rows)}>{saveProgress ? `正在保存 ${saveProgress.saved}/${saveProgress.total}` : `保存全部改动${dirtyCount ? `（${dirtyCount}）` : ""}`}</Button>
                <small role="status">{saveProgress ? "请勿关闭页面" : saveNotice || (dirtyCount ? storageWarning ? "尚未提交，请先保存到网站" : "尚未提交；草稿自动保存在本机（7天）" : "保存后看板同步更新")}</small>
              </div>
            </div>
            <div className="entry-filter-controls">
              <Select aria-label="筛选板块" allowClear placeholder="全部板块" disabled={busy} value={blockFilter} onChange={setBlockFilter} options={Array.from(new Map(data.rows.map((row) => [row.businessBlock, { value: row.businessBlock, label: row.businessBlockLabel }])).values())} />
              <Input.Search allowClear aria-label="搜索渠道或负责人" placeholder="搜索渠道 / 负责人" disabled={busy} value={search} onChange={(event) => setSearch(event.target.value)} />
              <Checkbox checked={onlyDirty} disabled={busy} onChange={(event) => setOnlyDirty(event.target.checked)}>只看未保存</Checkbox>
            </div>
          </div>
          {failedIds.length > 0 && <Alert type="error" showIcon title={`${failedIds.length} 行保存失败，修改仍保留在页面中`} description={rowErrors[failedIds[0]]} action={<Button size="small" disabled={busy} onClick={() => locateRow(failedIds[0])}>定位问题行</Button>} />}
          <div className="entry-input-status"><span>显示 {visibleRows.length} / {data.rows.length} 个渠道</span>{hiddenDirtyCount > 0 && <span className="entry-neutral">另有 {hiddenDirtyCount} 行修改被筛选隐藏，“保存全部”也会提交这些行。</span>}</div>
          <Table<EntryRow> bordered size="small" rowKey="channelId" columns={columns} dataSource={visibleRows} pagination={false} scroll={{ x: 800 + weekNumbers.length * 234 }} rowClassName={(row) => `entry-block-${row.businessBlock}${focusedId === row.channelId ? " entry-highlight" : ""}${drafts[row.channelId] ? " entry-row-dirty" : ""}`} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={onlyDirty ? "当前筛选下没有未保存的修改" : "当前筛选下没有渠道"}><Button onClick={() => { setOnlyDirty(false); setBlockFilter(undefined); setSearch(""); }}>显示全部渠道</Button></Empty> }} />
          <p className="entry-footnote">原币录入，人民币汇总。历史零值暂按未确认显示，确认无发生时请填写 0。</p>
        </section>
      </> : null}
    </main>
    <Modal title={`核对改动 · ${data?.rows.find((row) => row.channelId === conflictId)?.businessLine ?? "渠道"}`} open={conflictId !== null} onCancel={() => setConflictId(null)} footer={<><Button onClick={() => resolveConflict("server")}>冲突处采用最新值</Button><Button type="primary" onClick={() => resolveConflict("mine")}>冲突处保留我的值</Button></>}>
      <p className="entry-footnote">只有下列位置存在冲突，其他改动已保留。选择后仍需点击保存，不会立即覆盖服务器。</p>
      <Table size="small" rowKey="field" pagination={false} dataSource={conflictId === null ? [] : draftConflicts[conflictId] ?? []} columns={[
        { title: "位置", dataIndex: "label", width: 100 },
        { title: "我的修改", key: "mine", render: (_, item) => <div className="entry-conflict-value">{displayAuditValue(item.mine)}</div> },
        { title: "服务器最新值", key: "server", render: (_, item) => <div className="entry-conflict-value">{displayAuditValue(item.server)}</div> },
      ]} />
    </Modal>
    <Drawer title={`${period.year}年${period.month}月 · 修改记录`} open={auditOpen} onClose={() => setAuditOpen(false)} size={620} extra={<Button onClick={() => void showAudits()} loading={auditLoading}>刷新记录</Button>}>
      <p className="entry-footnote">最近 100 次保存</p>
      {auditError ? <Alert type="error" title={auditError} /> : auditLoading ? <Spin /> : audits.length ? audits.map((audit) => <div className="entry-audit" key={audit.id}><b>{audit.actorName}</b><time>{new Date(audit.createdAt).toLocaleString("zh-CN")}</time><h4>{audit.channel.businessLine} / {audit.channel.channelName}</h4>{audit.changes.map((change, index) => <div className="entry-audit-change" key={index}><span>{change.label}</span><del>{displayAuditValue(change.before)}</del><b>→ {displayAuditValue(change.after)}</b></div>)}</div>) : <Empty description="本月还没有保存记录" />}
    </Drawer>
  </div>;
}
