"use client";

import { useMemo, useState } from "react";
import { Button, Card, Select, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { compareChannelRoi, ENTRY_BLOCK_COLORS, sortChannelRoi } from "@/lib/channel-entry-analysis";
import type { ChannelRoiComparison as RoiRow } from "@/lib/channel-entry-analysis";
import type { EntryData } from "@/lib/channel-entry-types";

const money = (value: number | null) => value === null ? "—" : `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;

function RoiStatus({ status }: { status: RoiRow["previousStatus"] }) {
  return <Tag color={status === "missing" || status === null ? "default" : "orange"}>
    {status === "missing" || status === null ? "未填写" : status === "no-ad" ? "无广告投入" : "数据未齐"}
  </Tag>;
}

function RoiChange({ value, rate = false, zeroBaseline = false }: { value: number | null; rate?: boolean; zeroBaseline?: boolean }) {
  if (value === null) return <Tooltip title={zeroBaseline ? "上周 ROI 为 0，无法计算变化率" : "两周都需填齐销售和广告，且广告费大于 0"}><span className="entry-roi-muted">—</span></Tooltip>;
  const amount = Math.abs(value) * (rate ? 100 : 1);
  const digits = rate ? 1 : 2;
  const threshold = rate ? 0.05 : 0.005;
  const label = amount > 0 && amount < threshold ? `<${rate ? "0.1" : "0.01"}` : amount.toFixed(digits);
  return <strong className={value > 0 ? "entry-positive" : value < 0 ? "entry-negative" : "entry-roi-muted"}>
    {value > 0 ? "+" : value < 0 ? "−" : ""}{label}{rate ? "%" : ""}
  </strong>;
}

type RoiSort = "roi-desc" | "roi-asc" | "rate-desc" | "rate-asc";

export default function ChannelRoiComparison({ data, period, onPeriodChange, onLocate }: {
  data: EntryData; period: number; onPeriodChange: (week: number) => void; onLocate: (id: number) => void;
}) {
  const { rows, previousRows } = data;
  const [block, setBlock] = useState<string>();
  const [channelIds, setChannelIds] = useState<number[]>([]);
  const [sortPreference, setSort] = useState<RoiSort>("roi-desc");
  const sort = period === 0 && sortPreference.startsWith("rate") ? "roi-desc" : sortPreference;
  const comparisons = useMemo(() => compareChannelRoi(rows, period || null, previousRows), [rows, period, previousRows]);
  const blockRows = rows.filter((row) => !block || row.businessBlock === block);
  const visible = sortChannelRoi(
    comparisons.filter((item) => (!block || item.row.businessBlock === block) && (!channelIds.length || channelIds.includes(item.row.channelId))),
    sort.endsWith("asc") ? "asc" : "desc",
    period > 0 && sort.startsWith("rate") ? "roiRate" : "roi",
  );
  const maxRoi = Math.max(1, ...visible.map((item) => Math.abs(item.roi ?? 0)));
  const hasNegative = visible.some((item) => item.roi !== null && item.roi < 0);
  const previousLabel = period === 1 ? `${data.previousMonth.year}年${data.previousMonth.month}月 W5` : `${data.month}月 W${period - 1}`;
  const columns: ColumnsType<RoiRow> = [
    {
      title: "渠道", key: "channel", width: 240, fixed: "left",
      render: (_, item) => <div className="entry-roi-channel">
        <Button type="link" onClick={() => onLocate(item.row.channelId)}>{item.row.businessLine}<small>{item.row.channelName}</small></Button>
        <Tag color={ENTRY_BLOCK_COLORS[item.row.businessBlock] || ENTRY_BLOCK_COLORS.other}>{item.row.businessBlockLabel}</Tag>
      </div>,
    },
    {
      title: <Tooltip title="该渠道销售额 ÷ 该渠道广告费，非利润率。整店与单一广告渠道的归因口径可能不同，建议筛选同类渠道比较。">{period ? "本周 ROI（倍）" : "ROI（倍）"}</Tooltip>,
      key: "roi", width: period ? 215 : 255,
      render: (_, item) => item.roi === null ? <RoiStatus status={item.status} /> : <div className="entry-roi-value">
        <div className="entry-roi-track" aria-hidden="true">
          <i className="entry-roi-zero" style={{ left: hasNegative ? "50%" : 0 }} />
          <span style={{ width: `${Math.abs(item.roi) / maxRoi * (hasNegative ? 50 : 100)}%`, left: `${hasNegative ? item.roi < 0 ? 50 - Math.abs(item.roi) / maxRoi * 50 : 50 : 0}%`, background: item.roi < 0 ? "#dc2626" : ENTRY_BLOCK_COLORS[item.row.businessBlock] || ENTRY_BLOCK_COLORS.other }} />
        </div>
        <strong className={item.roi < 0 ? "entry-negative" : ""}>{item.roi.toFixed(2)}×</strong>
      </div>,
    },
  ];
  if (period > 0) columns.push(
    { title: "上周 ROI（倍）", key: "previousRoi", width: 130, align: "right", render: (_, item) => item.previousRoi === null ? <RoiStatus status={item.previousStatus} /> : `${item.previousRoi.toFixed(2)}×` },
    { title: <Tooltip title="本周 ROI − 上周 ROI">ROI 变化值</Tooltip>, key: "roiDelta", width: 115, align: "right", render: (_, item) => <RoiChange value={item.roiDelta} /> },
    { title: <Tooltip title="(本周 ROI − 上周 ROI) ÷ |上周 ROI|">ROI 变化率</Tooltip>, key: "roiRate", width: 120, align: "right", render: (_, item) => <RoiChange value={item.roiRate} rate zeroBaseline={item.previousRoi === 0 && item.roi !== null} /> },
  );
  columns.push(
    { title: period ? "本周销售额" : "销售额", key: "sales", width: 150, align: "right", render: (_, item) => money(item.sales) },
    { title: period ? "本周广告费" : "广告费", key: "ad", width: 140, align: "right", render: (_, item) => money(item.ad) },
    { title: period ? "本周广告占销" : "广告占销", key: "adRatio", width: 115, align: "right", render: (_, item) => percent(item.adRatio) },
  );
  if (period === 0) columns.push({
    title: "已录入周", key: "weeks", width: 150,
    render: (_, item) => <div className="entry-roi-weeks">{item.activeWeeks.length ? item.activeWeeks.map((week) => `W${week}`).join("、") : "—"}{item.incompleteWeeks.length > 0 && <small>{item.incompleteWeeks.map((week) => `W${week}`).join("、")} 待补齐</small>}</div>,
  });

  return <Card title="渠道 ROI 对比" className="entry-roi-card">
    <div className="entry-roi-controls">
      <Select aria-label="ROI统计周期" value={period} onChange={onPeriodChange} options={[{ value: 0, label: "全月" }, ...[1, 2, 3, 4, 5].map((value) => ({ value, label: `W${value}` }))]} />
      <Select aria-label="ROI筛选板块" allowClear placeholder="全部板块" value={block} onChange={(value) => { setBlock(value); setChannelIds([]); }} options={Array.from(new Map(rows.map((row) => [row.businessBlock, { value: row.businessBlock, label: row.businessBlockLabel }])).values())} />
      <Select<number[]> mode="multiple" aria-label="选择对比渠道" allowClear placeholder="全部渠道 · 可多选对比" className="entry-roi-channel-select" maxTagCount="responsive" value={channelIds} onChange={setChannelIds} optionFilterProp="label" options={blockRows.map((row) => ({ value: row.channelId, label: `${row.businessLine} / ${row.channelName}` }))} />
      <Select<RoiSort> aria-label="ROI排序" value={sort} onChange={setSort} options={[
        { value: "roi-desc", label: "ROI 从高到低" }, { value: "roi-asc", label: "ROI 从低到高" },
        ...(period > 0 ? [{ value: "rate-desc", label: "ROI 涨幅优先" }, { value: "rate-asc", label: "ROI 跌幅优先" }] : []),
      ]} />
    </div>
    {period > 0 && <p className="entry-card-caption entry-roi-period">本周：{data.year}年{data.month}月 W{period} · 上周：{previousLabel}</p>}
    <Table<RoiRow> rowKey={(item) => item.row.channelId} size="middle" pagination={false} scroll={{ x: period ? 1225 : 1050, y: 460 }} dataSource={visible} columns={columns} locale={{ emptyText: "当前筛选下没有渠道" }} />
    <p className="entry-footnote entry-roi-note">{period ? "金额为人民币。缺项或广告费为 0 不计算 ROI；上周 ROI 为 0 时只显示变化值，不计算变化率。" : "金额为人民币。全月按已填周汇总，请对齐周范围；缺项或广告费为 0 不参与 ROI 排名。"}</p>
  </Card>;
}
