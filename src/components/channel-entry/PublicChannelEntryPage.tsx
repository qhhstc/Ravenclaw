"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { App, Alert, Button, DatePicker, Drawer, Empty, Input, InputNumber, Select, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BarChartOutlined, DownloadOutlined, EditOutlined, HistoryOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import type { EntryAudit, EntryData, EntryDraft, EntryPeriod, EntryRow } from "@/lib/channel-entry-types";
import { ENTRY_BLOCK_COLORS, entryWeek } from "@/lib/channel-entry-analysis";
import EntryDashboard from "./EntryDashboard";
import ThemeToggle from "@/components/common/ThemeToggle";

dayjs.locale("zh-cn");

function draftOf(row: EntryRow): EntryDraft {
  return { owner: row.owner, remark: row.remark, version: row.version, weeks: row.weeks.map(({ weekNumber, salesAmountOriginal, adSpendOriginal }) => ({ weekNumber, salesAmountOriginal, adSpendOriginal })) };
}
async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `请求失败 (${response.status})`);
  return data as T;
}
function displayAuditValue(value: string | number | null) { return value === null || value === "" ? "未填写" : String(value); }

export default function PublicChannelEntryPage({ initialPeriod }: { initialPeriod: EntryPeriod }) {
  const { message, modal } = App.useApp();
  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState<EntryData | null>(null);
  const [drafts, setDrafts] = useState<Record<number, EntryDraft>>({});
  const [actorName, setActorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statsWeek, setStatsWeek] = useState(0);
  const selectedWeek = statsWeek || data?.latestWeek || 1;
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState<string | undefined>();
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audits, setAudits] = useState<EntryAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const dirtyCount = Object.keys(drafts).length;
  const busy = loading || savingId !== null;

  useEffect(() => {
    try { const name = localStorage.getItem("channel-entry-actor") || ""; queueMicrotask(() => setActorName(name)); } catch { /* Private browsing can disable storage. */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("channel-entry-actor", actorName); } catch { /* Name still works for this session. */ } }, [actorName]);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const prepared = await jsonResponse<{ warnings: string[] }>(await fetch("/api/channel-entry/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(period), signal: controller.signal }));
        const query = new URLSearchParams({ year: String(period.year), month: String(period.month) });
        const next = await jsonResponse<EntryData>(await fetch(`/api/channel-entry?${query}`, { cache: "no-store", signal: controller.signal }));
        if (!live) return;
        setData(next); setDrafts({}); setWarnings(prepared.warnings || []);
        window.history.replaceState(null, "", `/channel-entry?${query}`);
      } catch (failure) { if (live && !controller.signal.aborted) { setData(null); setError(failure instanceof Error ? failure.message : "数据加载失败"); } }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; controller.abort(); };
  }, [period, refreshKey]);
  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);
  useEffect(() => {
    if (focusedId === null) return;
    const element = tableRef.current?.querySelector(`[data-row-key="${focusedId}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedId, search, blockFilter]);

  function guard(action: () => void) {
    if (busy) return;
    if (!dirtyCount) { action(); return; }
    modal.confirm({ title: `有 ${dirtyCount} 行未保存`, content: "切换月份或重新加载会丢弃这些修改。", okText: "放弃修改", cancelText: "返回保存", okButtonProps: { danger: true }, onOk: action });
  }
  function edit(row: EntryRow, updater: (draft: EntryDraft) => EntryDraft) {
    setDrafts((current) => {
      const next = updater(current[row.channelId] ?? draftOf(row));
      const result = { ...current };
      if (JSON.stringify(next) === JSON.stringify(draftOf(row))) delete result[row.channelId];
      else result[row.channelId] = next;
      return result;
    });
  }
  async function saveRow(row: EntryRow): Promise<boolean> {
    if (!actorName.trim()) { message.warning("请先填写姓名，便于记录本次修改"); document.getElementById("entry-actor")?.focus(); return false; }
    const draft = drafts[row.channelId];
    if (!draft) return true;
    setSavingId(row.channelId);
    try {
      const result = await jsonResponse<{ row: EntryRow }>(await fetch(`/api/channel-entry/rows/${row.channelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...period, ...draft, actorName }) }));
      setData((current) => current ? { ...current, rows: current.rows.map((item) => item.channelId === row.channelId ? result.row : item), updatedAt: result.row.updatedAt } : current);
      setDrafts((current) => { const next = { ...current }; delete next[row.channelId]; return next; });
      message.success(`${row.businessLine} 已保存，看板已更新`);
      return true;
    } catch (failure) { message.error(failure instanceof Error ? failure.message : "保存失败，修改仍保留在页面中", 7); return false; }
    finally { setSavingId(null); }
  }
  async function saveAll() {
    for (const row of data?.rows ?? []) if (drafts[row.channelId] && !(await saveRow(row))) break;
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
  const visibleRows = useMemo(() => (data?.rows ?? []).filter((row) => (!blockFilter || row.businessBlock === blockFilter) && `${row.businessLine} ${row.channelName} ${drafts[row.channelId]?.owner ?? row.owner}`.toLowerCase().includes(search.toLowerCase())), [data, drafts, search, blockFilter]);
  const columns: ColumnsType<EntryRow> = [
    { title: "板块", key: "block", width: 95, fixed: "left", render: (_, row) => <span className="entry-block-badge" style={{ background: ENTRY_BLOCK_COLORS[row.businessBlock] || ENTRY_BLOCK_COLORS.other }}>{row.businessBlockLabel}</span> },
    { title: "渠道 / 录入币种", key: "channel", width: 215, fixed: "left", render: (_, row) => <div className="entry-channel-name"><b>{row.businessLine}</b><span>{row.channelName}</span><small>{row.currency} · 折算汇率 {row.exchangeRate}</small></div> },
    { title: "负责人", key: "owner", width: 120, render: (_, row) => <Input aria-label={`${row.businessLine} 负责人`} disabled={busy || !row.editable} maxLength={80} value={drafts[row.channelId]?.owner ?? row.owner} placeholder="负责人" onChange={(event) => edit(row, (draft) => ({ ...draft, owner: event.target.value }))} /> },
    ...[1, 2, 3, 4, 5].map((weekNumber) => ({
      title: `W${weekNumber}`, key: `week-${weekNumber}`, className: weekNumber === selectedWeek ? "entry-week-current" : undefined,
      children: (["salesAmountOriginal", "adSpendOriginal"] as const).map((field) => ({ title: field === "salesAmountOriginal" ? "销售额" : "广告费", key: `${weekNumber}-${field}`, width: 117, align: "right" as const,
        render: (_: unknown, row: EntryRow) => {
          const value = (drafts[row.channelId]?.weeks ?? row.weeks).find((w) => w.weekNumber === weekNumber)?.[field] ?? null;
          return <InputNumber<number> aria-label={`${row.businessLine} ${row.channelName} W${weekNumber}${field === "salesAmountOriginal" ? "销售" : "广告"}`} disabled={busy || !row.editable} value={value} placeholder="未填" controls={false} precision={2} min={field === "adSpendOriginal" ? 0 : undefined} max={999999999999} className={value === null ? "entry-input-blank" : ""} onChange={(amount) => edit(row, (draft) => ({ ...draft, weeks: draft.weeks.map((week) => week.weekNumber === weekNumber ? { ...week, [field]: amount } : week) }))} />;
        },
      })),
    })),
    { title: "备注", key: "remark", width: 190, render: (_, row) => <Input.TextArea aria-label={`${row.businessLine} 备注`} disabled={busy || !row.editable} value={drafts[row.channelId]?.remark ?? row.remark} placeholder="活动、退款等说明（选填）" maxLength={2000} autoSize={{ minRows: 1, maxRows: 3 }} onChange={(event) => edit(row, (draft) => ({ ...draft, remark: event.target.value }))} /> },
    { title: "保存状态", key: "save", width: 115, fixed: "right", render: (_, row) => <div className="entry-save-cell">{drafts[row.channelId] ? <Button size="small" type="primary" icon={<SaveOutlined />} loading={savingId === row.channelId} disabled={busy && savingId !== row.channelId} onClick={() => void saveRow(row)}>保存本行</Button> : <Tag color={row.editable ? "green" : "orange"}>{row.editable ? "已保存" : "待配置"}</Tag>}<small>{drafts[row.channelId] ? "修改尚未计入看板" : entryWeek(row, selectedWeek).salesAmountOriginal !== null && entryWeek(row, selectedWeek).adSpendOriginal !== null ? `W${selectedWeek} 已填齐` : `W${selectedWeek} 待填写`}</small></div> },
  ];

  return <div className="channel-entry-shell">
    <header className="entry-hero"><nav><a href="#entry-dashboard"><BarChartOutlined /> 经营看板</a><a href="#entry-input"><EditOutlined /> 负责人填报</a></nav><ThemeToggle /></header>
    <main className="public-channel-entry">
      <div className="entry-toolbar"><div className="entry-period-control">
        <label htmlFor="entry-month">统计月份</label><DatePicker id="entry-month" aria-label="统计月份" picker="month" allowClear={false} disabled={busy} value={dayjs(`${period.year}-${String(period.month).padStart(2, "0")}-01`)} format="YYYY年M月" minDate={dayjs("2000-01-01")} maxDate={dayjs("2100-12-31")} onChange={(value) => { if (value) guard(() => { setStatsWeek(0); setPeriod({ year: value.year(), month: value.month() + 1 }); }); }} />
        <label htmlFor="entry-stats-week">统计范围</label><Select id="entry-stats-week" aria-label="统计范围" className="entry-stats-week" disabled={busy} value={statsWeek} onChange={setStatsWeek} options={[{ value: 0, label: "全月" }, ...[1, 2, 3, 4, 5].map((value) => ({ value, label: `W${value}` }))]} />
        <Button icon={<ReloadOutlined />} disabled={busy} onClick={() => guard(() => setRefreshKey((k) => k + 1))}>刷新</Button>
      </div><div className="entry-tools"><Button icon={<PlusOutlined />} disabled={busy} onClick={() => guard(() => setRefreshKey((k) => k + 1))}>补齐本月行</Button><Button icon={<HistoryOutlined />} disabled={!data || busy} onClick={() => void showAudits()}>修改记录</Button><Button icon={<DownloadOutlined />} disabled={!data || busy} onClick={exportData}>导出</Button></div></div>
      {error ? <Alert type="error" showIcon title="数据加载失败" description={error} action={<Button onClick={() => setRefreshKey((k) => k + 1)}>重试</Button>} /> : null}
      {warnings.length ? <Alert type="warning" showIcon title="部分渠道需要后台配置" description={warnings.join("；")} /> : null}
      {loading ? <div className="entry-loading"><Spin size="large" /><span>正在准备 {period.year} 年 {period.month} 月数据…</span></div> : data ? <>
        <EntryDashboard data={data} statsWeek={statsWeek} selectedWeek={selectedWeek} onPeriodChange={setStatsWeek} onLocate={(id) => { setSearch(""); setBlockFilter(undefined); setFocusedId(null); requestAnimationFrame(() => setFocusedId(id)); }} />
        <section id="entry-input" className="entry-section" ref={tableRef}>
          <div className="entry-section-heading"><div><h2>负责人填报</h2><p>留空表示未填，0 表示确认无发生。</p></div><Tag color={dirtyCount ? "orange" : "green"}>{dirtyCount ? `${dirtyCount} 行待保存` : "全部修改已保存"}</Tag></div>
          <div className="entry-input-toolbar"><div><label htmlFor="entry-actor">填写人姓名</label><Input id="entry-actor" aria-label="填写人姓名" value={actorName} onChange={(event) => setActorName(event.target.value)} maxLength={80} placeholder="保存前填写姓名" disabled={busy} /><Button type="primary" icon={<SaveOutlined />} disabled={!dirtyCount || busy} onClick={() => void saveAll()}>保存全部改动</Button></div><div><Select aria-label="筛选板块" allowClear placeholder="全部板块" value={blockFilter} onChange={setBlockFilter} options={Array.from(new Map(data.rows.map((row) => [row.businessBlock, { value: row.businessBlock, label: row.businessBlockLabel }])).values())} /><Input.Search allowClear aria-label="搜索渠道或负责人" placeholder="搜索渠道 / 负责人" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
          <Table<EntryRow> bordered size="small" rowKey="channelId" columns={columns} dataSource={visibleRows} pagination={false} scroll={{ x: 1905 }} rowClassName={(row) => `entry-block-${row.businessBlock}${focusedId === row.channelId ? " entry-highlight" : ""}`} locale={{ emptyText: "当前筛选下没有渠道" }} />
          <p className="entry-footnote">原币录入，人民币汇总。历史零值暂按未确认显示，确认无发生时请填写 0。</p>
        </section>
      </> : null}
    </main>
    <Drawer title={`${period.year}年${period.month}月 · 修改记录`} open={auditOpen} onClose={() => setAuditOpen(false)} size={620} extra={<Button onClick={() => void showAudits()} loading={auditLoading}>刷新记录</Button>}>
      <p className="entry-footnote">最近 100 次保存</p>
      {auditError ? <Alert type="error" title={auditError} /> : auditLoading ? <Spin /> : audits.length ? audits.map((audit) => <div className="entry-audit" key={audit.id}><b>{audit.actorName}</b><time>{new Date(audit.createdAt).toLocaleString("zh-CN")}</time><h4>{audit.channel.businessLine} / {audit.channel.channelName}</h4>{audit.changes.map((change, index) => <div className="entry-audit-change" key={index}><span>{change.label}</span><del>{displayAuditValue(change.before)}</del><b>→ {displayAuditValue(change.after)}</b></div>)}</div>) : <Empty description="本月还没有保存记录" />}
    </Drawer>
  </div>;
}
