"use client";

import { Alert, Card, Col, Empty, Row, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { blockLabel, currencyMoney, ratio } from "./channelDataUtils";
import type { ChannelDataRow, WeeklyComparisonResponse, WeeklyComparisonRow } from "./channelDataTypes";

type ChannelAnalysisDashboardProps = { rows: ChannelDataRow[]; comparison: WeeklyComparisonResponse | null; loading: boolean };

function compactMoney(value: number) {
  const amount = Math.abs(value);
  if (amount >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return Math.round(value).toLocaleString("zh-CN");
}

function trendTag(trend: WeeklyComparisonRow["trend"]) {
  const config = { up: ["上涨", "green"], down: ["下降", "red"], flat: ["持平", "default"], new: ["新增", "blue"], missing: ["无本周数据", "orange"] } as const;
  const [label, color] = config[trend];
  return <Tag color={color}>{label}</Tag>;
}

export default function ChannelAnalysisDashboard({ rows, comparison, loading }: ChannelAnalysisDashboardProps) {
  const weeklyData = [1, 2, 3, 4, 5].map((weekNumber) => ({
    week: `W${weekNumber}`,
    sales: rows.reduce((sum, row) => sum + Number(row.weeks.find((week) => week.weekNumber === weekNumber)?.salesAmountOriginal || 0) * (Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1), 0),
    adSpend: rows.reduce((sum, row) => sum + Number(row.weeks.find((week) => week.weekNumber === weekNumber)?.adSpendOriginal || 0) * (Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1), 0),
  }));
  const blockData = Array.from(rows.reduce((map, row) => {
    const key = row.businessBlock || "other";
    const item = map.get(key) ?? { block: key, sales: 0, adSpend: 0 };
    item.sales += rows.length ? row.weeks.reduce((sum, week) => sum + week.salesAmountOriginal, 0) * (Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1) : 0;
    item.adSpend += rows.length ? row.weeks.reduce((sum, week) => sum + week.adSpendOriginal, 0) * (Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1) : 0;
    map.set(key, item);
    return map;
  }, new Map<string, { block: string; sales: number; adSpend: number }>()).values()).map((item) => ({ ...item, name: blockLabel(item.block) }));
  const attentionRows = (comparison?.rows ?? []).filter((row) => row.trend === "down" || row.trend === "missing" || (row.adSpendDelta > 0 && row.salesDelta < 0)).sort((a, b) => a.salesDelta - b.salesDelta).slice(0, 8);
  const columns: ColumnsType<WeeklyComparisonRow> = [
    { title: "渠道", dataIndex: "channelName", width: 180, render: (value, row) => <div><div className="font-medium">{value}</div><div className="text-xs text-[var(--muted)]">{row.businessLine}</div></div> },
    { title: "趋势", dataIndex: "trend", width: 105, render: (value) => trendTag(value) },
    { title: "销售变化", dataIndex: "salesDelta", align: "right", render: (value, row) => <span style={{ color: value < 0 ? "var(--danger)" : "var(--success)" }}>{currencyMoney(value, "CNY")} ({row.salesChangeRate === null ? "—" : `${(row.salesChangeRate * 100).toFixed(1)}%`})</span> },
    { title: "广告变化", dataIndex: "adSpendDelta", align: "right", render: (value, row) => <span>{currencyMoney(value, "CNY")} ({row.adSpendChangeRate === null ? "—" : `${(row.adSpendChangeRate * 100).toFixed(1)}%`})</span> },
    { title: "本周 ROI", dataIndex: "currentRoi", align: "right", render: (value) => ratio(value) },
  ];

  return (
    <Card loading={loading} styles={{ body: { padding: 16 } }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><Typography.Title level={4} className="!mb-1">经营分析看板</Typography.Title><Typography.Text type="secondary">快速查看周趋势、板块贡献和需要关注的渠道。</Typography.Text></div>
        {comparison ? <Tag color="blue">对比 W{comparison.currentPeriod.weekNumber} vs W{comparison.previousPeriod.weekNumber}</Tag> : null}
      </div>
      {!rows.length ? <Empty description="暂无看板数据" /> : <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}><Card size="small" title="周销售与广告趋势"><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="week" /><YAxis tickFormatter={(value) => compactMoney(Number(value))} /><Tooltip formatter={(value) => currencyMoney(Number(value), "CNY")} /><Legend /><Bar dataKey="adSpend" name="广告费" fill="#f59e0b" radius={[4, 4, 0, 0]} /><Line dataKey="sales" name="销售额" stroke="#1677ff" strokeWidth={3} dot={{ r: 4 }} /></ComposedChart></ResponsiveContainer></div></Card></Col>
        <Col xs={24} lg={12}><Card size="small" title="板块销售与广告"><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={blockData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" /><YAxis tickFormatter={(value) => compactMoney(Number(value))} /><Tooltip formatter={(value) => currencyMoney(Number(value), "CNY")} /><Legend /><Bar dataKey="sales" name="销售额" fill="#1677ff" radius={[4, 4, 0, 0]} /><Bar dataKey="adSpend" name="广告费" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></Col>
        <Col xs={24}><Card size="small" title="需要关注的渠道" extra={<Typography.Text type="secondary">下降、无数据或广告增加但销售下降</Typography.Text>}>{attentionRows.length ? <Table<WeeklyComparisonRow> size="small" rowKey="channelId" columns={columns} dataSource={attentionRows} pagination={false} scroll={{ x: 760 }} /> : <Alert type="success" showIcon message="当前没有明显异常渠道" />}</Card></Col>
      </Row>}
    </Card>
  );
}
