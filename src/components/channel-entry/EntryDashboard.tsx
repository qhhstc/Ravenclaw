"use client";

import { useMemo, useState } from "react";
import { Button, Card, Empty, Segmented, Select, Table, Tag, Tooltip } from "antd";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { analyzeEntry, ENTRY_BLOCK_COLORS, sumKnown } from "@/lib/channel-entry-analysis";
import type { EntryData } from "@/lib/channel-entry-types";
import ChannelRoiComparison from "./ChannelRoiComparison";
import { entryWeekLabel, previousEntryWeekLabel } from "@/lib/channel-entry-calendar";

export const entryMoney = (value: number | null) => value === null ? "—" : `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const entryPercent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;
const compact = (value: number) => Math.abs(value) >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString("zh-CN");
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" };
const changeLabel = (rate: number | null) => {
  if (rate === null) return "—";
  if (rate === 0) return "持平 0.0%";
  const amount = Math.abs(rate * 100);
  return `${rate > 0 ? "↑" : "↓"} ${amount < 0.05 ? "<0.1" : amount.toFixed(1)}%`;
};

export default function EntryDashboard({ data, statsWeek, selectedWeek, onLocate }: {
  data: EntryData; statsWeek: number; selectedWeek: number; onLocate: (id: number) => void;
}) {
  const analysis = useMemo(() => analyzeEntry(data, selectedWeek, statsWeek || null), [data, selectedWeek, statsWeek]);
  const scopeLabel = statsWeek ? `W${statsWeek}` : analysis.comparisonScope.partial ? "本月累计" : "本月";
  const [rankMetric, setRankMetric] = useState<"sales" | "ad">("sales");
  const [rankDirection, setRankDirection] = useState("下降");
  const previousLabel = previousEntryWeekLabel(data, selectedWeek);
  const rankRows = analysis.comparisons.filter((item) => {
    const delta = rankMetric === "sales" ? item.salesDelta : item.adDelta;
    return delta !== null && (rankDirection === "上涨" ? delta > 0 : delta < 0);
  }).sort((a, b) => {
    const first = rankMetric === "sales" ? a.salesDelta! : a.adDelta!;
    const second = rankMetric === "sales" ? b.salesDelta! : b.adDelta!;
    return rankDirection === "上涨" ? second - first : first - second;
  }).slice(0, 5);
  const alerts = analysis.comparisons.filter((item) => item.alerts.length).sort((a, b) => Number(b.alerts.some((s) => s.includes("下降"))) - Number(a.alerts.some((s) => s.includes("下降"))));
  const latest = data.updatedAt ? new Date(data.updatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "尚无数据";
  const currentSales = sumKnown(analysis.comparisons.map((item) => item.current.salesAmountBase));
  const previousSales = sumKnown(analysis.comparisons.map((item) => item.previous.salesAmountBase));
  const monthCompareLabel = `${data.previousMonth.year}年${data.previousMonth.month}月 ${analysis.comparisonScope.label}`;
  const cards = [
    { title: `${scopeLabel}销售额`, value: entryMoney(analysis.sales), note: `${analysis.populated} 个渠道已有数据`, accent: "#2563eb", rate: analysis.monthComparison.salesRate, previous: entryMoney(analysis.monthComparison.previousSales), isRatio: false },
    { title: `${scopeLabel}广告费`, value: entryMoney(analysis.ad), note: "已录入广告费合计", accent: "#d97706", rate: analysis.monthComparison.adRate, previous: entryMoney(analysis.monthComparison.previousAd), isRatio: false },
    { title: statsWeek ? `W${statsWeek}广告占销` : "广告占销", value: entryPercent(analysis.adRatio), note: "广告费 ÷ 销售额", accent: "#0f766e", rate: analysis.monthComparison.adRatioRate, previous: entryPercent(analysis.monthComparison.previousAdRatio), isRatio: true },
  ];
  return <section id="entry-dashboard" className="entry-section">
    <div className="entry-section-heading"><div><h2>经营分析看板</h2><p>{data.year} 年 {data.month} 月 · {statsWeek ? entryWeekLabel(data, statsWeek) : analysis.comparisonScope.partial ? `累计至 W${analysis.comparisonScope.latest || "—"}` : "全月"} · 人民币</p></div><span className="entry-updated">更新于 {latest}</span></div>
    <div className="entry-kpi-grid">{cards.map((card) => <div className="entry-kpi" key={card.title} style={{ borderTopColor: card.accent }}>
      <span>{card.title}</span><strong>{card.value}</strong>
      <div className="entry-kpi-footer"><small>{card.note}</small>
        <Tooltip title={`${monthCompareLabel}：${card.previous}。变化率 = (本期 − 上期) ÷ |上期|${card.isRatio ? "，此处为占销比的相对变化，不是百分点差值" : ""}。当前未结束月份按已录入周进度对齐上月；使用各月核算汇率，渠道缺报可能影响结果。缺数据、日期待核对或上期基数为 0 时显示 —。颜色仅表示数值方向。`}>
          <small className="entry-kpi-change">较 {monthCompareLabel}<span className={card.rate !== null && card.rate > 0 ? "entry-positive" : card.rate !== null && card.rate < 0 ? "entry-negative" : ""}>{changeLabel(card.rate)}</span></small>
        </Tooltip>
      </div>
    </div>)}</div>
    {analysis.comparisonScope.unknownDates && <p className="entry-footnote">存在日期待核对的周数据：金额仍保留，暂不计算月环比。</p>}
    <ChannelRoiComparison data={data} period={statsWeek} onLocate={onLocate} />
    <div className="entry-chart-grid">
      <Card title="每周销售与广告"><p className="entry-card-caption">全月周趋势{statsWeek ? ` · 当前选中 W${statsWeek}` : ""} · 空白周不绘制为 0</p>{analysis.weekly.some((w) => w.sales !== null || w.ad !== null) ? <div className="entry-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 280 }}><ComposedChart data={analysis.weekly} margin={{ left: 2, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="week" stroke="var(--muted)" /><YAxis tickFormatter={compact} stroke="var(--muted)" width={64} /><ChartTooltip contentStyle={tooltipStyle} labelFormatter={(label) => analysis.weekly.find((week) => week.week === label)?.dateLabel ?? label} formatter={(value) => entryMoney(Number(value))} /><Legend /><Bar dataKey="ad" name="广告费" fill="#fbbf24" radius={[5, 5, 0, 0]} /><Line dataKey="sales" name="销售额" stroke="#2563eb" strokeWidth={3} connectNulls={false} dot={{ r: 4 }} /></ComposedChart></ResponsiveContainer></div> : <Empty description="本月尚未填写数据" />}</Card>
      <Card title="各板块销售与广告"><p className="entry-card-caption">{scopeLabel} · 按渠道汇率折算</p>{analysis.blocks.some((b) => b.sales !== null || b.ad !== null) ? <div className="entry-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 280 }}><BarChart data={analysis.blocks} margin={{ left: 2, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="name" stroke="var(--muted)" /><YAxis tickFormatter={compact} stroke="var(--muted)" width={64} /><ChartTooltip contentStyle={tooltipStyle} formatter={(value) => entryMoney(Number(value))} /><Legend /><Bar dataKey="sales" name="销售额" radius={[5, 5, 0, 0]}>{analysis.blocks.map((block) => <Cell key={block.key} fill={ENTRY_BLOCK_COLORS[block.key] || ENTRY_BLOCK_COLORS.other} />)}</Bar><Bar dataKey="ad" name="广告费" fill="#cbd5e1" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty description={`${scopeLabel}暂无板块数据`} />}</Card>
    </div>
    <div className="entry-week-heading"><div><h3>周环比分析</h3><p className="entry-footnote">{entryWeekLabel(data, selectedWeek)} 对比 {previousLabel} · 未填写不视为下降</p></div></div>
    <div className="entry-chart-grid">
      <Card title="周环比涨跌排行" extra={<div className="entry-rank-controls"><Select aria-label="排行指标" value={rankMetric} onChange={setRankMetric} options={[{ value: "sales", label: "销售额" }, { value: "ad", label: "广告费" }]} /><Segmented size="small" value={rankDirection} onChange={(value) => setRankDirection(String(value))} options={["下降", "上涨"]} /></div>}>
        <p className="entry-card-caption">W{selectedWeek} vs {previousLabel} · 按变动金额排序</p>
        {rankRows.length ? rankRows.map((item, index) => <button type="button" className="entry-ranking-row" key={item.row.channelId} onClick={() => onLocate(item.row.channelId)}><span className="entry-rank-number">{index + 1}</span><span className="entry-rank-name"><b>{item.row.businessLine}</b><small>{item.row.channelName}</small></span><span className={rankMetric === "ad" ? "entry-neutral" : rankDirection === "上涨" ? "entry-positive" : "entry-negative"}><b>{entryMoney(rankMetric === "sales" ? item.salesDelta : item.adDelta)}</b><small>{entryPercent(rankMetric === "sales" ? item.salesRate : item.adRate)}</small></span></button>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可比的涨跌渠道" />}
      </Card>
      <Card title={`${scopeLabel}销售 TOP 5`}><p className="entry-card-caption">按销售额排序，不代表利润或盈利能力</p>{analysis.topSales.length ? analysis.topSales.map(({ row, sales }, index) => <button type="button" className="entry-ranking-row" key={row.channelId} onClick={() => onLocate(row.channelId)}><span className="entry-rank-number">{index + 1}</span><span className="entry-rank-name"><b>{row.businessLine}</b><small>{row.channelName}</small></span><b>{entryMoney(sales)}</b></button>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无销售数据" />}</Card>
    </div>
    <Card title="本周 vs 上周 / 待关注渠道" extra={<Tooltip title="这是规则提示，不是盈利结论。广告占销关注阈值为 25%。"><Tag color="blue">点击渠道定位填报行</Tag></Tooltip>}>
      <div className="entry-comparison-totals"><span>本周已填销售 <b>{entryMoney(currentSales)}</b></span><span>上周已填销售 <b>{entryMoney(previousSales)}</b></span><small>两周覆盖范围可能不同，涨跌以逐渠道可比数据为准。</small></div>
      <Table size="small" rowKey={(item) => item.row.channelId} dataSource={alerts} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 850 }} columns={[
        { title: "渠道", key: "channel", render: (_, item) => <Button type="link" className="!p-0" onClick={() => onLocate(item.row.channelId)}>{item.row.businessLine} / {item.row.channelName}</Button> },
        { title: "本周销售", key: "current", render: (_, item) => entryMoney(item.current.salesAmountBase) },
        { title: "上周销售", key: "previous", render: (_, item) => entryMoney(item.previous.salesAmountBase) },
        { title: "销售变化", key: "delta", render: (_, item) => <span className={item.salesDelta !== null && item.salesDelta < 0 ? "entry-negative" : ""}>{entryMoney(item.salesDelta)}</span> },
        { title: "提示", key: "alerts", render: (_, item) => item.alerts.map((alert) => <Tag key={alert} color={alert.includes("下降") ? "red" : "orange"}>{alert}</Tag>) },
      ]} locale={{ emptyText: "可比数据中未触发上述关注规则" }} />
    </Card>
  </section>;
}
