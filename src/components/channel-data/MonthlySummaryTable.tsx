"use client";

import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { channelTypeLabel, currencyMoney, PercentText, RoiTag, rowAdSpend, rowKey, rowSales, safeRatio } from "./channelDataUtils";
import type { ChannelDataRow } from "./channelDataTypes";

type MonthlySummaryTableProps = {
  rows: ChannelDataRow[];
  loading: boolean;
};

export default function MonthlySummaryTable({ rows, loading }: MonthlySummaryTableProps) {
  const totalSales = rows.reduce((total, row) => total + rowSales(row), 0);
  const totalAdSpend = rows.reduce((total, row) => total + rowAdSpend(row), 0);

  const columns: ColumnsType<ChannelDataRow> = [
    { title: "业务线", dataIndex: "businessLine", width: 150, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "平台", dataIndex: ["platform", "name"], width: 130, render: (value) => value || "-" },
    { title: "店铺/站点", dataIndex: ["store", "name"], width: 180, render: (value) => value || "-" },
    {
      title: "渠道名称",
      dataIndex: "channelName",
      width: 180,
      render: (value, row) => <span>{value} <span className="text-xs text-[var(--muted)]">/ {channelTypeLabel(row.channelType)}</span></span>,
    },
    { title: "月销售", key: "sales", width: 140, align: "right", sorter: (a, b) => rowSales(a) - rowSales(b), render: (_, row) => currencyMoney(rowSales(row)) },
    { title: "月广告", key: "ad", width: 140, align: "right", sorter: (a, b) => rowAdSpend(a) - rowAdSpend(b), render: (_, row) => currencyMoney(rowAdSpend(row)) },
    {
      title: "ROI",
      key: "roi",
      width: 110,
      align: "right",
      sorter: (a, b) => (safeRatio(rowSales(a), rowAdSpend(a)) ?? -1) - (safeRatio(rowSales(b), rowAdSpend(b)) ?? -1),
      render: (_, row) => <RoiTag value={safeRatio(rowSales(row), rowAdSpend(row))} />,
    },
    { title: "广告占比", key: "adRatio", width: 120, align: "right", render: (_, row) => <PercentText value={rowSales(row) > 0 ? rowAdSpend(row) / rowSales(row) : 0} /> },
    { title: "销售占比", key: "salesShare", width: 120, align: "right", render: (_, row) => <PercentText value={totalSales > 0 ? rowSales(row) / totalSales : 0} /> },
  ];

  return (
    <Table<ChannelDataRow>
      size="small"
      rowKey={rowKey}
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={false}
      scroll={{ x: 1260 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}><Typography.Text strong>合计</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Typography.Text strong>{currencyMoney(totalSales)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Typography.Text strong>{currencyMoney(totalAdSpend)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><RoiTag value={safeRatio(totalSales, totalAdSpend)} /></Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right"><PercentText value={totalSales > 0 ? totalAdSpend / totalSales : 0} /></Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right">100.0%</Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}
