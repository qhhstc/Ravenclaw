"use client";

import { Input, InputNumber, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { channelTypeLabel, currencyMoney, getWeek, money, percent, PercentText, RoiTag, rowAdSpend, rowKey, rowSales, safeRatio, weekNumbers, withUpdatedWeek } from "./channelDataUtils";
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
    { title: "业务线", dataIndex: "businessLine", fixed: "left", width: 130, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "所属品牌", dataIndex: ["brand", "name"], width: 130, render: (value) => value || "-" },
    { title: "平台", dataIndex: ["platform", "name"], width: 120, render: (value) => value || "-" },
    { title: "店铺/站点", dataIndex: ["store", "name"], width: 170, render: (value) => value || "-" },
    {
      title: "渠道名称",
      dataIndex: "channelName",
      width: 140,
      render: (value, row) => (
        <div>
          <div className="font-medium text-[#172033]">{value}</div>
          <div className="text-xs text-[#8a94a6]">{row.channelGroup || "-"}</div>
        </div>
      ),
    },
    { title: "渠道类型", dataIndex: "channelType", width: 120, render: (value) => <Tag color="blue">{channelTypeLabel(value)}</Tag> },
    ...weeklyColumns,
    { title: "月销售", key: "monthSales", width: 130, align: "right", render: (_, row) => currencyMoney(rowSales(row)) },
    { title: "月广告", key: "monthAd", width: 130, align: "right", render: (_, row) => currencyMoney(rowAdSpend(row)) },
    { title: "ROI", key: "roi", width: 92, align: "right", render: (_, row) => <RoiTag value={safeRatio(rowSales(row), rowAdSpend(row))} /> },
    { title: "广告占比", key: "adRatio", width: 108, align: "right", render: (_, row) => <PercentText value={rowSales(row) > 0 ? rowAdSpend(row) / rowSales(row) : 0} /> },
    { title: "销售占比", key: "salesShare", width: 108, align: "right", render: (_, row) => <PercentText value={totalSales > 0 ? rowSales(row) / totalSales : 0} /> },
    {
      title: "备注",
      dataIndex: "remark",
      width: 180,
      render: (value, row) => (
        <Input
          size="small"
          value={value ?? ""}
          placeholder="备注"
          onChange={(event) => updateRow(row.channelId, (current) => ({ ...current, remark: event.target.value }))}
        />
      ),
    },
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
      scroll={{ x: 2600 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6}>
              <Typography.Text strong>合计</Typography.Text>
            </Table.Summary.Cell>
            {weekNumbers.flatMap((weekNumber, index) => {
              const sales = rows.reduce((total, row) => total + getWeek(row, weekNumber).salesAmountOriginal, 0);
              const adSpend = rows.reduce((total, row) => total + getWeek(row, weekNumber).adSpendOriginal, 0);
              return [
                <Table.Summary.Cell index={6 + index * 2} key={`sales-${weekNumber}`} align="right">
                  {money(sales)}
                </Table.Summary.Cell>,
                <Table.Summary.Cell index={7 + index * 2} key={`ad-${weekNumber}`} align="right">
                  {money(adSpend)}
                </Table.Summary.Cell>,
              ];
            })}
            <Table.Summary.Cell index={16} align="right"><Typography.Text strong>{currencyMoney(totalSales)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={17} align="right"><Typography.Text strong>{currencyMoney(totalAdSpend)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={18} align="right"><RoiTag value={totalRoi} /></Table.Summary.Cell>
            <Table.Summary.Cell index={19} align="right"><PercentText value={totalAdRatio} /></Table.Summary.Cell>
            <Table.Summary.Cell index={20} align="right">{percent(1)}</Table.Summary.Cell>
            <Table.Summary.Cell index={21} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}
