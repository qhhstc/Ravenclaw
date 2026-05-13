"use client";

import { DatePicker, Input, InputNumber, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { actionText, blockLabel, channelTypeLabel, currencyMoney, getWeek, money, percent, PercentText, ratingText, RoiTag, rowAdSpend, rowKey, rowSales, safeRatio, weekNumbers, withUpdatedWeek } from "./channelDataUtils";
import type { ChannelDataRow } from "./channelDataTypes";

type WeeklyMetricTableProps = {
  rows: ChannelDataRow[];
  loading: boolean;
  onChange: (rows: ChannelDataRow[]) => void;
};

function EditableNumber({ value, onChange }: { value: number; onChange: (value: number | null) => void }) {
  return (
    <InputNumber
      size="small"
      min={0}
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

export default function WeeklyMetricTable({ rows, loading, onChange }: WeeklyMetricTableProps) {
  const totalSales = rows.reduce((total, row) => total + rowSales(row), 0);
  const totalAdSpend = rows.reduce((total, row) => total + rowAdSpend(row), 0);
  const totalQuarterSales = rows.reduce((total, row) => total + Number(row.quarter?.salesAmount || 0), 0);
  const totalQuarterAdSpend = rows.reduce((total, row) => total + Number(row.quarter?.adSpend || 0), 0);
  const totalRoi = safeRatio(totalSales, totalAdSpend);
  const totalAdRatio = totalSales > 0 ? totalAdSpend / totalSales : 0;

  function updateRow(channelId: number, updater: (row: ChannelDataRow) => ChannelDataRow) {
    onChange(rows.map((row) => (row.channelId === channelId ? updater(row) : row)));
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
    { title: "板块", dataIndex: "businessBlock", fixed: "left", width: 108, render: (value) => <Tag color="blue">{blockLabel(value)}</Tag> },
    { title: "二级", dataIndex: "businessLine", fixed: "left", width: 130, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    {
      title: "渠道",
      dataIndex: "channelName",
      fixed: "left",
      width: 140,
      render: (value, row) => (
        <div>
          <div className="font-medium text-[#172033]">{value}</div>
          <div className="text-xs text-[#8a94a6]">{row.channelGroup || "-"}</div>
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
    { title: "月销售额", key: "monthSales", width: 130, align: "right", render: (_, row) => currencyMoney(rowSales(row)) },
    { title: "月广告", key: "monthAd", width: 130, align: "right", render: (_, row) => currencyMoney(rowAdSpend(row)) },
    { title: "月ROI", key: "roi", width: 92, align: "right", render: (_, row) => <RoiTag value={safeRatio(rowSales(row), rowAdSpend(row))} /> },
    { title: "月广告占销", key: "adRatio", width: 120, align: "right", render: (_, row) => <PercentText value={rowSales(row) > 0 ? rowAdSpend(row) / rowSales(row) : 0} /> },
    { title: "月销售占比", key: "salesShare", width: 120, align: "right", render: (_, row) => <PercentText value={totalSales > 0 ? rowSales(row) / totalSales : 0} /> },
    { title: "季销售额", key: "quarterSales", width: 130, align: "right", render: (_, row) => currencyMoney(Number(row.quarter?.salesAmount || 0)) },
    { title: "季广告", key: "quarterAd", width: 130, align: "right", render: (_, row) => currencyMoney(Number(row.quarter?.adSpend || 0)) },
    { title: "季ROI", key: "quarterRoi", width: 92, align: "right", render: (_, row) => <RoiTag value={safeRatio(Number(row.quarter?.salesAmount || 0), Number(row.quarter?.adSpend || 0))} /> },
    { title: "季广告占销", key: "quarterAdRatio", width: 120, align: "right", render: (_, row) => <PercentText value={Number(row.quarter?.salesAmount || 0) > 0 ? Number(row.quarter?.adSpend || 0) / Number(row.quarter?.salesAmount || 0) : 0} /> },
    { title: "季销售占比", key: "quarterSalesShare", width: 120, align: "right", render: (_, row) => <PercentText value={totalQuarterSales > 0 ? Number(row.quarter?.salesAmount || 0) / totalQuarterSales : 0} /> },
    {
      title: "评级",
      dataIndex: "manualRating",
      width: 96,
      render: (_, row) => (
        <Input
          size="small"
          value={ratingText(row)}
          placeholder="S/A/B/C"
          onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, manualRating: event.target.value, ratingSource: event.target.value ? "manual" : "none" }))}
        />
      ),
    },
    {
      title: "建议动作",
      dataIndex: "manualActionSuggestion",
      width: 220,
      render: (_, row) => (
        <Input
          size="small"
          value={actionText(row)}
          placeholder="待填写 / 待 AI 分析"
          onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, manualActionSuggestion: event.target.value }))}
        />
      ),
    },
    {
      title: "决策 deadline",
      dataIndex: "decisionDeadline",
      width: 150,
      render: (value, row) => (
        <DatePicker
          size="small"
          value={value ? dayjs(value) : null}
          placeholder="选择日期"
          onChange={(date) => updateRow(row.channelId, (current) => ({ ...current, decisionDeadline: date ? date.toISOString() : null }))}
        />
      ),
    },
    {
      title: "备注",
      dataIndex: "remark",
      width: 220,
      render: (value, row) => (
        <Input
          size="small"
          value={value ?? ""}
          placeholder="备注"
          onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, remark: event.target.value }))}
        />
      ),
    },
    { title: "渠道类型", dataIndex: "channelType", width: 120, render: (value) => <Tag>{channelTypeLabel(value)}</Tag> },
  ];

  return (
    <Table<ChannelDataRow>
      className="channel-weekly-table"
      size="small"
      rowKey={rowKey}
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={false}
      scroll={{ x: 3700 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}>
              <Typography.Text strong>合计</Typography.Text>
            </Table.Summary.Cell>
            {weekNumbers.flatMap((weekNumber, index) => {
              const sales = rows.reduce((total, row) => total + getWeek(row, weekNumber).salesAmountOriginal, 0);
              const adSpend = rows.reduce((total, row) => total + getWeek(row, weekNumber).adSpendOriginal, 0);
              return [
                <Table.Summary.Cell index={4 + index * 2} key={`sales-${weekNumber}`} align="right">
                  {money(sales)}
                </Table.Summary.Cell>,
                <Table.Summary.Cell index={5 + index * 2} key={`ad-${weekNumber}`} align="right">
                  {money(adSpend)}
                </Table.Summary.Cell>,
              ];
            })}
            <Table.Summary.Cell index={14} align="right"><Typography.Text strong>{currencyMoney(totalSales)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={15} align="right"><Typography.Text strong>{currencyMoney(totalAdSpend)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={16} align="right"><RoiTag value={totalRoi} /></Table.Summary.Cell>
            <Table.Summary.Cell index={17} align="right"><PercentText value={totalAdRatio} /></Table.Summary.Cell>
            <Table.Summary.Cell index={18} align="right">{percent(1)}</Table.Summary.Cell>
            <Table.Summary.Cell index={19} align="right"><Typography.Text strong>{currencyMoney(totalQuarterSales)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={20} align="right"><Typography.Text strong>{currencyMoney(totalQuarterAdSpend)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={21} align="right"><RoiTag value={safeRatio(totalQuarterSales, totalQuarterAdSpend)} /></Table.Summary.Cell>
            <Table.Summary.Cell index={22} align="right"><PercentText value={totalQuarterSales > 0 ? totalQuarterAdSpend / totalQuarterSales : 0} /></Table.Summary.Cell>
            <Table.Summary.Cell index={23} align="right">100.0%</Table.Summary.Cell>
            <Table.Summary.Cell index={24} />
            <Table.Summary.Cell index={25} />
            <Table.Summary.Cell index={26} />
            <Table.Summary.Cell index={27} />
            <Table.Summary.Cell index={28} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}
