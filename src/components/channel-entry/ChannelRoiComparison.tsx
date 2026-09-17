"use client";

import { useMemo, useState } from "react";
import { Button, Card, Select, Table, Tag, Tooltip } from "antd";
import { compareChannelRoi, ENTRY_BLOCK_COLORS, sortChannelRoi } from "@/lib/channel-entry-analysis";
import type { EntryRow } from "@/lib/channel-entry-types";

const money = (value: number | null) => value === null ? "—" : `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;

export default function ChannelRoiComparison({ rows, onLocate }: { rows: EntryRow[]; onLocate: (id: number) => void }) {
  const [period, setPeriod] = useState(0);
  const [block, setBlock] = useState<string>();
  const [channelIds, setChannelIds] = useState<number[]>([]);
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const comparisons = useMemo(() => compareChannelRoi(rows, period || null), [rows, period]);
  const blockRows = rows.filter((row) => !block || row.businessBlock === block);
  const visible = sortChannelRoi(comparisons.filter((item) => (!block || item.row.businessBlock === block) && (!channelIds.length || channelIds.includes(item.row.channelId))), direction);
  const maxRoi = Math.max(1, ...visible.map((item) => Math.abs(item.roi ?? 0)));
  const hasNegative = visible.some((item) => item.roi !== null && item.roi < 0);

  return <Card title="渠道 ROI 对比" className="entry-roi-card">
    <div className="entry-roi-controls">
      <Select aria-label="ROI统计周期" value={period} onChange={setPeriod} options={[{ value: 0, label: "全月" }, ...[1, 2, 3, 4, 5].map((value) => ({ value, label: `W${value}` }))]} />
      <Select aria-label="ROI筛选板块" allowClear placeholder="全部板块" value={block} onChange={(value) => { setBlock(value); setChannelIds([]); }} options={Array.from(new Map(rows.map((row) => [row.businessBlock, { value: row.businessBlock, label: row.businessBlockLabel }])).values())} />
      <Select<number[]> mode="multiple" aria-label="选择对比渠道" allowClear placeholder="全部渠道 · 可多选对比" className="entry-roi-channel-select" maxTagCount="responsive" value={channelIds} onChange={setChannelIds} optionFilterProp="label" options={blockRows.map((row) => ({ value: row.channelId, label: `${row.businessLine} / ${row.channelName}` }))} />
      <Select aria-label="ROI排序" value={direction} onChange={setDirection} options={[{ value: "desc", label: "ROI 从高到低" }, { value: "asc", label: "ROI 从低到高" }]} />
    </div>
    <Table rowKey={(item) => item.row.channelId} size="middle" pagination={false} scroll={{ x: 1040, y: 460 }} dataSource={visible} columns={[
      { title: "渠道", key: "channel", width: 260, fixed: "left", render: (_, item) => <div className="entry-roi-channel"><Button type="link" onClick={() => onLocate(item.row.channelId)}>{item.row.businessLine}<small>{item.row.channelName}</small></Button><Tag color={ENTRY_BLOCK_COLORS[item.row.businessBlock] || ENTRY_BLOCK_COLORS.other}>{item.row.businessBlockLabel}</Tag></div> },
      { title: <Tooltip title="该渠道销售额 ÷ 该渠道广告费，非利润率。整店与单一广告渠道的归因口径可能不同，建议筛选同类渠道比较。">ROI（倍）</Tooltip>, key: "roi", width: 255, render: (_, item) => item.roi === null ? <Tag color={item.status === "missing" ? "default" : "orange"}>{item.status === "missing" ? "未填写" : item.status === "no-ad" ? "无广告投入" : "数据未齐"}</Tag> : <div className="entry-roi-value"><div className="entry-roi-track" aria-hidden="true"><i className="entry-roi-zero" style={{ left: hasNegative ? "50%" : 0 }} /><span style={{ width: `${Math.abs(item.roi) / maxRoi * (hasNegative ? 50 : 100)}%`, left: `${hasNegative ? item.roi < 0 ? 50 - Math.abs(item.roi) / maxRoi * 50 : 50 : 0}%`, background: item.roi < 0 ? "#dc2626" : ENTRY_BLOCK_COLORS[item.row.businessBlock] || ENTRY_BLOCK_COLORS.other }} /></div><strong className={item.roi < 0 ? "entry-negative" : ""}>{item.roi.toFixed(2)}×</strong></div> },
      { title: "销售额", key: "sales", width: 150, align: "right", render: (_, item) => money(item.sales) },
      { title: "广告费", key: "ad", width: 150, align: "right", render: (_, item) => money(item.ad) },
      { title: "广告占销", key: "adRatio", width: 105, align: "right", render: (_, item) => percent(item.adRatio) },
      { title: "已录入周", key: "weeks", width: 150, render: (_, item) => <div className="entry-roi-weeks">{item.activeWeeks.length ? item.activeWeeks.map((week) => `W${week}`).join("、") : "—"}{item.incompleteWeeks.length > 0 && <small>{item.incompleteWeeks.map((week) => `W${week}`).join("、")} 待补齐</small>}</div> },
    ]} locale={{ emptyText: "当前筛选下没有渠道" }} />
    <p className="entry-footnote entry-roi-note">金额为人民币。全月按已填周汇总，请对齐周范围；缺项或广告费为 0 不参与 ROI 排名。</p>
  </Card>;
}
