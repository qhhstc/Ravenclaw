"use client";

import { SaveOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, DatePicker, Empty, Input, InputNumber, Row, Space, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Week = { weekNumber: number; salesAmountOriginal: number; adSpendOriginal: number };
type EntryRow = { channelId: number; businessBlock: string; businessBlockLabel: string; businessLine: string; channelName: string; owner: string; currency: string; exchangeRate: number; weeks: Week[]; filledWeeks: number; salesAmountBase: number; adSpendBase: number; roi: number | null; adRatio: number | null; status: "empty" | "partial" | "complete" };

const blockColors: Record<string, string> = { amazon: "#f59e0b", independent_site: "#8b5cf6", tiktok: "#111827", b2b: "#16a34a", other: "#94a3b8" };
function money(value: number) { return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`; }
function week(row: EntryRow, number: number) { return row.weeks.find((item) => item.weekNumber === number) ?? { weekNumber: number, salesAmountOriginal: 0, adSpendOriginal: 0 }; }

export default function PublicChannelEntryPage() {
  const now = new Date();
  const [period, setPeriod] = useState<Dayjs>(dayjs(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`));
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [actorName, setActorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load(nextPeriod = period) {
    setLoading(true);
    try {
      const query = `year=${nextPeriod.year()}&month=${nextPeriod.month()}`;
      const response = await fetch(`/api/channel-entry?${query}`, { cache: "no-store" });
      const data = (await response.json()) as { rows?: EntryRow[]; message?: string };
      if (!response.ok) throw new Error(data.message || "数据加载失败");
      setRows(data.rows ?? []);
    } catch (error) { message.error(error instanceof Error ? error.message : "数据加载失败"); } finally { setLoading(false); }
  }

  useEffect(() => { setActorName(window.localStorage.getItem("channel-entry-actor") || ""); void load(); }, []);
  useEffect(() => { if (actorName) window.localStorage.setItem("channel-entry-actor", actorName); }, [actorName]);

  const totals = useMemo(() => {
    const sales = rows.reduce((sum, row) => sum + row.salesAmountBase, 0);
    const ad = rows.reduce((sum, row) => sum + row.adSpendBase, 0);
    return { sales, ad, roi: ad > 0 ? sales / ad : null, adRatio: sales > 0 ? ad / sales : null, complete: rows.filter((row) => row.status === "complete").length, empty: rows.filter((row) => row.status === "empty").length };
  }, [rows]);
  const weekly = [1, 2, 3, 4, 5].map((number) => ({ week: `W${number}`, sales: rows.reduce((sum, row) => sum + week(row, number).salesAmountOriginal * row.exchangeRate, 0), ad: rows.reduce((sum, row) => sum + week(row, number).adSpendOriginal * row.exchangeRate, 0) }));
  const blocks = Array.from(rows.reduce((map, row) => { const key = row.businessBlock || "other"; const item = map.get(key) ?? { key, sales: 0, ad: 0 }; item.sales += row.salesAmountBase; item.ad += row.adSpendBase; map.set(key, item); return map; }, new Map<string, { key: string; sales: number; ad: number }>()).values()).map((item) => ({ ...item, name: item.key === "other" ? "其他" : item.key === "amazon" ? "亚马逊" : item.key === "independent_site" ? "独立站" : item.key === "tiktok" ? "TikTok" : "B端" }));

  function updateRow(channelId: number, updater: (row: EntryRow) => EntryRow) { setRows((current) => current.map((row) => row.channelId === channelId ? updater(row) : row)); }
  async function saveRow(row: EntryRow) {
    if (!actorName.trim()) { message.warning("请先填写姓名"); return; }
    setSavingId(row.channelId);
    try {
      const response = await fetch(`/api/channel-entry/rows/${row.channelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: period.year(), month: period.month(), actorName, weeks: row.weeks }) });
      const data = (await response.json()) as { row?: EntryRow; message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      if (data.row) updateRow(row.channelId, () => data.row as EntryRow);
      message.success("已保存");
    } catch (error) { message.error(error instanceof Error ? error.message : "保存失败"); } finally { setSavingId(null); }
  }

  const columns: ColumnsType<EntryRow> = [
    { title: "板块", dataIndex: "businessBlockLabel", fixed: "left", width: 95, render: (value, row) => <Tag color={blockColors[row.businessBlock] ? undefined : "default"} style={{ background: blockColors[row.businessBlock], color: "#fff", border: 0 }}>{value}</Tag> },
    { title: "渠道", dataIndex: "channelName", fixed: "left", width: 180, render: (value, row) => <div><div className="font-medium">{value}</div><div className="text-xs text-[var(--muted)]">{row.businessLine}</div></div> },
    { title: "负责人", dataIndex: "owner", width: 120, render: (_, row) => <Input size="small" value={row.owner} placeholder="负责人" onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, owner: event.target.value }))} /> },
    ...[1, 2, 3, 4, 5].flatMap((number) => [{ title: `W${number}销售`, key: `s${number}`, width: 118, align: "right" as const, render: (_: unknown, row: EntryRow) => <InputNumber size="small" controls={false} precision={2} min={undefined} value={week(row, number).salesAmountOriginal} onChange={(value) => updateRow(row.channelId, (current) => ({ ...current, weeks: current.weeks.map((item) => item.weekNumber === number ? { ...item, salesAmountOriginal: Number(value || 0) } : item) }))} /> }, { title: `W${number}广告`, key: `a${number}`, width: 118, align: "right" as const, render: (_: unknown, row: EntryRow) => <InputNumber size="small" controls={false} precision={2} min={0} value={week(row, number).adSpendOriginal} onChange={(value) => updateRow(row.channelId, (current) => ({ ...current, weeks: current.weeks.map((item) => item.weekNumber === number ? { ...item, adSpendOriginal: Number(value || 0) } : item) }))} /> }]),
    { title: "月销售", key: "sales", width: 130, align: "right", render: (_: unknown, row) => money(row.salesAmountBase) },
    { title: "月广告", key: "ad", width: 130, align: "right", render: (_: unknown, row) => money(row.adSpendBase) },
    { title: "ROI", key: "roi", width: 85, align: "right", render: (_: unknown, row) => row.roi === null ? "—" : row.roi.toFixed(2) },
    { title: "状态", key: "status", width: 95, render: (_: unknown, row) => row.status === "complete" ? <Tag color="green">已完成</Tag> : row.status === "partial" ? <Tag color="orange">部分填写</Tag> : <Tag color="gold">待填写</Tag> },
    { title: "操作", key: "action", fixed: "right", width: 92, render: (_: unknown, row) => <Button size="small" type="primary" icon={<SaveOutlined />} loading={savingId === row.channelId} onClick={() => void saveRow(row)}>保存</Button> },
  ];

  return <div className="public-channel-entry page-stack">
    <div className="page-section-header"><div><Typography.Title level={2} className="!mb-1 !text-[var(--foreground)]">渠道经营分析</Typography.Title><Typography.Text type="secondary">员工填报与老板看板合并页面 · 当前为内部试用链接</Typography.Text></div><Space><Typography.Text strong>月份</Typography.Text><DatePicker picker="month" value={period} allowClear={false} format="YYYY年M月" onChange={(value) => { if (value) { setPeriod(value); void load(value); } }} /><Input value={actorName} onChange={(event) => setActorName(event.target.value)} placeholder="填写人姓名" style={{ width: 130 }} /></Space></div>
    <Alert type="warning" showIcon message="当前页面无需登录，拿到链接的人员都可以填写；请填写姓名以便留下操作记录。" />
    <Row gutter={[12, 12]}>{[{title:"本月销售额",value:money(totals.sales)},{title:"本月广告费",value:money(totals.ad)},{title:"整体 ROI",value:totals.roi === null ? "—" : totals.roi.toFixed(2)},{title:"广告占销",value:totals.adRatio === null ? "—" : `${(totals.adRatio * 100).toFixed(1)}%`},{title:"填报进度",value:`${totals.complete}/${rows.length}`}].map((item) => <Col xs={24} sm={12} lg={4} key={item.title}><Card><Statistic title={item.title} value={item.value} valueStyle={{ fontSize: 22 }} /></Card></Col>)}</Row>
    <Row gutter={[16, 16]}><Col xs={24} lg={12}><Card title="W1-W5 销售与广告趋势"><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><Tooltip formatter={(value) => money(Number(value))} /><Legend /><Bar dataKey="ad" name="广告费" fill="#f59e0b" /><Line dataKey="sales" name="销售额" stroke="#1677ff" strokeWidth={3} /></ComposedChart></ResponsiveContainer></div></Card></Col><Col xs={24} lg={12}><Card title="板块贡献"><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={blocks}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => money(Number(value))} /><Legend /><Bar dataKey="sales" name="销售额" fill="#1677ff" /><Bar dataKey="ad" name="广告费" fill="#f59e0b" /></BarChart></ResponsiveContainer></div></Card></Col></Row>
    <Card title="员工填报" extra={<Typography.Text type="secondary">销售和广告为原币录入，统计按汇率折算 CNY</Typography.Text>}>{loading && !rows.length ? <div className="grid place-items-center py-16">加载中...</div> : rows.length ? <Table<EntryRow> size="small" rowKey="channelId" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 2200 }} rowClassName={(row) => `entry-row-${row.businessBlock}`} /> : <Empty description="暂无渠道数据" />}</Card>
  </div>;
}
