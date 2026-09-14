"use client";

import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from "@ant-design/icons";
import { Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { blockColor, blockLabel, currencyMoney, percent, ratio } from "./channelDataUtils";
import type { WeeklyComparisonResponse, WeeklyComparisonRow } from "./channelDataTypes";

type WeeklyComparisonProps = {
  comparison: WeeklyComparisonResponse | null;
  loading: boolean;
  weekNumber?: number;
  onWeekChange: (weekNumber: number) => void;
};

function changeRate(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function deltaText(value: number, valueRate: number | null) {
  const color = value > 0 ? "var(--success)" : value < 0 ? "var(--danger)" : "var(--muted)";
  const Icon = value > 0 ? ArrowUpOutlined : value < 0 ? ArrowDownOutlined : MinusOutlined;
  return <span style={{ color }}><Icon className="mr-1" />{currencyMoney(value, "CNY")} ({changeRate(valueRate)})</span>;
}

function trendTag(value: WeeklyComparisonRow["trend"]) {
  const config = {
    up: ["上涨", "green"], down: ["下降", "red"], flat: ["持平", "default"], new: ["新增", "blue"], missing: ["本周无数据", "orange"],
  } as const;
  const [label, color] = config[value];
  return <Tag color={color}>{label}</Tag>;
}

export default function WeeklyComparison({ comparison, loading, weekNumber, onWeekChange }: WeeklyComparisonProps) {
  const selectedWeek = weekNumber ?? comparison?.currentPeriod.weekNumber ?? 1;
  const columns = useMemo<ColumnsType<WeeklyComparisonRow>>(() => [
    { title: "板块", dataIndex: "businessBlock", width: 100, fixed: "left", render: (value) => <Tag color={blockColor(value)}>{blockLabel(value)}</Tag> },
    { title: "渠道", dataIndex: "channelName", width: 180, fixed: "left", render: (value, row) => <div><div className="font-medium">{value}</div><div className="text-xs text-[var(--muted)]">{row.businessLine}</div></div> },
    { title: "本周销售", key: "currentSales", width: 125, align: "right", render: (_, row) => currencyMoney(row.current.salesAmount, "CNY") },
    { title: "上周销售", key: "previousSales", width: 125, align: "right", render: (_, row) => currencyMoney(row.previous.salesAmount, "CNY") },
    { title: "销售变化", key: "salesDelta", width: 190, align: "right", sorter: (a, b) => a.salesDelta - b.salesDelta, render: (_, row) => deltaText(row.salesDelta, row.salesChangeRate) },
    { title: "本周广告", key: "currentAd", width: 125, align: "right", render: (_, row) => currencyMoney(row.current.adSpend, "CNY") },
    { title: "上周广告", key: "previousAd", width: 125, align: "right", render: (_, row) => currencyMoney(row.previous.adSpend, "CNY") },
    { title: "广告变化", key: "adDelta", width: 190, align: "right", sorter: (a, b) => a.adSpendDelta - b.adSpendDelta, render: (_, row) => deltaText(row.adSpendDelta, row.adSpendChangeRate) },
    { title: "ROI变化", key: "roiDelta", width: 110, align: "right", sorter: (a, b) => (a.roiDelta ?? -Infinity) - (b.roiDelta ?? -Infinity), render: (_, row) => row.roiDelta === null ? "—" : `${row.roiDelta >= 0 ? "+" : ""}${ratio(row.roiDelta)}` },
    { title: "广告占销变化", key: "adRatioDelta", width: 130, align: "right", render: (_, row) => row.adRatioDelta === null ? "—" : `${row.adRatioDelta >= 0 ? "+" : ""}${percent(row.adRatioDelta)}` },
    { title: "状态", key: "trend", width: 105, render: (_, row) => trendTag(row.trend) },
  ], []);

  const summary = comparison?.summary;
  const cards = summary ? [
    { title: "销售额", current: currencyMoney(summary.current.salesAmount, "CNY"), previous: `上周 ${currencyMoney(summary.previous.salesAmount, "CNY")}`, change: deltaText(summary.salesDelta, summary.salesChangeRate) },
    { title: "广告费", current: currencyMoney(summary.current.adSpend, "CNY"), previous: `上周 ${currencyMoney(summary.previous.adSpend, "CNY")}`, change: deltaText(summary.adSpendDelta, summary.adSpendChangeRate) },
    { title: "ROI", current: ratio(summary.current.roi), previous: `上周 ${ratio(summary.previous.roi)}`, change: summary.roiDelta === null ? "—" : `${summary.roiDelta >= 0 ? "+" : ""}${ratio(summary.roiDelta)}` },
    { title: "广告占销", current: percent(summary.current.adRatio ?? 0), previous: `上周 ${percent(summary.previous.adRatio ?? 0)}`, change: summary.adRatioDelta === null ? "—" : `${summary.adRatioDelta >= 0 ? "+" : ""}${percent(summary.adRatioDelta)}` },
  ] : [];

  return (
    <Card loading={loading} styles={{ body: { padding: 16 } }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><Typography.Title level={4} className="!mb-1">周环比分析</Typography.Title><Typography.Text type="secondary">比较本周与上周渠道表现，金额统一按本位币 ¥ 计算。</Typography.Text></div>
        <Space><Typography.Text type="secondary">当前周</Typography.Text><Select value={selectedWeek} onChange={onWeekChange} options={[1, 2, 3, 4, 5].map((week) => ({ label: `W${week}`, value: week }))} style={{ width: 90 }} /></Space>
      </div>
      <Typography.Text type="secondary" className="mb-3 block">{comparison ? `${comparison.currentPeriod.year}年${comparison.currentPeriod.month}月 W${comparison.currentPeriod.weekNumber} vs ${comparison.previousPeriod.year}年${comparison.previousPeriod.month}月 W${comparison.previousPeriod.weekNumber}` : "暂无对比数据"}</Typography.Text>
      <Row gutter={[12, 12]} className="mb-4">
        {cards.map((item) => <Col xs={24} sm={12} lg={6} key={item.title}><Card size="small"><Statistic title={item.title} value={item.current} /><div className="mt-1 text-xs text-[var(--muted)]">{item.previous}</div><div className="mt-1 text-sm">{item.change}</div></Card></Col>)}
      </Row>
      <Table<WeeklyComparisonRow> size="small" rowKey="channelId" columns={columns} dataSource={comparison?.rows ?? []} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1480 }} locale={{ emptyText: "暂无周对比数据" }} />
    </Card>
  );
}
