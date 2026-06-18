"use client";

import { Button, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { actionSourceText, actionText, blockColor, blockLabel, channelTypeLabel, currencyMoney, getWeek, money, PercentText, ratingSourceText, ratingText, RoiTag, rowAdSpend, rowAdSpendBase, rowKey, rowSales, rowSalesBase, safeRatio, weekNumbers, withUpdatedWeek } from "./channelDataUtils";
import type { ChannelDataRow } from "./channelDataTypes";

type WeeklyMetricTableProps = {
  rows: ChannelDataRow[];
  loading: boolean;
  onChange: (rows: ChannelDataRow[]) => void;
};

function EditableNumber({ value, allowNegative = false, onChange }: { value: number; allowNegative?: boolean; onChange: (value: number | null) => void }) {
  return (
    <InputNumber
      size="small"
      min={allowNegative ? undefined : 0}
      precision={2}
      controls={false}
      value={value}
      formatter={(input) => `${input}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      parser={(input) => Number(input?.replace(/,/g, "") || 0)}
      onChange={onChange}
      className="w-[104px]"
    />
  );
}

function aiStatusText(value?: string | null) {
  const labels: Record<string, string> = {
    pending: "待分析",
    analyzing: "分析中",
    completed: "已完成",
    failed: "失败",
  };
  return labels[value || ""] ?? "待分析";
}

function parseRiskNotes(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  } catch {
    return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  }
}

function sourceTag(source: string) {
  if (source !== "AI") return null;
  return <Tag className="!m-0" color="purple">AI</Tag>;
}

function shortText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "—";
}

export default function WeeklyMetricTable({ rows, loading, onChange }: WeeklyMetricTableProps) {
  const [detailRow, setDetailRow] = useState<ChannelDataRow | null>(null);
  // 跨渠道汇总一律用本位币(base),避免不同币种原币直接相加;逐行金额仍按原币显示
  const totalSalesBase = rows.reduce((total, row) => total + rowSalesBase(row), 0);
  const totalAdSpendBase = rows.reduce((total, row) => total + rowAdSpendBase(row), 0);
  const totalQuarterSales = rows.reduce((total, row) => total + Number(row.quarter?.salesAmount || 0), 0);
  const totalQuarterAdSpend = rows.reduce((total, row) => total + Number(row.quarter?.adSpend || 0), 0);
  const totalRoi = safeRatio(totalSalesBase, totalAdSpendBase);
  const totalAdRatio = totalSalesBase > 0 ? totalAdSpendBase / totalSalesBase : 0;
  // 合计/占比统一本位币 ¥(season 列与 KPI 同口径),逐行原币仅用于录入展示
  const totalMoney = (value: number) => currencyMoney(value, "CNY");

  function updateRow(channelId: number, updater: (row: ChannelDataRow) => ChannelDataRow) {
    onChange(rows.map((row) => (row.channelId === channelId ? updater(row) : row)));
  }

  function adoptAiSuggestion(row: ChannelDataRow) {
    if (!row.aiRating && !row.aiActionSuggestion) {
      message.info("当前渠道暂无可采用的 AI 建议");
      return;
    }
    const nextRow = {
      ...row,
      manualRating: row.aiRating || row.manualRating || "",
      manualActionSuggestion: row.aiActionSuggestion || row.manualActionSuggestion || "",
      ratingSource: row.aiRating ? "manual" : row.ratingSource,
    };
    updateRow(row.channelId, () => nextRow);
    setDetailRow(nextRow);
    message.success("已采用 AI 评级和建议动作，请记得保存本月数据");
  }

  const weeklyColumns: ColumnsType<ChannelDataRow> = weekNumbers.flatMap((weekNumber) => [
    {
      title: `W${weekNumber}销售`,
      key: `w${weekNumber}Sales`,
      width: 122,
      align: "right" as const,
      render: (_, row) => (
        <EditableNumber
          value={getWeek(row, weekNumber).salesAmountOriginal}
          allowNegative
          onChange={(value) => updateRow(row.channelId, (current) => withUpdatedWeek(current, weekNumber, "salesAmountOriginal", value))}
        />
      ),
    },
    {
      title: `W${weekNumber}广告`,
      key: `w${weekNumber}Ad`,
      width: 122,
      align: "right" as const,
      render: (_, row) => (
        <EditableNumber
          value={getWeek(row, weekNumber).adSpendOriginal}
          onChange={(value) => updateRow(row.channelId, (current) => withUpdatedWeek(current, weekNumber, "adSpendOriginal", value))}
        />
      ),
    },
  ]);

  const columns: ColumnsType<ChannelDataRow> = [
    { title: "板块", dataIndex: "businessBlock", fixed: "left", width: 108, render: (value) => <Tag color={blockColor(value)}>{blockLabel(value)}</Tag> },
    { title: "二级", dataIndex: "businessLine", fixed: "left", width: 130, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    {
      title: "店铺/站点",
      dataIndex: ["store", "name"],
      fixed: "left",
      width: 150,
      render: (value, row) => (
        <div>
          <div className="font-medium text-[var(--foreground)]">{value || "-"}</div>
          <div className="text-xs text-[var(--muted)]">{row.channelType === "manual" && !row.store ? "原表导入" : row.platform?.name || row.store?.defaultCurrency || "-"}</div>
        </div>
      ),
    },
    {
      title: "渠道",
      dataIndex: "channelName",
      fixed: "left",
      width: 140,
      render: (value, row) => (
        <div>
          <div className="font-medium text-[var(--foreground)]">{value}</div>
          <div className="text-xs text-[var(--muted)]">{row.channelGroup || "-"}</div>
        </div>
      ),
    },
    {
      title: "负责人",
      dataIndex: "decisionOwner",
      width: 128,
      render: (value, row) => (
        <Input
          size="small"
          value={value ?? ""}
          placeholder="负责人"
          onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, decisionOwner: event.target.value }))}
        />
      ),
    },
    ...weeklyColumns,
    { title: "月销售额", key: "monthSales", width: 130, align: "right", render: (_, row) => currencyMoney(rowSales(row), row.currency) },
    { title: "月广告", key: "monthAd", width: 130, align: "right", render: (_, row) => currencyMoney(rowAdSpend(row), row.currency) },
    { title: "月ROI", key: "roi", width: 92, align: "right", render: (_, row) => <RoiTag value={safeRatio(rowSales(row), rowAdSpend(row))} /> },
    { title: "月广告占销", key: "adRatio", width: 120, align: "right", render: (_, row) => <PercentText value={rowSales(row) > 0 ? rowAdSpend(row) / rowSales(row) : 0} /> },
    { title: "月销售占比", key: "salesShare", width: 120, align: "right", render: (_, row) => <PercentText tone="share" value={totalSalesBase > 0 ? rowSalesBase(row) / totalSalesBase : 0} /> },
    { title: "季销售额", key: "quarterSales", width: 130, align: "right", render: (_, row) => currencyMoney(Number(row.quarter?.salesAmount || 0), "CNY") },
    { title: "季广告", key: "quarterAd", width: 130, align: "right", render: (_, row) => currencyMoney(Number(row.quarter?.adSpend || 0), "CNY") },
    { title: "季ROI", key: "quarterRoi", width: 92, align: "right", render: (_, row) => <RoiTag value={safeRatio(Number(row.quarter?.salesAmount || 0), Number(row.quarter?.adSpend || 0))} /> },
    { title: "季广告占销", key: "quarterAdRatio", width: 120, align: "right", render: (_, row) => <PercentText value={Number(row.quarter?.salesAmount || 0) > 0 ? Number(row.quarter?.adSpend || 0) / Number(row.quarter?.salesAmount || 0) : 0} /> },
    { title: "季销售占比", key: "quarterSalesShare", width: 120, align: "right", render: (_, row) => <PercentText tone="share" value={totalQuarterSales > 0 ? Number(row.quarter?.salesAmount || 0) / totalQuarterSales : 0} /> },
    {
      title: "评级",
      dataIndex: "manualRating",
      width: 104,
      render: (_, row) => {
        const rating = ratingText(row);
        const source = ratingSourceText(row);
        return (
          <Space size={4} direction="vertical" className="w-full">
            <Select
              size="small"
              allowClear
              value={rating || undefined}
              placeholder="待分析"
              options={["S", "A", "B", "C"].map((value) => ({ label: value, value }))}
              className="w-[82px]"
              onChange={(value) => updateRow(row.channelId, (current) => ({ ...current, manualRating: value || "", ratingSource: value ? "manual" : current.aiRating ? "ai" : "none" }))}
            />
            {source === "AI" ? <span className="leading-none">{sourceTag(source)}</span> : null}
          </Space>
        );
      },
    },
    {
      title: "建议动作",
      dataIndex: "manualActionSuggestion",
      width: 220,
      ellipsis: true,
      render: (_, row) => {
        const action = shortText(actionText(row), "待填写 / 待 AI 分析");
        const source = actionSourceText(row);
        return (
          <div className="channel-action-cell">
            <Tooltip title={action}>
              <button type="button" className="channel-table-link" onClick={() => setDetailRow(row)}>
                {action}
              </button>
            </Tooltip>
            {sourceTag(source)}
          </div>
        );
      },
    },
    {
      title: "AI 状态",
      dataIndex: "aiAnalysisStatus",
      width: 90,
      render: (value) => <Tag color={value === "completed" ? "green" : value === "failed" ? "red" : value === "analyzing" ? "blue" : "default"}>{aiStatusText(value)}</Tag>,
    },
    {
      title: "AI 总结/风险",
      dataIndex: "aiSummary",
      width: 150,
      render: (value, row) => {
        const risks = parseRiskNotes(row.aiRiskNotes);
        const hasAiDetail = Boolean(value || row.aiRating || row.aiActionSuggestion || risks.length || row.aiAnalyzedAt);
        return (
          <Button type="link" size="small" className="!px-0" disabled={!hasAiDetail} onClick={() => setDetailRow(row)}>
            {risks.length ? `${risks.length}条风险` : hasAiDetail ? "查看" : "待分析"}
          </Button>
        );
      },
    },
    {
      title: "决策期限",
      dataIndex: "decisionDeadline",
      width: 130,
      render: (value, row) => (
        <DatePicker
          size="small"
          value={value ? dayjs(value) : null}
          placeholder="选择日期"
          style={{ width: 118 }}
          onChange={(date) => updateRow(row.channelId, (current) => ({ ...current, decisionDeadline: date ? date.toISOString() : null }))}
        />
      ),
    },
    {
      title: "备注",
      dataIndex: "remark",
      width: 160,
      render: (value, row) => (
        <Tooltip title={value || ""}>
          <Input
            size="small"
            value={value ?? ""}
            placeholder="备注"
            onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, remark: event.target.value }))}
          />
        </Tooltip>
      ),
    },
    { title: "渠道类型", dataIndex: "channelType", width: 100, render: (value) => <Tag>{channelTypeLabel(value)}</Tag> },
  ];

  return (
    <>
      <Table<ChannelDataRow>
        className="channel-weekly-table"
        size="small"
        rowKey={rowKey}
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        scroll={{ x: 4050 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={5}>
                <Typography.Text strong>合计</Typography.Text>
              </Table.Summary.Cell>
              {weekNumbers.flatMap((weekNumber, index) => {
                // 周列合计也按本位币:各行该周原币 × 汇率求和,与月/季合计同口径
                const sales = rows.reduce((total, row) => total + getWeek(row, weekNumber).salesAmountOriginal * (Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1), 0);
                const adSpend = rows.reduce((total, row) => total + getWeek(row, weekNumber).adSpendOriginal * (Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1), 0);
                return [
                  <Table.Summary.Cell index={5 + index * 2} key={`sales-${weekNumber}`} align="right">
                    {money(sales)}
                  </Table.Summary.Cell>,
                  <Table.Summary.Cell index={6 + index * 2} key={`ad-${weekNumber}`} align="right">
                    {money(adSpend)}
                  </Table.Summary.Cell>,
                ];
              })}
              <Table.Summary.Cell index={15} align="right"><Typography.Text strong>{totalMoney(totalSalesBase)}</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={16} align="right"><Typography.Text strong>{totalMoney(totalAdSpendBase)}</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={17} align="right"><RoiTag value={totalRoi} /></Table.Summary.Cell>
              <Table.Summary.Cell index={18} align="right"><PercentText value={totalAdRatio} /></Table.Summary.Cell>
              <Table.Summary.Cell index={19} align="right"><PercentText tone="share" value={1} /></Table.Summary.Cell>
              <Table.Summary.Cell index={20} align="right"><Typography.Text strong>{totalMoney(totalQuarterSales)}</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={21} align="right"><Typography.Text strong>{totalMoney(totalQuarterAdSpend)}</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={22} align="right"><RoiTag value={safeRatio(totalQuarterSales, totalQuarterAdSpend)} /></Table.Summary.Cell>
              <Table.Summary.Cell index={23} align="right"><PercentText value={totalQuarterSales > 0 ? totalQuarterAdSpend / totalQuarterSales : 0} /></Table.Summary.Cell>
              <Table.Summary.Cell index={24} align="right"><PercentText tone="share" value={1} /></Table.Summary.Cell>
              <Table.Summary.Cell index={25} />
              <Table.Summary.Cell index={26} />
              <Table.Summary.Cell index={27} />
              <Table.Summary.Cell index={28} />
              <Table.Summary.Cell index={29} />
              <Table.Summary.Cell index={30} />
              <Table.Summary.Cell index={31} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <Modal
        title={detailRow ? `${detailRow.channelName} AI 分析详情` : "AI 分析详情"}
        open={Boolean(detailRow)}
        width={720}
        onCancel={() => setDetailRow(null)}
        footer={[
          <Button key="close" onClick={() => setDetailRow(null)}>关闭</Button>,
          <Button key="adopt" type="primary" disabled={!detailRow?.aiRating && !detailRow?.aiActionSuggestion} onClick={() => detailRow && adoptAiSuggestion(detailRow)}>
            采用 AI 建议
          </Button>,
        ]}
      >
        {detailRow ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-[var(--soft-bg)] p-3 text-sm">
              <div>评级：{detailRow.aiRating ? <Tag color="purple">{detailRow.aiRating}</Tag> : "待分析"}</div>
              <div>状态：<Tag>{aiStatusText(detailRow.aiAnalysisStatus)}</Tag></div>
              <div>负责人：{detailRow.decisionOwner || "—"}</div>
              <div>决策期限：{detailRow.decisionDeadline ? dayjs(detailRow.decisionDeadline).format("YYYY-MM-DD") : "—"}</div>
              <div>置信度：{detailRow.aiConfidence ? <Tag color="cyan">{({ high: "高", medium: "中", low: "低" } as Record<string, string>)[detailRow.aiConfidence] ?? detailRow.aiConfidence}</Tag> : "—"}</div>
              <div>分析模型：{detailRow.aiModel || "—"}</div>
              <div className="col-span-2">数据覆盖：{detailRow.aiDataCoverage || "—"}</div>
              <div className="col-span-2">分析时间：{formatDateTime(detailRow.aiAnalyzedAt)}</div>
            </div>
            {detailRow.aiRatingReason ? (
              <div>
                <Typography.Text strong>评级依据</Typography.Text>
                <div className="mt-2 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                  {detailRow.aiRatingReason}
                </div>
              </div>
            ) : null}
            <div>
              <Typography.Text strong>AI 总结</Typography.Text>
              <div className="mt-2 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                {detailRow.aiSummary || "暂无 AI 总结"}
              </div>
            </div>
            <div>
              <Typography.Text strong>风险提示</Typography.Text>
              <div className="mt-2 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                {parseRiskNotes(detailRow.aiRiskNotes).length ? (
                  <ul className="m-0 list-disc pl-5">
                    {parseRiskNotes(detailRow.aiRiskNotes).map((risk) => <li key={risk}>{risk}</li>)}
                  </ul>
                ) : "暂无风险提示"}
              </div>
            </div>
            <div>
              <Typography.Text strong>AI 建议动作</Typography.Text>
              <div className="mt-2 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                {detailRow.aiActionSuggestion || "暂无 AI 建议动作"}
              </div>
            </div>
            <div>
              <Typography.Text strong>预算建议</Typography.Text>
              <div className="mt-2 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                {detailRow.nextBudgetBase ? `${currencyMoney(Number(detailRow.nextBudgetBase), "CNY")} · ${detailRow.budgetAdjustReason || "暂无调整原因"}` : "暂无预算建议"}
              </div>
            </div>
            <div>
              <Typography.Text strong>备注</Typography.Text>
              <div className="mt-2 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                {detailRow.remark || "暂无备注"}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
